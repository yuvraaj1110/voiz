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
