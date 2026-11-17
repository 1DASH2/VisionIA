# VISION AI Enterprise — Web + Backend

Plataforma de demostración integrada: dashboard, cuatro escenarios con muñecos interactivos en movimiento, cámara real con inferencia YOLO mediante FastAPI, alertas, historial, CSV y configuración. **No hay carga manual de imágenes en la interfaz.**

## Requisitos

- Node.js 20+ y npm
- Python 3.11 recomendado
- Webcam y permiso de cámara en `localhost`
- Internet durante la primera instalación/descarga de pesos YOLO

## Backend (terminal 1, PowerShell)

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Comprobar `http://localhost:8000/api/v1/health`: `model_loaded` debe ser `true`. La primera vez Ultralytics puede descargar `yolo11n.pt`. Los eventos se guardan en SQLite `backend/vision_events.db`. Los fotogramas enviados al servidor local se procesan en memoria y no se guardan.

## Frontend (terminal 2)

```powershell
npm install
npm run dev
```

Abrir `http://localhost:5173` → **Análisis visual**. Elegir escenario y modalidad **Simulación interactiva** o **Cámara real + IA**. La simulación tiene reproducción, pausa y velocidad. En cámara real se ven cuadros actualizados por inferencia sobre fotogramas capturados continuamente. Usa **Registrar observación** para guardar un evento del backend. La simulación permite registrar un evento desde el panel lateral.

Si el backend corre en otra dirección, crea `.env` con `VITE_API_URL=http://localhost:8000` (o tu dirección) y reinicia Vite.

## Alcance honesto

- La webcam usa YOLO preentrenado en clases generales. No hay modelo industrial específico de cascos, chalecos, defectos o pallets.
- Los cuatro escenarios son escenas vectoriales animadas con objetos y cuadros sincronizados por estado; **no son inferencias de IA sobre los muñecos**.
- El dashboard/historial/alertas heredados del prototipo usan LocalStorage; el backend SQLite dispone de `/api/v1/events` y `/api/v1/dashboard` y recibe nuevos eventos, pero la sincronización completa de la interfaz con SQLite sigue pendiente.
- El endpoint recibe fotogramas JPEG automáticamente desde la webcam, **no hay selector ni subida manual de imágenes**.
- No hay autenticación ni controles empresariales de producción. No utilizar para decisiones de seguridad.

## API

`GET /api/v1/health`, `POST /api/v1/live/frame?scenario=industrial&confidence=0.35` (body JPEG del flujo en vivo), `GET /api/v1/events`, `POST /api/v1/events`, `PATCH /api/v1/events/{id}`, `GET /api/v1/dashboard`.

## Próximos pasos para producción

Integrar modelo EPP/zonas/defectos entrenado con datos representativos, seguimiento de IDs y reglas de zonas; unificar repositorio backend y UI, roles/autenticación, HTTPS, auditoría y pruebas.
# VisionIA
