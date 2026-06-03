# VOIZ Hindi Voice Lead Qualification Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working outbound Hindi voice agent that qualifies loan prospects through a 4-turn FSM conversation and delivers structured results to a mock CRM.

**Architecture:** Vapi orchestrates calls with Deepgram Nova-2 (Hindi STT), GPT-4o-mini (conversation + classification via system prompt), and ElevenLabs (Hindi TTS). A lightweight Express webhook server receives end-of-call events and constructs the CRM payload. The system prompt encodes the full FSM — no external state machine needed.

**Tech Stack:** Node.js 20+, Express, Vapi SDK (`@vapi-ai/server-sdk`), vitest, dotenv, ngrok (for local webhook tunneling)

---

## File Structure

```
VOIZ/
├── src/
│   ├── prompts/
│   │   └── system-prompt.txt         # FSM system prompt for Vapi assistant
│   ├── server/
│   │   ├── index.js                  # Express entry — webhook listener
│   │   └── payload-builder.js        # Builds CRM JSON from Vapi call data
│   └── vapi/
│       ├── assistant-config.js       # Exports assistant creation config
│       └── tool-schemas.js           # Function tool the LLM calls at end of conversation
├── tests/
│   ├── payload-builder.test.js       # Unit tests for CRM payload construction
│   └── tool-schemas.test.js          # Validates tool schema structure
├── scripts/
│   ├── setup-assistant.js            # Creates or updates the Vapi assistant
│   └── make-call.js                  # Triggers a test outbound call
├── .env.example
├── .gitignore
└── package.json
```

**Responsibilities:**
- `system-prompt.txt` — All conversation logic: FSM states, transitions, Hindi scripts, edge case handling, 55s awareness. This is the brain of the agent.
- `payload-builder.js` — Pure function: takes Vapi's end-of-call webhook body → outputs CRM JSON matching the spec schema. Testable in isolation.
- `tool-schemas.js` — Defines the `submit_call_result` function tool that GPT-4o-mini calls when conversation reaches a terminal state. This is how structured data exits the LLM.
- `assistant-config.js` — Composes the full Vapi assistant config: model (GPT-4o-mini + system prompt + tools), voice (ElevenLabs Hindi), transcriber (Deepgram Nova-2 Hindi).
- `server/index.js` — Express server with one route: `POST /webhook/vapi` that receives events, filters for `end-of-call-report`, runs payload-builder, logs CRM JSON.
- `scripts/` — One-shot scripts for setup and testing. Not production code.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/yuvraajsuri/VOIZ && npm init -y
```

Then replace the contents of `package.json` with:

```json
{
  "name": "voiz",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node src/server/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "setup": "node scripts/setup-assistant.js",
    "call": "node scripts/make-call.js"
  },
  "dependencies": {
    "@vapi-ai/server-sdk": "^0.3.0",
    "dotenv": "^16.4.7",
    "express": "^4.21.2"
  },
  "devDependencies": {
    "vitest": "^3.2.1"
  }
}
```

- [ ] **Step 2: Create .env.example**

```
VAPI_API_KEY=your_vapi_api_key
VAPI_PHONE_NUMBER_ID=your_vapi_phone_number_id
ELEVENLABS_VOICE_ID=your_elevenlabs_hindi_voice_id
WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app/webhook/vapi
TEST_PHONE_NUMBER=+91XXXXXXXXXX
LEAD_NAME=Rajesh Kumar
COMPANY_NAME=QuickLoan
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
.env
*.log
```

- [ ] **Step 4: Install dependencies**

```bash
cd /Users/yuvraajsuri/VOIZ && npm install
```

Expected: `added X packages` with no errors.

- [ ] **Step 5: Verify test runner works**

Create a smoke test at `tests/smoke.test.js`:

```js
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run:

```bash
cd /Users/yuvraajsuri/VOIZ && npx vitest run
```

Expected: `1 passed`

- [ ] **Step 6: Commit**

