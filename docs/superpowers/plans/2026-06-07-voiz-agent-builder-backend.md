# VOIZ Agent Builder — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "Deploy" real — compile the node graph into a Vapi assistant, place a live in-browser call, and show the scored CRM payload + latency afterward.

**Architecture:** A **deterministic compiler** turns the user's `AgentNode[]` into a Hindi FSM system prompt + `submit_call_result` tool schema (no LLM). `/api/deploy` compiles and creates a Vapi assistant via REST. The browser runs the call with the **Vapi Web SDK**; a pure event reducer feeds the live transcript and per-node capture lights. On call end, **ported** `payload-builder` + `latency-tracker` (now self-contained TS in `web/lib`) produce the result card. A `/api/vapi-events` webhook is the authoritative server path.

**Tech Stack:** Next.js 14 (App Router, route handlers), TypeScript, `@vapi-ai/web`, Vitest. No Anthropic key.

---

## Scope

**In scope:** node→config compiler, `/api/deploy`, Vapi Web SDK live call (State 2), ported payload/latency modules, result card (State 3), `/api/vapi-events` webhook, env wiring.

**Out of scope:** real phone calls, persistence/accounts, Claude-based generation (deterministic by decision), drag-reorder.

**Manual step (no Vapi creds in CI):** the actual live call and assistant creation require real `VAPI_PRIVATE_KEY`/`VAPI_PUBLIC_KEY`. All pure logic is unit-tested; network paths are verified manually (documented in Task 11).

**Reference (existing, do not import across packages — port instead):**
- `src/prompts/system-prompt.txt` — FSM style to mirror.
- `src/vapi/tool-schemas.js` — `submit_call_result` shape to mirror.
- `src/server/payload-builder.js`, `src/server/latency-tracker.js` — port to TS.

---

## File Structure

```
web/
  lib/
    compiler.ts            AgentNode[] -> { systemPrompt, firstMessage, toolSchema, captureKeys }
    vapi.ts                buildAssistantBody() (pure) + createAssistant() (fetch)
    payload-builder.ts     ported from src/server/payload-builder.js (typed)
    latency-tracker.ts     ported from src/server/latency-tracker.js (typed)
    callReducer.ts         pure reducer: Vapi Web SDK events -> live call state
    useVapiCall.ts         React hook wrapping @vapi-ai/web around callReducer
  app/
    api/deploy/route.ts        POST {nodes,globals} -> compile -> Vapi create -> {assistantId, publicKey}
    api/vapi-events/route.ts   Vapi serverUrl webhook (tool-calls ack + end-of-call log)
  components/
    LiveCall.tsx           State 2: Talk, transcript, node capture lights, 60s ring
    ResultCard.tsx         State 3: scored payload + latency chart
  __tests__/
    compiler.test.ts
    vapi.test.ts
    payload-builder.test.ts
    latency-tracker.test.ts
    callReducer.test.ts
```

---

## Phase 1 — Deterministic compiler

### Task 1: Tool-schema compilation

**Files:**
- Create: `web/lib/compiler.ts`
- Test: `web/__tests__/compiler.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/__tests__/compiler.test.ts
import { describe, it, expect } from "vitest";
import { deriveCaptureKey, buildToolSchema } from "@/lib/compiler";
import { DEFAULT_NODES } from "@/lib/nodes";

describe("deriveCaptureKey", () => {
  it("uses canonical keys for known node types", () => {
    const emp = DEFAULT_NODES.find((n) => n.type === "employment")!;
    const amt = DEFAULT_NODES.find((n) => n.type === "amount")!;
    expect(deriveCaptureKey(emp).key).toBe("employment_type");
    expect(deriveCaptureKey(amt).key).toBe("loan_amount_range");
  });

  it("derives enum from the node's options plus NOT_CAPTURED", () => {
    const emp = DEFAULT_NODES.find((n) => n.type === "employment")!;
    expect(deriveCaptureKey(emp).enumVals).toEqual(["SALARIED", "SELF_EMPLOYED", "NOT_CAPTURED"]);
  });
});

describe("buildToolSchema", () => {
  it("always includes the universal fields and requires the core three", () => {
    const t = buildToolSchema(DEFAULT_NODES);
    expect(t.function.name).toBe("submit_call_result");
    expect(t.function.parameters.required).toEqual(["rpc_confirmed", "interest", "exit_state"]);
    const props = t.function.parameters.properties;
    expect(props.rpc_confirmed.type).toBe("boolean");
    expect(props.interest.enum).toEqual(["INTERESTED", "NOT_INTERESTED", "DEFERRED"]);
    expect(props.exit_state.enum).toContain("HANDOFF");
    expect(props.unclear_count.type).toBe("number");
    expect(props.hard_timeout_fired.type).toBe("boolean");
  });

  it("adds one enum property per data-capturing node", () => {
    const t = buildToolSchema(DEFAULT_NODES);
    const props = t.function.parameters.properties;
    expect(props.employment_type.enum).toEqual(["SALARIED", "SELF_EMPLOYED", "NOT_CAPTURED"]);
    expect(props.loan_amount_range.enum).toEqual(["1-3L", "3-5L", "5L+", "NOT_CAPTURED"]);
  });

  it("ignores non-data nodes", () => {
    const t = buildToolSchema(DEFAULT_NODES);
    expect(t.function.parameters.properties).not.toHaveProperty("rpc");
    expect(t.function.parameters.properties).not.toHaveProperty("offer");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run __tests__/compiler.test.ts`
Expected: FAIL ("Cannot find module '@/lib/compiler'").

- [ ] **Step 3: Write `web/lib/compiler.ts` (Task 1 portion)**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx vitest run __tests__/compiler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/compiler.ts web/__tests__/compiler.test.ts
git commit -m "feat(web): tool-schema compiler from node graph"
```

---

### Task 2: System-prompt + firstMessage + compileAgent

**Files:**
- Modify: `web/lib/compiler.ts`
- Test: `web/__tests__/compiler.test.ts`

- [ ] **Step 1: Add failing tests (append to the file)**

```ts
import { compileAgent } from "@/lib/compiler";

