import { describe, it, expect } from "vitest";
import { buildCrmPayload } from "../src/server/payload-builder.js";

describe("buildCrmPayload", () => {
  const baseToolCall = {
    rpc_confirmed: true,
    interest: "INTERESTED",
    employment_type: "SALARIED",
    loan_amount_range: "3_5L",
    unclear_count: 0,
    hard_timeout_fired: false,
    exit_state: "HANDOFF",
  };

  const baseCallData = {
    id: "call-uuid-123",
    createdAt: "2026-06-04T10:00:00Z",
    endedAt: "2026-06-04T10:00:42Z",
    endedReason: "assistant-ended-call",
    customer: { number: "+919876543210" },
  };

  it("builds a complete qualified handoff payload with full priority score", () => {
    const result = buildCrmPayload(baseCallData, baseToolCall);
    expect(result.call_id).toBe("call-uuid-123");
    expect(result.prospect_phone).toBe("+919876543210");
    expect(result.call_timestamp).toBe("2026-06-04T10:00:00Z");
    expect(result.call_duration_seconds).toBe(42);
    expect(result.rpc_confirmed).toBe(true);
    expect(result.interest).toBe("INTERESTED");
    expect(result.employment_type).toBe("SALARIED");
    expect(result.loan_amount_range).toBe("3_5L");
    expect(result.qualification_complete).toBe(true);
    expect(result.unclear_count).toBe(0);
    expect(result.hard_timeout_fired).toBe(false);
    expect(result.call_terminated_early).toBe(false);
    expect(result.rep_priority_score).toBe(100);
  });

  it("docks 5 points for self-employed", () => {
    const result = buildCrmPayload(baseCallData, {
      ...baseToolCall,
      employment_type: "SELF_EMPLOYED",
    });
    expect(result.employment_type).toBe("SELF_EMPLOYED");
    expect(result.rep_priority_score).toBe(95);
  });

  it("docks 20 per NOT_CAPTURED field and marks qualification incomplete", () => {
    const result = buildCrmPayload(baseCallData, {
      ...baseToolCall,
      employment_type: "NOT_CAPTURED",
      loan_amount_range: "NOT_CAPTURED",
      unclear_count: 4,
    });
    expect(result.qualification_complete).toBe(false);
    expect(result.unclear_count).toBe(4);
    // 100 - 20 - 20 = 60
    expect(result.rep_priority_score).toBe(60);
  });

  it("docks 10 for hard timeout", () => {
    const result = buildCrmPayload(baseCallData, {
      ...baseToolCall,
      hard_timeout_fired: true,
    });
    expect(result.hard_timeout_fired).toBe(true);
    expect(result.rep_priority_score).toBe(90);
  });

  it("passes through DEFERRED interest", () => {
    const result = buildCrmPayload(baseCallData, {
      ...baseToolCall,
      interest: "DEFERRED",
      employment_type: "NOT_CAPTURED",
      loan_amount_range: "NOT_CAPTURED",
      exit_state: "EXIT_NOT_INTERESTED",
    });
    expect(result.interest).toBe("DEFERRED");
    expect(result.qualification_complete).toBe(false);
  });

  it("handles wrong-party exit", () => {
    const result = buildCrmPayload(baseCallData, {
      rpc_confirmed: false,
      interest: "NOT_INTERESTED",
      employment_type: "NOT_CAPTURED",
      loan_amount_range: "NOT_CAPTURED",
      unclear_count: 0,
      hard_timeout_fired: false,
      exit_state: "EXIT_WRONG_PARTY",
    });
    expect(result.rpc_confirmed).toBe(false);
    expect(result.qualification_complete).toBe(false);
  });

  it("flags call_terminated_early when customer hangs up before handoff", () => {
    const result = buildCrmPayload(
      { ...baseCallData, endedReason: "customer-ended-call" },
      { ...baseToolCall, loan_amount_range: "NOT_CAPTURED", exit_state: "EXIT_UNRESOLVED" }
    );
    expect(result.call_terminated_early).toBe(true);
    // 100 - 20 (loan NOT_CAPTURED) - 15 (early) = 65
    expect(result.rep_priority_score).toBe(65);
  });

  it("does NOT flag early termination on a normal handoff even if customer ends the line", () => {
    const result = buildCrmPayload(
      { ...baseCallData, endedReason: "customer-ended-call" },
      baseToolCall
    );
    expect(result.call_terminated_early).toBe(false);
  });

  it("builds a partial payload when no tool call was made (hangup mid-call)", () => {
    const result = buildCrmPayload(
      { ...baseCallData, endedReason: "customer-ended-call" },
      null
    );
    expect(result.call_terminated_early).toBe(true);
    expect(result.employment_type).toBe("NOT_CAPTURED");
    expect(result.loan_amount_range).toBe("NOT_CAPTURED");
    expect(result.qualification_complete).toBe(false);
    // 100 - 20 - 20 - 15 = 45
    expect(result.rep_priority_score).toBe(45);
  });

  it("never returns a negative priority score", () => {
    const result = buildCrmPayload(
      { ...baseCallData, endedReason: "customer-ended-call" },
      {
        ...baseToolCall,
        employment_type: "NOT_CAPTURED",
        loan_amount_range: "NOT_CAPTURED",
        hard_timeout_fired: true,
        exit_state: "EXIT_UNRESOLVED",
      }
    );
    // 100 -20 -20 -10 -15 = 35, still >= 0
    expect(result.rep_priority_score).toBeGreaterThanOrEqual(0);
  });

  it("calculates duration from createdAt and endedAt", () => {
    const result = buildCrmPayload(
      { ...baseCallData, endedAt: "2026-06-04T10:00:52Z" },
      baseToolCall
    );
    expect(result.call_duration_seconds).toBe(52);
  });
});
