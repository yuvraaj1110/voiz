import { describe, it, expect } from "vitest";
import { submitCallResultTool } from "../src/vapi/tool-schemas.js";

describe("submitCallResultTool", () => {
  const props = submitCallResultTool.function.parameters.properties;

  it("is a function type tool named submit_call_result", () => {
    expect(submitCallResultTool.type).toBe("function");
    expect(submitCallResultTool.function.name).toBe("submit_call_result");
  });

  it("requires the core fields", () => {
    const required = submitCallResultTool.function.parameters.required;
    expect(required).toContain("rpc_confirmed");
    expect(required).toContain("interest");
    expect(required).toContain("exit_state");
  });

  it("restricts interest to INTERESTED / NOT_INTERESTED / DEFERRED", () => {
    expect(props.interest.enum).toEqual([
      "INTERESTED",
      "NOT_INTERESTED",
      "DEFERRED",
    ]);
  });

  it("restricts employment_type to the two classes plus NOT_CAPTURED", () => {
    expect(props.employment_type.enum).toEqual([
      "SALARIED",
      "SELF_EMPLOYED",
      "NOT_CAPTURED",
    ]);
  });

  it("restricts loan_amount_range to the three buckets plus NOT_CAPTURED", () => {
    expect(props.loan_amount_range.enum).toEqual([
      "1_3L",
      "3_5L",
      "5L_PLUS",
      "NOT_CAPTURED",
    ]);
  });

  it("restricts exit_state to valid FSM exits", () => {
    expect(props.exit_state.enum).toEqual([
      "HANDOFF",
      "EXIT_WRONG_PARTY",
      "EXIT_NO_ANSWER",
      "EXIT_NOT_INTERESTED",
      "EXIT_UNRESOLVED",
    ]);
  });

  it("exposes unclear_count and hard_timeout_fired for observability", () => {
    expect(props.unclear_count.type).toBe("number");
    expect(props.hard_timeout_fired.type).toBe("boolean");
  });
});
