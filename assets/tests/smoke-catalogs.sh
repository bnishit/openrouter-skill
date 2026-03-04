#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage:
  smoke-catalogs.sh models
  smoke-catalogs.sh user-models
  smoke-catalogs.sh providers
  smoke-catalogs.sh free-models
  smoke-catalogs.sh image-models
  smoke-catalogs.sh generation <generation-id>

Environment:
  OPENROUTER_API_KEY   Required
  OPENROUTER_SITE_URL  Optional, default http://localhost:3000
  OPENROUTER_APP_NAME  Optional, default OpenRouter Catalog Smoke Test
USAGE
}

[[ $# -ge 1 ]] || { usage >&2; exit 1; }
if [[ ${1:-} == --help || ${1:-} == -h ]]; then
  usage
  exit 0
fi

[[ -n "${OPENROUTER_API_KEY:-}" ]] || { echo "OPENROUTER_API_KEY is required" >&2; exit 1; }

CASE=$1
shift || true

site_url=${OPENROUTER_SITE_URL:-http://localhost:3000}
app_name=${OPENROUTER_APP_NAME:-OpenRouter Catalog Smoke Test}

tmp_body=$(mktemp /tmp/openrouter-catalog-body.XXXXXX.json)
cleanup() {
  rm -f "$tmp_body"
}
trap cleanup EXIT

curl_json() {
  local url=$1
  local status

  status=$(
    curl -sS \
      -o "$tmp_body" \
      -w "%{http_code}" \
      "$url" \
      -H "Authorization: Bearer $OPENROUTER_API_KEY" \
      -H "Accept: application/json" \
      -H "HTTP-Referer: $site_url" \
      -H "X-OpenRouter-Title: $app_name"
  )

  if [[ ! "$status" =~ ^2 ]]; then
    echo "Request failed with status $status" >&2
    cat "$tmp_body" >&2
    exit 1
  fi

  cat "$tmp_body"
}

case "$CASE" in
  models)
    curl_json "https://openrouter.ai/api/v1/models"
    ;;
  user-models)
    curl_json "https://openrouter.ai/api/v1/models/user"
    ;;
  providers)
    curl_json "https://openrouter.ai/api/v1/providers"
    ;;
  free-models)
    json=$(curl_json "https://openrouter.ai/api/v1/models")
    OPENROUTER_MODELS_JSON="$json" python3 - <<'PY'
import json
import os

payload = json.loads(os.environ["OPENROUTER_MODELS_JSON"])
data = payload.get("data", [])
free_models = []

for item in data:
    pricing = item.get("pricing") or {}
    values = [pricing.get(key) for key in ("prompt", "completion", "request", "image")]
    values = [value for value in values if value is not None]
    if not values:
        continue
    if all(value == "0" for value in values):
        free_models.append(
            {
                "id": item.get("id"),
                "name": item.get("name"),
                "pricing": pricing,
            }
        )

print(json.dumps({"data": free_models}, indent=2))
PY
    ;;
  image-models)
    json=$(curl_json "https://openrouter.ai/api/v1/models")
    OPENROUTER_MODELS_JSON="$json" python3 - <<'PY'
import json
import os

payload = json.loads(os.environ["OPENROUTER_MODELS_JSON"])
data = payload.get("data", [])
image_models = []

for item in data:
    architecture = item.get("architecture") or {}
    output_modalities = architecture.get("output_modalities") or []
    if "image" not in output_modalities:
        continue
    image_models.append(
        {
            "id": item.get("id"),
            "name": item.get("name"),
            "output_modalities": output_modalities,
            "pricing": item.get("pricing") or {},
        }
    )

print(json.dumps({"data": image_models}, indent=2))
PY
    ;;
  generation)
    generation_id=${1:-}
    [[ -n "$generation_id" ]] || { echo "generation id is required" >&2; exit 1; }
    curl_json "https://openrouter.ai/api/v1/generation?id=$generation_id"
    ;;
  *)
    echo "Unknown test case: $CASE" >&2
    usage >&2
    exit 1
    ;;
esac
