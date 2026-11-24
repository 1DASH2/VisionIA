"""VISION AI live inference API. Frames are ephemeral; only event metadata is stored."""
from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path
import os, time, sqlite3, threading, uuid
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from scenario_rules import evaluate
from models.registry import (
    SCENARIOS,
    load_model,
    model_status,
)
from fastapi import Depends
from pydantic import BaseModel
from auth import (
    init_auth_db,
    authenticate,
    create_token,
    current_user,
)

MODEL_NAME = os.getenv('VISION_MODEL', 'yolo11n.pt')
DB = os.getenv('VISION_DB', 'vision_events.db')
model = None
model_error = None
lock = threading.Lock()

def connect():
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    db.execute('CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, scenario TEXT NOT NULL, source TEXT NOT NULL, severity TEXT NOT NULL, message TEXT NOT NULL, detections INTEGER NOT NULL, status TEXT NOT NULL DEFAULT "Nueva")')
    db.commit()
    return db

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, model_error
    with connect(): pass
    init_auth_db()
    try:
        model = load_model("general")
    except Exception as exc:
        model_error = str(exc)
    yield

app = FastAPI(
    title='VISION AI Enterprise — Live API', 
    version='2.0.0', 
    lifespan=lifespan
    )

# Permite los puertos de Vite en localhost y orígenes explícitos para producción.
allowed_origins = [origin.strip() for origin in os.getenv("VISION_CORS_ORIGINS", "").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/v1/auth/login")
def login(data: LoginRequest):
    user = authenticate(
        data.username,
        data.password,
    )

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Usuario o contraseña incorrectos",
        )

    token = create_token(user)

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": 7200,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
        },
    }


@app.get("/api/v1/auth/me")
def me(user: dict = Depends(current_user)):
    return {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
    }


@app.get("/api/v1/health")
def health():
    return {
        "service": "VISION AI",
        "mode": "LIVE",
        "model_loaded": model is not None,
        "model": MODEL_NAME,
        "model_error": model_error,
    }

@app.get("/api/v1/models", dependencies=[Depends(current_user)])
def get_models():
    return {
        "models": model_status()
    }


@app.post('/api/v1/live/frame', dependencies=[Depends(current_user)])
async def frame(request: Request, scenario: str = 'industrial', confidence: float = .35):
    if scenario not in ('industrial','warehouse','quality','retail'):
        raise HTTPException(422,'Escenario inválido')
    if not .05 <= confidence <= .99:
        raise HTTPException(422,'Umbral inválido')
    try:
        available = model_status()

        if available[scenario]["installed"]:
            selected_model = load_model(scenario)
            model_type = "SPECIALIZED" if scenario in (
        "industrial", "warehouse", "quality"
    ) else "GENERAL"
        else:
            selected_model = load_model("general")
            model_type = "GENERAL_FALLBACK"
            
    except FileNotFoundError as exc:
        raise HTTPException(
        status_code=503,
        detail=str(exc)
    ) from exc
    except Exception as exc:
        raise HTTPException(
        status_code=503,
        detail="No se pudo cargar el modelo"
    ) from exc
    if request.headers.get('content-type','').split(';')[0] != 'image/jpeg':
        raise HTTPException(415,'Se requiere un fotograma JPEG')
    raw = await request.body()
    if len(raw) > 1_500_000:
        raise HTTPException(413,'Fotograma demasiado grande')
    try:
        img = Image.open(BytesIO(raw)).convert('RGB')
        if img.width * img.height > 2_000_000:
            raise HTTPException(413,'Resolución demasiado grande')
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400,'Fotograma inválido')
    start = time.perf_counter()
    try:
        with lock:
            result = selected_model.predict(
                img,
                conf=confidence,
                verbose=False
            )[0]
    except Exception as exc:
        raise HTTPException(500,'Error de inferencia') from exc
    detections=[]
    for box in result.boxes:
        x1,y1,x2,y2 = (float(v) for v in box.xyxy[0].tolist())
        cls = int(box.cls[0].item())
        detections.append({'label':str(result.names[cls]),'confidence':round(float(box.conf[0].item()),4),'bbox':[x1/img.width,y1/img.height,(x2-x1)/img.width,(y2-y1)/img.height]})
    rules = evaluate(scenario, detections, result.names, model_type == "SPECIALIZED")
    ppe = rules.get("ppe")
    return {
    "ppe": ppe,
    "rules": rules,
    "mode": "REAL",
    "scenario": scenario,
    "model": (
        model_status()[scenario]["filename"]
        if model_type == "SPECIALIZED"
        else model_status()["general"]["filename"]
    ),
    "model_type": model_type,
    "detections": detections,
    "elapsed_ms": round(
        (time.perf_counter() - start) * 1000, 1
    ),
    "width": img.width,
    "height": img.height,
    "note": (
        "Inferencia real con modelo general COCO. "
        "Las detecciones industriales especializadas "
        "requieren modelos entrenados."
        if model_type != "SPECIALIZED"
        else "Inferencia con modelo especializado."
    ),
}

@app.get('/api/v1/events', dependencies=[Depends(current_user)])
def events(limit: int = 100):
    with connect() as db:
        return [dict(r) for r in db.execute('SELECT * FROM events ORDER BY timestamp DESC LIMIT ?', (max(1,min(limit,500)),))]

@app.post('/api/v1/events', dependencies=[Depends(current_user)])
async def add_event(request: Request):
    data=await request.json()
    scenario=data.get('scenario')
    if scenario not in ('industrial','warehouse','quality','retail'):
        raise HTTPException(422,'Escenario inválido')
    source=data.get('source')
    if source not in ('SIMULACION','CAMARA_REAL'):
        raise HTTPException(422,'Origen inválido')
    event={'id':str(uuid.uuid4()),'timestamp':datetime.now(timezone.utc).isoformat(),'scenario':scenario,'source':source,'severity':str(data.get('severity','Media'))[:20], 'message':str(data.get('message','Evento observado'))[:300], 'detections':max(0,int(data.get('detections',0))),'status':'Nueva'}
    with connect() as db:
        db.execute('INSERT INTO events (id,timestamp,scenario,source,severity,message,detections,status) VALUES (:id,:timestamp,:scenario,:source,:severity,:message,:detections,:status)',event)
        db.commit()
    return event

@app.patch('/api/v1/events/{event_id}', dependencies=[Depends(current_user)])
async def review(event_id: str, request: Request):
    status=(await request.json()).get('status')
    if status not in ('Nueva','Revisada','Cerrada'):
        raise HTTPException(422,'Estado inválido')
    with connect() as db:
        cursor=db.execute('UPDATE events SET status=? WHERE id=?',(status,event_id))
        db.commit()
        if not cursor.rowcount: raise HTTPException(404,'Evento no encontrado')
    return {'id':event_id,'status':status}

@app.get('/api/v1/dashboard', dependencies=[Depends(current_user)])
def dashboard():
    with connect() as db:
        total=db.execute('SELECT COUNT(*) FROM events').fetchone()[0]
        open_count=db.execute('SELECT COUNT(*) FROM events WHERE status="Nueva"').fetchone()[0]
    return {'events':total,'open_alerts':open_count}
