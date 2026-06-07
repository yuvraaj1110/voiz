# VOIZ Agent Builder — Design Spec

> **Pivot:** from a single hand-built Hindi loan-qualification agent to a
> **plug-and-play builder**: type a goal + constraints in plain language, and a
> working Hindi voice agent is generated and deployed that you can talk to in
> the browser. Built as a **portfolio showpiece** — one polished happy-path
> flow that reads as a real product.

Date: 2026-06-07
Status: Approved (design); pending implementation plan.

---

## 1. Goal & scope

### What we're building
A one-page web app where a user:
1. Describes an agent's goal in a large free-text box + sets a few knobs.
2. Clicks **Deploy** → Claude generates the agent (system prompt, first line,
   data-extraction tool schema); a Vapi assistant is created via API.
3. Clicks **Talk** → speaks to the agent **in the browser** (Vapi Web SDK),
   watching the live transcript and the requested data points fill in.
4. On call end → sees a clean result card: structured payload, rep-priority
   score, and per-turn latency chart.

### Explicitly out of scope (portfolio showpiece)
- No auth, accounts, or multi-tenancy.
- No billing.
- No persistent database — state lives in the browser session
  (optionally `localStorage` for the last config).
- No real outbound phone calls or number provisioning (in-browser voice only).
- No saved-agent library / dashboards.

### Success criteria
- A stranger can land on the deployed URL, deploy an agent from a preset, talk
  to it, and see structured results — in under two minutes, no setup.
- The flow is screen-recordable for a LinkedIn/Loom clip.
- Reuses the existing tested modules (`payload-builder`, `latency-tracker`)
  without modification.

---

## 2. User experience — one page, three states

Visual theme: **Mono Minimal (dark)** — `#0a0a0b` background, Inter at weight
200–400, monochrome with a thin-underline accent, generous whitespace. The
input box is the visual centerpiece. Hero headline cycles EN ⇄ हिंदी every
~4.2s with a fade.

### State 1 — Build
- Hero headline (animated EN/Hindi).
- **Large goal textarea** (the centerpiece): free-text agent goal.
- **Knobs** (slim controls):
  - Language register: Tier-2/3 conversational Hindi (default) / formal Hindi.
  - Max call duration: 30 / 45 / 60s (default 60).
  - Voice: choose from available Vapi/3rd-party Hindi voices.
  - Data points to collect: 1–3 chips the user names (e.g. "employment",
    "loan amount"); default seeded from the goal.
- **Presets** (2–3): "Loan lead qualifier", "Clinic appointment booking",
  "Delivery feedback" — clicking one fills the goal + knobs so a live demo
  never starts blank.
- **Deploy →** button.

### State 2 — Live call
- **Talk** button requests mic permission and starts the Vapi web call.
- **Left:** live transcript streaming (user + agent turns) from Vapi Web SDK
  `message`/`transcript` events.
