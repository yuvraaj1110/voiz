import "dotenv/config";
import express from "express";
import { buildCrmPayload } from "./payload-builder.js";

const app = express();
app.use(express.json());

app.post("/webhook/vapi", (req, res) => {
  const event = req.body;
  const msgType = event.message?.type ?? "unknown";
  console.log(`[webhook] event type: ${msgType}`);

  // ── Live tool-call: Vapi fires this mid-call and waits for our ack ──────────
  // Must respond with { results: [{ toolCallId, result }] } or the LLM retries.
  if (msgType === "tool-calls") {
    const toolCallList = event.message?.toolCallList ?? [];
    const results = toolCallList.map((tc) => {
      const name = tc.function?.name ?? "";
      const rawArgs = tc.function?.arguments ?? "{}";
      const args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;

      if (name === "submit_call_result") {
        console.log("[tool-call] submit_call_result received:", JSON.stringify(args, null, 2));
      }

      return { toolCallId: tc.id, result: "success" };
    });

    return res.status(200).json({ results });
  }

  // ── End-of-call report: full call summary, build & log CRM payload ──────────
  if (msgType === "end-of-call-report") {
    const callData = event.message.call;
    const toolCalls = event.message.artifact?.toolCalls ?? [];

    const resultCall = toolCalls.find(
      (tc) => tc.function?.name === "submit_call_result"
    );

    const args = resultCall
      ? typeof resultCall.function.arguments === "string"
        ? JSON.parse(resultCall.function.arguments)
        : resultCall.function.arguments
      : null;

    if (!args) {
      console.log(
        "[webhook] no submit_call_result tool call (likely early hangup) — building partial payload"
      );
    }

    // buildCrmPayload handles args === null (customer dropped before any
    // terminal state) by emitting a partial, early-termination payload.
    const crmPayload = buildCrmPayload(callData, args);

    console.log("[CRM PAYLOAD]", JSON.stringify(crmPayload, null, 2));
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
