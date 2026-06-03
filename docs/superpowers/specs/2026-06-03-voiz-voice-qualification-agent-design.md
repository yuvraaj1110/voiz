# VOIZ — Hindi Voice Lead Qualification Agent

**Date:** 2026-06-03
**Status:** Approved
**Context:** PM Assignment from Predixion AI — Live Voice Prototype (Option B)

## Overview

Outbound voice agent that calls loan prospects in Hindi, confirms identity (RPC), checks interest, asks 2 qualifying questions (loan amount, employment type), and hands off to a human sales rep with a structured JSON payload. 55-second hard cap per call.

## Architecture

Vapi orchestrates the call, connecting Deepgram Nova-2 (Hindi STT), GPT-4o-mini (intent classification), and ElevenLabs (Hindi TTS). n8n handles webhook workflows — receiving Vapi events, running FSM logic, and pushing the final payload to a mock CRM endpoint.

```
Outbound Call (Vapi SIP)
  → Customer picks up
  → Deepgram Nova-2 transcribes Hindi speech
  → GPT-4o-mini classifies intent (max 4 calls/conversation)
  → FSM in n8n determines next prompt
  → ElevenLabs speaks Hindi response
  → On completion/timeout → structured JSON to CRM
```

## FSM States & Transitions

| State | Purpose | Max Duration | Exit Conditions |
|-------|---------|-------------|-----------------|
| `GREETING` | Introduce, ask for name confirmation (RPC) | 10s | Confirmed → `INTEREST_CHECK`, Denied → `WRONG_PERSON_EXIT`, No response → retry once → `TIMEOUT_EXIT` |
| `INTEREST_CHECK` | "Kya aapko personal loan mein interest hai?" | 10s | Yes → `Q1_LOAN_AMOUNT`, No → `NOT_INTERESTED_EXIT`, Unclear → rephrase once → `UNCLEAR_EXIT` |
| `Q1_LOAN_AMOUNT` | "Kitne ka loan chahiye roughly?" | 12s | Parsed amount → `Q2_EMPLOYMENT`, Out-of-range → clarify once, Unclear → store null → `Q2_EMPLOYMENT` |
| `Q2_EMPLOYMENT` | "Aap job karte hain ya business?" | 12s | Salaried/Self-employed/Other → `HANDOFF`, Unclear → rephrase once → `HANDOFF` with null |
| `HANDOFF` | "Main aapko humare loan advisor se connect karta hoon" | 5s | Always → `CALL_END` |
| `CALL_END` | Terminate call, emit payload | — | Terminal |

**Exit states:** `WRONG_PERSON_EXIT`, `NOT_INTERESTED_EXIT`, `TIMEOUT_EXIT` (hard 55s cap), `UNCLEAR_EXIT` (double-unclear on interest check), `ERROR_EXIT` (service failure).

**Hard rule:** 55-second total call cap. Timer starts at customer pickup. If exceeded mid-question, gracefully exit with whatever data is collected.

## Intent Classification (GPT-4o-mini)

4 LLM calls max per conversation, allocated as:

1. **RPC confirmation** — "Is this [Name]?" → `CONFIRMED` / `DENIED` / `UNCLEAR`
2. **Interest check** — → `YES` / `NO` / `UNCLEAR`
3. **Loan amount extraction** — → `{amount: number, unit: "lakh"|"crore"}` or `null`
4. **Employment classification** — → `SALARIED` / `SELF_EMPLOYED` / `OTHER` or `null`

Each call uses a tight system prompt (~200 tokens) with Hindi+English examples. Strictly classification/extraction — no open-ended generation.

## Hindi Voice Design

**Register:** Tier 2/3/4 North India conversational. Not corporate, not translated-from-English.