- **Right:** the requested data points rendered as cards that **light up** when
  captured (driven by the agent's `submit_*` tool-call events).
- A 60s (or configured) countdown ring.
- **End call** button; call also ends on the agent's terminal state.

### State 3 — Result
- Structured payload card (the JSON the "CRM" receives).
- `rep_priority_score` (0–100) with the bar visual.
- Per-turn **latency** chart (min/avg/p95/max), computed by the reused tracker.
- Full transcript, collapsible.
- "Build another" resets to State 1.

---

## 3. The generator (clever core)

`POST /api/generate` with `{ goal, register, maxDurationSec, voice, dataPoints[] }`.

- Calls **Claude** (Anthropic SDK) with a meta-prompt that includes the existing
  hand-written loan FSM as a **few-shot example** of the desired structure and
  Hindi register.
- Returns:
  - `systemPrompt` — an FSM-style prompt in the target register, honoring the
    duration cap and the requested data points, with UNCLEAR/timeout/exit rules.
  - `firstMessage` — the opening Hindi line.
  - `toolSchema` — a `submit_call_result`-shaped function tool whose properties
    match the requested data points (enums where the model can infer them, else
    free string), always including the universal fields (`interest`,
    `exit_state`, `unclear_count`, etc.).
- **Validation:** the response is parsed and checked (valid JSON, required tool
  fields present, prompt non-empty). On failure, one retry with a stricter
  instruction; if it still fails, return a clear error to the UI.

Generation prompt and validation live in `web/lib/generator/`.

---

## 4. Architecture

```
Browser  (Next.js App Router + React + Tailwind, Mono-Minimal theme)
  │  ① POST {goal, knobs}
  ▼
/api/generate   → Claude (Anthropic SDK) → {systemPrompt, firstMessage, toolSchema}
  │  ② POST {config}
  ▼
/api/deploy     → Vapi REST: create/patch assistant; set serverUrl to /api/vapi-events
  │  ③ {assistantId, vapiPublicKey}
  ▼
Vapi Web SDK (@vapi-ai/web) in the browser  ── live events ──▶ transcript + fields UI
  │  end-of-call (client event)              and/or
  ▼                                          Vapi serverUrl → /api/vapi-events (authoritative)
/api/result     → payload-builder.js + latency-tracker.js (REUSED) → result card
```

### Source of truth for results
- **Primary (live UI):** Vapi Web SDK client events drive the live transcript
  and field-capture animation, and provide the final call artifact.
- **Payload + latency:** the client posts the end-of-call artifact to
  `/api/result`, which runs the **existing** `buildCrmPayload` and
  `computeTurnLatencies`/`summarizeLatency` and returns the structured result.
  This reuses our tested logic verbatim and keeps the builder server-side.
- The Vapi `serverUrl` webhook (`/api/vapi-events`) is wired as a belt-and-
  suspenders authoritative path and for future server-side persistence, but the
  showpiece does not depend on it. On Vercel it is publicly reachable, so **no
  ngrok is required** in the deployed app.

---

## 5. Repository layout (monorepo)

Keep the existing assignment code intact; add the web app alongside and share
logic by import.

```
VOIZ/
  src/server/payload-builder.js     ← reused unchanged
  src/server/latency-tracker.js     ← reused unchanged
  src/prompts/system-prompt.txt     ← becomes the generator's few-shot example
  web/                              ← NEW Next.js app (Vercel root = web/)
    app/
      page.tsx                      ← the one page (3 states via client state)
      api/generate/route.ts
      api/deploy/route.ts
      api/result/route.ts
      api/vapi-events/route.ts      ← Vapi serverUrl webhook (optional path)
    lib/
      generator/                    ← meta-prompt + validation
      vapi.ts                       ← Vapi REST + web-token helpers
      shared/                       ← thin re-export of ../../src/server/*.js
    components/                     ← BuildForm, LiveCall, ResultCard, Hero
    styles/                         ← Mono-Minimal theme (Tailwind config)
```

- Shared modules imported from `src/server/*.js` (ESM) into Next API routes.
- Vercel project root set to `web/`; shared files referenced via relative
  import or a small workspace alias.

---

## 6. Configuration & secrets

Environment variables (Vercel project settings + `.env.local` for dev):
- `ANTHROPIC_API_KEY` — generator.
- `VAPI_PRIVATE_KEY` — server-side assistant create/patch.
- `VAPI_PUBLIC_KEY` — returned to the browser for the Web SDK call.
- All secrets server-side only; the public key is the only Vapi value exposed
  to the client (as designed by Vapi for web calls).

---

## 7. Error handling

| Failure | Behavior |
|---------|----------|
| Generator returns invalid JSON/schema | One stricter retry, then a clear inline error ("Couldn't build that agent — try rephrasing the goal"). |
| Vapi deploy fails | Inline error with the Vapi message; Deploy button re-enabled. |
| Mic permission denied | Friendly prompt explaining the browser needs mic access. |
| Call drops / network loss | Show partial result from whatever events arrived; `call_terminated_early` reflected via the existing builder. |
| Claude/Vapi rate limit | Surface a retry-after message; do not crash the page. |

---

## 8. Testing

- **Reused modules:** keep their existing 24 unit tests green (no changes).
- **Generator:** unit test that, given a sample `{goal, knobs}`, the validation
  layer accepts a well-formed Claude response and rejects malformed ones
  (mock the Claude call — test the validation/normalization, not the model).
- **API routes:** light integration test for `/api/result` asserting it returns
  the same payload shape the builder produces.
- No E2E/browser automation for the showpiece (manual happy-path + Loom).

---

## 9. Build order (for the implementation plan)

1. Scaffold `web/` Next.js app + Tailwind + Mono-Minimal theme + animated hero.
2. Build State 1 (Build form + knobs + presets) — static, no backend.
3. `/api/generate` + generator lib + validation + test.
4. `/api/deploy` + Vapi REST helpers.
5. Vapi Web SDK wiring + State 2 (live transcript + field-capture animation).
6. `/api/result` reusing payload-builder + latency-tracker; State 3 result card.
7. `/api/vapi-events` webhook (optional authoritative path).
8. Polish pass (spacing, motion, empty/error states), deploy to Vercel.
9. README/demo updates + LinkedIn-ready public URL.

---

## 10. Open questions (none blocking)

- Exact preset set can be finalized during build (loan / clinic / feedback is
  the working assumption).
- Voice list depends on which Hindi voices are available on the account at build
  time; default to the current demo voice.
