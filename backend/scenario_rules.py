"""Deterministic, conservative per-frame business rules for live inference.

A rule is evaluated only when the detector exposes the necessary classes.
Missing objects/classes are not silently treated as violations.
"""
import json
import os
from ppe_rules import evaluate_ppe, kind

PERSON = {'person', 'persona', 'worker', 'trabajador'}
BOX = {'box', 'cardboard box', 'caja', 'package', 'parcel'}
PALLET = {'pallet', 'palet', 'paleta'}
FORKLIFT = {'forklift', 'montacargas', 'fork lift'}
DEFECT = {'defect', 'defecto', 'crack', 'grieta', 'scratch', 'rayón', 'scratch mark', 'stain', 'mancha', 'deformation', 'deformación', 'missing component', 'missing label', 'wrong label'}
PRODUCT = {'product', 'producto', 'item'}

def normalized(label):
    return str(label).strip().lower().replace('_', ' ').replace('-', ' ')

def nameset(names):
    return {normalized(x) for x in (names.values() if isinstance(names, dict) else names)}

def inside_polygon(point, polygon):
    x, y = point
    inside = False
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside

def roi():
    """Normalized image polygon, configurable per camera via env."""
    try:
        polygon = json.loads(os.getenv('VISION_WAREHOUSE_ROI', '[[0.65,0.2],[0.98,0.2],[0.98,0.98],[0.65,0.98]]'))
        if len(polygon) < 3 or any(len(p) != 2 or any(not 0 <= float(v) <= 1 for v in p) for p in polygon):
            raise ValueError('ROI inválida')
        return polygon
    except (ValueError, TypeError):
        return [[0.65,0.2],[0.98,0.2],[0.98,0.98],[0.65,0.98]]

def evaluate(scenario, detections, names, specialized=False):
    available = nameset(names)
    if scenario == 'industrial':
        ppe = evaluate_ppe(detections, names) if specialized else {'checkable':False,'reason':'Se requiere modelo especializado EPP con clases persona, casco y chaleco.','workers':[],'violations':0}
        return {'checkable':ppe['checkable'], 'summary':f"{ppe['violations']} posibles incumplimientos EPP" if ppe['checkable'] else ppe['reason'], 'alerts':ppe['violations'], 'ppe':ppe}
    if scenario == 'warehouse':
        required = PERSON | BOX | PALLET | FORKLIFT
        checkable = specialized and bool(available & BOX) and bool(available & PALLET) and bool(available & FORKLIFT)
        polygon = roi()
        intruders = []
        if checkable:
            for d in detections:
                if normalized(d['label']) not in required:
                    continue
                x,y,w,h = d['bbox']
                if inside_polygon((x+w/2,y+h), polygon):
                    intruders.append({'label':d['label'],'bbox':d['bbox']})
        return {'checkable':checkable,'summary':f'{len(intruders)} objetos en zona restringida' if checkable else 'Requiere modelo warehouse.pt con cajas, pallets y montacargas.', 'alerts':len(intruders),'roi':polygon,'intruders':intruders}
    if scenario == 'quality':
        supported_defects = bool(available & DEFECT)
        checkable = specialized and supported_defects
        defects = [d for d in detections if normalized(d['label']) in DEFECT] if checkable else []
        return {'checkable':checkable,'summary':f'{len(defects)} defectos detectados; {"NO CONFORME" if defects else "sin defecto detectado (revisión recomendada)"}' if checkable else 'Requiere quality.pt entrenado para defectos del producto elegido.', 'alerts':len(defects),'classification':'NO CONFORME' if defects else ('SIN DEFECTO DETECTADO' if checkable else 'NO EVALUABLE')}
    if scenario == 'retail':
        checkable = bool(available & PERSON)
        count = sum(normalized(d['label']) in PERSON for d in detections)
        limit = max(1, int(os.getenv('VISION_RETAIL_MAX_PEOPLE', '3')))
        return {'checkable':checkable,'summary':f'{count} personas detectadas; umbral de ocupación {limit}' if checkable else 'El modelo no detecta personas.', 'alerts':int(count >= limit) if checkable else 0,'people':count,'limit':limit}
    raise ValueError('Escenario inválido')
