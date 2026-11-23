
from functools import lru_cache
from pathlib import Path

from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parents[1]

MODEL_PATHS = {
    "general": BASE_DIR / "yolo11n.pt",
    "industrial": BASE_DIR / "models" / "weights" / "ppe.pt",
    "warehouse": BASE_DIR / "models" / "weights" / "warehouse.pt",
    "quality": BASE_DIR / "models" / "weights" / "quality.pt",
    "retail": BASE_DIR / "yolo11n.pt",
}

SCENARIOS = ("industrial", "warehouse", "quality", "retail")


def model_status():
    return {
        name: {
            "installed": path.is_file(),
            "filename": path.name,
        }
        for name, path in MODEL_PATHS.items()
    }


@lru_cache(maxsize=5)
def load_model(name: str):
    if name not in MODEL_PATHS:
        raise ValueError(f"Modelo desconocido: {name}")

    path = MODEL_PATHS[name]

    if not path.is_file():
        raise FileNotFoundError(
            f"No está instalado el modelo {path.name}"
        )

    return YOLO(str(path))
