// Node model for the n8n-style agent builder. Each node is one FSM step the
// user can configure. Pure helpers here are unit-tested; the component holds
// the live array in React state and calls these to derive/update it.

export type FieldKind = "text" | "number" | "options";

export type Field = {
  key: string;
  label: string;
  kind: FieldKind;
  value: string | number | string[];
};

export type NodeType =
  | "rpc"
  | "offer"
  | "interest"
  | "employment"
  | "amount"
  | "handoff"
  | "custom";

export type IconKey =
  | "customer"
  | "offer"
  | "interest"
  | "briefcase"
  | "amount"
  | "rep";

export type AccentKey = "sky" | "emerald" | "violet" | "amber" | "teal" | "rose";

export type AgentNode = {
  id: string;
  type: NodeType;
  title: string;
  desc: string;
  pill: string;
  icon: IconKey;
  accent: AccentKey;
  fields: Field[];
  capturesData?: boolean;
};

export const DEFAULT_NODES: AgentNode[] = [
  {
    id: "n-rpc",
    type: "rpc",
    title: "Right Party Check",
    desc: "Confirm you're speaking to the borrower",
    pill: "RPC",
    icon: "customer",
    accent: "sky",
    fields: [
      { key: "line", label: "Opening line (Hindi)", kind: "text", value: "नमस्ते, क्या मैं {{name}} जी से बात कर रहा हूँ?" },
      { key: "retries", label: "Retries on no-answer", kind: "number", value: 1 },
    ],
  },
  {
    id: "n-offer",
    type: "offer",
    title: "Offer Statement",
    desc: "Pitch the pre-approved loan",
    pill: "SCRIPT",
    icon: "offer",
    accent: "emerald",
    fields: [
      { key: "script", label: "Offer script (Hindi)", kind: "text", value: "आपके नाम पर एक पर्सनल लोन ऑफ़र तैयार है।" },
    ],
  },
  {
    id: "n-interest",
    type: "interest",
    title: "Interest Check",
    desc: "Gauge whether they want to proceed",
    pill: "BRANCH",
    icon: "interest",
    accent: "violet",
    fields: [
      { key: "question", label: "Question (Hindi)", kind: "text", value: "क्या आप इसके बारे में और जानना चाहेंगे?" },
    ],
  },
  {
    id: "n-employment",
    type: "employment",
    title: "Qualify · Employment",
    desc: "Capture salaried vs self-employed",
    pill: "DATA",
    icon: "briefcase",
    accent: "amber",
    capturesData: true,
    fields: [
      { key: "question", label: "Question (Hindi)", kind: "text", value: "आप नौकरी करते हैं या अपना बिज़नेस है?" },
      { key: "options", label: "Capture as", kind: "options", value: ["SALARIED", "SELF_EMPLOYED"] },
    ],
  },
  {
    id: "n-amount",
    type: "amount",
    title: "Qualify · Loan amount",
    desc: "Bucket the ticket size",
    pill: "DATA",
    icon: "amount",
    accent: "teal",
    capturesData: true,
    fields: [
      { key: "question", label: "Question (Hindi)", kind: "text", value: "आप कितना लोन सोच रहे हैं?" },
      { key: "options", label: "Buckets", kind: "options", value: ["1-3L", "3-5L", "5L+"] },
    ],
  },
  {
    id: "n-handoff",
    type: "handoff",
    title: "Human Handoff",
    desc: "Close politely & push the disposition",
    pill: "EXIT",
    icon: "rep",
    accent: "rose",
    fields: [
      { key: "line", label: "Closing line (Hindi)", kind: "text", value: "धन्यवाद, हमारा प्रतिनिधि आपको शीघ्र कॉल करेगा।" },
    ],
  },
];

/** Per-type rough spoken-time estimate (seconds). */
const SECONDS_BY_TYPE: Record<NodeType, number> = {
  rpc: 8,
  offer: 6,
  interest: 7,
  employment: 9,
  amount: 9,
  handoff: 6,
  custom: 8,
};

/** Number of nodes that capture a structured data point. */
export function countDataPoints(nodes: AgentNode[]): number {
  return nodes.filter((n) => n.capturesData).length;
}

/** Deterministic estimate of total call length from the node list. */
export function estimateSeconds(nodes: AgentNode[]): number {
  return nodes.reduce((sum, n) => sum + (SECONDS_BY_TYPE[n.type] ?? 8), 0);
}

/** Build a fresh, editable data-capturing node with a collision-free id. */
export function makeCustomNode(existing: AgentNode[]): AgentNode {
  let i = existing.length + 1;
  let id = `n-custom-${i}`;
  while (existing.some((n) => n.id === id)) {
    i += 1;
    id = `n-custom-${i}`;
  }
  return {
    id,
    type: "custom",
    title: "Custom step",
    desc: "Ask a question and capture the answer",
    pill: "DATA",
    icon: "interest",
    accent: "violet",
    capturesData: true,
    fields: [
      { key: "question", label: "Question (Hindi)", kind: "text", value: "" },
      { key: "field", label: "Capture as", kind: "text", value: "custom_field" },
    ],
  };
}

/** Immutably set one field's value on one node. */
export function updateFieldValue(
  nodes: AgentNode[],
  nodeId: string,
  fieldKey: string,
  value: Field["value"],
): AgentNode[] {
  return nodes.map((n) =>
    n.id !== nodeId
      ? n
      : {
          ...n,
          fields: n.fields.map((f) => (f.key === fieldKey ? { ...f, value } : f)),
        },
  );
}
