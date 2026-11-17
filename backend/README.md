# VISION AI — API de inferencia real (fase 1)

Desde PowerShell, dentro de `backend`:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Visita http://127.0.0.1:8000/docs y prueba `POST /api/v1/detect` con una imagen JPG/PNG. El modelo YOLO se descarga la primera vez (requiere internet). `GET /api/v1/health` indica si cargó.

**Alcance real:** detección de clases genéricas reconocidas por el modelo base. No detecta EPP industrial, pallets o defectos de fabricación de forma confiable sin modelos especializados. No hay tracking persistente, base de datos, autenticación ni alertas de producción en esta fase. La webcam del frontend sigue utilizando COCO-SSD hasta conectar explícitamente esta API.

**Privacidad:** la imagen enviada se procesa en memoria; no se guarda en disco por esta API. Para producción se necesitan autenticación, límites de tasa, auditoría, protección de datos y pruebas.
