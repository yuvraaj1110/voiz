# VOIZ — Setup & Architecture (full detail)

> The root `README.md` is kept to the assignment's required 3-section format.
> This file holds the full technical detail.

## What it is

Outbound voice agent that calls loan prospects in Hindi, confirms identity
(Right Party Contact), states the offer, checks interest, asks 2 qualifying
questions, and hands off to a human sales rep with a structured JSON payload —
all within a 55-second hard cap.

## Architecture

| Layer | Choice | Role |
|-------|--------|------|
| Voice orchestration | **Vapi** | Outbound calls, turn-taking, tool dispatch |
| Speech-to-text | **Deepgram Nova-3** (multilingual) | Hindi STT |
| LLM | **Claude 3.5 Haiku** | FSM-driven intent classification + dialogue |
| Text-to-speech | **Vapi "Elliot" (Hindi)** in the demo; ElevenLabs/Sarvam for production | Hindi TTS |
| Backend | **Node.js / Express** | Webhook receiver + CRM payload builder |

The conversation logic is a finite state machine encoded in the LLM system
prompt (`src/prompts/system-prompt.txt`). The webhook server receives Vapi
events and builds the structured handoff payload.

## Call flow (FSM)

```
RPC_CHECK → OFFER_STATEMENT → INTEREST_CHECK
          → QUAL_EMPLOYMENT → QUAL_LOAN_AMOUNT → HANDOFF_BRIDGE → CRM_PAYLOAD
```

Employment is asked first (eligibility filter); loan amount second, in three
buckets (`1_3L` / `3_5L` / `5L_PLUS`) to stay robust to STT noise. Every exit
path — wrong party, no answer, not interested, deferred, double-unclear, hard
timeout, early hangup — terminates in a structured payload. See
`docs/part1-design-artifacts.md` for the full FSM diagram and edge-case matrix.

## Setup

```bash
npm install
cp .env.example .env        # fill in Vapi / Deepgram keys
```

### Run the webhook server

```bash
npm run dev                 # Express on port 3000
ngrok http 3000             # tunnel for Vapi webhooks
# point the Vapi assistant's server URL at https://<ngrok>/webhook/vapi
```

### Create / configure the assistant

```bash
npm run setup               # creates the Vapi assistant via API
```

Then place a test call from the Vapi dashboard (Test Call) or:

```bash
npm run call                # triggers an outbound call to TEST_PHONE_NUMBER
```

## Verify without a phone

```bash
npm test                    # 18 unit tests (vitest)
npm run demo:edge-cases     # replays all 9 exit/failure paths through the
                            # real payload-builder and prints each CRM payload
```

## Output

Each completed call prints a formatted summary and writes
`payloads/<callId>.json`:

```json
{
  "call_id": "uuid",
  "prospect_phone": "+91...",
  "call_duration_seconds": 48,
  "rpc_confirmed": true,
  "interest": "INTERESTED",
  "employment_type": "SALARIED",
  "loan_amount_range": "5L_PLUS",
  "qualification_complete": true,
  "unclear_count": 0,
  "hard_timeout_fired": false,
  "call_terminated_early": false,
  "rep_priority_score": 100
}
```

`rep_priority_score` (0–100) lets reps triage the best leads first: base 100,
−5 self-employed, −20 per uncaptured field, −10 hard timeout, −15 early hangup.

## Project structure

```
src/
  prompts/system-prompt.txt    — FSM system prompt (conversation brain)
  server/index.js              — Express webhook server
  server/payload-builder.js    — CRM payload construction + scoring
  vapi/assistant-config.js     — Vapi assistant configuration
  vapi/tool-schemas.js          — submit_call_result function tool
scripts/
  setup-assistant.js           — create the Vapi assistant
  make-call.js                 — trigger a test call
  demo-edge-cases.js           — replay all exit/failure paths
tests/                         — unit tests (vitest)
docs/
  part1-design-artifacts.md    — FSM diagram, edge matrix, cost math
  SETUP.md                     — this file
```
