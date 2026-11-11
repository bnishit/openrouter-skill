#!/usr/bin/env python3
import argparse
import json
import re
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path
import sys
import urllib.request
from typing import Iterable

OPENAPI_URL = "https://openrouter.ai/openapi.json"
INDEX_URLS = (
    "https://openrouter.ai/docs/llms.txt",
    "https://openrouter.ai/docs/_llms/docs.txt",
    "https://openrouter.ai/docs/_llms/api-reference.txt",
)
INVENTORY_PATH = Path(__file__).resolve().parents[1] / "references/docs-inventory.json"

PAGES = {
    "overview": {
        "url": "https://openrouter.ai/docs/api_reference/overview.md",
        "checks": [
            ("x-openrouter-title", "Preferred title header"),
            ("chat/completions", "Chat completions endpoint mention"),
        ],
    },
    "responses": {
        "url": "https://openrouter.ai/docs/api_reference/responses/overview.md",
        "checks": [
            ("/api/v1/responses", "Responses endpoint mention"),
            ("stateless", "Stateless Responses guidance present"),
            ("previous_response_id", "Responses history restriction present"),
        ],
    },
    "tool-calling": {
        "url": "https://openrouter.ai/docs/guides/features/tool-calling.md",
        "checks": [
            ("tool", "Tools terminology present"),
            ("every request", "Loop requirement language present"),
        ],
    },
    "provider-routing": {
        "url": "https://openrouter.ai/docs/guides/routing/provider-selection.md",
        "checks": [
            ("allow_fallbacks", "Provider fallback field present"),
            ("require_parameters", "Provider parameter requirement field present"),
        ],
    },
    "pdfs": {
        "url": "https://openrouter.ai/docs/guides/overview/multimodal/pdfs.md",
        "checks": [
            ("file-parser", "PDF parser plugin mention"),
            ("mistral-ocr", "Mistral OCR engine mention"),
        ],
    },
    "streaming": {
        "url": "https://openrouter.ai/docs/api_reference/streaming.md",
        "checks": [
            ("[done]", "Terminal marker mention"),
            ("usage", "Usage chunk mention"),
            ("200", "Streaming error caveat mention"),
        ],
    },
    "response-healing": {
        "url": "https://openrouter.ai/docs/guides/features/plugins/response-healing.md",
        "checks": [
            ("response healing", "Response healing feature page present"),
            ("plugin", "Response healing plugin mention"),
        ],
    },
    "message-transforms": {
        "url": "https://openrouter.ai/docs/guides/features/message-transforms.md",
        "checks": [
            ("context-compression", "Context compression plugin"),
            ("truncating", "Lossy compression boundary"),
        ],
    },
    "models": {
        "url": "https://openrouter.ai/docs/guides/overview/models.md",
        "checks": [
            ("models/count", "Model count endpoint mention"),
            ("single model lookup", "Single-model lookup guidance present"),
            ("pricing-low-to-high", "Server-side price sorting present"),
        ],
    },
    "image-api": {
        "url": "https://openrouter.ai/docs/guides/overview/multimodal/image-generation.md",
        "checks": [
            ("/api/v1/images", "Dedicated image endpoint mention"),
            ("b64_json", "Base64 image response field present"),
            ("images/models", "Image model catalog mention"),
        ],
    },
    "reasoning": {
        "url": "https://openrouter.ai/docs/guides/best-practices/reasoning-tokens.md",
        "checks": [
            ("reasoning_details", "Reasoning detail preservation field present"),
            ("effort", "Reasoning effort control present"),
        ],
    },
    "service-tiers": {
        "url": "https://openrouter.ai/docs/guides/features/service-tiers.md",
        "checks": [
            ("service_tier", "Service tier request field present"),
            ("flex", "Flex tier present"),
            ("priority", "Priority tier present"),
        ],
    },
    "batch": {
        "url": "https://openrouter.ai/docs/batch-quickstart.md",
        "checks": [
            ("/api/v1/batches", "Batch endpoint mention"),
            ("completion_window", "Batch completion window present"),
        ],
    },
    "video": {"url": "https://openrouter.ai/docs/guides/overview/multimodal/video-generation.md", "checks": [
        ("/api/v1/videos", "Video API"), ("not eligible", "Video ZDR limit"), ("unsigned_urls", "Authenticated video downloads") ]},
    "speech": {"url": "https://openrouter.ai/docs/guides/overview/multimodal/tts.md", "checks": [
        ("/api/v1/audio/speech", "Speech API"), ("raw audio", "Speech byte response"), ("supports_voice_cloning", "Endpoint voice capability") ]},
    "transcription": {"url": "https://openrouter.ai/docs/guides/overview/multimodal/stt.md", "checks": [
        ("/api/v1/audio/transcriptions", "Transcription API"), ("multipart/form-data", "Multipart transcription"), ("verbose_json", "Timestamp transcript format") ]},
    "server-tools": {"url": "https://openrouter.ai/docs/guides/features/server-tools.md", "checks": [
        ("/api/v1/tools", "Tools catalog"), ("stop_server_tools_when", "Hosted tool stop conditions") ]},
    "tool-search": {"url": "https://openrouter.ai/docs/guides/features/server-tools/tool-search.md", "checks": [
        ("defer_loading", "Deferred tool definitions"), ("deferred_tools_state_missing", "Continuation state requirement") ]},
    "shell": {"url": "https://openrouter.ai/docs/guides/features/server-tools/shell.md", "checks": [
        ("responses and messages", "Shell API boundary"), ("global endpoint", "Shell regional limit") ]},
    "agent-sdk": {"url": "https://openrouter.ai/docs/agent-sdk/agent-migration.md", "checks": [
        ("@openrouter/agent", "Agent package migration"), ("rest api", "REST client separation") ]},
    "response-cache": {"url": "https://openrouter.ai/docs/guides/features/response-caching.md", "checks": [
        ("x-openrouter-cache", "Cache header"), ("account-level", "Cache retention scope") ]},
    "router-metadata": {"url": "https://openrouter.ai/docs/guides/routing/routers/router-metadata.md", "checks": [
        ("x-openrouter-metadata", "Router metadata opt-in"), ("cache hits never", "Cache metadata boundary") ]},
    "workspace-budget": {"url": "https://openrouter.ai/docs/guides/features/workspaces/workspace-budgets.md", "checks": [
        ("lifetime > monthly > weekly > daily", "Budget interval ordering"), ("include_byok_in_budgets", "BYOK budget scope") ]},
    "policies": {"url": "https://openrouter.ai/docs/guides/features/guardrails/policies-migration.md", "checks": [
        ("managed_by", "Policy migration ownership"), ("legacy_policy_types", "Legacy policy scope") ]},
    "alignment": {"url": "https://openrouter.ai/docs/guides/features/plugins/alignment.md", "checks": [
        ("beta since october 2026", "Alignment beta status"), ("audit", "Alignment audit mode") ]},
    "armor": {"url": "https://openrouter.ai/docs/guides/features/plugins/armor.md", "checks": [
        ("safeguard_results", "Armor client verdicts"), ("claude_code_compatibility", "Armor execution contract") ]},
    "files": {"url": "https://openrouter.ai/docs/guides/features/files-api.md", "checks": [
        ("cannot be downloaded", "Uploaded-file download limit"), ("global endpoint", "Files regional limit") ]},
    "workload-identity": {"url": "https://openrouter.ai/docs/guides/overview/auth/workload-identity-federation.md", "checks": [
        ("/api/v1/oauth/token", "Workload token exchange"), ("business and enterprise", "Workload identity plan gate") ]},
}