describe("compileAgent", () => {
  const globals = { voice: "Aanya (Hindi)", register: "Tier 2/3", maxDurationSec: 60 };

  it("uses the RPC node's opening line as firstMessage", () => {
    const out = compileAgent(DEFAULT_NODES, globals);
    expect(out.firstMessage).toContain("नमस्ते");
  });

  it("embeds every node's script text and the duration cap in the prompt", () => {
    const out = compileAgent(DEFAULT_NODES, globals);
    expect(out.systemPrompt).toContain("60");
    expect(out.systemPrompt).toContain("आपके नाम पर"); // offer script
    expect(out.systemPrompt).toContain("आप नौकरी करते हैं"); // employment question
    // compliance + tool/end-call rules are always present
    expect(out.systemPrompt).toMatch(/Aadhaar/i);
    expect(out.systemPrompt).toMatch(/submit_call_result/);
    expect(out.systemPrompt).toMatch(/endCall/);
  });

  it("returns capture keys for data nodes, paired with node ids", () => {
    const out = compileAgent(DEFAULT_NODES, globals);
    expect(out.captureKeys).toEqual([
      { nodeId: "n-employment", key: "employment_type" },
      { nodeId: "n-amount", key: "loan_amount_range" },
    ]);
  });

  it("exposes the tool schema", () => {
    const out = compileAgent(DEFAULT_NODES, globals);
    expect(out.toolSchema.function.name).toBe("submit_call_result");
  });
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `cd web && npx vitest run __tests__/compiler.test.ts`
Expected: FAIL ("compileAgent is not a function").

- [ ] **Step 3: Append to `web/lib/compiler.ts`**

```ts
export type Globals = { voice: string; register: string; maxDurationSec: number };

export type CompiledAgent = {
  systemPrompt: string;
  firstMessage: string;
  toolSchema: ToolSchema;
  captureKeys: { nodeId: string; key: string }[];
};

function textField(node: AgentNode, key: string): string {
  return String(node.fields.find((f) => f.key === key)?.value ?? "");
}

function nodeSection(node: AgentNode): string {
  switch (node.type) {
    case "rpc":
      return `### STATE: RPC_CHECK\nSay: "${textField(node, "line")}"\nIf wrong party -> submit_call_result(rpc_confirmed=false, exit_state="EXIT_WRONG_PARTY"). If silence, retry ${textField(node, "retries")} time(s) then EXIT_NO_ANSWER.`;
    case "offer":
      return `### STATE: OFFER\nSay: "${textField(node, "script")}" then continue.`;
    case "interest":
      return `### STATE: INTEREST_CHECK\nAsk: "${textField(node, "question")}"\nINTERESTED -> continue; NOT_INTERESTED -> EXIT_NOT_INTERESTED; DEFERRED -> log DEFERRED & exit; UNCLEAR x2 -> EXIT_UNRESOLVED.`;
    default: {
      // employment / amount / custom — a data-capturing question
      const { key, enumVals } = deriveCaptureKey(node);
      const opts = enumVals.filter((v) => v !== "NOT_CAPTURED");
      const optText = opts.length ? ` Classify into: ${opts.join(", ")}.` : "";
      return `### STATE: ${key.toUpperCase()}\nAsk: "${textField(node, "question")}".${optText}\nStore as ${key}. UNCLEAR x2 or timeout -> ${key}=NOT_CAPTURED, then continue.`;
    }
  }
}

const HANDOFF_AND_RULES = `### STATE: HANDOFF\nSay the closing line, then call submit_call_result with everything captured, then call endCall to hang up.\n\n## RULES\n- Speak natural, conversational Hindi. One short question at a time.\n- NEVER ask for Aadhaar number, full PAN, card number/CVV, OTP, or exact salary.\n- NEVER promise approval, interest rate, or sanction.\n- If a qualification answer is UNCLEAR, re-ask once, then store NOT_CAPTURED and move on.\n- ALWAYS call submit_call_result before the call ends, then endCall. Never linger.`;

