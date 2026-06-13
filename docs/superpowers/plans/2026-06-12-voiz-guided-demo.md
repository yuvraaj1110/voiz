# VOIZ Guided Demo + Free-Trial CTA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public demo a zero-cost, interactive-but-simulated walkthrough (scripted Hindi call reusing the real reducer + scorer), with a "Start free trial →" mailto CTA, while keeping the real Vapi call behind `?real=1` for local review.

**Architecture:** A single client-side `mode` (`"mock"` | `"real"`) branches the deploy path and the call hook. The mock call replays a node-derived script through the **same `reduceCall` reducer** the real call uses and feeds the **same `payload-builder`**, so scoring/latency are genuine. `LiveCall` splits into thin `LiveCallReal`/`LiveCallMock` wrappers (Rules of Hooks; keeps `@vapi-ai/web` out of mock). Prod sets no Vapi keys, so real mode is inert publicly.

**Tech Stack:** Next.js 14 App Router, TypeScript, Vitest + React Testing Library (jsdom). All new logic modules are pure and unit-tested.

**Working dir:** all paths are under `web/`. Run all commands from `web/`.

---

### Task 1: Mode resolver

**Files:**
- Create: `web/lib/mode.ts`
- Test: `web/__tests__/mode.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/__tests__/mode.test.ts
import { describe, it, expect } from "vitest";
import { resolveMode } from "@/lib/mode";

describe("resolveMode", () => {
  it("returns 'real' when ?real=1", () => expect(resolveMode("?real=1")).toBe("real"));
  it("defaults to 'mock' for empty search", () => expect(resolveMode("")).toBe("mock"));
  it("stays 'mock' for unrelated params", () => expect(resolveMode("?foo=bar")).toBe("mock"));
  it("stays 'mock' when real has another value", () => expect(resolveMode("?real=0")).toBe("mock"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/mode.test.ts`
Expected: FAIL — cannot resolve `@/lib/mode`.

- [ ] **Step 3: Write the implementation**

```ts
// web/lib/mode.ts
export type DemoMode = "mock" | "real";

/** Public demo is mocked (zero cost). Real Vapi only when ?real=1. */
export function resolveMode(search: string): DemoMode {
  return new URLSearchParams(search).get("real") === "1" ? "real" : "mock";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/mode.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/mode.ts web/__tests__/mode.test.ts
git commit -m "feat(web): demo mode resolver (?real=1 → real, else mock)"
```

---

### Task 2: Demo script generator

**Files:**
- Create: `web/lib/demoScript.ts`
- Test: `web/__tests__/demoScript.test.ts`

Generates a time-ordered, node-aware script: agent line → canned user reply → capture (for data nodes) per node, then the handoff line, then a terminal `end` carrying the meta fields. `eventsForStep` converts a step into the exact `CallEvent`s the existing reducer consumes, so the same logic powers both the test fold and the live hook.

- [ ] **Step 1: Write the failing test**

