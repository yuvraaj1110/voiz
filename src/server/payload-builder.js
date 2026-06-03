// Vapi endedReason values that indicate the customer dropped the line.
const CUSTOMER_HANGUP_REASONS = new Set([
  "customer-ended-call",
  "customer-hung-up",
  "hangup",
]);

/**
 * Build the CRM handoff payload from Vapi call data and the submit_call_result
 * tool call. Pass toolCall = null when the customer hung up before the agent
 * reached any terminal state (no tool call was ever made).
 */
export function buildCrmPayload(callData, toolCall) {
  const durationSeconds = computeDurationSeconds(callData);

  if (!toolCall) {
    // Customer dropped before the agent could classify and report anything.
    return assemble({
      callData,
      durationSeconds,
      rpcConfirmed: false,
      interest: "NOT_INTERESTED",
      employmentType: "NOT_CAPTURED",
      loanAmountRange: "NOT_CAPTURED",
      unclearCount: 0,
      hardTimeoutFired: false,
      callTerminatedEarly: true,
    });
  }

  const employmentType = toolCall.employment_type ?? "NOT_CAPTURED";
  const loanAmountRange = toolCall.loan_amount_range ?? "NOT_CAPTURED";
  const hardTimeoutFired = toolCall.hard_timeout_fired ?? false;
  const callTerminatedEarly =
    CUSTOMER_HANGUP_REASONS.has(callData.endedReason) &&
    toolCall.exit_state !== "HANDOFF";

  return assemble({
    callData,
    durationSeconds,
    rpcConfirmed: toolCall.rpc_confirmed ?? false,
    interest: toolCall.interest,
    employmentType,
    loanAmountRange,
    unclearCount: toolCall.unclear_count ?? 0,
    hardTimeoutFired,
    callTerminatedEarly,
  });
}

function computeDurationSeconds(callData) {
  const startMs = new Date(callData.createdAt).getTime();
  const endMs = new Date(callData.endedAt).getTime();
  return Math.round((endMs - startMs) / 1000);
}

function assemble({
  callData,
  durationSeconds,
  rpcConfirmed,
  interest,
  employmentType,
  loanAmountRange,
  unclearCount,
  hardTimeoutFired,
  callTerminatedEarly,
}) {
  const qualificationComplete =
    employmentType !== "NOT_CAPTURED" && loanAmountRange !== "NOT_CAPTURED";

  return {
    call_id: callData.id,
    prospect_phone: callData.customer?.number ?? null,
    call_timestamp: callData.createdAt,
    call_duration_seconds: durationSeconds,
    rpc_confirmed: rpcConfirmed,
    interest,
    employment_type: employmentType,
    loan_amount_range: loanAmountRange,
    qualification_complete: qualificationComplete,
    unclear_count: unclearCount,
    hard_timeout_fired: hardTimeoutFired,
    call_terminated_early: callTerminatedEarly,
    rep_priority_score: computeRepPriorityScore({
      employmentType,
      loanAmountRange,
      hardTimeoutFired,
      callTerminatedEarly,
    }),
  };
}

/**
 * Rep priority score (0-100): how worth a human rep's time this lead is.
 *   Base 100
 *   SELF_EMPLOYED        -5   (harder to underwrite)
 *   each NOT_CAPTURED    -20  (rep must re-ask)
 *   hard_timeout_fired   -10  (rushed, lower-confidence capture)
 *   call_terminated_early -15 (incomplete, possibly disengaged)
 */
function computeRepPriorityScore({
  employmentType,
  loanAmountRange,
  hardTimeoutFired,
  callTerminatedEarly,
}) {
  let score = 100;
  if (employmentType === "SELF_EMPLOYED") score -= 5;
  if (employmentType === "NOT_CAPTURED") score -= 20;
  if (loanAmountRange === "NOT_CAPTURED") score -= 20;
  if (hardTimeoutFired) score -= 10;
  if (callTerminatedEarly) score -= 15;
  return Math.max(0, score);
}
