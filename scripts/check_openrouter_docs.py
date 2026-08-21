#!/usr/bin/env python3
import argparse
import json
import sys
import urllib.request
from typing import Iterable

OPENAPI_URL = "https://openrouter.ai/openapi.json"

PAGES = {
    "overview": {
        "url": "https://openrouter.ai/docs/api-reference/overview",
        "checks": [
            ("x-openrouter-title", "Preferred title header"),
            ("chat/completions", "Chat completions endpoint mention"),
        ],
    },
    "tool-calling": {
        "url": "https://openrouter.ai/docs/guides/features/tool-calling",
        "checks": [
            ("tool", "Tools terminology present"),
            ("every request", "Loop requirement language present"),
        ],
    },
    "provider-routing": {
        "url": "https://openrouter.ai/docs/guides/routing/provider-selection",
        "checks": [
            ("allow_fallbacks", "Provider fallback field present"),
            ("require_parameters", "Provider parameter requirement field present"),
        ],
    },
    "pdfs": {
        "url": "https://openrouter.ai/docs/guides/overview/multimodal/pdfs",
        "checks": [
            ("file-parser", "PDF parser plugin mention"),
            ("mistral-ocr", "Mistral OCR engine mention"),
        ],
    },
    "streaming": {
        "url": "https://openrouter.ai/docs/api-reference/streaming",
        "checks": [
            ("[done]", "Terminal marker mention"),
            ("usage", "Usage chunk mention"),
            ("200", "Streaming error caveat mention"),
        ],
    },
    "response-healing": {
        "url": "https://openrouter.ai/docs/guides/features/plugins/response-healing",
        "checks": [
            ("response healing", "Response healing feature page present"),
            ("plugin", "Response healing plugin mention"),
        ],
    },
    "message-transforms": {
        "url": "https://openrouter.ai/docs/guides/features/message-transforms",
        "checks": [
            ("middle-out", "Middle-out transform mention"),
            ("transforms", "Transforms terminology present"),
        ],
    },
    "models": {
        "url": "https://openrouter.ai/docs/guides/overview/models",
        "checks": [
            ("models/count", "Model count endpoint mention"),
            ("single model lookup", "Single-model lookup guidance present"),
            ("pricing-low-to-high", "Server-side price sorting present"),
        ],
    },
    "image-api": {
        "url": "https://openrouter.ai/docs/guides/overview/multimodal/image-generation",
        "checks": [
            ("/api/v1/images", "Dedicated image endpoint mention"),
            ("b64_json", "Base64 image response field present"),
            ("images/models", "Image model catalog mention"),
        ],
    },
    "reasoning": {
        "url": "https://openrouter.ai/docs/guides/best-practices/reasoning-tokens",
        "checks": [
            ("reasoning_details", "Reasoning detail preservation field present"),
            ("effort", "Reasoning effort control present"),
        ],
    },
    "service-tiers": {
        "url": "https://openrouter.ai/docs/guides/features/service-tiers",
        "checks": [
            ("service_tier", "Service tier request field present"),
            ("flex", "Flex tier present"),
            ("priority", "Priority tier present"),
        ],
    },
    "batch": {
        "url": "https://openrouter.ai/docs/batch-quickstart",
        "checks": [
            ("/api/beta/batches", "Batch endpoint mention"),
            ("24-hour", "Batch completion window present"),
        ],
    },
}

REQUIRED_PATHS = [
    "/chat/completions",
    "/models",
    "/models/count",
    "/model/{author}/{slug}",
    "/models/{author}/{slug}/endpoints",
    "/images",
    "/images/models",
    "/images/models/{author}/{slug}/endpoints",
    "/generation",
    "/activity",
    "/credits",
    "/key",
]


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

    paths = set((data.get("paths") or {}).keys())
    results = []
    for path in REQUIRED_PATHS:
        if path in paths:
            results.append(("PASS", "openapi", f"path present: {path}"))
        else:
            results.append(("WARN", "openapi", f"missing path: {path}"))
    return results


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
    parser.add_argument("--timeout", type=float, default=15.0, help="Per-request timeout in seconds.")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero on warnings as well as failures.")
    args = parser.parse_args()

    results = []
    results.extend(check_openapi(args.timeout))
    for name in PAGES:
      results.extend(check_page(name, args.timeout))

    code = render(results)
    if args.strict and code == 1:
        return 1
    return 1 if code == 2 else 0


if __name__ == "__main__":
    sys.exit(main())
