import unittest
from unittest.mock import patch
from scenario_rules import evaluate, inside_polygon

def det(label, bbox): return {'label':label,'bbox':bbox,'confidence':.9}

class TestScenarioRules(unittest.TestCase):
    def test_polygon(self):
        p = [[.5,.5],[.9,.5],[.9,.9],[.5,.9]]
        self.assertTrue(inside_polygon((.7,.7),p))
        self.assertFalse(inside_polygon((.2,.2),p))
    def test_warehouse_requires_model(self):
        r=evaluate('warehouse',[det('person',[.7,.3,.1,.3])],{0:'person'},False)
        self.assertFalse(r['checkable']);self.assertEqual(r['alerts'],0)
    def test_warehouse_intrusion(self):
        r=evaluate('warehouse',[det('forklift',[.7,.4,.15,.3])],{0:'box',1:'pallet',2:'forklift'},True)
        self.assertTrue(r['checkable']);self.assertEqual(r['alerts'],1)
    def test_quality_no_model(self):
        r=evaluate('quality',[],{0:'person'},False)
        self.assertFalse(r['checkable']);self.assertEqual(r['alerts'],0)
    def test_quality_defect(self):
        r=evaluate('quality',[det('crack',[.2,.2,.2,.2])],{0:'crack',1:'product'},True)
        self.assertEqual(r['classification'],'NO CONFORME');self.assertEqual(r['alerts'],1)
    def test_retail_people(self):
        with patch.dict('os.environ',{'VISION_RETAIL_MAX_PEOPLE':'2'}):
            r=evaluate('retail',[det('person',[.1,.1,.1,.5]),det('person',[.4,.1,.1,.5])],{0:'person'})
        self.assertTrue(r['checkable']);self.assertEqual(r['alerts'],1)
    def test_retail_without_person(self):
        r=evaluate('retail',[],{0:'tv'})
        self.assertFalse(r['checkable'])

if __name__=='__main__': unittest.main()
