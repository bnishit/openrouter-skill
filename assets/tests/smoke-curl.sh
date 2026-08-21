#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage:
  smoke-curl.sh text [model]
  smoke-curl.sh structured [model]
  smoke-curl.sh tools [model]
  smoke-curl.sh tools-followup [model]
  smoke-curl.sh fallback [model]
  smoke-curl.sh image <image-path> [model]
  smoke-curl.sh image-generation [model]
  smoke-curl.sh pdf <pdf-path> [model]

Environment:
  OPENROUTER_API_KEY   Required
  OPENROUTER_SITE_URL  Optional, default http://localhost:3000
  OPENROUTER_APP_NAME  Optional, default OpenRouter Smoke Test
USAGE
}

[[ $# -ge 1 ]] || { usage >&2; exit 1; }
if [[ ${1:-} == --help || ${1:-} == -h ]]; then
  usage
  exit 0
fi
[[ -n "${OPENROUTER_API_KEY:-}" ]] || { echo "OPENROUTER_API_KEY is required" >&2; exit 1; }

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
FIXTURES_DIR="$SCRIPT_DIR/fixtures"
CASE=$1
shift || true
MODEL=${1:-}
endpoint=https://openrouter.ai/api/v1/chat/completions

site_url=${OPENROUTER_SITE_URL:-http://localhost:3000}
app_name=${OPENROUTER_APP_NAME:-OpenRouter Smoke Test}

base64_no_wrap() {
  if base64 --help 2>&1 | grep -q -- '-w'; then
    base64 -w 0 "$1"
  else
    base64 < "$1" | tr -d '\n'
  fi
}

json_from_fixture() {
  local fixture=$1
  python3 - "$fixture" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
print(json.dumps(json.loads(path.read_text())))
PY
}

json_with_replacements() {
  local fixture=$1
  shift
  python3 - "$fixture" "$@" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
text = path.read_text()
args = sys.argv[2:]
for item in args:
    key, value = item.split('=', 1)
    text = text.replace(key, value)
print(json.dumps(json.loads(text)))
PY
}

case "$CASE" in
  text)
    MODEL=${MODEL:-openai/gpt-4o-mini}
    payload=$(json_with_replacements "$FIXTURES_DIR/text-chat.json" "__MODEL__=$MODEL")
    ;;
  structured)
    MODEL=${MODEL:-openai/gpt-4o-mini}
    payload=$(json_with_replacements "$FIXTURES_DIR/structured-output.json" "__MODEL__=$MODEL")
    ;;
  tools)
    MODEL=${MODEL:-openai/gpt-4o-mini}
    payload=$(json_with_replacements "$FIXTURES_DIR/tool-calling-step1.json" "__MODEL__=$MODEL")
    ;;
  tools-followup)
    MODEL=${MODEL:-openai/gpt-4o-mini}
    payload=$(json_with_replacements "$FIXTURES_DIR/tool-calling-step3.json" "__MODEL__=$MODEL")
    ;;
  fallback)
    primary=${MODEL:-openai/gpt-4o-mini}
    payload=$(json_with_replacements "$FIXTURES_DIR/provider-fallback.json" "__PRIMARY_MODEL__=$primary")
    ;;
  image)
    image_path=${1:-}
    MODEL=${2:-google/gemini-2.5-flash}
    [[ -n "$image_path" ]] || { echo "image path is required" >&2; exit 1; }
    mime_type=image/png
    case "$image_path" in
      *.jpg|*.jpeg) mime_type=image/jpeg ;;
      *.webp) mime_type=image/webp ;;
      *.gif) mime_type=image/gif ;;
    esac
    image_data_url="data:${mime_type};base64,$(base64_no_wrap "$image_path")"
    payload=$(json_with_replacements "$FIXTURES_DIR/image-chat.template.json" "__MODEL__=$MODEL" "__IMAGE_DATA_URL__=$image_data_url")
    ;;
  image-generation)
    MODEL=${MODEL:-google/gemini-3.1-flash-image}
    payload=$(json_with_replacements "$FIXTURES_DIR/image-generation.json" "__MODEL__=$MODEL")
    endpoint=https://openrouter.ai/api/v1/images
    ;;
  pdf)
    pdf_path=${1:-}
    MODEL=${2:-google/gemini-2.5-flash}
    [[ -n "$pdf_path" ]] || { echo "pdf path is required" >&2; exit 1; }
    pdf_data_url="data:application/pdf;base64,$(base64_no_wrap "$pdf_path")"
    payload=$(json_with_replacements "$FIXTURES_DIR/pdf-chat.template.json" "__MODEL__=$MODEL" "__PDF_DATA_URL__=$pdf_data_url")
    ;;
  --help|-h)
    usage
    exit 0
    ;;
  *)
    echo "Unknown test case: $CASE" >&2
    usage >&2
    exit 1
    ;;
esac

curl -sS "$endpoint" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -H "HTTP-Referer: $site_url" \
  -H "X-OpenRouter-Title: $app_name" \
  -d "$payload"