```ts
// web/__tests__/demoScript.test.ts
import { describe, it, expect } from "vitest";
import { DEFAULT_NODES, type AgentNode } from "@/lib/nodes";
import { compileAgent } from "@/lib/compiler";
import { buildDemoScript, eventsForStep, type ScriptStep } from "@/lib/demoScript";
import { initialCallState, reduceCall } from "@/lib/callReducer";

const GLOBALS = { voice: "male", register: "friendly", maxDurationSec: 55 };
const captureKeys = compileAgent(DEFAULT_NODES, GLOBALS).captureKeys;

describe("buildDemoScript", () => {
  it("is time-ordered and ends with a terminal 'end' step", () => {
    const s = buildDemoScript(DEFAULT_NODES, captureKeys);
    for (let i = 1; i < s.length; i++) expect(s[i].atMs).toBeGreaterThanOrEqual(s[i - 1].atMs);
    expect(s[s.length - 1].kind).toBe("end");
  });

  it("emits exactly one capture per captureKey", () => {
    const s = buildDemoScript(DEFAULT_NODES, captureKeys);
    const caps = s.filter((x): x is Extract<ScriptStep, { kind: "capture" }> => x.kind === "capture");
    expect(caps.map((c) => c.key).sort()).toEqual(captureKeys.map((c) => c.key).sort());
  });

  it("folds (via the real reducer) into a captured, ended, high-score state", () => {
    const s = buildDemoScript(DEFAULT_NODES, captureKeys);
    let state = initialCallState(0);
    for (const step of s) for (const ev of eventsForStep(step, 1000)) state = reduceCall(state, ev);
    expect(state.ended).toBe(true);
    for (const { key } of captureKeys) expect(state.captured).toContain(key);
    expect(state.submitArgs?.rpc_confirmed).toBe(true);
    expect(state.submitArgs?.interest).toBe("INTERESTED");
    expect(state.submitArgs?.employment_type).toBe("SALARIED");
    expect(state.submitArgs?.loan_amount_range).toBe("1-3L");
  });

  it("handles a custom data node (one capture, generic answer)", () => {
    const custom: AgentNode = {
      id: "n-custom-1", type: "custom", title: "City", desc: "", pill: "DATA",
      icon: "interest", accent: "violet", capturesData: true,
      fields: [
        { key: "question", label: "Q", kind: "text", value: "आप किस शहर में रहते हैं?" },
        { key: "field", label: "as", kind: "text", value: "city" },
      ],
    };
    const nodes = [DEFAULT_NODES[0], custom, DEFAULT_NODES[5]];
    const keys = compileAgent(nodes, GLOBALS).captureKeys;
    const s = buildDemoScript(nodes, keys);
    expect(s.filter((x) => x.kind === "capture").length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/demoScript.test.ts`
Expected: FAIL — cannot resolve `@/lib/demoScript`.

- [ ] **Step 3: Write the implementation**

```ts
// web/lib/demoScript.ts
import type { AgentNode } from "./nodes";
import type { CallEvent } from "./callReducer";

export type ScriptStep =
  | { atMs: number; kind: "transcript"; role: "user" | "bot"; text: string }
  | { atMs: number; kind: "capture"; key: string; value: string }
  | { atMs: number; kind: "end"; reason: string; finalArgs: Record<string, unknown> };

const STEP_GAP_MS = 1300;

const CANNED_USER: Record<string, string> = {
  rpc: "जी हाँ, मैं ही बोल रहा हूँ।",
  interest: "हाँ, ज़रा बताइए।",
  employment: "मैं नौकरी करता हूँ।",
  amount: "एक से तीन लाख तक।",
  custom: "जी हाँ।",
};

function field(node: AgentNode, key: string): string {
  return String(node.fields.find((f) => f.key === key)?.value ?? "");
}

/** First configured option, else a generic non-empty marker so the field lights up. */
function captureValue(node: AgentNode): string {
  const opts = node.fields.find((f) => f.key === "options")?.value;
  if (Array.isArray(opts) && opts.length > 0) return String(opts[0]);
  return "PROVIDED";
}

/** Build the timed walkthrough script for the agent the user just configured. */
export function buildDemoScript(
  nodes: AgentNode[],
  captureKeys: { nodeId: string; key: string }[],
): ScriptStep[] {
  const steps: ScriptStep[] = [];
  let t = 0;
  const push = (s: Omit<ScriptStep, "atMs">) => {
    steps.push({ atMs: t, ...s } as ScriptStep);
    t += STEP_GAP_MS;
  };
  const keyFor = (nodeId: string) => captureKeys.find((c) => c.nodeId === nodeId)?.key;

  for (const node of nodes) {
    if (node.type === "handoff") continue;

    const agentLine =
      node.type === "rpc" ? field(node, "line")
      : node.type === "offer" ? field(node, "script")
      : field(node, "question");
    if (agentLine) push({ kind: "transcript", role: "bot", text: agentLine });

    if (node.type === "offer") continue; // statement, no reply

    push({ kind: "transcript", role: "user", text: CANNED_USER[node.type] ?? CANNED_USER.custom });

    if (node.capturesData) {
      const key = keyFor(node.id);
      if (key) push({ kind: "capture", key, value: captureValue(node) });
    }
  }

  const handoff = nodes.find((n) => n.type === "handoff");
  if (handoff) push({ kind: "transcript", role: "bot", text: field(handoff, "line") });

  steps.push({
    atMs: t,
    kind: "end",
    reason: "assistant-ended-call",
    finalArgs: {
      rpc_confirmed: true,
      interest: "INTERESTED",
      exit_state: "HANDOFF",
      unclear_count: 0,
      hard_timeout_fired: false,
    },
  });

  return steps;
}

/** Convert a script step into the CallEvents the existing reducer understands. */
export function eventsForStep(step: ScriptStep, atMs: number): CallEvent[] {
  switch (step.kind) {
    case "transcript":
      return [{ kind: "transcript", role: step.role, text: step.text, final: true, at: atMs }];
    case "capture":
      return [{ kind: "tool-call", args: { [step.key]: step.value } }];
    case "end":
      return [
        { kind: "tool-call", args: step.finalArgs },
        { kind: "end", reason: step.reason, at: atMs },
      ];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/demoScript.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/demoScript.ts web/__tests__/demoScript.test.ts
git commit -m "feat(web): node-aware demo script + reducer event mapping (tested)"
```

