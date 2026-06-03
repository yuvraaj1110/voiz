import { describe, it, expect } from "vitest";
import { buildCrmPayload } from "../src/server/payload-builder.js";

describe("buildCrmPayload", () => {
  const baseToolCall = {
    rpc_confirmed: true,
    interested: true,
    loan_amount_value: 500000,
    loan_amount_unit: "lakh",
    loan_amount_display: "5 lakh",
    employment_type: "salaried",
    disposition: "QUALIFIED_HANDOFF",
    exit_state: "HANDOFF",
    flags: [],
  };

  const baseCallData = {
    id: "call-uuid-123",
    createdAt: "2026-06-03T10:00:00Z",
    endedAt: "2026-06-03T10:00:42Z",
    customer: { number: "+919876543210" },
    assistantOverrides: {
      metadata: { lead_name: "Rajesh Kumar" },
    },
  };

  it("builds a complete qualified handoff payload", () => {
    const result = buildCrmPayload(baseCallData, baseToolCall);
    expect(result.call_id).toBe("call-uuid-123");
    expect(result.lead_phone).toBe("+919876543210");
    expect(result.lead_name).toBe("Rajesh Kumar");
    expect(result.rpc_confirmed).toBe(true);
    expect(result.interested).toBe(true);
    expect(result.loan_amount).toEqual({ value: 500000, unit: "lakh", display: "5 lakh" });
    expect(result.employment_type).toBe("salaried");
    expect(result.disposition).toBe("QUALIFIED_HANDOFF");
    expect(result.exit_state).toBe("HANDOFF");
    expect(result.duration_seconds).toBe(42);
    expect(result.flags).toEqual([]);
    expect(result.uncaptured_fields).toEqual([]);
  });

  it("lists uncaptured fields when loan_amount is null", () => {
    const toolCall = { ...baseToolCall, loan_amount_value: null, loan_amount_unit: null, loan_amount_display: null };
    const result = buildCrmPayload(baseCallData, toolCall);
    expect(result.loan_amount).toBeNull();
    expect(result.uncaptured_fields).toContain("loan_amount");
  });

  it("lists uncaptured fields when employment_type is null", () => {
    const toolCall = { ...baseToolCall, employment_type: null };
    const result = buildCrmPayload(baseCallData, toolCall);
    expect(result.uncaptured_fields).toContain("employment_type");
  });

  it("preserves flags from the tool call", () => {
    const toolCall = { ...baseToolCall, flags: ["out_of_range_amount", "language_switch"] };
    const result = buildCrmPayload(baseCallData, toolCall);
    expect(result.flags).toEqual(["out_of_range_amount", "language_switch"]);
  });

  it("handles NOT_INTERESTED disposition", () => {
    const toolCall = { ...baseToolCall, interested: false, disposition: "NOT_INTERESTED", exit_state: "NOT_INTERESTED_EXIT", loan_amount_value: null, loan_amount_unit: null, loan_amount_display: null, employment_type: null };
    const result = buildCrmPayload(baseCallData, toolCall);
    expect(result.disposition).toBe("NOT_INTERESTED");
    expect(result.interested).toBe(false);
    expect(result.uncaptured_fields).toContain("loan_amount");
    expect(result.uncaptured_fields).toContain("employment_type");
  });

  it("includes timestamp in ISO-8601 format", () => {
    const result = buildCrmPayload(baseCallData, baseToolCall);
    expect(result.timestamp).toBe("2026-06-03T10:00:00Z");
  });

  it("calculates duration from createdAt and endedAt", () => {
    const callData = { ...baseCallData, createdAt: "2026-06-03T10:00:00Z", endedAt: "2026-06-03T10:00:55Z" };
    const result = buildCrmPayload(callData, baseToolCall);
    expect(result.duration_seconds).toBe(55);
  });
});
