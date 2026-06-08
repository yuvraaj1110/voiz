import type { AgentNode } from "./nodes";

export type ToolProperty =
  | { type: "boolean"; description: string }
  | { type: "number"; description: string }
  | { type: "string"; enum?: string[]; description: string };

export type ToolSchema = {
  type: "function";
  function: {
    name: "submit_call_result";
    description: string;
    parameters: {
      type: "object";
      required: string[];
      properties: Record<string, ToolProperty>;
    };
  };
};

/** Slugify free text into a safe snake_case tool-property key. */
function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "field"
  );
}

function optionsOf(node: AgentNode): string[] {
  const f = node.fields.find((x) => x.key === "options");
  return Array.isArray(f?.value) ? (f!.value as string[]) : [];
}

/** Resolve a data node into a tool-property key + enum values (+ NOT_CAPTURED). */
export function deriveCaptureKey(node: AgentNode): { key: string; enumVals: string[] } {
  const key =
    node.type === "employment"
      ? "employment_type"
      : node.type === "amount"
        ? "loan_amount_range"
        : slug(String(node.fields.find((f) => f.key === "field")?.value ?? node.title));
  const opts = optionsOf(node);
  const enumVals = opts.length > 0 ? [...opts, "NOT_CAPTURED"] : [];
  return { key, enumVals };
}

export function buildToolSchema(nodes: AgentNode[]): ToolSchema {
  const properties: Record<string, ToolProperty> = {
    rpc_confirmed: { type: "boolean", description: "True if the right party confirmed they are the intended lead." },
    interest: {
      type: "string",
      enum: ["INTERESTED", "NOT_INTERESTED", "DEFERRED"],
      description: "INTERESTED = wants to know more; NOT_INTERESTED = declined; DEFERRED = call back later.",
    },
    unclear_count: { type: "number", description: "Total UNCLEAR classifications across the call." },
    hard_timeout_fired: { type: "boolean", description: "True if the hard deadline forced an early handoff." },
    exit_state: {
      type: "string",
      enum: ["HANDOFF", "EXIT_WRONG_PARTY", "EXIT_NO_ANSWER", "EXIT_NOT_INTERESTED", "EXIT_UNRESOLVED"],
      description: "The FSM state at which the call ended.",
    },
  };

  for (const node of nodes.filter((n) => n.capturesData)) {
    const { key, enumVals } = deriveCaptureKey(node);
    properties[key] =
      enumVals.length > 0
        ? { type: "string", enum: enumVals, description: `Captured for "${node.title}". NOT_CAPTURED if unclear/timed out.` }
        : { type: "string", description: `Captured for "${node.title}". Empty if not captured.` };
  }

  return {
    type: "function",
    function: {
      name: "submit_call_result",
      description: "Call this when the conversation reaches any terminal state. Mandatory on every exit path.",
      parameters: { type: "object", required: ["rpc_confirmed", "interest", "exit_state"], properties },
    },
  };
}
