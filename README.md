# VOIZ — Hindi Voice Lead Qualification Agent

Outbound voice agent that calls loan prospects in Hindi, confirms identity (RPC), checks interest, asks 2 qualifying questions, and hands off to a human sales rep with a structured JSON payload.

## Architecture

- **Vapi** — Voice orchestration (outbound calls, turn management)
- **Deepgram Nova-2** — Hindi speech-to-text
- **GPT-4o-mini** — Intent classification via FSM system prompt
- **ElevenLabs** — Hindi text-to-speech

## Call Flow

```
GREETING → INTEREST CHECK → LOAN AMOUNT → EMPLOYMENT TYPE → HANDOFF
```

55-second hard cap. 4 conversational turns max. Handles 8 edge cases (garbage STT, language switch, identity questions, double-unclear, hard timeout, out-of-range amounts, interruptions, service failures).

## Setup

```bash
npm install
cp .env.example .env
# Fill in your API keys in .env
```

### Start webhook server

```bash
npm run dev          # starts Express on port 3000
ngrok http 3000      # tunnel for Vapi webhooks
```

### Create Vapi assistant

```bash
npm run setup        # creates assistant via Vapi API
# Save the returned assistant ID to .env
```

### Make a test call

```bash
npm run call         # triggers outbound call to TEST_PHONE_NUMBER
```

## Tests

```bash
npm test
```

## Project Structure

```
src/
  prompts/system-prompt.txt    — FSM system prompt (conversation brain)
  server/index.js              — Express webhook server
  server/payload-builder.js    — CRM payload construction
  vapi/assistant-config.js     — Vapi assistant configuration
  vapi/tool-schemas.js         — Function tool for structured data extraction
scripts/
  setup-assistant.js           — Create Vapi assistant
  make-call.js                 — Trigger test call
tests/                         — Unit tests (vitest)
```

## Output

Each call produces a structured CRM payload:

```json
{
  "call_id": "uuid",
  "lead_name": "Rajesh Kumar",
  "rpc_confirmed": true,
  "interested": true,
  "loan_amount": { "value": 500000, "unit": "lakh", "display": "5 lakh" },
  "employment_type": "salaried",
  "disposition": "QUALIFIED_HANDOFF",
  "flags": [],
  "uncaptured_fields": []
}
```