---

### Task 3: Mock call hook

**Files:**
- Create: `web/lib/useMockCall.ts`

Mirrors `useVapiCall`'s return shape `{ status, state, error, start, stop }` so the view code is identical. Replays the script via timers into `reduceCall`. Imports only a **type** from `useVapiCall`, so `@vapi-ai/web` is never bundled here.

- [ ] **Step 1: Write the implementation**

```ts
// web/lib/useMockCall.ts
"use client";

import { useCallback, useRef, useState } from "react";
import { initialCallState, reduceCall, type CallEvent, type CallState } from "./callReducer";
import { buildDemoScript, eventsForStep } from "./demoScript";
import type { AgentNode } from "./nodes";
import type { CallStatus } from "./useVapiCall";

const CONNECT_MS = 250;

/** Simulated call: replays a scripted Hindi conversation through the real reducer. */
export function useMockCall(nodes: AgentNode[], captureKeys: { nodeId: string; key: string }[]) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [state, setState] = useState<CallState>(initialCallState(0));
  const [error] = useState<string | null>(null);

  const apply = useCallback((ev: CallEvent) => setState((s) => reduceCall(s, ev)), []);
  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const start = useCallback(() => {
    clear();
    setStatus("connecting");
    setState(initialCallState(Date.now()));
    timers.current.push(setTimeout(() => setStatus("live"), CONNECT_MS));

    for (const step of buildDemoScript(nodes, captureKeys)) {
      timers.current.push(
        setTimeout(() => {
          for (const ev of eventsForStep(step, Date.now())) apply(ev);
          if (step.kind === "end") setStatus("ended");
        }, CONNECT_MS + step.atMs),
      );
    }
  }, [nodes, captureKeys, apply, clear]);

  const stop = useCallback(() => {
    clear();
    apply({ kind: "end", reason: "stopped", at: Date.now() });
    setStatus("ended");
  }, [clear, apply]);

  return { status, state, error, start, stop };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Behaviour is exercised end-to-end by Task 2's fold test, which uses the same `buildDemoScript`/`eventsForStep`, plus manual verify in Task 7.)

- [ ] **Step 3: Commit**

```bash
git add web/lib/useMockCall.ts
git commit -m "feat(web): useMockCall — scripted call over the real reducer, no Vapi import"
```

---

### Task 4: Free-trial CTA

**Files:**
- Create: `web/components/TrialCta.tsx`
- Test: `web/__tests__/TrialCta.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/__tests__/TrialCta.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrialCta } from "@/components/TrialCta";