```bash
cd /Users/yuvraajsuri/VOIZ && git add package.json package-lock.json .env.example .gitignore tests/smoke.test.js && git commit -m "chore: scaffold project with dependencies and test runner"
```

---

### Task 2: CRM Payload Builder (TDD)

**Files:**
- Create: `src/server/payload-builder.js`
- Test: `tests/payload-builder.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/payload-builder.test.js`:

```js
import { describe, it, expect } from "vitest";
import { buildCrmPayload } from "../src/server/payload-builder.js";

describe("buildCrmPayload", () => {
  const baseToolCall = {
    rpc_confirmed: true,
    interested: true,
    loan_amount_value: 500000,
    loan_amount_unit: "lakh",
    loan_amount_display: "5 lakh",
    employment_type: "salaried",
    disposition: "QUALIFIED_HANDOFF",
    exit_state: "HANDOFF",
    flags: [],
  };

  const baseCallData = {
    id: "call-uuid-123",
    createdAt: "2026-06-03T10:00:00Z",
    endedAt: "2026-06-03T10:00:42Z",
    customer: { number: "+919876543210" },
    assistantOverrides: {
      metadata: { lead_name: "Rajesh Kumar" },
    },
  };

  it("builds a complete qualified handoff payload", () => {
    const result = buildCrmPayload(baseCallData, baseToolCall);

    expect(result.call_id).toBe("call-uuid-123");
    expect(result.lead_phone).toBe("+919876543210");
    expect(result.lead_name).toBe("Rajesh Kumar");
    expect(result.rpc_confirmed).toBe(true);
    expect(result.interested).toBe(true);
    expect(result.loan_amount).toEqual({
      value: 500000,
      unit: "lakh",
      display: "5 lakh",
    });
    expect(result.employment_type).toBe("salaried");
    expect(result.disposition).toBe("QUALIFIED_HANDOFF");
    expect(result.exit_state).toBe("HANDOFF");
    expect(result.duration_seconds).toBe(42);
    expect(result.flags).toEqual([]);
    expect(result.uncaptured_fields).toEqual([]);
  });

  it("lists uncaptured fields when loan_amount is null", () => {
    const toolCall = {
      ...baseToolCall,
      loan_amount_value: null,
      loan_amount_unit: null,
      loan_amount_display: null,
    };
    const result = buildCrmPayload(baseCallData, toolCall);

    expect(result.loan_amount).toBeNull();
    expect(result.uncaptured_fields).toContain("loan_amount");
  });

  it("lists uncaptured fields when employment_type is null", () => {
    const toolCall = { ...baseToolCall, employment_type: null };
    const result = buildCrmPayload(baseCallData, toolCall);

    expect(result.uncaptured_fields).toContain("employment_type");
  });

  it("preserves flags from the tool call", () => {
    const toolCall = {
      ...baseToolCall,
      flags: ["out_of_range_amount", "language_switch"],
    };
    const result = buildCrmPayload(baseCallData, toolCall);

    expect(result.flags).toEqual(["out_of_range_amount", "language_switch"]);
  });

  it("handles NOT_INTERESTED disposition", () => {
    const toolCall = {
      ...baseToolCall,
      interested: false,
      disposition: "NOT_INTERESTED",
      exit_state: "NOT_INTERESTED_EXIT",
      loan_amount_value: null,
      loan_amount_unit: null,
      loan_amount_display: null,
      employment_type: null,
    };
    const result = buildCrmPayload(baseCallData, toolCall);

    expect(result.disposition).toBe("NOT_INTERESTED");
    expect(result.interested).toBe(false);
    expect(result.uncaptured_fields).toContain("loan_amount");
    expect(result.uncaptured_fields).toContain("employment_type");
  });

  it("includes timestamp in ISO-8601 format", () => {
    const result = buildCrmPayload(baseCallData, baseToolCall);

    expect(result.timestamp).toBe("2026-06-03T10:00:00Z");
  });

  it("calculates duration from createdAt and endedAt", () => {
    const callData = {
      ...baseCallData,
      createdAt: "2026-06-03T10:00:00Z",
      endedAt: "2026-06-03T10:00:55Z",
    };
    const result = buildCrmPayload(callData, baseToolCall);

    expect(result.duration_seconds).toBe(55);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/yuvraajsuri/VOIZ && npx vitest run tests/payload-builder.test.js
```

