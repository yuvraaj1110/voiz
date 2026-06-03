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
          description: "Loan amount in INR. Null if not captured or unclear.",
        },
        loan_amount_unit: {
          type: ["string", "null"],
          enum: ["lakh", "crore", null],
          description: "Unit of the loan amount",
        },
        loan_amount_display: {
          type: ["string", "null"],
          description: "Human-readable loan amount as spoken, e.g. '5 lakh'",
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
