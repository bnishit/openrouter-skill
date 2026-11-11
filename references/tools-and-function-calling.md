# Tools And Function Calling

## When To Use Tools

Use tool calling when the model must fetch live data, execute deterministic business logic, or act through an external system. Do not use tools for work that should stay in the prompt, such as simple formatting or summarization.

Before enabling tool use, check the model's `supported_parameters` and prefer providers that support tools fully.

## Core Request Shape

Tool calling still uses `POST https://openrouter.ai/api/v1/chat/completions`.

Send a `tools` array and optionally `tool_choice` or `parallel_tool_calls`.

```json
{
  "model": "openai/gpt-4o-mini",
  "messages": [
    {
      "role": "user",
      "content": "Look up today's weather in San Francisco and summarize it."
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get current weather by city name",
        "parameters": {
          "type": "object",
          "properties": {
            "city": { "type": "string" }
          },
          "required": ["city"],
          "additionalProperties": false
        }
      }
    }
  ],
  "tool_choice": "auto",
  "parallel_tool_calls": false
}
```

## Three-Step Loop

1. Send user and system messages plus the `tools` array.
2. Inspect the assistant message for `tool_calls`.
3. Execute the tool, append a `tool` role message, and send another chat completion request with the full conversation and the same `tools` array.

Do not drop the `tools` array on the second call. OpenRouter docs explicitly note that tools must remain present on every request in the loop.

## Tool Call Response Shape

When the model wants a tool, the assistant message typically looks like:

```json
{
  "role": "assistant",
  "content": "",
  "tool_calls": [
    {
      "id": "call_123",
      "type": "function",
      "function": {
        "name": "get_weather",
        "arguments": "{\"city\":\"San Francisco\"}"
      }
    }
  ]
}
```

Expect `finish_reason` or `native_finish_reason` to indicate tool use.

## Tool Result Message

Return tool results as a `tool` role message tied to the tool call id.

```json
{
  "role": "tool",
  "tool_call_id": "call_123",
  "content": "{\"city\":\"San Francisco\",\"temp_f\":63,\"condition\":\"Sunny\"}"
}
```

`content` should be a string. Use JSON stringification for structured results.

## Full Follow-Up Request

```json
{
  "model": "openai/gpt-4o-mini",
  "messages": [
    {
      "role": "user",
      "content": "Look up today's weather in San Francisco and summarize it."
    },
    {
      "role": "assistant",
      "content": "",
      "tool_calls": [
        {
          "id": "call_123",
          "type": "function",
          "function": {
            "name": "get_weather",
            "arguments": "{\"city\":\"San Francisco\"}"
          }
        }
      ]
    },
    {
      "role": "tool",
      "tool_call_id": "call_123",
      "content": "{\"city\":\"San Francisco\",\"temp_f\":63,\"condition\":\"Sunny\"}"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get current weather by city name",
        "parameters": {
          "type": "object",
          "properties": {
            "city": { "type": "string" }
          },
          "required": ["city"],
          "additionalProperties": false
        }
      }
    }
  ]
}
```

## Practical Rules

- Keep function names stable and machine-friendly.
- Write tight schemas with `additionalProperties: false`.
- Parse `function.arguments` as JSON and validate before executing.
- If the request depends on tools, prefer `provider.require_parameters: true`.
- Use `parallel_tool_calls: false` unless you really want concurrency.
- Surface tool failures back to the model as structured tool output instead of dropping them.
- Log both the requested tool name and the validated arguments.

## Common Failure Modes

- Sending `tools` only on the first request.
- Forgetting `tool_call_id` on the tool result message.
- Returning raw objects instead of string content.
- Letting invalid arguments reach the real tool.
- Assuming every provider for a model supports tools equally.

## Suggested Loop Structure

- Validate arguments with a schema before executing the tool.
- Impose timeouts and retries on the tool implementation, not on the model request alone.
- Cap the number of tool turns to avoid runaway loops.
- On the final answer, log the resolved response model because fallbacks can change which provider or model actually answered.

## Hosted Tools And The Agent SDK

