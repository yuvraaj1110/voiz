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
