#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage:
  install_template.sh --template nextjs|express --target PATH [options]

Options:
  --template NAME           Template to install: nextjs or express
  --target PATH             Project root to receive the files
  --base-path PATH          API base path to use. Default: /api/openrouter
  --api-key-var NAME        Env var name for API key. Default: OPENROUTER_API_KEY
  --site-url-var NAME       Env var name for site URL. Default: OPENROUTER_SITE_URL
  --app-name-var NAME       Env var name for app name. Default: OPENROUTER_APP_NAME
  --force                   Overwrite existing files
  --help                    Show this help
USAGE
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
SKILL_DIR=$(cd -- "$SCRIPT_DIR/.." && pwd)

TEMPLATE=""
TARGET=""
BASE_PATH="/api/openrouter"
API_KEY_VAR="OPENROUTER_API_KEY"
SITE_URL_VAR="OPENROUTER_SITE_URL"
APP_NAME_VAR="OPENROUTER_APP_NAME"
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --template) TEMPLATE=${2:-}; shift 2 ;;
    --target) TARGET=${2:-}; shift 2 ;;
    --base-path) BASE_PATH=${2:-}; shift 2 ;;
    --api-key-var) API_KEY_VAR=${2:-}; shift 2 ;;
    --site-url-var) SITE_URL_VAR=${2:-}; shift 2 ;;
    --app-name-var) APP_NAME_VAR=${2:-}; shift 2 ;;
    --force) FORCE=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

[[ -n "$TEMPLATE" ]] || { echo "--template is required" >&2; exit 1; }
[[ -n "$TARGET" ]] || { echo "--target is required" >&2; exit 1; }
[[ "$TEMPLATE" == "nextjs" || "$TEMPLATE" == "express" ]] || { echo "--template must be nextjs or express" >&2; exit 1; }
[[ "$BASE_PATH" == /* ]] || { echo "--base-path must start with /" >&2; exit 1; }

require_cmd python3
require_cmd cp
require_cmd mkdir
require_cmd chmod

mkdir -p -- "$TARGET"
TARGET=$(cd -- "$TARGET" && pwd)

python3 - "$SKILL_DIR" "$TARGET" "$TEMPLATE" "$BASE_PATH" "$API_KEY_VAR" "$SITE_URL_VAR" "$APP_NAME_VAR" "$FORCE" <<'PYINSTALL'
from pathlib import Path
import re
import shutil
import sys

skill, target = map(Path, sys.argv[1:3])
template, base, key, site, app, force = sys.argv[3:]
if any(part in {".", ".."} for part in base.split("/")):
    sys.exit("--base-path must not contain . or .. segments")
if not all(re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value) for value in (key, site, app)):
    sys.exit("Environment variable names must be valid identifiers")

src_layout = template == "nextjs" and (target / "src/app").is_dir()
code_root = target / "src" if src_layout else target
plan = []
for source in sorted((skill / "assets" / f"{template}-template").rglob("*")):
    if not source.is_file():
        continue
    relative = source.relative_to(skill / "assets" / f"{template}-template")
    if source.name == ".env.example":
        destination = target / ".env.openrouter.example"
    elif template == "express":
        destination = target / "openrouter" / relative
    elif relative.is_relative_to("app/api/openrouter"):
        destination = code_root / "app" / base.lstrip("/") / relative.relative_to("app/api/openrouter")
    else:
        destination = code_root / relative
    plan.append((source, destination))
for folder, destination in (("shared", code_root / "lib/openrouter"), ("tests", target / "openrouter-tests")):
    for source in sorted((skill / "assets" / folder).rglob("*")):
        if source.is_file():
            plan.append((source, destination / source.relative_to(skill / "assets" / folder)))

# Check the whole install before writing, including helpers and fixtures.
for _, destination in plan:
    for path in (destination, *destination.parents):
        if path == target:
            break
        if path.is_symlink():
            sys.exit(f"Refusing to write through symlink: {path}")
    if destination.is_dir() or (destination.exists() and force != "1"):
        sys.exit(f"Refusing to overwrite existing file: {destination}. Use --force to replace installed files.")
    if any(path.exists() and not path.is_dir() for path in destination.parents):
        sys.exit(f"Destination parent is not a directory: {destination}")

replacements = {
    "/api/openrouter": base,
    "OPENROUTER_API_KEY": key,
    "OPENROUTER_SITE_URL": site,
    "OPENROUTER_APP_NAME": app,
}
pattern = re.compile("|".join(map(re.escape, replacements)))
for source, destination in plan:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source.suffix in {".ts", ".tsx", ".mjs", ".sh", ".md", ".example"}:
        content = pattern.sub(lambda match: replacements[match[0]], source.read_text())
        if destination.suffix == ".ts" and destination.parent == target / "openrouter-tests":
            shared = "../src/lib/openrouter/" if src_layout else "../lib/openrouter/"
            content = content.replace("../shared/", shared)
        destination.write_text(content)
        shutil.copymode(source, destination)
    else:
        shutil.copy2(source, destination)
    print(f"Copied {destination}")
PYINSTALL

chmod +x "$TARGET/openrouter-tests/smoke-curl.sh" 2>/dev/null || true
chmod +x "$TARGET/openrouter-tests/smoke-catalogs.sh" 2>/dev/null || true

echo
echo "Installed OpenRouter $TEMPLATE template into $TARGET"
echo "Base path: $BASE_PATH"
echo "Env vars: $API_KEY_VAR, $SITE_URL_VAR, $APP_NAME_VAR"
