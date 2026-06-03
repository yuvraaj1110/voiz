import { describe, it, expect } from "vitest";
import { submitCallResultTool } from "../src/vapi/tool-schemas.js";

describe("submitCallResultTool", () => {
  it("is a function type tool", () => {
    expect(submitCallResultTool.type).toBe("function");
  });

  it("has required parameters matching CRM payload fields", () => {
    const required = submitCallResultTool.function.parameters.required;
    expect(required).toContain("rpc_confirmed");
    expect(required).toContain("interested");
    expect(required).toContain("disposition");
    expect(required).toContain("exit_state");
  });

  it("defines loan_amount_value as nullable number", () => {
    const props = submitCallResultTool.function.parameters.properties;
    expect(props.loan_amount_value.type).toContain("number");
  });

  it("restricts disposition to valid enum values", () => {
    const dispositions = submitCallResultTool.function.parameters.properties.disposition.enum;
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
    const states = submitCallResultTool.function.parameters.properties.exit_state.enum;
    expect(states).toContain("HANDOFF");
    expect(states).toContain("WRONG_PERSON_EXIT");
    expect(states).toContain("NOT_INTERESTED_EXIT");
    expect(states).toContain("TIMEOUT_EXIT");
    expect(states).toContain("UNCLEAR_EXIT");
    expect(states).toContain("ERROR_EXIT");
  });
});