REQUIRED_OPERATIONS = {
    "get": [
        "/models", "/models/count", "/model/{author}/{slug}",
        "/models/{author}/{slug}/endpoints", "/models/user", "/providers",
        "/images/models", "/images/models/{author}/{slug}/endpoints",
        "/videos/models", "/videos/{jobId}", "/videos/{jobId}/content",
        "/embeddings/models", "/tools", "/tools/{name}",
        "/batches", "/batches/{id}", "/files", "/files/{file_id}",
        "/generation", "/activity", "/credits", "/key", "/analytics/meta",
        "/workspaces/{workspace_ref}/budgets", "/guardrails/policies/budget",
        "/guardrails/policies/model-availability", "/guardrails/policies/moderation",
        "/external-users", "/presets", "/private-endpoints", "/private-providers",
    ],
    "post": [
        "/chat/completions", "/responses", "/messages", "/images", "/videos",
        "/audio/speech", "/audio/transcriptions", "/embeddings", "/rerank",
        "/batches", "/files", "/oauth/token", "/analytics/query", "/systemone",
        "/api/alpha/decisions", "/api/alpha/extractions",
    ],
}




@lru_cache(maxsize=64)
def fetch_text(url: str, timeout: float) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "openrouter-skill-doc-check/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def check_page(name: str, timeout: float) -> list[tuple[str, str, str]]:
    page = PAGES[name]
    try:
        text = fetch_text(page["url"], timeout).lower()
    except Exception as exc:
        return [("FAIL", name, f"could not fetch {page['url']}: {exc}")]

    results = []
    for needle, label in page["checks"]:
        if needle in text:
            results.append(("PASS", name, label))
        else:
            results.append(("WARN", name, f"missing check: {label}"))
    return results


