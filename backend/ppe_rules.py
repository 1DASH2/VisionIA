"""Conservative per-frame PPE checks for specialized Ultralytics models.

Only evaluates a worker when a person bounding box is detected. Missing PPE is
an observation, not proof: callers must confirm persistence over multiple frames.
Unknown model class names are NOT interpreted as absent PPE.
"""

PERSON = {"person", "persona", "worker", "trabajador"}
HELMET = {"helmet", "hardhat", "hard_hat", "hard hat", "safety helmet", "casco"}
VEST = {"vest", "safety vest", "reflective vest", "chaleco", "chaleco reflectante"}


def kind(label):
    value = str(label).lower().strip().replace("-", "_")
    if value in PERSON: return "person"
    if value in HELMET: return "helmet"
    if value in VEST: return "vest"
    return None


def _center(box):
    x, y, w, h = box
    return x + w / 2, y + h / 2


def evaluate_ppe(detections, names):
    """Return checkable=False unless person, helmet AND vest classes exist.

    Association uses conservative approximate regions within a person box;
    this is a prototype heuristic, not a calibrated safety certification.
    """
    supported = {kind(v) for v in names.values()} if isinstance(names, dict) else {kind(v) for v in names}
    supported.discard(None)
    if not {"person", "helmet", "vest"}.issubset(supported):
        return {"checkable": False, "reason": "El modelo no contiene las tres clases necesarias: persona, casco y chaleco.", "workers": [], "violations": 0}
    people = [d for d in detections if kind(d['label']) == 'person']
    helmets = [d for d in detections if kind(d['label']) == 'helmet']
    vests = [d for d in detections if kind(d['label']) == 'vest']
    workers=[]
    for i,p in enumerate(people):
        x,y,w,h=p['bbox']
        def associated(items, top, bottom):
            for item in items:
                cx,cy=_center(item['bbox'])
                if x <= cx <= x+w and y+top*h <= cy <= y+bottom*h:
                    return True
            return False
        helmet=associated(helmets,0,.45)
        vest=associated(vests,.18,.85)
        workers.append({"index":i,"bbox":p['bbox'],"helmet":helmet,"vest":vest,"compliant":helmet and vest,"missing":[n for n,ok in (("casco",helmet),("chaleco",vest)) if not ok]})
    return {"checkable":True,"reason":"Evaluación espacial aproximada; confirmar incumplimiento en varios fotogramas.","workers":workers,"violations":sum(not p['compliant'] for p in workers)}
