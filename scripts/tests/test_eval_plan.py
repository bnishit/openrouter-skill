import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SKILL = Path(__file__).resolve().parents[2]


class EvalPlanTests(unittest.TestCase):
    def test_default_mode_plans_without_model_calls_or_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'not-created'
            result = subprocess.run([sys.executable, str(SKILL / 'evals/run.py'), '--output', str(output)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            plan = json.loads(result.stdout)
            self.assertEqual(plan['mode'], 'plan')
            self.assertEqual(plan['model_calls'], 90)
            self.assertFalse(output.exists())

    def test_holdout_mode_is_separate_and_results_cannot_write_inside_skill(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([sys.executable, str(SKILL / 'evals/run.py'), '--output', directory, '--phase', 'holdout'], capture_output=True, text=True)
            plan = json.loads(result.stdout)
            self.assertEqual(plan['model_calls'], 27)
            self.assertTrue(all(name.startswith('holdout-') for name in plan['cases']))
        result = subprocess.run([sys.executable, str(SKILL / 'evals/run.py'), '--output', str(SKILL / 'raw-eval-results')], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((SKILL / 'raw-eval-results').exists())


if __name__ == '__main__':
    unittest.main()
