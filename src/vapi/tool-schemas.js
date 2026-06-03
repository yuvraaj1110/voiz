export const submitCallResultTool = {
  type: "function",
  function: {
    name: "submit_call_result",
    description:
      "Call this when the conversation reaches any terminal state. Submit everything captured so far. Mandatory on every exit path.",
    parameters: {
      type: "object",
      required: ["rpc_confirmed", "interest", "exit_state"],
      properties: {
        rpc_confirmed: {
          type: "boolean",
          description: "True if the right party confirmed they are the intended lead.",
        },
        interest: {
          type: "string",
          enum: ["INTERESTED", "NOT_INTERESTED", "DEFERRED"],
          description:
            "INTERESTED = wants to know more; NOT_INTERESTED = declined; DEFERRED = asked to be called back later.",
        },
        employment_type: {
          type: "string",
          enum: ["SALARIED", "SELF_EMPLOYED", "NOT_CAPTURED"],
          description:
            "Employment classification. Use NOT_CAPTURED if unclear twice or timed out.",
        },
        loan_amount_range: {
          type: "string",
          enum: ["1_3L", "3_5L", "5L_PLUS", "NOT_CAPTURED"],
          description:
            "Loan amount bucket: 1_3L (up to 3 lakh), 3_5L (3-5 lakh), 5L_PLUS (above 5 lakh). NOT_CAPTURED if unclear twice or timed out.",
        },
        unclear_count: {
          type: "number",
          description: "Total number of UNCLEAR classifications across the whole call.",
        },
        hard_timeout_fired: {
          type: "boolean",
          description:
            "True if the 53-second hard deadline forced an early jump to handoff.",
        },
        exit_state: {
          type: "string",
          enum: [
            "HANDOFF",
            "EXIT_WRONG_PARTY",
            "EXIT_NO_ANSWER",
            "EXIT_NOT_INTERESTED",
            "EXIT_UNRESOLVED",
          ],
          description: "The FSM state at which the call ended.",
        },
      },
    },
  },
};