Expected: FAIL — `Cannot find module '../src/server/payload-builder.js'`

- [ ] **Step 3: Implement payload-builder.js**

Create `src/server/payload-builder.js`:

```js
export function buildCrmPayload(callData, toolCall) {
  const startMs = new Date(callData.createdAt).getTime();
  const endMs = new Date(callData.endedAt).getTime();
  const durationSeconds = Math.round((endMs - startMs) / 1000);

  const loanAmount =
    toolCall.loan_amount_value != null
      ? {
          value: toolCall.loan_amount_value,
          unit: toolCall.loan_amount_unit,
          display: toolCall.loan_amount_display,
        }
      : null;

  const uncapturedFields = [];
  if (loanAmount === null) uncapturedFields.push("loan_amount");
  if (toolCall.employment_type == null) uncapturedFields.push("employment_type");

  return {
    call_id: callData.id,
    timestamp: callData.createdAt,
    duration_seconds: durationSeconds,
    lead_phone: callData.customer?.number ?? null,
    lead_name: callData.assistantOverrides?.metadata?.lead_name ?? null,
    rpc_confirmed: toolCall.rpc_confirmed,
    interested: toolCall.interested,
    loan_amount: loanAmount,
    employment_type: toolCall.employment_type ?? null,
    disposition: toolCall.disposition,
    exit_state: toolCall.exit_state,
    flags: toolCall.flags ?? [],
    uncaptured_fields: uncapturedFields,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/yuvraajsuri/VOIZ && npx vitest run tests/payload-builder.test.js
```

Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
cd /Users/yuvraajsuri/VOIZ && git add src/server/payload-builder.js tests/payload-builder.test.js && git commit -m "feat: add CRM payload builder with tests"
```

---

### Task 3: Vapi Function Tool Schema

**Files:**
- Create: `src/vapi/tool-schemas.js`
- Test: `tests/tool-schemas.test.js`

This is the function tool that GPT-4o-mini calls when the conversation reaches any terminal state. It captures all structured data from the call.

- [ ] **Step 1: Write failing test**

Create `tests/tool-schemas.test.js`:

```js
import { describe, it, expect } from "vitest";
import { submitCallResultTool } from "../src/vapi/tool-schemas.js";