describe("TrialCta", () => {
  it("links to the owner email via mailto with a prefilled subject", () => {
    render(<TrialCta />);
    const href = screen.getByRole("link").getAttribute("href") ?? "";
    expect(href).toContain("mailto:yuvraajsuri1110@gmail.com");
    expect(href).toContain("subject=");
  });

  it("renders a custom label", () => {
    render(<TrialCta label="Like it? Start free trial →" />);
    expect(screen.getByRole("link").textContent).toBe("Like it? Start free trial →");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/TrialCta.test.tsx`
Expected: FAIL — cannot resolve `@/components/TrialCta`.

- [ ] **Step 3: Write the implementation**

```tsx
// web/components/TrialCta.tsx
const MAIL = "yuvraajsuri1110@gmail.com";
const SUBJECT = "VOIZ — free trial request";
const BODY = "Hi Yuvraaj, I tried the VOIZ demo and would like a free trial.";

const HREF = `mailto:${MAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`;

const BASE =
  "bg-gradient-to-r from-amber-300 to-fuchsia-400 text-ink font-semibold hover:brightness-110 transition-all";

export function TrialCta({
  variant = "inline",
  label = "Start free trial →",
}: {
  variant?: "floating" | "inline";
  label?: string;
}) {
  const cls =
    variant === "floating"
      ? `fixed top-5 right-6 z-50 text-sm px-4 py-2 rounded-lg ${BASE}`
      : `inline-block text-base px-7 py-3.5 rounded-xl ${BASE}`;
  return (
    <a href={HREF} className={cls}>
      {label}
    </a>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/TrialCta.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/components/TrialCta.tsx web/__tests__/TrialCta.test.tsx
git commit -m "feat(web): TrialCta — mailto free-trial button (floating + inline)"
```

---

### Task 5: Split LiveCall into mode-aware wrappers

**Files:**
- Modify (full rewrite): `web/components/LiveCall.tsx`

Replace the single component with a `mode`-aware dispatcher + `LiveCallReal` / `LiveCallMock` wrappers (each calls exactly one hook) + a shared presentational `LiveCallView`. The view JSX is the existing markup, with `onTalk`/`onStop` callbacks and a "Simulated" pill in mock mode. `maxDurationSec` is dropped from the props (it was unused — `void maxDurationSec`).

- [ ] **Step 1: Rewrite the file**

```tsx
// web/components/LiveCall.tsx
"use client";

import { useEffect } from "react";
import { useVapiCall, type CallStatus } from "@/lib/useVapiCall";
import { useMockCall } from "@/lib/useMockCall";
import type { AgentNode } from "@/lib/nodes";
import type { CallState } from "@/lib/callReducer";
import type { DemoMode } from "@/lib/mode";

export type LiveCallProps = {
  mode: DemoMode;
  assistantId: string;
  publicKey: string;
  nodes: AgentNode[];
  captureKeys: { nodeId: string; key: string }[];
  onEnded: (state: CallState) => void;
};

export function LiveCall(props: LiveCallProps) {
  return props.mode === "real" ? <LiveCallReal {...props} /> : <LiveCallMock {...props} />;
}

function LiveCallReal({ assistantId, publicKey, nodes, captureKeys, onEnded }: LiveCallProps) {
  const { status, state, error, start, stop } = useVapiCall(publicKey);
  useEffect(() => {
    if (status === "ended") onEnded(state);
  }, [status, state, onEnded]);
  return (
    <LiveCallView
      simulated={false}
      status={status}
      state={state}
      error={error}
      nodes={nodes}
      captureKeys={captureKeys}
      onTalk={() => start(assistantId)}
      onStop={stop}
    />
  );
}

function LiveCallMock({ nodes, captureKeys, onEnded }: LiveCallProps) {
  const { status, state, error, start, stop } = useMockCall(nodes, captureKeys);
  useEffect(() => {
    if (status === "ended") onEnded(state);
  }, [status, state, onEnded]);
  return (
    <LiveCallView
      simulated
      status={status}
      state={state}
      error={error}
      nodes={nodes}
      captureKeys={captureKeys}
      onTalk={() => start()}
      onStop={stop}
    />
  );
}

function LiveCallView({
  simulated,
  status,
  state,
  error,
  nodes,
  captureKeys,
  onTalk,
  onStop,
}: {
  simulated: boolean;
  status: CallStatus;
  state: CallState;
  error: string | null;
  nodes: AgentNode[];
  captureKeys: { nodeId: string; key: string }[];
  onTalk: () => void;
  onStop: () => void;
}) {
  const capturedFor = (nodeId: string) => {
    const k = captureKeys.find((c) => c.nodeId === nodeId)?.key;
    return k ? state.captured.includes(k) : false;
  };

  return (
    <div className="w-full max-w-[1100px] mx-auto px-8 py-12">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="font-extralight text-[40px] -tracking-[0.5px]">Talk to your agent</h1>
        {simulated && (
          <span className="text-[10px] uppercase tracking-wide text-ink bg-amber-300 px-2 py-1 rounded-full font-semibold">
            Simulated
          </span>
        )}
      </div>
      <p className="text-muted font-light mb-8">
        {simulated
          ? "Press Talk to watch a sample Hindi call run — captured fields light up live."
          : "Click talk and speak in Hindi. Captured fields light up live."}
      </p>

      <div className="flex gap-3 mb-8">
        {status === "idle" || status === "error" ? (
          <button
            onClick={onTalk}
            className="font-semibold text-base text-ink px-7 py-3.5 rounded-xl bg-gradient-to-r from-amber-300 to-fuchsia-400 hover:brightness-110 transition-all"
          >
            🎙 Talk
          </button>
        ) : (
          <button onClick={onStop} className="font-medium text-base px-7 py-3.5 rounded-xl border border-line2 text-fg">
            End call
          </button>
        )}
        <span className="self-center text-sm text-faint">
          {status === "connecting" ? "connecting…" : status === "live" ? "● live" : status === "ended" ? "ended" : ""}
        </span>
      </div>

      {error && <div className="mb-6 text-sm text-rose-300">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        <div className="bg-panel border border-line rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wide text-faint mb-3">Captured data</div>
          <div className="space-y-2.5">
            {nodes
              .filter((n) => n.capturesData)
              .map((n) => {
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

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `web/app/page.tsx` only (LiveCall now needs `mode` and no longer takes `maxDurationSec`). Those are fixed in Task 6. The `LiveCall.tsx` file itself must report no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/LiveCall.tsx
git commit -m "refactor(web): LiveCall → mode-aware Real/Mock wrappers + shared view"
```

---

### Task 6: Wire mode, mock deploy, and CTAs into the page

**Files:**
- Modify: `web/app/page.tsx`
- Modify: `web/components/ResultCard.tsx`

- [ ] **Step 1: Add imports to `web/app/page.tsx`**

Add to the existing import block (after the `ResultCard` import):

```tsx
import { TrialCta } from "@/components/TrialCta";
import { compileAgent } from "@/lib/compiler";
import { resolveMode, type DemoMode } from "@/lib/mode";
```

- [ ] **Step 2: Add mode state + resolve after mount**

In `Page()`, immediately after `const reduced = usePrefersReducedMotion();`:

```tsx
  const [mode, setMode] = useState<DemoMode>("mock");
  useEffect(() => {
    setMode(resolveMode(window.location.search));
  }, []);
```

- [ ] **Step 3: Branch `handleDeploy` for mock mode**

Replace the start of `handleDeploy` (the `async function handleDeploy(payload: BuildPayload) {` line through the first `setStage("live");`) so the mock path short-circuits before any network call:

```tsx
  async function handleDeploy(payload: BuildPayload) {
    if (mode === "mock") {
      const compiled = compileAgent(payload.nodes, {
        voice: payload.voice,
        register: payload.register,
        maxDurationSec: payload.maxDurationSec,
      });
      setDeployed({
        assistantId: "demo",
        publicKey: "",
        captureKeys: compiled.captureKeys,
        nodes: payload.nodes,
        maxDurationSec: payload.maxDurationSec,
      });
      setStage("live");
      return;
    }

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
```

- [ ] **Step 4: Render the floating CTA and pass `mode` to LiveCall**

Add the floating CTA right after the existing `<HomeLogo onClick={goHome} />` line:

```tsx
      <TrialCta variant="floating" />
```

Update the `<LiveCall .../>` usage — add `mode={mode}` and remove the `maxDurationSec={deployed.maxDurationSec}` prop (LiveCall no longer accepts it):

```tsx
          <LiveCall
            mode={mode}
            assistantId={deployed.assistantId}
            publicKey={deployed.publicKey}
            nodes={deployed.nodes}
            captureKeys={deployed.captureKeys}
            onEnded={(s) => { setResult(s); setStage("result"); }}
          />
```

- [ ] **Step 5: Add the inline CTA to `web/components/ResultCard.tsx`**

Add the import at the top (after the `latency-tracker` import):

```tsx
import { TrialCta } from "@/components/TrialCta";
```

Replace the final "Build another" button block with a row that includes the CTA:

```tsx
      <div className="flex items-center gap-4">
        <button
          onClick={onRestart}
          className="font-medium text-base text-ink px-7 py-3.5 rounded-xl bg-gradient-to-r from-amber-300 to-fuchsia-400 hover:brightness-110 transition-all"
        >
          Build another
        </button>
        <TrialCta variant="inline" label="Like it? Start free trial →" />
      </div>
```

- [ ] **Step 6: Typecheck + full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass (previous 43 + mode 4 + demoScript 4 + TrialCta 2 = 53).

- [ ] **Step 7: Commit**

```bash
git add web/app/page.tsx web/components/ResultCard.tsx
git commit -m "feat(web): wire demo mode + mock deploy + free-trial CTAs"
```

---

### Task 7: Docs + manual verification

**Files:**
- Modify: `web/README.md`

- [ ] **Step 1: Add a "Demo modes" section to `web/README.md`**

Insert after the existing "Backend / live call" section:

```markdown
## Demo modes

The app runs in one of two modes, resolved client-side from the URL:

- **Mock (default, public):** `/` — the builder is real, but Deploy/Talk run a
  **simulated** Hindi call (scripted transcript through the real reducer +
  scorer). No mic, no Vapi, **no cost**. This is what visitors see.
- **Real:** `/?real=1` — Deploy hits `/api/deploy` and Talk uses the Vapi Web
  SDK. Only works where Vapi keys are set (your local `.env.local`).

**Deploy safety:** on the public host (Vercel) **do not set** `VAPI_PRIVATE_KEY`
/ `VAPI_PUBLIC_KEY`. Real mode is then inert even if someone adds `?real=1`, so
the public demo can never spend money. Keep the keys only in local `.env.local`
for the live review.
```

- [ ] **Step 2: Manual verification (mock — the default)**

Run: `npm run dev`, open `http://localhost:3000`.
Verify: intro → builder → **Deploy** (no network call) → **Talk** → the scripted Hindi transcript streams line by line, the employment + loan-amount lights turn green in order, the call ends, and the **ResultCard shows `rep_priority_score: 100`** with latency stats. The floating **Start free trial →** (top-right) and the ResultCard CTA open a `mailto:` to `yuvraajsuri1110@gmail.com`.

- [ ] **Step 3: Manual verification (real — needs local Vapi keys)**

Run: open `http://localhost:3000/?real=1` with keys in `.env.local`.
Verify: **Deploy** creates a real assistant and **Talk** starts a real mic call (the "Simulated" pill is absent). This is the path for the Predixion review.

- [ ] **Step 4: Commit**

```bash
git add web/README.md
git commit -m "docs(web): document mock/real demo modes + deploy safety"
```

---

## Self-Review

**Spec coverage:**
- Mode resolution → Task 1. ✓
- Mock deploy (client compile, no fetch) → Task 6 Step 3. ✓
- Node-aware demo script + reuse of `reduceCall` → Task 2. ✓
- `useMockCall` mirroring `useVapiCall` interface, no Vapi import → Task 3. ✓
- Real scoring via `payload-builder` in ResultCard → unchanged; mock feeds it genuine args (Task 2 fold test asserts `employment_type=SALARIED`, `loan_amount_range=1-3L` → score 100). ✓
- LiveCall Real/Mock wrapper split (Rules of Hooks) → Task 5. ✓
- "Simulated" badge + guidance copy → Task 5 view. ✓
- TrialCta floating + ResultCard inline → Tasks 4, 6. ✓
- Email `yuvraajsuri1110@gmail.com` → Task 4. ✓
- Deploy safety (no prod keys) → Task 7 docs. ✓
- Builder guidance: NodeBuilder already shows "Each step is a node. Configure it, add your own, then deploy." — no new line needed (YAGNI). ✓

**Placeholder scan:** none — every code step has complete code; commands have expected output.

**Type consistency:** `ScriptStep`, `eventsForStep`, `buildDemoScript`, `DemoMode`, `resolveMode`, `LiveCallProps`, `CallStatus` (imported as type), `CallEvent`/`CallState` (existing) are consistent across tasks. `useMockCall(nodes, captureKeys)` and `useVapiCall(publicKey)` both return `{ status, state, error, start, stop }`; the view consumes only the shared subset. `compileAgent(nodes, Globals)` matches the existing signature; `Globals = { voice, register, maxDurationSec }` matches `BuildPayload` fields.
