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
  smoke-catalogs.sh image-endpoints <model-id>
  smoke-catalogs.sh low-cost-models
  smoke-catalogs.sh model <model-id>
  smoke-catalogs.sh model-count
  smoke-catalogs.sh endpoints <model-id>
  smoke-catalogs.sh discounts <model-id>
  smoke-catalogs.sh generation <generation-id>
  smoke-catalogs.sh key
  smoke-catalogs.sh credits
  smoke-catalogs.sh activity [YYYY-MM-DD]

Environment:
  OPENROUTER_API_KEY   Required
  OPENROUTER_MANAGEMENT_KEY  Required only for account-wide credits
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
    curl_json "https://openrouter.ai/api/v1/images/models"
    ;;
  image-endpoints)
    model_id=${1:-}
    [[ "$model_id" == */* ]] || { echo "model id must use author/slug format" >&2; exit 1; }
    curl_json "https://openrouter.ai/api/v1/images/models/$model_id/endpoints"
    ;;
  low-cost-models)
    curl_json "https://openrouter.ai/api/v1/models?sort=pricing-low-to-high&output_modalities=text"
    ;;
  model)
    model_id=${1:-}
    [[ "$model_id" == */* ]] || { echo "model id must use author/slug format" >&2; exit 1; }
    curl_json "https://openrouter.ai/api/v1/model/$model_id"
    ;;
  model-count)
    curl_json "https://openrouter.ai/api/v1/models/count?output_modalities=text"
    ;;
  endpoints)
    model_id=${1:-}
    [[ "$model_id" == */* ]] || { echo "model id must use author/slug format" >&2; exit 1; }
    curl_json "https://openrouter.ai/api/v1/models/$model_id/endpoints"
    ;;
  discounts)
    model_id=${1:-}
    [[ "$model_id" == */* ]] || { echo "model id must use author/slug format" >&2; exit 1; }
    json=$(curl_json "https://openrouter.ai/api/v1/models/$model_id/endpoints")
    OPENROUTER_ENDPOINTS_JSON="$json" python3 - <<'PY'
import json
import os

payload = json.loads(os.environ["OPENROUTER_ENDPOINTS_JSON"])
model_id = (payload.get("data") or {}).get("id")
discounted = []

for endpoint in (payload.get("data") or {}).get("endpoints", []):
    pricing = endpoint.get("pricing") or {}
    discount = pricing.get("discount")
    if not isinstance(discount, (int, float)) or not 0 < discount < 1:
        continue
    discounted.append(
        {
            "model_id": model_id,
            "provider": endpoint.get("provider_name"),
            "tag": endpoint.get("tag"),
            "discount": discount,
            "effective_pricing": pricing,
        }
    )

print(json.dumps({"data": discounted}, indent=2))
PY
    ;;
  generation)
    generation_id=${1:-}
    [[ -n "$generation_id" ]] || { echo "generation id is required" >&2; exit 1; }
    curl_json "https://openrouter.ai/api/v1/generation?id=$generation_id"
    ;;
  key)
    curl_json "https://openrouter.ai/api/v1/key"
    ;;
  credits)
    [[ -n "${OPENROUTER_MANAGEMENT_KEY:-}" ]] || {
      echo "OPENROUTER_MANAGEMENT_KEY is required for account-wide credits" >&2
      exit 1
    }
    original_key=$OPENROUTER_API_KEY
    OPENROUTER_API_KEY=$OPENROUTER_MANAGEMENT_KEY
    curl_json "https://openrouter.ai/api/v1/credits"
    OPENROUTER_API_KEY=$original_key
    ;;
  activity)
    [[ -n "${OPENROUTER_MANAGEMENT_KEY:-}" ]] || {
      echo "OPENROUTER_MANAGEMENT_KEY is required for account activity" >&2
      exit 1
    }
    date_filter=${1:-}
    original_key=$OPENROUTER_API_KEY
    OPENROUTER_API_KEY=$OPENROUTER_MANAGEMENT_KEY
    if [[ -n "$date_filter" ]]; then
      curl_json "https://openrouter.ai/api/v1/activity?date=$date_filter"
    else
      curl_json "https://openrouter.ai/api/v1/activity"
    fi
    OPENROUTER_API_KEY=$original_key
    ;;
  *)
    echo "Unknown test case: $CASE" >&2
    usage >&2
    exit 1
    ;;
esac
