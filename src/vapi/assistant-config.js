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
