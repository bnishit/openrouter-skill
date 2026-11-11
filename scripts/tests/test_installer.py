import subprocess
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[2]


class InstallerTests(unittest.TestCase):
    def install(self, target, template="nextjs", *args):
        return subprocess.run(["bash", str(SKILL / "scripts/install_template.sh"), "--template", template, "--target", str(target), *args], capture_output=True, text=True)

    def test_installs_both_layouts_without_rewriting_existing_app(self):
        for template, src in [("nextjs", False), ("nextjs", True), ("express", False)]:
            with self.subTest(template=template, src=src), tempfile.TemporaryDirectory() as directory:
                target = Path(directory)
                if src:
                    (target / "src/app").mkdir(parents=True)
                existing = target / "existing.ts"
                original = 'const route = "/api/openrouter"; const key = "OPENROUTER_API_KEY";'
                existing.write_text(original)
                result = self.install(target, template, "--base-path", "/api/ai", "--api-key-var", "MY_AI_KEY")
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(existing.read_text(), original)
                code = target / "src" if src else target
                route = code / "app/api/ai/chat/route.ts" if template == "nextjs" else target / "openrouter/openrouter-routes.mjs"
                self.assertIn("MY_AI_KEY", route.read_text())
                self.assertNotIn("OPENROUTER_API_KEY", route.read_text())
                tests = target / "openrouter-tests/openrouter-image-api.test.ts"
                shared = "../src/lib/openrouter/" if src else "../lib/openrouter/"
                self.assertIn(shared, tests.read_text())
                self.assertTrue((code / "lib/openrouter/stream-openrouter-sse.ts").exists())
                again = self.install(target, template)
                self.assertNotEqual(again.returncode, 0)
                forced = self.install(target, template, "--force")
                self.assertEqual(forced.returncode, 0, forced.stderr)
                self.assertEqual(existing.read_text(), original)

    def test_helper_collision_leaves_all_files_untouched(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            helper = target / "lib/openrouter/stream-openrouter-sse.ts"
            helper.parent.mkdir(parents=True)
            helper.write_text("keep")
            result = self.install(target)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(helper.read_text(), "keep")
            self.assertFalse((target / "app").exists())

    def test_symlink_and_parent_traversal_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as outside:
            target = Path(directory)
            (target / "app").symlink_to(outside, target_is_directory=True)
            self.assertNotEqual(self.install(target, "nextjs", "--force").returncode, 0)
            self.assertEqual(list(Path(outside).iterdir()), [])
            self.assertNotEqual(self.install(target, "nextjs", "--base-path", "/../escape").returncode, 0)


if __name__ == "__main__":
    unittest.main()