| State | Hindi Script |
|-------|-------------|
| Greeting | "Hello, main [Company] se bol raha hoon. Kya main [Name] ji se baat kar raha hoon?" |
| Interest | "Aapko personal loan ki zaroorat hai kya abhi?" |
| Loan amount | "Roughly kitne ka loan soch rahe hain? Ek lakh, do lakh, paanch lakh — koi bhi range chalegi" |
| Employment | "Aap kahin job karte hain ya apna kuch kaam hai?" |
| Handoff | "Bahut accha, main aapko abhi humare loan advisor se jod deta hoon" |
| Wrong person | "Oh sorry, galat number lag gaya. Aapka din accha jaaye" |
| Not interested | "Koi baat nahi, dhanyavaad aapke time ke liye" |
| Timeout | "Lagta hai abhi aap busy hain, phir kabhi call karenge" |
| Double unclear | "Koi baat nahi, phir kabhi call karenge" |

**ElevenLabs config:** Hindi male voice, conversational tone, moderate speed.

## Edge Cases

| # | Scenario | Handling |
|---|----------|----------|
| 1 | **Garbage STT** — background noise, unintelligible | Classify as UNCLEAR, rephrase once in simpler Hindi, then proceed with null |
| 2 | **Language switch** — customer responds in English | Detect via STT language tag, continue in Hindi but accept English input for classification |
| 3 | **Identity question** — "Aap kaun? Kahan se?" | Short scripted response: "Main [Company] se, aapke loan application ke baare mein call kar raha hoon", then resume flow |
| 4 | **Double-UNCLEAR on interest** | After two unclear responses on interest check, politely exit |
| 5 | **Hard timeout mid-question** | 55s cap hits during Q2 → store whatever is collected, deliver partial payload with nulls |
| 6 | **Out-of-range loan amount** — "50 crore", "200 rupees" | Flag as `out_of_range` in payload, don't reject — proceed to employment question |
| 7 | **Customer interruption** — speaks over the bot | Vapi barge-in handling — stop TTS, process customer speech, resume FSM |
| 8 | **Service failure** — Deepgram/ElevenLabs/GPT timeout | 3s timeout per service call, one retry, then graceful exit with error code |

## Handoff Payload (JSON to CRM)

```json
{
  "call_id": "uuid",
  "timestamp": "ISO-8601",
  "duration_seconds": 42,
  "lead_phone": "+91XXXXXXXXXX",
  "lead_name": "Rajesh Kumar",
  "rpc_confirmed": true,
  "interested": true,
  "loan_amount": { "value": 500000, "unit": "lakh", "display": "5 lakh" },
  "employment_type": "salaried",
  "disposition": "QUALIFIED_HANDOFF",
  "exit_state": "HANDOFF",
  "flags": [],
  "uncaptured_fields": [],
  "stage_timestamps": {
    "call_start": "ISO-8601",
    "rpc_complete": "ISO-8601",
    "interest_complete": "ISO-8601",
    "q1_complete": "ISO-8601",
    "q2_complete": "ISO-8601",
    "handoff_start": "ISO-8601"
  }
}
```

- `uncaptured_fields`: lists any field that couldn't be collected (e.g., `["loan_amount"]`)
- `flags`: edge cases hit during the call (e.g., `["out_of_range_amount", "language_switch"]`)
- `stage_timestamps`: per-stage timing for latency analysis without a dashboard
- `disposition`: one of `QUALIFIED_HANDOFF`, `NOT_INTERESTED`, `WRONG_PERSON`, `TIMEOUT`, `UNCLEAR`, `ERROR`

## Observability (MVP)

No dashboard. Structured JSON logs emitted at every Vapi webhook and n8n node with timestamps. The `stage_timestamps` in the CRM payload provides per-call latency visibility. Sufficient for demonstrating production thinking during the review call.

## Out of Scope

- No Aadhaar, PAN, or income collection via voice
- No real telephony — Vapi test calling only
- No dashboard or visualization
- No real CRM — mock webhook endpoint
- No multi-language support beyond accepting English input in a Hindi flow

## Cost Estimates (per call)

| Service | Rate | Est. per call |
|---------|------|--------------|
| Deepgram Nova-2 | ~$0.0043/min | ~$0.004 (55s) |
| GPT-4o-mini (4 calls × ~300 tokens) | ~$0.15/1M input | ~$0.0002 |
| ElevenLabs TTS (~500 chars) | ~$0.006/1k chars | ~$0.003 |
| Vapi orchestration | varies | platform fee |
| **Total (excl. Vapi)** | | **~$0.007/call** |
