import unittest
from ppe_rules import evaluate_ppe

CLASSES = {0: 'person', 1: 'helmet', 2: 'vest'}

def d(label, bbox):
    return {'label': label, 'bbox': bbox, 'confidence': .9}

class TestPPE(unittest.TestCase):
    def test_missing_model_classes_not_a_violation(self):
        r = evaluate_ppe([d('person', [.1,.1,.5,.8])], {0:'person'})
        self.assertFalse(r['checkable'])
        self.assertEqual(r['violations'], 0)
    def test_missing_both(self):
        r = evaluate_ppe([d('person',[.1,.1,.5,.8])], CLASSES)
        self.assertEqual(r['violations'],1)
        self.assertEqual(r['workers'][0]['missing'], ['casco','chaleco'])
    def test_compliant(self):
        r = evaluate_ppe([d('person',[.1,.1,.5,.8]),d('helmet',[.27,.12,.1,.1]),d('vest',[.2,.4,.3,.2])], CLASSES)
        self.assertEqual(r['violations'],0)
        self.assertTrue(r['workers'][0]['compliant'])
    def test_unrelated_ppe_not_associated(self):
        r = evaluate_ppe([d('person',[.1,.1,.3,.8]),d('helmet',[.8,.12,.1,.1]),d('vest',[.8,.4,.1,.2])], CLASSES)
        self.assertEqual(r['violations'],1)

if __name__ == '__main__': unittest.main()
