export type ClientCall = {
  id: string;
  type: string;
  function?: { name?: string; arguments?: string };
};
export type ClientHandler = {
  parse: (input: unknown) => unknown;
  execute: (input: any) => Promise<unknown>;
};

export async function executeClientFunction(
  call: ClientCall,
  registry: Record<string, ClientHandler>,
) {
  const name = call.function?.name;
  if (
    !call.id ||
    call.type !== "function" ||
    !name ||
    name.startsWith("openrouter:") ||
    !Object.hasOwn(registry, name)
  ) {
    throw new Error("Only an allowlisted application function may run locally");
  }
  const handler = registry[name];
  const validated = handler.parse(JSON.parse(call.function?.arguments || "{}"));
  const output = await handler.execute(validated);
  return {
    role: "tool",
    tool_call_id: call.id,
    content: JSON.stringify(output ?? null),
  };
}
