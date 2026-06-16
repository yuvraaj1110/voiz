# VOIZ Agent Builder — Web (frontend)

Next.js frontend for the plug-and-play Hindi voice-agent builder. This is the
**frontend-only** slice: animated intro → fintech Build screen with a mocked
deploy. Live generation/voice arrive in a later plan.

## Run

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

## Test

```bash
npm test           # Vitest + React Testing Library
```

## Build

```bash
npm run build
```

## Structure

- `app/` — App Router pages (`page.tsx` orchestrates State 0 → State 1)
- `components/` — `IntroSequence` (State 0), `NodeBuilder` (State 1),
  `LiveCall` (State 2), `ResultCard` (State 3), `icons`
- `lib/` — `nodes` (node model), `compiler` (node graph → Vapi config),
  `vapi` (assistant body + create), `payload-builder`, `latency-tracker`,
  `callReducer` + `useVapiCall`, `useIntroTimeline`, `usePrefersReducedMotion`

## Demo modes

The app runs in one of two modes, resolved client-side from the URL:

- **Mock (default, public):** `/` — the builder is real, but Deploy/Talk run a
  **simulated** Hindi call (scripted transcript through the real reducer +
  scorer). No mic, no Vapi, **no cost**. This is what visitors see.

  Each step has an editable **Sample customer reply** field — type any text
  (Hinglish included) and the simulation plays it as the customer's line; for
  custom steps it also becomes the captured value in the result. Add a step,
  type its question + reply, and it appears as an extra exchange in the sim.
- **Real:** `/?real=1` — Deploy hits `/api/deploy` and Talk uses the Vapi Web
  SDK. Only works where Vapi keys are set (your local `.env.local`).

**Deploy safety:** on the public host (Vercel) **do not set** `VAPI_PRIVATE_KEY`
/ `VAPI_PUBLIC_KEY`. Real mode is then inert even if someone adds `?real=1`, so
the public demo can never spend money. Keep the keys only in local `.env.local`
for the live review.

## Backend / live call

Deploy compiles your node graph into a Vapi assistant and runs a real
in-browser voice call.

### Env

Copy `.env.example` to `.env.local` and fill in:
- `VAPI_PRIVATE_KEY` — server-side, used by `/api/deploy` to create the assistant.
- `VAPI_PUBLIC_KEY` — sent to the browser for the Web SDK call.

### Flow
1. Build your agent (nodes) → **Deploy** → `POST /api/deploy` compiles the
   Hindi FSM prompt + tool schema and creates a Vapi assistant.
2. **Talk** starts a Web SDK call; the transcript streams and data fields
   light up as they're captured.
3. On end, the result card shows the scored CRM payload + latency, reusing
   the ported `payload-builder` + `latency-tracker`.

### Manual verification (needs real Vapi credentials)
- `npm run dev`, open the app, build → Deploy → Talk, speak Hindi, confirm
  the result card renders a payload with a `rep_priority_score`.
- On Vercel, set the two env vars in project settings; `/api/vapi-events`
  is publicly reachable (no ngrok needed).
