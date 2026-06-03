export function buildCrmPayload(callData, toolCall) {
  const startMs = new Date(callData.createdAt).getTime();
  const endMs = new Date(callData.endedAt).getTime();
  const durationSeconds = Math.round((endMs - startMs) / 1000);

  const loanAmount =
    toolCall.loan_amount_value != null
      ? {
          value: toolCall.loan_amount_value,
          unit: toolCall.loan_amount_unit,
          display: toolCall.loan_amount_display,
        }
      : null;

  const uncapturedFields = [];
  if (loanAmount === null) uncapturedFields.push("loan_amount");
  if (toolCall.employment_type == null) uncapturedFields.push("employment_type");

  return {
    call_id: callData.id,
    timestamp: callData.createdAt,
    duration_seconds: durationSeconds,
    lead_phone: callData.customer?.number ?? null,
    lead_name: callData.assistantOverrides?.metadata?.lead_name ?? null,
    rpc_confirmed: toolCall.rpc_confirmed,
    interested: toolCall.interested,
    loan_amount: loanAmount,
    employment_type: toolCall.employment_type ?? null,
    disposition: toolCall.disposition,
    exit_state: toolCall.exit_state,
    flags: toolCall.flags ?? [],
    uncaptured_fields: uncapturedFields,
  };
}
