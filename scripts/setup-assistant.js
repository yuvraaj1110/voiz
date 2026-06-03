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