def check_openapi(timeout: float) -> list[tuple[str, str, str]]:
    try:
        text = fetch_text(OPENAPI_URL, timeout)
        data = json.loads(text)
    except Exception as exc:
        return [("FAIL", "openapi", f"could not fetch {OPENAPI_URL}: {exc}")]

    results = []
    for method, paths in REQUIRED_OPERATIONS.items():
        for path in paths:
            present = method in (data.get("paths") or {}).get(path, {})
            results.append(("PASS" if present else "WARN", "openapi", f"{method.upper()} {path}: {'present' if present else 'missing'}"))
    return results


def build_inventory(index_texts: list[str], spec: dict) -> dict:
    pages = set()
    for text in index_texts:
        found = re.findall(r"\]\(https://openrouter\.ai/docs/([^)?]+\.md)\)", text)
        if not found:
            raise ValueError("docs index contained no Markdown page links")
        pages.update(found)
    paths = spec.get("paths")
    if not isinstance(paths, dict) or not paths:
        raise ValueError("OpenAPI contained no paths")
    operations = sorted(f"{method.upper()} {path}" for path, methods in paths.items()
                        for method in methods if method in {"get", "post", "put", "patch", "delete", "options", "head"})
    if not operations:
        raise ValueError("OpenAPI contained no operations")
    return {"pages": sorted(pages), "operations": operations}


def compare_inventory(baseline: dict, current: dict) -> list[tuple[str, str, str]]:
    results = []
    for key in ("pages", "operations"):
        before, after = set(baseline[key]), set(current[key])
        for item in sorted(after - before):
            results.append(("WARN", "inventory", f"new {key}: {item}"))
        for item in sorted(before - after):
            results.append(("WARN", "inventory", f"removed {key}: {item}"))
        if before == after:
            results.append(("PASS", "inventory", f"{len(after)} {key} match the reviewed inventory"))
    return results


def check_inventory(timeout: float) -> list[tuple[str, str, str]]:
    try:
        baseline = json.loads(INVENTORY_PATH.read_text())
        texts = [fetch_text(url, timeout) for url in INDEX_URLS]
        spec = json.loads(fetch_text(OPENAPI_URL, timeout))
        return compare_inventory(baseline, build_inventory(texts, spec))
    except Exception as exc:
        return [("FAIL", "inventory", f"could not compare reviewed inventory: {exc}")]


def render(results: Iterable[tuple[str, str, str]]) -> int:
    worst = 0
    for status, scope, message in results:
        print(f"[{status}] {scope}: {message}")
        if status == "WARN":
            worst = max(worst, 1)
        elif status == "FAIL":
            worst = max(worst, 2)
    return worst


def main() -> int:
    parser = argparse.ArgumentParser(description="Quickly verify key OpenRouter docs assumptions against official pages.")
    parser.add_argument("--quick", action="store_true", help="Run the default focused checks.")
    parser.add_argument("--inventory", action="store_true", help="Detect added/removed docs pages and API operations against the reviewed baseline.")
    parser.add_argument("--timeout", type=float, default=15.0, help="Per-request timeout in seconds.")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero on warnings as well as failures.")
    args = parser.parse_args()

    results = []
    if args.quick or not args.inventory:
        results.extend(check_openapi(args.timeout))
        with ThreadPoolExecutor(max_workers=8) as pool:
            for page_results in pool.map(lambda name: check_page(name, args.timeout), PAGES):
                results.extend(page_results)
    if args.inventory:
        results.extend(check_inventory(args.timeout))

    code = render(results)
    if args.strict and code == 1:
        return 1
    return 1 if code == 2 else 0


if __name__ == "__main__":
    sys.exit(main())
