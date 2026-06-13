# VOIZ Guided Demo + Free-Trial CTA — Design

**Date:** 2026-06-12
**Status:** Approved
**Context:** Portfolio goal. The build → deploy → Vapi voice → scored-result loop works locally. For a public deploy we want visitors to experience the product with **zero Vapi cost**, plus a lead-capture CTA. This supersedes the shelved Upstash cost-cap spec (`2026-06-12-voiz-public-demo-hardening-design.md`) — with no real public calls, no cost guard is needed.

## Goal

A public, interactive-but-simulated walkthrough: visitors really click through the builder and Deploy/Talk, but the "call" is a scripted Hindi simulation — no mic, no Vapi, no money. A "Start free trial →" CTA opens the owner's email. The real Vapi call stays available behind a flag for the live Predixion review.

## Decisions (owner)

- **Interactive but mocked** walkthrough (visitor drives; call is simulated).
- **Real call kept behind a flag** (`?real=1`), inert on public because prod has no Vapi keys.
- **CTA → `mailto:yuvraajsuri1110@gmail.com`**, label "Start free trial →".
- **Canned Hindi transcript** matching what the real FSM produces.

## Architecture

One client-side mode value (`"mock"` | `"real"`) branches three things: the deploy path, the call hook, and a "Simulated" badge. Everything else (builder, compiler, payload-builder, ResultCard, reducer) is reused unchanged. The mock call replays a node-derived script through the **same `reduceCall` reducer** the real call uses, so the UI code path is identical.

```
?real=1 ──▶ mode="real" ──▶ handleDeploy → /api/deploy → useVapiCall (real Vapi)
(default) ─▶ mode="mock" ──▶ handleDeploy → client compile → useMockCall (scripted)
                                                                   │
                              both feed reduceCall → LiveCall → ResultCard (real scoring)
```

**Safety:** prod (Vercel) has **no Vapi env keys**, so `/api/deploy` returns an error and the real path cannot spend money even if `?real=1` is set. Keys live only in the owner's local `.env.local`.

## Components & files

### New

**`web/lib/mode.ts`** — pure.
```ts
export type DemoMode = "mock" | "real";
export function resolveMode(search: string): DemoMode; // "?real=1" → "real", else "mock"
```
Called in `page.tsx` from `window.location.search` (guarded for SSR: default "mock" until mounted).

**`web/lib/demoScript.ts`** — pure, the heart of the simulation.
```ts
export type ScriptStep =
  | { atMs: number; kind: "transcript"; line: TranscriptLine }      // role + text
  | { atMs: number; kind: "capture"; key: string }                  // lights up a field
  | { atMs: number; kind: "result"; toolCall: SubmitCallResultArgs }; // terminal synthetic payload

export function buildDemoScript(nodes: AgentNode[], captureKeys: {nodeId:string;key:string}[]): ScriptStep[];
```
Generates: an opening agent line (from the compiled `firstMessage`), then for each capture node a **(Hindi agent question → canned customer answer)** transcript pair followed by a `capture` step for that key, then a Hindi handoff line, then a single `result` step whose `toolCall` sets each captured field to a sensible happy-path value (employment=SALARIED, amount bucket, interest=INTERESTED, rpc_confirmed=true). Custom nodes get a generic question/answer and a `"<custom>"` capture value. Timings: ~1.4s between steps so the transcript streams believably.

**`web/lib/useMockCall.ts`** — mirrors `useVapiCall`'s return shape `{ status, state, error, start, stop }`. On `start()`, schedules the script steps via timers, dispatching each into `reduceCall` (transcript → message event; capture → a synthetic tool-call event marking the key captured; result → end-of-call with the synthetic payload). `stop()` clears timers and ends. No network, no `@vapi-ai/web` import.

**`web/components/TrialCta.tsx`** — a button/link:
```
mailto:yuvraajsuri1110@gmail.com?subject=VOIZ%20—%20free%20trial%20request&body=Hi%20Yuvraaj,%20I%20tried%20the%20VOIZ%20demo%20and%20would%20like%20a%20free%20trial.
```
Gradient style matching the existing CTA. Two placements (below).

### Modified

**`web/app/page.tsx`**
- Resolve `mode` after mount.
- `handleDeploy`: if `mock`, compile client-side via `compileAgent(nodes, globals)` to obtain `captureKeys`, build `Deployed` with `assistantId:"demo"`, `publicKey:""`, then `setStage("live")` — no fetch. If `real`, keep today's fetch.
- Render `<TrialCta variant="floating" />` fixed top-right (opposite the HomeLogo).

**`web/components/LiveCall.tsx`**
- Accept `mode` (or select the hook internally): `const call = mode === "mock" ? useMockCall(...) : useVapiCall(...)`. Both hooks share the same interface, so the rest is untouched.
- In mock mode show a small **"Simulated"** pill near the status, and a one-line helper ("Press Talk to watch a sample call").
- Hooks must be called unconditionally — implement by always calling both hooks but only `start()`-ing the active one, OR (preferred) split into `LiveCallReal` / `LiveCallMock` thin wrappers that each call one hook and render a shared `LiveCallView`. Use the wrapper split to respect the Rules of Hooks.

**`web/components/ResultCard.tsx`**
- Add a primary `<TrialCta variant="inline" />` ("Like it? Start free trial →") alongside the existing "Build another".

**`web/components/NodeBuilder.tsx`**
- One-line stage helper under the header: "Configure your nodes, then Deploy." (light guidance, no coachmarks).

## Data flow (mock call)

`buildDemoScript(nodes, captureKeys)` → `useMockCall` timers → `reduceCall` state → `LiveCallView` renders transcript + capture lights → on `result` step, `onEnded(state)` fires → `page.tsx` sets result → `ResultCard` runs the **real** `buildCrmPayload` on the synthetic toolCall → genuine `rep_priority_score` + latency display.

## Rules-of-Hooks note

`useVapiCall` imports `@vapi-ai/web`; we must not call it in mock mode (and ideally avoid bundling its side effects when unused). The `LiveCallReal` / `LiveCallMock` wrapper split ensures only one hook is mounted per render, and lets the real wrapper be dynamically importable later if bundle size matters (not required now).

## Testing

- `web/__tests__/mode.test.ts` — `resolveMode("?real=1")==="real"`, `resolveMode("")==="mock"`, `resolveMode("?x=1")==="mock"`.
- `web/__tests__/demoScript.test.ts` — for default nodes: steps are time-ordered; exactly one `capture` step per captureKey; a single terminal `result` step; the result payload marks each captured key with a non-`NOT_CAPTURED` value; custom node produces a transcript pair + capture. 
- `useMockCall` covered indirectly via `reduceCall` (already tested) — assert that feeding the script's synthetic events yields a `state` with captured keys set and a final payload. A focused test drives the reducer with `buildDemoScript` output (fake timers) and checks the end state.
- No network/integration tests.

## Deploy

1. Vercel project, root `web/`. **Do not set `VAPI_PRIVATE_KEY` / `VAPI_PUBLIC_KEY` in prod** → real mode inert, zero cost.
2. Default URL = mock walkthrough. Owner uses `http://localhost:3000/?real=1` locally (with keys in `.env.local`) for the live review.
3. Verify on Vercel: open URL → build → Deploy → Talk → simulated transcript streams, lights fire, ResultCard shows a score; "Start free trial →" opens the mail client.

## Out of scope

- Recorded video.
- Server-side lead capture / CRM (CTA is mailto only).
- Auth, analytics, multi-tenant.
- Any change to compiler/payload-builder/voice logic.