export function compileAgent(nodes: AgentNode[], globals: Globals): CompiledAgent {
  const rpc = nodes.find((n) => n.type === "rpc");
  const handoff = nodes.find((n) => n.type === "handoff");

  const persona = `You are a Hindi-speaking outbound voice agent for an Indian lender. Register: ${globals.register}. The ENTIRE call must finish within ${globals.maxDurationSec} seconds. Follow these states in order; classify each reply and transition.`;

  const sections = nodes
    .filter((n) => n.type !== "handoff")
    .map(nodeSection)
    .join("\n\n");

  const closing = handoff
    ? HANDOFF_AND_RULES.replace("the closing line", `"${textField(handoff, "line")}"`)
    : HANDOFF_AND_RULES;

  const systemPrompt = `${persona}\n\n${sections}\n\n${closing}`;

  const firstMessage = rpc ? textField(rpc, "line") : "नमस्ते।";

  const captureKeys = nodes
    .filter((n) => n.capturesData)
    .map((n) => ({ nodeId: n.id, key: deriveCaptureKey(n).key }));

  return { systemPrompt, firstMessage, toolSchema: buildToolSchema(nodes), captureKeys };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd web && npx vitest run __tests__/compiler.test.ts`
Expected: PASS (all compiler tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/compiler.ts web/__tests__/compiler.test.ts
git commit -m "feat(web): compile node graph into Hindi FSM prompt + firstMessage + capture keys"
```

---

## Phase 2 — Deploy

### Task 3: Vapi assistant body builder + create helper

**Files:**
- Create: `web/lib/vapi.ts`
- Test: `web/__tests__/vapi.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/__tests__/vapi.test.ts
import { describe, it, expect } from "vitest";
import { buildAssistantBody } from "@/lib/vapi";
import { compileAgent } from "@/lib/compiler";
import { DEFAULT_NODES } from "@/lib/nodes";

const compiled = compileAgent(DEFAULT_NODES, { voice: "Elliot", register: "Tier 2/3", maxDurationSec: 60 });

describe("buildAssistantBody", () => {
  it("wires model, prompt, tools (incl. endCall), voice, transcriber and serverUrl", () => {
    const body = buildAssistantBody(compiled, { voice: "Elliot", register: "Tier 2/3", maxDurationSec: 60 }, "https://x.dev/api/vapi-events");
    expect(body.model.provider).toBe("anthropic");
    expect(body.model.messages[0].role).toBe("system");
    expect(body.model.messages[0].content).toContain("submit_call_result");
    const toolNames = body.model.tools.map((t: any) => t.function?.name ?? t.type);
    expect(toolNames).toContain("submit_call_result");
    expect(toolNames).toContain("endCall");
    expect(body.firstMessage).toBe(compiled.firstMessage);
    expect(body.transcriber.provider).toBe("deepgram");
    expect(body.serverUrl).toBe("https://x.dev/api/vapi-events");
    expect(body.serverMessages).toContain("end-of-call-report");
    expect(body.serverMessages).toContain("tool-calls");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run __tests__/vapi.test.ts`
Expected: FAIL ("Cannot find module '@/lib/vapi'").

- [ ] **Step 3: Write `web/lib/vapi.ts`**

```ts
import type { CompiledAgent, Globals } from "./compiler";

export function buildAssistantBody(compiled: CompiledAgent, _globals: Globals, serverUrl: string) {
  return {
    name: "VOIZ Generated Agent",
    firstMessage: compiled.firstMessage,
    model: {
      provider: "anthropic",
      model: "claude-3-5-haiku-20241022",
      messages: [{ role: "system", content: compiled.systemPrompt }],
      tools: [compiled.toolSchema, { type: "endCall" }],
    },
    voice: { provider: "vapi", voiceId: "Elliot", language: "hi" },
    transcriber: { provider: "deepgram", model: "nova-3", language: "multi" },
    serverUrl,
    serverMessages: ["end-of-call-report", "tool-calls", "status-update"],
  };
}

/** Create a Vapi assistant. Network call — exercised manually with real creds. */
export async function createAssistant(body: unknown, privateKey: string): Promise<{ id: string }> {
  const res = await fetch("https://api.vapi.ai/assistant", {
    method: "POST",
    headers: { Authorization: `Bearer ${privateKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Vapi create failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as { id: string };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd web && npx vitest run __tests__/vapi.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/vapi.ts web/__tests__/vapi.test.ts
git commit -m "feat(web): Vapi assistant body builder + create helper"
```

---

### Task 4: `/api/deploy` route

**Files:**
- Create: `web/app/api/deploy/route.ts`

- [ ] **Step 1: Write `web/app/api/deploy/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { compileAgent, type Globals } from "@/lib/compiler";
import { buildAssistantBody, createAssistant } from "@/lib/vapi";
import type { AgentNode } from "@/lib/nodes";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const privateKey = process.env.VAPI_PRIVATE_KEY;
  const publicKey = process.env.VAPI_PUBLIC_KEY;
  if (!privateKey || !publicKey) {
    return NextResponse.json({ error: "Vapi keys not configured on the server." }, { status: 500 });
  }

  let nodes: AgentNode[];
  let globals: Globals;
  try {
    const body = await req.json();
    nodes = body.nodes;
    globals = { voice: body.voice, register: body.register, maxDurationSec: body.maxDurationSec };
    if (!Array.isArray(nodes) || nodes.length === 0) throw new Error("no nodes");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const compiled = compileAgent(nodes, globals);
  const origin = req.nextUrl.origin;
  const assistantBody = buildAssistantBody(compiled, globals, `${origin}/api/vapi-events`);

  try {
    const { id } = await createAssistant(assistantBody, privateKey);
    return NextResponse.json({ assistantId: id, publicKey, captureKeys: compiled.captureKeys });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
```

- [ ] **Step 2: Type-check + build**

Run: `cd web && npx tsc --noEmit && npm run build`
Expected: no type errors; `/api/deploy` listed as a route.

- [ ] **Step 3: Commit**

```bash
git add web/app/api/deploy/route.ts
git commit -m "feat(web): /api/deploy compiles nodes and creates a Vapi assistant"
```

---

## Phase 3 — Live in-browser call (State 2)

### Task 5: Call-event reducer + Vapi hook

**Files:**
- Create: `web/lib/callReducer.ts`, `web/lib/useVapiCall.ts`
- Test: `web/__tests__/callReducer.test.ts`
- Modify: `web/package.json` (add `@vapi-ai/web`)

- [ ] **Step 1: Add the Web SDK dependency**

Run: `cd web && npm install @vapi-ai/web@2.3.8`
Expected: installs; `@vapi-ai/web` in dependencies.

- [ ] **Step 2: Write the failing reducer test**

```ts
// web/__tests__/callReducer.test.ts
import { describe, it, expect } from "vitest";
import { initialCallState, reduceCall, type CallEvent } from "@/lib/callReducer";

describe("reduceCall", () => {
  it("appends final transcript lines with role and seconds", () => {
    let s = initialCallState(0);
    s = reduceCall(s, { kind: "transcript", role: "user", text: "हाँ जी", final: true, at: 4000 } as CallEvent);
    expect(s.transcript).toHaveLength(1);
    expect(s.transcript[0]).toMatchObject({ role: "user", message: "हाँ जी" });
  });

  it("ignores non-final (partial) transcripts", () => {
    let s = initialCallState(0);
    s = reduceCall(s, { kind: "transcript", role: "user", text: "हा", final: false, at: 4000 } as CallEvent);
    expect(s.transcript).toHaveLength(0);
  });

  it("marks capture keys present in a tool-call as captured", () => {
    let s = initialCallState(0);
    s = reduceCall(s, {
      kind: "tool-call",
      args: { rpc_confirmed: true, interest: "INTERESTED", employment_type: "SALARIED", exit_state: "HANDOFF" },
    } as CallEvent);
    expect(s.captured).toContain("employment_type");
    expect(s.captured).toContain("interest");
    expect(s.submitArgs?.employment_type).toBe("SALARIED");
  });

  it("records end with reason and timestamp", () => {
    let s = initialCallState(0);
    s = reduceCall(s, { kind: "end", reason: "assistant-ended-call", at: 48000 } as CallEvent);
    expect(s.ended).toBe(true);
    expect(s.endedReason).toBe("assistant-ended-call");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd web && npx vitest run __tests__/callReducer.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 4: Write `web/lib/callReducer.ts`**

```ts
export type TranscriptLine = { role: "user" | "bot"; message: string; secondsFromStart: number; duration: number };

export type CallState = {
  startedAtMs: number;
  transcript: TranscriptLine[];
  captured: string[];
  submitArgs: Record<string, unknown> | null;
  ended: boolean;
  endedReason: string | null;
};

export type CallEvent =
  | { kind: "transcript"; role: "user" | "bot"; text: string; final: boolean; at: number }
  | { kind: "tool-call"; args: Record<string, unknown> }
  | { kind: "end"; reason: string; at: number };

export function initialCallState(startedAtMs: number): CallState {
  return { startedAtMs, transcript: [], captured: [], submitArgs: null, ended: false, endedReason: null };
}

export function reduceCall(state: CallState, ev: CallEvent): CallState {
  switch (ev.kind) {
    case "transcript": {
      if (!ev.final) return state;
      const line: TranscriptLine = {
        role: ev.role,
        message: ev.text,
        secondsFromStart: Math.max(0, (ev.at - state.startedAtMs) / 1000),
        duration: 1,
      };
      return { ...state, transcript: [...state.transcript, line] };
    }
    case "tool-call": {
      const keys = Object.keys(ev.args ?? {});
      const captured = Array.from(new Set([...state.captured, ...keys]));
      return { ...state, captured, submitArgs: { ...(state.submitArgs ?? {}), ...ev.args } };
    }
    case "end":
      return { ...state, ended: true, endedReason: ev.reason };
    default:
      return state;
  }
}
```

- [ ] **Step 5: Run to verify pass**

Run: `cd web && npx vitest run __tests__/callReducer.test.ts`
Expected: PASS.

- [ ] **Step 6: Write `web/lib/useVapiCall.ts` (wraps the SDK around the reducer — not unit-tested)**

```ts
"use client";

import { useCallback, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";
import { initialCallState, reduceCall, type CallEvent, type CallState } from "./callReducer";

export type CallStatus = "idle" | "connecting" | "live" | "ended" | "error";

export function useVapiCall(publicKey: string) {
  const vapiRef = useRef<Vapi | null>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [state, setState] = useState<CallState>(initialCallState(0));
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((ev: CallEvent) => setState((s) => reduceCall(s, ev)), []);

  const start = useCallback(
    async (assistantId: string) => {
      try {
        setError(null);
        setStatus("connecting");
        setState(initialCallState(Date.now()));
        const vapi = new Vapi(publicKey);
        vapiRef.current = vapi;

        vapi.on("call-start", () => setStatus("live"));
        vapi.on("error", (e: unknown) => {
          setError(String((e as { message?: string })?.message ?? e));
          setStatus("error");
        });
        vapi.on("message", (msg: any) => {
          if (msg?.type === "transcript") {
            apply({
              kind: "transcript",
              role: msg.role === "user" ? "user" : "bot",
              text: msg.transcript ?? "",
              final: msg.transcriptType === "final",
              at: Date.now(),
            });
          } else if (msg?.type === "tool-calls") {
            const calls = msg.toolCalls ?? msg.toolCallList ?? [];
            for (const c of calls) {
              if (c?.function?.name === "submit_call_result") {
                const raw = c.function.arguments ?? "{}";
                const args = typeof raw === "string" ? JSON.parse(raw) : raw;
                apply({ kind: "tool-call", args });
              }
            }
          }
        });
        vapi.on("call-end", () => {
          apply({ kind: "end", reason: "assistant-ended-call", at: Date.now() });
          setStatus("ended");
        });

        await vapi.start(assistantId);
      } catch (e) {
        setError((e as Error).message);
        setStatus("error");
      }
    },
    [publicKey, apply],
  );

  const stop = useCallback(() => {
    vapiRef.current?.stop();
  }, []);

  return { status, state, error, start, stop };
}
```

- [ ] **Step 7: Commit**

```bash
git add web/package.json web/package-lock.json web/lib/callReducer.ts web/lib/useVapiCall.ts web/__tests__/callReducer.test.ts
git commit -m "feat(web): Vapi Web SDK call hook + tested event reducer"
```

---

### Task 6: LiveCall component (State 2) + page wiring

**Files:**
- Create: `web/components/LiveCall.tsx`
- Modify: `web/app/page.tsx`

- [ ] **Step 1: Write `web/components/LiveCall.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { useVapiCall } from "@/lib/useVapiCall";
import type { AgentNode } from "@/lib/nodes";
import type { CallState } from "@/lib/callReducer";

export function LiveCall({
  assistantId,
  publicKey,
  nodes,
  captureKeys,
  maxDurationSec,
  onEnded,
}: {
  assistantId: string;
  publicKey: string;
  nodes: AgentNode[];
  captureKeys: { nodeId: string; key: string }[];
  maxDurationSec: number;
  onEnded: (state: CallState) => void;
}) {
  const { status, state, error, start, stop } = useVapiCall(publicKey);

  useEffect(() => {
    if (status === "ended") onEnded(state);
  }, [status, state, onEnded]);

  const capturedFor = (nodeId: string) => {
    const k = captureKeys.find((c) => c.nodeId === nodeId)?.key;
    return k ? state.captured.includes(k) : false;
  };

  return (
    <div className="w-full max-w-[1100px] mx-auto px-8 py-12">
      <h1 className="font-extralight text-[40px] -tracking-[0.5px] mb-2">Talk to your agent</h1>
      <p className="text-muted font-light mb-8">Click talk and speak in Hindi. Captured fields light up live.</p>

      <div className="flex gap-3 mb-8">
        {status === "idle" || status === "error" ? (
          <button
            onClick={() => start(assistantId)}
            className="font-semibold text-base text-ink px-7 py-3.5 rounded-xl bg-gradient-to-r from-amber-300 to-fuchsia-400 hover:brightness-110 transition-all"
          >
            🎙 Talk
          </button>
        ) : (
          <button onClick={stop} className="font-medium text-base px-7 py-3.5 rounded-xl border border-line2 text-fg">
            End call
          </button>
        )}
        <span className="self-center text-sm text-faint">
          {status === "connecting" ? "connecting…" : status === "live" ? "● live" : status === "ended" ? "ended" : ""}
        </span>
      </div>

      {error && <div className="mb-6 text-sm text-rose-300">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* transcript */}
        <div className="bg-panel border border-line rounded-2xl p-5 min-h-[260px]">
          <div className="text-xs uppercase tracking-wide text-faint mb-3">Transcript</div>
          <div className="space-y-2">
            {state.transcript.map((t, i) => (
              <div key={i} className="text-sm font-light">
                <span className={t.role === "user" ? "text-sky-300" : "text-fuchsia-300"}>
                  {t.role === "user" ? "Customer" : "Agent"}:
                </span>{" "}
                <span className="font-deva">{t.message}</span>
              </div>
            ))}
            {state.transcript.length === 0 && <div className="text-sm text-faint">…</div>}
          </div>
        </div>

        {/* capture lights */}
        <div className="bg-panel border border-line rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wide text-faint mb-3">Captured data</div>
          <div className="space-y-2.5">
            {nodes.filter((n) => n.capturesData).map((n) => {
              const done = capturedFor(n.id);
              return (
                <div key={n.id} className="flex items-center gap-3 text-sm">
                  <span className={`w-2.5 h-2.5 rounded-full ${done ? "bg-emerald-400" : "bg-line2"}`} />
                  <span className={done ? "text-fg" : "text-faint"}>{n.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `web/app/page.tsx`**

Replace the page body so deploy transitions Build → LiveCall → Result. Full new `web/app/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { IntroSequence } from "@/components/IntroSequence";
import { NodeBuilder, type BuildPayload } from "@/components/NodeBuilder";
import { LiveCall } from "@/components/LiveCall";
import { ResultCard } from "@/components/ResultCard";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import type { AgentNode } from "@/lib/nodes";
import type { CallState } from "@/lib/callReducer";

function FadeIn({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 30);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`w-full transition-all duration-700 ease-out ${shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
      {children}
    </div>
  );
}

type Stage = "intro" | "build" | "live" | "result";

type Deployed = {
  assistantId: string;
  publicKey: string;
  captureKeys: { nodeId: string; key: string }[];
  nodes: AgentNode[];
  maxDurationSec: number;
};

export default function Page() {
  const reduced = usePrefersReducedMotion();
  const [stage, setStage] = useState<Stage>("intro");
  const [deployed, setDeployed] = useState<Deployed | null>(null);
  const [result, setResult] = useState<CallState | null>(null);

  async function handleDeploy(payload: BuildPayload) {
    const res = await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Deploy failed" }));
      alert(`Deploy failed: ${error}`);
      return;
    }
    const data = await res.json();
    setDeployed({
      assistantId: data.assistantId,
      publicKey: data.publicKey,
      captureKeys: data.captureKeys,
      nodes: payload.nodes,
      maxDurationSec: payload.maxDurationSec,
    });
    setStage("live");
  }

  return (
    <main className="min-h-screen w-full">
      {stage === "intro" && (
        <div className="min-h-screen grid place-items-center px-12 overflow-hidden">
          <IntroSequence enabled={!reduced} onDone={() => setStage("build")} />
        </div>
      )}

      {stage === "build" && (
        <div className="relative min-h-screen">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <div className="absolute -top-48 right-[-8%] w-[620px] h-[620px] rounded-full blur-[130px]" style={{ background: "radial-gradient(circle, rgba(245,158,11,0.20), transparent 70%)" }} />
            <div className="absolute bottom-[-25%] left-[-8%] w-[640px] h-[640px] rounded-full blur-[140px]" style={{ background: "radial-gradient(circle, rgba(217,70,239,0.16), transparent 70%)" }} />
          </div>
          <div className="relative">
            <FadeIn><NodeBuilder onDeploy={handleDeploy} /></FadeIn>
          </div>
        </div>
      )}

      {stage === "live" && deployed && (
        <FadeIn>
          <LiveCall
            assistantId={deployed.assistantId}
            publicKey={deployed.publicKey}
            nodes={deployed.nodes}
            captureKeys={deployed.captureKeys}
            maxDurationSec={deployed.maxDurationSec}
            onEnded={(s) => { setResult(s); setStage("result"); }}
          />
        </FadeIn>
      )}

      {stage === "result" && result && deployed && (
        <FadeIn>
          <ResultCard call={result} nodes={deployed.nodes} captureKeys={deployed.captureKeys} onRestart={() => setStage("build")} />
        </FadeIn>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Type-check (ResultCard is added in Task 10; expect an unresolved import until then)**

Run: `cd web && npx tsc --noEmit`
Expected: only error is the missing `@/components/ResultCard` import — proceed; Task 10 resolves it. (Do not run `npm run build` until Task 10.)

- [ ] **Step 4: Commit**

```bash
git add web/components/LiveCall.tsx web/app/page.tsx
git commit -m "feat(web): LiveCall (State 2) + Build->Live->Result stage flow"
```

---

## Phase 4 — Result (State 3)

### Task 7: Port payload-builder to TS

**Files:**
- Create: `web/lib/payload-builder.ts`
- Test: `web/__tests__/payload-builder.test.ts`

- [ ] **Step 1: Write the test (ported from `tests/payload-builder.test.js`)**

```ts
import { describe, it, expect } from "vitest";
import { buildCrmPayload } from "@/lib/payload-builder";

const baseToolCall = {
  rpc_confirmed: true,
  interest: "INTERESTED",
  employment_type: "SALARIED",
  loan_amount_range: "3_5L",
  unclear_count: 0,
  hard_timeout_fired: false,
  exit_state: "HANDOFF",
};
const baseCallData = {
  id: "call-uuid-123",
  createdAt: "2026-06-04T10:00:00Z",
  endedAt: "2026-06-04T10:00:42Z",
  endedReason: "assistant-ended-call",
  customer: { number: "+919876543210" },
};

describe("buildCrmPayload", () => {
  it("builds a complete qualified handoff with score 100", () => {
    const r = buildCrmPayload(baseCallData, baseToolCall);
    expect(r.call_duration_seconds).toBe(42);
    expect(r.qualification_complete).toBe(true);
    expect(r.rep_priority_score).toBe(100);
  });
  it("docks 5 for self-employed", () => {
    expect(buildCrmPayload(baseCallData, { ...baseToolCall, employment_type: "SELF_EMPLOYED" }).rep_priority_score).toBe(95);
  });
  it("docks 20 per NOT_CAPTURED", () => {
    const r = buildCrmPayload(baseCallData, { ...baseToolCall, employment_type: "NOT_CAPTURED", loan_amount_range: "NOT_CAPTURED" });
    expect(r.qualification_complete).toBe(false);
    expect(r.rep_priority_score).toBe(60);
  });
  it("partial payload when no tool call (hangup) scores 45", () => {
    const r = buildCrmPayload({ ...baseCallData, endedReason: "customer-ended-call" }, null);
    expect(r.call_terminated_early).toBe(true);
    expect(r.rep_priority_score).toBe(45);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run __tests__/payload-builder.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `web/lib/payload-builder.ts` (typed port)**

```ts
const CUSTOMER_HANGUP_REASONS = new Set(["customer-ended-call", "customer-hung-up", "hangup"]);

export type ToolCallArgs = {
  rpc_confirmed?: boolean;
  interest?: string;
  employment_type?: string;
  loan_amount_range?: string;
  unclear_count?: number;
  hard_timeout_fired?: boolean;
  exit_state?: string;
} | null;

export type CallData = {
  id?: string;
  createdAt?: string;
  endedAt?: string;
  endedReason?: string;
  customer?: { number?: string };
};

export function buildCrmPayload(callData: CallData, toolCall: ToolCallArgs) {
  const durationSeconds = computeDurationSeconds(callData);

  if (!toolCall) {
    return assemble({
      callData, durationSeconds, rpcConfirmed: false, interest: "NOT_INTERESTED",
      employmentType: "NOT_CAPTURED", loanAmountRange: "NOT_CAPTURED",
      unclearCount: 0, hardTimeoutFired: false, callTerminatedEarly: true,
    });
  }

  const employmentType = toolCall.employment_type ?? "NOT_CAPTURED";
  const loanAmountRange = toolCall.loan_amount_range ?? "NOT_CAPTURED";
  const hardTimeoutFired = toolCall.hard_timeout_fired ?? false;
  const callTerminatedEarly =
    CUSTOMER_HANGUP_REASONS.has(callData.endedReason ?? "") && toolCall.exit_state !== "HANDOFF";

  return assemble({
    callData, durationSeconds, rpcConfirmed: toolCall.rpc_confirmed ?? false,
    interest: toolCall.interest ?? "NOT_INTERESTED", employmentType, loanAmountRange,
    unclearCount: toolCall.unclear_count ?? 0, hardTimeoutFired, callTerminatedEarly,
  });
}

function computeDurationSeconds(callData: CallData): number | null {
  if (!callData.createdAt || !callData.endedAt) return null;
  const start = new Date(callData.createdAt).getTime();
  const end = new Date(callData.endedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 1000);
}

function assemble(o: {
  callData: CallData; durationSeconds: number | null; rpcConfirmed: boolean; interest: string;
  employmentType: string; loanAmountRange: string; unclearCount: number; hardTimeoutFired: boolean; callTerminatedEarly: boolean;
}) {
  const qualificationComplete = o.employmentType !== "NOT_CAPTURED" && o.loanAmountRange !== "NOT_CAPTURED";
  return {
    call_id: o.callData.id ?? null,
    prospect_phone: o.callData.customer?.number ?? null,
    call_timestamp: o.callData.createdAt ?? null,
    call_duration_seconds: o.durationSeconds,
    rpc_confirmed: o.rpcConfirmed,
    interest: o.interest,
    employment_type: o.employmentType,
    loan_amount_range: o.loanAmountRange,
    qualification_complete: qualificationComplete,
    unclear_count: o.unclearCount,
    hard_timeout_fired: o.hardTimeoutFired,
    call_terminated_early: o.callTerminatedEarly,
    rep_priority_score: computeRepPriorityScore(o),
  };
}

function computeRepPriorityScore(o: {
  employmentType: string; loanAmountRange: string; hardTimeoutFired: boolean; callTerminatedEarly: boolean;
}): number {
  let score = 100;
  if (o.employmentType === "SELF_EMPLOYED") score -= 5;
  if (o.employmentType === "NOT_CAPTURED") score -= 20;
  if (o.loanAmountRange === "NOT_CAPTURED") score -= 20;
  if (o.hardTimeoutFired) score -= 10;
  if (o.callTerminatedEarly) score -= 15;
  return Math.max(0, score);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd web && npx vitest run __tests__/payload-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/payload-builder.ts web/__tests__/payload-builder.test.ts
git commit -m "feat(web): port payload-builder to typed module"
```

---

### Task 8: Port latency-tracker to TS

**Files:**
- Create: `web/lib/latency-tracker.ts`
- Test: `web/__tests__/latency-tracker.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { computeTurnLatencies, summarizeLatency } from "@/lib/latency-tracker";

describe("computeTurnLatencies", () => {
  it("pairs user turn with bot reply and computes ms gap", () => {
    const msgs = [
      { role: "user", message: "Haan", secondsFromStart: 4, duration: 1 },
      { role: "bot", message: "ok", secondsFromStart: 5.8, duration: 4 },
    ];
    expect(computeTurnLatencies(msgs)[0].latencyMs).toBe(800);
  });
  it("never returns negative latency", () => {
    const msgs = [
      { role: "user", message: "Haan", secondsFromStart: 5, duration: 1 },
      { role: "bot", message: "ok", secondsFromStart: 5.9, duration: 2 },
    ];
    expect(computeTurnLatencies(msgs)[0].latencyMs).toBe(0);
  });
});

describe("summarizeLatency", () => {
  it("computes min/avg/max/p95", () => {
    const s = summarizeLatency([{ latencyMs: 400 }, { latencyMs: 600 }, { latencyMs: 500 }, { latencyMs: 800 }]);
    expect(s).toMatchObject({ turns: 4, minMs: 400, maxMs: 800, avgMs: 575, p95Ms: 800 });
  });
  it("zeroes for empty", () => {
    expect(summarizeLatency([])).toEqual({ turns: 0, minMs: 0, avgMs: 0, maxMs: 0, p95Ms: 0 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run __tests__/latency-tracker.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `web/lib/latency-tracker.ts` (typed port)**

```ts
export type Turn = { turn: number; afterUserSaid: string; latencyMs: number };
type Msg = { role?: string; message?: string; secondsFromStart?: number; duration?: number };

function toSeconds(d: unknown): number {
  if (typeof d !== "number" || Number.isNaN(d)) return 0;
  return d > 60 ? d / 1000 : d;
}

export function computeTurnLatencies(messages: Msg[] = []): Turn[] {
  const isUser = (m: Msg) => m.role === "user";
  const isBot = (m: Msg) => m.role === "bot" || m.role === "assistant";
  const turns: Turn[] = [];
  let pendingUser: Msg | null = null;
  let turnNo = 0;
  for (const m of messages) {
    if (typeof m.secondsFromStart !== "number") continue;
    if (isUser(m)) pendingUser = m;
    else if (isBot(m) && pendingUser) {
      const userEnd = (pendingUser.secondsFromStart ?? 0) + toSeconds(pendingUser.duration);
      const latencyMs = Math.round(((m.secondsFromStart ?? 0) - userEnd) * 1000);
      turns.push({ turn: ++turnNo, afterUserSaid: String(pendingUser.message ?? "").slice(0, 40), latencyMs: Math.max(0, latencyMs) });
      pendingUser = null;
    }
  }
  return turns;
}

export function summarizeLatency(turns: { latencyMs: number }[] = []) {
  if (turns.length === 0) return { turns: 0, minMs: 0, avgMs: 0, maxMs: 0, p95Ms: 0 };
  const v = turns.map((t) => t.latencyMs).sort((a, b) => a - b);
  const sum = v.reduce((a, b) => a + b, 0);
  const p95 = Math.min(v.length - 1, Math.ceil(0.95 * v.length) - 1);
  return { turns: v.length, minMs: v[0], avgMs: Math.round(sum / v.length), maxMs: v[v.length - 1], p95Ms: v[p95] };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd web && npx vitest run __tests__/latency-tracker.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/latency-tracker.ts web/__tests__/latency-tracker.test.ts
git commit -m "feat(web): port latency-tracker to typed module"
```

---

### Task 9: ResultCard component (State 3)

**Files:**
- Create: `web/components/ResultCard.tsx`

- [ ] **Step 1: Write `web/components/ResultCard.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import type { AgentNode } from "@/lib/nodes";
import type { CallState } from "@/lib/callReducer";
import { buildCrmPayload } from "@/lib/payload-builder";
import { computeTurnLatencies, summarizeLatency } from "@/lib/latency-tracker";

export function ResultCard({
  call,
  nodes,
  captureKeys,
  onRestart,
}: {
  call: CallState;
  nodes: AgentNode[];
  captureKeys: { nodeId: string; key: string }[];
  onRestart: () => void;
}) {
  const payload = useMemo(() => {
    const seconds = call.transcript.length ? Math.max(...call.transcript.map((t) => t.secondsFromStart)) : 0;
    const callData = {
      id: "web-call",
      createdAt: new Date(call.startedAtMs).toISOString(),
      endedAt: new Date(call.startedAtMs + seconds * 1000).toISOString(),
      endedReason: call.endedReason ?? "assistant-ended-call",
    };
    return buildCrmPayload(callData, (call.submitArgs as Record<string, unknown>) ?? null);
  }, [call]);

  const latency = useMemo(() => summarizeLatency(computeTurnLatencies(call.transcript)), [call]);

  const score = payload.rep_priority_score;
  const bars = Math.round(score / 10);

  return (
    <div className="w-full max-w-[900px] mx-auto px-8 py-12">
      <h1 className="font-extralight text-[40px] -tracking-[0.5px] mb-2">Call result</h1>
      <p className="text-muted font-light mb-8">This is the structured disposition your CRM receives.</p>

      <div className="bg-panel border border-line rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-faint">rep priority</span>
          <span className="font-mono text-emerald-300">{"█".repeat(bars)}{"░".repeat(10 - bars)}</span>
          <span className="font-semibold">{score}/100</span>
        </div>
        <pre className="font-mono text-xs text-muted overflow-x-auto leading-relaxed">
{JSON.stringify(payload, null, 2)}
        </pre>
      </div>

      <div className="bg-panel border border-line rounded-2xl p-6 mb-8">
        <div className="text-xs uppercase tracking-wide text-faint mb-2">Agent response latency</div>
        <div className="text-sm font-light">
          {latency.turns} turns · min {latency.minMs}ms · avg {latency.avgMs}ms · p95 {latency.p95Ms}ms · max {latency.maxMs}ms
        </div>
      </div>

      <button
        onClick={onRestart}
        className="font-medium text-base text-ink px-7 py-3.5 rounded-xl bg-gradient-to-r from-amber-300 to-fuchsia-400 hover:brightness-110 transition-all"
      >
        Build another
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Full type-check, tests, build (everything resolves now)**

Run: `cd web && npx tsc --noEmit && npx vitest run && npm run build`
Expected: no type errors; all tests pass; build compiles with routes `/`, `/api/deploy`, `/api/vapi-events` (vapi-events added in Task 10 — if not yet, expect only `/` and `/api/deploy`).

- [ ] **Step 3: Commit**

```bash
git add web/components/ResultCard.tsx
git commit -m "feat(web): ResultCard (State 3) reusing ported payload-builder + latency-tracker"
```

---

### Task 10: `/api/vapi-events` webhook

**Files:**
- Create: `web/app/api/vapi-events/route.ts`

- [ ] **Step 1: Write `web/app/api/vapi-events/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Vapi serverUrl webhook. For tool-calls it must reply with
// { results: [{ toolCallId, result }] } or the model retries. Authoritative
// path / logging; the live UI is driven client-side by the Web SDK.
export async function POST(req: NextRequest) {
  const event = await req.json().catch(() => ({}));
  const type = event?.message?.type;

  if (type === "tool-calls") {
    const list = event.message?.toolCallList ?? [];
    const results = list.map((tc: { id: string }) => ({ toolCallId: tc.id, result: "success" }));
    return NextResponse.json({ results });
  }

  if (type === "end-of-call-report") {
    // eslint-disable-next-line no-console
    console.log("[vapi end-of-call]", JSON.stringify(event.message?.artifact?.toolCalls ?? []).slice(0, 500));
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Build to confirm the route registers**

Run: `cd web && npm run build`
Expected: routes include `/api/deploy` and `/api/vapi-events`.

- [ ] **Step 3: Commit**

```bash
git add web/app/api/vapi-events/route.ts
git commit -m "feat(web): /api/vapi-events webhook (tool-call ack + end-of-call log)"
```

---

### Task 11: Env wiring + docs + manual verification

**Files:**
- Create: `web/.env.example`
- Modify: `web/README.md`

- [ ] **Step 1: Write `web/.env.example`**

```
# Server-only — never exposed to the browser
VAPI_PRIVATE_KEY=your_vapi_private_key

# Sent to the browser for the Web SDK call
VAPI_PUBLIC_KEY=your_vapi_public_key
```

- [ ] **Step 2: Append a "Backend / live call" section to `web/README.md`**

```markdown
## Backend / live call

Deploy compiles your node graph into a Vapi assistant and runs a real
in-browser voice call.

### Env

Copy `.env.example` to `.env.local` and fill in:
- `VAPI_PRIVATE_KEY` — server-side, used by `/api/deploy` to create the assistant.
- `VAPI_PUBLIC_KEY` — sent to the browser for the Web SDK call.

### Flow
1. Build your agent (nodes) → **Deploy** → `POST /api/deploy` compiles + creates a Vapi assistant.
2. **Talk** starts a Web SDK call; transcript streams and data fields light up.
3. On end, the result card shows the scored CRM payload + latency.

### Manual verification (needs real Vapi credentials)
- `npm run dev`, open the app, build → Deploy → Talk, speak Hindi, confirm
  the result card renders a payload with a `rep_priority_score`.
- On Vercel, set the two env vars in project settings; `/api/vapi-events`
  is publicly reachable (no ngrok needed).
```

- [ ] **Step 3: Commit**

```bash
git add web/.env.example web/README.md
git commit -m "docs(web): env wiring + live-call run/verify instructions"
```

- [ ] **Step 4: Final full check**

Run: `cd web && npx vitest run && npx tsc --noEmit && npm run build`
Expected: all tests pass; clean type-check; build compiles with `/`, `/api/deploy`, `/api/vapi-events`.

---

## Self-Review Notes

**Spec coverage (backend slice):**
- §3 generator → replaced by deterministic compiler (Tasks 1–2) per the approved decision. ✓
- §4 architecture (deploy, Web SDK call, reused builders, webhook) → Tasks 3–11. ✓
- State 2 live call (transcript + capture lights) → Tasks 5–6. ✓
- State 3 result (payload + latency, reused modules) → Tasks 7–9. ✓
- Compliance rules in generated prompt → Task 2 (`HANDOFF_AND_RULES`). ✓
- Self-contained for Vercel (no cross-package import) → Tasks 7–8 port the modules. ✓
- No Anthropic key → compiler is deterministic; `/api/deploy` only needs Vapi keys. ✓

**Deviation from spec (intentional):** spec named `/api/generate`; with deterministic compilation there is no model call, so compilation happens inside `/api/deploy` (the compiler module is still independently tested). Documented here.

**Placeholder scan:** none — every step has full code/commands.

**Type consistency:** `CompiledAgent`/`Globals` (Task 2) consumed by `buildAssistantBody` (Task 3) and `/api/deploy` (Task 4). `CallState`/`CallEvent` (Task 5) consumed by `useVapiCall` (Task 5), `LiveCall` (Task 6), `ResultCard` (Task 9). `captureKeys: {nodeId, key}[]` consistent across compiler → deploy response → page → LiveCall/ResultCard. `buildCrmPayload(callData, toolCall|null)` and `computeTurnLatencies/summarizeLatency` signatures match their ports and call sites.

**Known limitation (documented):** per-field capture lights depend on Vapi emitting `submit_call_result` tool-call args; if the agent only calls the tool once at the end, fields light up at end rather than progressively. Acceptable for the showpiece.
```
