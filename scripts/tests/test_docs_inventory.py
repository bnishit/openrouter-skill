import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "check_openrouter_docs.py"
spec = importlib.util.spec_from_file_location("docs_checker", SCRIPT)
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class InventoryTests(unittest.TestCase):
    def test_new_feature_is_reported_even_when_old_checks_still_pass(self):
        baseline = {"pages": ["quickstart.md"], "operations": ["POST /chat/completions"]}
        current = checker.build_inventory(
            ["- [Start](https://openrouter.ai/docs/quickstart.md)\n- [New](https://openrouter.ai/docs/guides/new-feature.md)"],
            {"paths": {"/chat/completions": {"post": {}}, "/new-feature": {"post": {}}}},
        )
        results = checker.compare_inventory(baseline, current)
        self.assertTrue(any(status == "WARN" and "guides/new-feature.md" in message for status, _, message in results))
        self.assertTrue(any(status == "WARN" and "POST /new-feature" in message for status, _, message in results))

    def test_removed_operation_and_new_method_on_existing_path_are_detected(self):
        results = checker.compare_inventory(
            {"pages": ["quickstart.md"], "operations": ["GET /tools", "POST /old"]},
            {"pages": ["quickstart.md"], "operations": ["GET /tools", "POST /tools"]},
        )
        self.assertIn(("WARN", "inventory", "new operations: POST /tools"), results)
        self.assertIn(("WARN", "inventory", "removed operations: POST /old"), results)

    def test_reordered_duplicate_links_and_non_operations_do_not_create_drift(self):
        page = "- [Start](https://openrouter.ai/docs/quickstart.md)"
        current = checker.build_inventory([page + "\n" + page], {"paths": {"/models": {"parameters": [], "get": {}}}})
        self.assertEqual(checker.compare_inventory(current, current), [
            ("PASS", "inventory", "1 pages match the reviewed inventory"),
            ("PASS", "inventory", "1 operations match the reviewed inventory"),
        ])

    def test_missing_index_or_spec_is_a_failure_not_an_empty_success(self):
        for indexes, api in [(["<html>not an index</html>"], {"paths": {"/models": {"get": {}}}}),
                             (["[Start](https://openrouter.ai/docs/quickstart.md)"], {})]:
            with self.subTest(indexes=indexes, api=api), self.assertRaises(ValueError):
                checker.build_inventory(indexes, api)

    def test_known_endpoint_with_missing_method_is_flagged(self):
        with patch.object(checker, "fetch_text", return_value='{"paths":{"/chat/completions":{"get":{}}}}'):
            result = checker.check_openapi(1)
        self.assertIn(("WARN", "openapi", "POST /chat/completions: missing"), result)


if __name__ == "__main__":
    unittest.main()