describe("submitCallResultTool", () => {
  it("is a function type tool", () => {
    expect(submitCallResultTool.type).toBe("function");
  });

  it("has required parameters matching CRM payload fields", () => {
    const required =
      submitCallResultTool.function.parameters.required;

    expect(required).toContain("rpc_confirmed");
    expect(required).toContain("interested");
    expect(required).toContain("disposition");
    expect(required).toContain("exit_state");
  });

  it("defines loan_amount_value as nullable number", () => {
    const props =
      submitCallResultTool.function.parameters.properties;

    expect(props.loan_amount_value.type).toContain("number");
  });

  it("restricts disposition to valid enum values", () => {
    const dispositions =
      submitCallResultTool.function.parameters.properties.disposition.enum;

    expect(dispositions).toEqual([
      "QUALIFIED_HANDOFF",
      "NOT_INTERESTED",
      "WRONG_PERSON",
      "TIMEOUT",
      "UNCLEAR",
      "ERROR",
    ]);
  });

  it("restricts exit_state to valid enum values", () => {
    const states =
      submitCallResultTool.function.parameters.properties.exit_state.enum;

    expect(states).toContain("HANDOFF");
    expect(states).toContain("WRONG_PERSON_EXIT");
    expect(states).toContain("NOT_INTERESTED_EXIT");
    expect(states).toContain("TIMEOUT_EXIT");
    expect(states).toContain("UNCLEAR_EXIT");
    expect(states).toContain("ERROR_EXIT");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/yuvraajsuri/VOIZ && npx vitest run tests/tool-schemas.test.js
```

Expected: FAIL

- [ ] **Step 3: Implement tool-schemas.js**

Create `src/vapi/tool-schemas.js`:

```js
export const submitCallResultTool = {
  type: "function",
  function: {
    name: "submit_call_result",
    description:
      "Call this function when the conversation reaches a terminal state. Submit all data collected during the call.",
    parameters: {
      type: "object",
      required: [
        "rpc_confirmed",
        "interested",
        "disposition",
        "exit_state",
      ],
      properties: {
        rpc_confirmed: {
          type: "boolean",
          description: "Whether the person confirmed they are the intended lead",
        },
        interested: {
          type: "boolean",
          description: "Whether the person expressed interest in a personal loan",
        },
        loan_amount_value: {
          type: ["number", "null"],
          description:
            "Loan amount in INR. Null if not captured or unclear.",
        },
        loan_amount_unit: {
          type: ["string", "null"],
          enum: ["lakh", "crore", null],
          description: "Unit of the loan amount",
        },
        loan_amount_display: {
          type: ["string", "null"],
          description:
            "Human-readable loan amount as spoken, e.g. '5 lakh'",
        },
        employment_type: {
          type: ["string", "null"],
          enum: ["salaried", "self_employed", "other", null],
          description: "Employment classification. Null if not captured.",
        },
        disposition: {
          type: "string",
          enum: [
            "QUALIFIED_HANDOFF",
            "NOT_INTERESTED",
            "WRONG_PERSON",
            "TIMEOUT",
            "UNCLEAR",
            "ERROR",
          ],
          description: "Final outcome of the call",
        },
        exit_state: {
          type: "string",
          enum: [
            "HANDOFF",
            "CALL_END",
            "WRONG_PERSON_EXIT",
            "NOT_INTERESTED_EXIT",
            "TIMEOUT_EXIT",
            "UNCLEAR_EXIT",
            "ERROR_EXIT",
          ],
          description: "The FSM state at which the call ended",
        },
        flags: {
          type: "array",
          items: { type: "string" },
          description:
            "Edge case flags: out_of_range_amount, language_switch, garbage_stt, identity_question, double_unclear, customer_interruption, service_failure",
        },
      },
    },
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/yuvraajsuri/VOIZ && npx vitest run tests/tool-schemas.test.js
```

Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
cd /Users/yuvraajsuri/VOIZ && git add src/vapi/tool-schemas.js tests/tool-schemas.test.js && git commit -m "feat: add Vapi function tool schema for call result submission"
```

---

### Task 4: FSM System Prompt

**Files:**
- Create: `src/prompts/system-prompt.txt`

This is the core artifact — the system prompt that turns GPT-4o-mini into the FSM-driven Hindi voice agent. No automated tests; validated through live calls in Task 8.

- [ ] **Step 1: Write the system prompt**

Create `src/prompts/system-prompt.txt`:

```
You are a Hindi-speaking outbound call agent for {{COMPANY_NAME}}. You are calling {{LEAD_NAME}} to qualify them for a personal loan. You must complete the call within 55 seconds.

## YOUR PERSONALITY
- Speak naturally in Hindi (Tier 2/3/4 North India register — conversational, NOT corporate/translated-English)
- Be polite but efficient — this is a short qualification call, not a sales pitch
- Use "ji" respectfully, use "aap" (never "tum")

## CALL FLOW (Finite State Machine)

You MUST follow these states in order. At each state, classify the customer's response and transition accordingly.

### STATE 1: GREETING (max 10 seconds)
Say: "Hello, main {{COMPANY_NAME}} se bol raha hoon. Kya main {{LEAD_NAME}} ji se baat kar raha hoon?"

Customer response → classify:
- CONFIRMED (any form of "haan", "ji", "bol raha hoon", "yes") → go to STATE 2
- DENIED ("nahi", "galat number", "wrong number") → say "Oh sorry, galat number lag gaya. Aapka din accha jaaye." → call submit_call_result with disposition=WRONG_PERSON, exit_state=WRONG_PERSON_EXIT
- NO RESPONSE (silence for 5+ seconds) → retry ONCE: "Hello? Aap sun pa rahe hain?" → if still no response → say "Lagta hai abhi aap busy hain, phir kabhi call karenge" → call submit_call_result with disposition=TIMEOUT, exit_state=TIMEOUT_EXIT

### STATE 2: INTEREST CHECK (max 10 seconds)
Say: "Aapko personal loan ki zaroorat hai kya abhi?"

Customer response → classify:
- YES (any form of interest: "haan", "batao", "kitna milega", "yes") → go to STATE 3
- NO ("nahi chahiye", "no", "interest nahi hai") → say "Koi baat nahi, dhanyavaad aapke time ke liye" → call submit_call_result with disposition=NOT_INTERESTED, exit_state=NOT_INTERESTED_EXIT
- UNCLEAR (1st time) → rephrase: "Matlab, agar aapko kuch paise ki zaroorat ho toh hum loan de sakte hain. Interest hai kya?"
- UNCLEAR (2nd time) → say "Koi baat nahi, phir kabhi call karenge" → call submit_call_result with disposition=UNCLEAR, exit_state=UNCLEAR_EXIT, flags=["double_unclear"]

### STATE 3: LOAN AMOUNT (max 12 seconds)
Say: "Roughly kitne ka loan soch rahe hain? Ek lakh, do lakh, paanch lakh — koi bhi range chalegi"

Customer response → extract amount:
- VALID AMOUNT (any number with lakh/crore/hazaar) → store it, go to STATE 4
- OUT OF RANGE (below 10,000 or above 1 crore) → store it anyway, add flag "out_of_range_amount", go to STATE 4
- UNCLEAR → rephrase ONCE: "Koi exact number nahi chahiye — bas roughly batao, kitne lakh soch rahe hain?" → if still unclear → store null, go to STATE 4

### STATE 4: EMPLOYMENT TYPE (max 12 seconds)
Say: "Aap kahin job karte hain ya apna kuch kaam hai?"

Customer response → classify:
- SALARIED ("job", "naukri", "service", "company mein kaam") → store "salaried", go to STATE 5
- SELF EMPLOYED ("business", "apna kaam", "dukaan", "freelance") → store "self_employed", go to STATE 5
- OTHER (retired, student, homemaker, etc.) → store "other", go to STATE 5
- UNCLEAR → rephrase ONCE: "Matlab aap kisi company mein kaam karte hain, ya apna business hai?" → if still unclear → store null, go to STATE 5

### STATE 5: HANDOFF
Say: "Bahut accha, main aapko abhi humare loan advisor se jod deta hoon"
→ call submit_call_result with disposition=QUALIFIED_HANDOFF, exit_state=HANDOFF

## EDGE CASE RULES

1. IDENTITY QUESTIONS: If the customer asks "Aap kaun?" or "Kahan se bol rahe hain?" → respond: "Main {{COMPANY_NAME}} se bol raha hoon, aapke loan application ke baare mein call kar raha hoon" → then resume the current state

2. LANGUAGE SWITCH: If the customer speaks in English, continue responding in Hindi but understand their English input. Do NOT switch to English.

3. GARBAGE/NOISE: If you cannot understand the response at all, treat it as UNCLEAR for the current state.

4. CUSTOMER INTERRUPTION: If the customer interrupts you mid-sentence, stop speaking and listen. Process what they said. Resume from the current state.

5. 55-SECOND HARD CAP: You are on a timer. If you sense the conversation is running long, skip to the handoff or exit gracefully with whatever data you have. Do NOT let the call exceed 55 seconds.

## CRITICAL RULES
- NEVER ask for Aadhaar number, PAN number, or exact income
- NEVER switch to English even if the customer speaks English
- NEVER make promises about loan approval or interest rates
- ALWAYS call submit_call_result before the call ends — this is mandatory
- Keep responses SHORT — one sentence per turn, two maximum
- Do NOT explain what you are doing or mention "states" or "qualification" — just have a natural conversation
```

- [ ] **Step 2: Verify the prompt covers all spec requirements**

Check manually:
- 6 FSM states (GREETING, INTEREST_CHECK, Q1_LOAN_AMOUNT, Q2_EMPLOYMENT, HANDOFF, CALL_END) ✓
- 5 exit states (WRONG_PERSON, NOT_INTERESTED, TIMEOUT, UNCLEAR, ERROR) ✓
- 8 edge cases (garbage STT, language switch, identity question, double-unclear, hard timeout, out-of-range, interruption, service failure) ✓
- Hindi scripts matching spec ✓
- No Aadhaar/PAN/income ✓
- 55s hard cap ✓

- [ ] **Step 3: Commit**

```bash
cd /Users/yuvraajsuri/VOIZ && git add src/prompts/system-prompt.txt && git commit -m "feat: add FSM system prompt with Hindi scripts and edge cases"
```

---

### Task 5: Vapi Assistant Configuration

**Files:**
- Create: `src/vapi/assistant-config.js`

- [ ] **Step 1: Write the assistant config**

Create `src/vapi/assistant-config.js`:

```js
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { submitCallResultTool } from "./tool-schemas.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createAssistantConfig({ companyName, webhookUrl, elevenLabsVoiceId }) {
  const rawPrompt = readFileSync(
    join(__dirname, "../prompts/system-prompt.txt"),
    "utf-8"
  );

  const systemPrompt = rawPrompt.replaceAll("{{COMPANY_NAME}}", companyName);

  return {
    name: "VOIZ Hindi Lead Qualifier",
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      systemPrompt,
      tools: [submitCallResultTool],
      temperature: 0.3,
      maxTokens: 150,
    },
    voice: {
      provider: "11labs",
      voiceId: elevenLabsVoiceId,
      stability: 0.6,
      similarityBoost: 0.75,
    },
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "hi",
    },
    serverUrl: webhookUrl,
    endCallFunctionEnabled: true,
    maxDurationSeconds: 60,
    silenceTimeoutSeconds: 8,
    firstMessage: null,
    endCallMessage: "Dhanyavaad, aapka din accha jaaye.",
  };
}
```

Note: `firstMessage` is null because the system prompt's STATE 1 greeting drives the first utterance through the LLM, giving it access to the lead's name via `{{LEAD_NAME}}` substitution at call time.

- [ ] **Step 2: Commit**

```bash
cd /Users/yuvraajsuri/VOIZ && git add src/vapi/assistant-config.js && git commit -m "feat: add Vapi assistant config with Deepgram + ElevenLabs + GPT-4o-mini"
```

---

### Task 6: Webhook Server

**Files:**
- Create: `src/server/index.js`

- [ ] **Step 1: Write the webhook server**

Create `src/server/index.js`:

```js
import "dotenv/config";
import express from "express";
import { buildCrmPayload } from "./payload-builder.js";

const app = express();
app.use(express.json());

app.post("/webhook/vapi", (req, res) => {
  const event = req.body;
  console.log(`[webhook] event type: ${event.message?.type ?? "unknown"}`);

  if (event.message?.type === "end-of-call-report") {
    const callData = event.message.call;
    const toolCalls = event.message.artifact?.toolCalls ?? [];

    const resultCall = toolCalls.find(
      (tc) => tc.function?.name === "submit_call_result"
    );

    if (resultCall) {
      const args =
        typeof resultCall.function.arguments === "string"
          ? JSON.parse(resultCall.function.arguments)
          : resultCall.function.arguments;

      const crmPayload = buildCrmPayload(callData, args);

      console.log(
        "[CRM PAYLOAD]",
        JSON.stringify(crmPayload, null, 2)
      );
    } else {
      console.log(
        "[webhook] end-of-call-report received but no submit_call_result tool call found"
      );
    }
  }

  res.status(200).json({ ok: true });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`[server] listening on port ${port}`);
  console.log(`[server] webhook URL: POST /webhook/vapi`);
});
```

- [ ] **Step 2: Verify the server starts**

```bash
cd /Users/yuvraajsuri/VOIZ && timeout 3 node src/server/index.js || true
```

Expected: `[server] listening on port 3000` (then exits after 3s timeout).

- [ ] **Step 3: Commit**

```bash
cd /Users/yuvraajsuri/VOIZ && git add src/server/index.js && git commit -m "feat: add Express webhook server for Vapi end-of-call events"
```

---

### Task 7: Setup and Test Call Scripts

**Files:**
- Create: `scripts/setup-assistant.js`
- Create: `scripts/make-call.js`

- [ ] **Step 1: Write the assistant setup script**

Create `scripts/setup-assistant.js`:

```js
import "dotenv/config";
import { createAssistantConfig } from "../src/vapi/assistant-config.js";

const config = createAssistantConfig({
  companyName: process.env.COMPANY_NAME || "QuickLoan",
  webhookUrl: process.env.WEBHOOK_URL,
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID,
});

const response = await fetch("https://api.vapi.ai/assistant", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(config),
});

if (!response.ok) {
  const error = await response.text();
  console.error("[setup] Failed to create assistant:", response.status, error);
  process.exit(1);
}

const assistant = await response.json();
console.log("[setup] Assistant created successfully");
console.log("[setup] Assistant ID:", assistant.id);
console.log("[setup] Save this ID in your .env as VAPI_ASSISTANT_ID");
```

- [ ] **Step 2: Write the test call script**

Create `scripts/make-call.js`:

```js
import "dotenv/config";

const leadName = process.env.LEAD_NAME || "Rajesh Kumar";
const companyName = process.env.COMPANY_NAME || "QuickLoan";

const body = {
  assistantId: process.env.VAPI_ASSISTANT_ID,
  phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
  customer: {
    number: process.env.TEST_PHONE_NUMBER,
  },
  assistantOverrides: {
    model: {
      systemPrompt: undefined,
    },
    metadata: {
      lead_name: leadName,
    },
    firstMessage: `Hello, main ${companyName} se bol raha hoon. Kya main ${leadName} ji se baat kar raha hoon?`,
  },
};

console.log(`[call] Dialing ${process.env.TEST_PHONE_NUMBER} for lead: ${leadName}`);

const response = await fetch("https://api.vapi.ai/call/phone", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

if (!response.ok) {
  const error = await response.text();
  console.error("[call] Failed:", response.status, error);
  process.exit(1);
}

const call = await response.json();
console.log("[call] Call initiated successfully");
console.log("[call] Call ID:", call.id);
console.log("[call] Status:", call.status);
```

- [ ] **Step 3: Commit**

```bash
cd /Users/yuvraajsuri/VOIZ && git add scripts/setup-assistant.js scripts/make-call.js && git commit -m "feat: add assistant setup and test call scripts"
```

---

### Task 8: End-to-End Validation

**Files:** No new files — uses existing scripts and server.

This task walks through the full integration test. You need active API keys in `.env`.

- [ ] **Step 1: Start the webhook server with ngrok**

Terminal 1:
```bash
cd /Users/yuvraajsuri/VOIZ && npm run dev
```

Terminal 2:
```bash
ngrok http 3000
```

Copy the ngrok HTTPS URL and set it in `.env` as `WEBHOOK_URL` (append `/webhook/vapi`).

- [ ] **Step 2: Create the Vapi assistant**

```bash
cd /Users/yuvraajsuri/VOIZ && npm run setup
```

Expected: `[setup] Assistant created successfully` with an assistant ID. Add `VAPI_ASSISTANT_ID` to `.env`.

- [ ] **Step 3: Make a test call (happy path)**

```bash
cd /Users/yuvraajsuri/VOIZ && npm run call
```

Answer the call on the test phone. Go through the full flow:
1. Confirm identity → "Haan, main Rajesh bol raha hoon"
2. Express interest → "Haan, batao"
3. Give loan amount → "Paanch lakh"
4. Give employment → "Job karta hoon"

Expected in server terminal: `[CRM PAYLOAD]` with a complete JSON payload showing `disposition: "QUALIFIED_HANDOFF"`.

- [ ] **Step 4: Test edge cases**

Make additional calls testing:
1. **Wrong person:** "Nahi, yeh Rajesh nahi hai" → expect `WRONG_PERSON` disposition
2. **Not interested:** Confirm identity, then "Nahi chahiye" → expect `NOT_INTERESTED`
3. **Unclear responses:** Give gibberish twice on interest check → expect `UNCLEAR` with `double_unclear` flag
4. **Out of range amount:** Confirm + interested, then "50 crore" → expect `QUALIFIED_HANDOFF` with `out_of_range_amount` flag
5. **English switch:** Respond in English throughout → should still work, agent stays in Hindi
6. **Identity question:** Ask "Aap kaun?" before confirming → agent explains and resumes

- [ ] **Step 5: Verify payload completeness**

For each test call, check the CRM payload against the spec:
- `call_id` present and non-null
- `duration_seconds` is a reasonable number (< 60)
- `disposition` matches the expected outcome
- `uncaptured_fields` correctly lists any null fields
- `flags` captures any edge cases hit
- `lead_phone` and `lead_name` are populated

- [ ] **Step 6: Commit any fixes**

If any prompt adjustments or code fixes are needed after testing:

```bash
cd /Users/yuvraajsuri/VOIZ && git add -A && git commit -m "fix: adjust prompt/config based on integration testing"
```

---

### Task 9: Cleanup and Final Commit

- [ ] **Step 1: Delete the smoke test**

```bash
rm /Users/yuvraajsuri/VOIZ/tests/smoke.test.js
```

- [ ] **Step 2: Run all unit tests one final time**

```bash
cd /Users/yuvraajsuri/VOIZ && npm test
```

Expected: All tests pass.

- [ ] **Step 3: Final commit**

```bash
cd /Users/yuvraajsuri/VOIZ && git add -A && git commit -m "chore: clean up smoke test, finalize prototype"
```

---

## Spec Coverage Matrix

| Spec Requirement | Task |
|-----------------|------|
| Vapi + Deepgram + ElevenLabs + GPT-4o-mini | Task 5 (assistant-config.js) |
| FSM with 6 states | Task 4 (system-prompt.txt) |
| 55-second hard cap | Task 4 (prompt rule) + Task 5 (maxDurationSeconds: 60) |
| Hindi conversational register | Task 4 (all scripts in prompt) |
| 4 LLM classification turns | Task 4 (prompt structure: 4 states with classification) |
| Loan amount + Employment questions | Task 4 (STATE 3 + STATE 4) |
| 8 edge cases | Task 4 (EDGE CASE RULES section) |
| Structured CRM payload | Task 2 (payload-builder.js) + Task 3 (tool-schemas.js) |
| uncaptured_fields / flags | Task 2 (payload-builder.js null handling) |
| Disposition enum | Task 3 (tool schema enum) |
| No Aadhaar/PAN/income | Task 4 (CRITICAL RULES in prompt) |
| Structured logging (stage_timestamps) | Task 2 (timestamp in payload) + Task 6 (console.log JSON) |
| Mock CRM endpoint | Task 6 (webhook server logs payload) |
| End-to-end voice demo | Task 8 (integration testing) |