Checked 2026-11-11. A client function returns a call for **your app** to execute. A server tool lets **OpenRouter or a provider** execute during the request. A plugin transforms/checks a request or response. Choosing one changes cost, privacy, state, and the response items your app must preserve.

With a server-held bearer token, discover `GET /api/v1/tools` and `/tools/{name}` for accepted type spellings, engines, prices, and native endpoints. Inspect each model endpoint's `native_tools`; a native tool name alone does not prove OpenRouter executes it. Server tools remain beta.

| Need | Tool / integration | Boundary |
| - | - | - |
| Search the web or read URLs | `openrouter:web_search`, `openrouter:web_fetch` | Preserve citations and review backend retention; global and regional availability differ |
| Current time, discover models | `openrouter:datetime`, `openrouter:search_models` | Read actual returned data; availability is not permission to change the app's model |
| Make images within a task | `openrouter:image_generation` | Separate image asset/cost handling from final answer text |
| Hosted commands | `openrouter:shell` | Responses/Messages only; Chat Completions returns 400; global-only |
| Anthropic-style bash | `openrouter:bash` | `auto` can return a client-side call; `engine: "openrouter"` selects the hosted sandbox |
| File edits | `openrouter:apply_patch` | Your app applies the proposed patch; validate paths and authorization |
| Ask other models | `openrouter:advisor`, `openrouter:subagent`, `openrouter:fusion` | Inner model/tool calls add cost; outer and inner limits differ |
| Large tool libraries | `openrouter:tool_search`, `defer_loading` | Keep continuation state and catalog unchanged; see below |

For example, a Responses request can include `tools: [{ type: "openrouter:web_search" }]` and `max_tool_calls: 3`. The default outer tool budget is 30, max 30. `stop_server_tools_when` overrides `max_tool_calls`; read the current supported stop-condition schema before using spend/token limits. Fusion/subagent inner loops have their own limits. Do not count one outer tool call as one model charge.

### Deferred tools: history is part of the contract

Use tool search when sending the whole catalog every turn wastes context. Keep common tools loaded and defer rare ones. Never defer tool search itself. Standard client function validation/execution still applies after discovery.

The portable `deferred_tools` protocol carries state in encrypted reasoning. Replay assistant messages and reasoning **exactly as returned**. Do not trim/reorder earlier history, change the catalog/tool order/descriptions/`tool_choice`, or compact the conversation. Start a new conversation when changing those. Batch rejects `deferred_tools`; the service disables context compression for these requests. A client that strips reasoning can fail with `deferred_tools_state_missing` or `deferred_tools_history_changed` on the next turn. This skill's simple chat UI does not implement that continuation protocol.

### Agent SDK and MCP

Use `@openrouter/sdk` for direct typed REST calls. Use **`@openrouter/agent`** for `callModel`, tools, multi-turn state, dynamic parameters, hooks, streaming, stop conditions, tool approval/state persistence, async tools, and doom-loop detection. Agent imports moved out of `@openrouter/sdk`; migrate only agent imports, leaving ordinary REST clients alone. Python and Go agent packages also exist; use the language-specific docs rather than translating TypeScript signatures by guesswork.

The SDK can execute tools automatically. Define allowed actions and meaningful step/cost limits before enabling execution; test an interrupted/denied tool and resumed state, not only a happy response. SDK state is client-managed and does not make the Responses API server-stateful.

`@openrouter/mcp` connects remote MCP servers to the Agent SDK. Check authentication, tool trust, and data sharing for each server. This is different from OpenRouter's own developer MCP server, which supplies catalogs/docs/test calls to a coding assistant; neither is a replacement for your app's inference API.

[Server tools](https://openrouter.ai/docs/guides/features/server-tools.md), [tool search/state](https://openrouter.ai/docs/guides/features/server-tools/tool-search.md), [shell](https://openrouter.ai/docs/guides/features/server-tools/shell.md), [bash](https://openrouter.ai/docs/guides/features/server-tools/bash.md), [Agent SDK](https://openrouter.ai/docs/agent-sdk/overview.md), [migration](https://openrouter.ai/docs/agent-sdk/agent-migration.md), [MCP tools](https://openrouter.ai/docs/agent-sdk/call-model/mcp-tools.md).
