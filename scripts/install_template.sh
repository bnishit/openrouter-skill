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

copy_file() {
  local src=$1
  local dest=$2

  if [[ -e "$dest" && $FORCE -ne 1 ]]; then
    echo "Refusing to overwrite existing file: $dest" >&2
    echo "Re-run with --force to overwrite." >&2
    exit 1
  fi

  mkdir -p -- "$(dirname -- "$dest")"
  cp -- "$src" "$dest"
  echo "Copied $dest"
}

rewrite_tree() {
  local dir=$1
  local old=$2
  local new=$3

  python3 - "$dir" "$old" "$new" <<'PY'
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
old = sys.argv[2]
new = sys.argv[3]

suffixes = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".example", ".env"}
for path in root.rglob("*"):
    if not path.is_file():
        continue
    if path.name.startswith(".env") or path.suffix in suffixes:
        text = path.read_text()
        if old in text:
            path.write_text(text.replace(old, new))
PY
}

copy_shared_assets() {
  local lib_root=$1
  local tests_root=$2

  mkdir -p -- "$lib_root" "$tests_root"
  cp -R -- "$SKILL_DIR/assets/shared/." "$lib_root/"
  cp -R -- "$SKILL_DIR/assets/tests/." "$tests_root/"
  echo "Copied shared helpers to $lib_root"
  echo "Copied test fixtures to $tests_root"
}

install_nextjs() {
  local template_root="$SKILL_DIR/assets/nextjs-template"
  local app_root components_root lib_root tests_root route_root

  if [[ -d "$TARGET/src/app" ]]; then
    app_root="$TARGET/src/app"
    components_root="$TARGET/src/components"
    lib_root="$TARGET/src/lib/openrouter"
  else
    app_root="$TARGET/app"
    components_root="$TARGET/components"
    lib_root="$TARGET/lib/openrouter"
  fi

  tests_root="$TARGET/openrouter-tests"
  route_root="$app_root/${BASE_PATH#/}"

  copy_file "$template_root/app/api/openrouter/models/route.ts" "$route_root/models/route.ts"
  copy_file "$template_root/app/api/openrouter/providers/route.ts" "$route_root/providers/route.ts"
  copy_file "$template_root/app/api/openrouter/free-models/route.ts" "$route_root/free-models/route.ts"
  copy_file "$template_root/app/api/openrouter/generation/[id]/route.ts" "$route_root/generation/[id]/route.ts"
  copy_file "$template_root/app/api/openrouter/chat/route.ts" "$route_root/chat/route.ts"
  copy_file "$template_root/app/openrouter-image-lab/page.tsx" "$app_root/openrouter-image-lab/page.tsx"
  copy_file "$template_root/components/openrouter-model-picker.tsx" "$components_root/openrouter-model-picker.tsx"
  copy_file "$template_root/components/openrouter-image-workbench.tsx" "$components_root/openrouter-image-workbench.tsx"
  copy_file "$template_root/components/openrouter-ops-console.tsx" "$components_root/openrouter-ops-console.tsx"
  copy_file "$template_root/components/openrouter-streaming-chat.tsx" "$components_root/openrouter-streaming-chat.tsx"
  copy_file "$template_root/.env.example" "$TARGET/.env.openrouter.example"

  copy_shared_assets "$lib_root" "$tests_root"

  rewrite_tree "$TARGET" "/api/openrouter" "$BASE_PATH"
  rewrite_tree "$TARGET" "OPENROUTER_API_KEY" "$API_KEY_VAR"
  rewrite_tree "$TARGET" "OPENROUTER_SITE_URL" "$SITE_URL_VAR"
  rewrite_tree "$TARGET" "OPENROUTER_APP_NAME" "$APP_NAME_VAR"
}

install_express() {
  local template_root="$SKILL_DIR/assets/express-template"
  local api_root="$TARGET/openrouter"
  local lib_root="$TARGET/lib/openrouter"
  local tests_root="$TARGET/openrouter-tests"

  copy_file "$template_root/openrouter-routes.mjs" "$api_root/openrouter-routes.mjs"
  copy_file "$template_root/example-server.mjs" "$api_root/example-server.mjs"
  copy_file "$template_root/.env.example" "$TARGET/.env.openrouter.example"

  copy_shared_assets "$lib_root" "$tests_root"

  rewrite_tree "$TARGET" "/api/openrouter" "$BASE_PATH"
  rewrite_tree "$TARGET" "OPENROUTER_API_KEY" "$API_KEY_VAR"
  rewrite_tree "$TARGET" "OPENROUTER_SITE_URL" "$SITE_URL_VAR"
  rewrite_tree "$TARGET" "OPENROUTER_APP_NAME" "$APP_NAME_VAR"
}

case "$TEMPLATE" in
  nextjs) install_nextjs ;;
  express) install_express ;;
esac

chmod +x "$TARGET/openrouter-tests/smoke-curl.sh" 2>/dev/null || true
chmod +x "$TARGET/openrouter-tests/smoke-catalogs.sh" 2>/dev/null || true

echo
echo "Installed OpenRouter $TEMPLATE template into $TARGET"
echo "Base path: $BASE_PATH"
echo "Env vars: $API_KEY_VAR, $SITE_URL_VAR, $APP_NAME_VAR"
