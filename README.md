# VISION AI — versión corregida (local y futura Vercel)

Se conserva el dashboard React, simulaciones, cámara YOLO, alertas e historial.

## 1. Backend — Windows PowerShell

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Abre `backend/.env` y cambia `VISION_JWT_SECRET` por una clave aleatoria de **al menos 32 caracteres**. Para generar una:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Luego crea tu usuario y ejecuta el backend:

```powershell
python create_admin.py
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Comprueba http://localhost:8000/api/v1/health y http://localhost:8000/docs . Si `model_loaded` es false, revisa `model_error` (la autenticación puede funcionar aunque el modelo YOLO no cargue).

## 2. Frontend — otra terminal en la raíz

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Abre http://localhost:5173 e inicia sesión con el usuario creado.

**Importante:** los secretos de `backend/.env` nunca deben ponerse en el archivo `.env` de React. `VITE_API_URL` es pública y solo debe contener la dirección del backend.

## 3. Cuando publiques en Vercel

Publica el frontend en Vercel, configura `VITE_API_URL=https://TU-BACKEND` en Vercel y reconstruye el frontend. Aloja FastAPI+YOLO en un servidor aparte con HTTPS, persistencia de base de datos y variables de entorno `VISION_JWT_SECRET` y `VISION_CORS_ORIGINS=https://TU-FRONTEND.vercel.app`. No subas la base SQLite local ni los secretos al repositorio.

## Alcance

La cámara detecta clases generales del modelo YOLO; no valida EPP ni defectos industriales especializados. Los eventos se guardan en SQLite y la interfaz DEMO conserva sus funciones de simulación. Los tokens de acceso permanecen en memoria: al actualizar la página hay que iniciar sesión otra vez.
