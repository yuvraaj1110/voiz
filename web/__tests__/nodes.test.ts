import { describe, it, expect } from "vitest";
import {
  DEFAULT_NODES,
  countDataPoints,
  estimateSeconds,
  makeCustomNode,
  updateFieldValue,
  type AgentNode,
} from "@/lib/nodes";

describe("nodes model", () => {
  it("ships the fintech FSM as default nodes in order", () => {
    expect(DEFAULT_NODES.map((n) => n.type)).toEqual([
      "rpc",
      "offer",
      "interest",
      "employment",
      "amount",
      "handoff",
    ]);
  });

  it("counts data-capturing nodes", () => {
    // employment + amount capture data by default
    expect(countDataPoints(DEFAULT_NODES)).toBe(2);
  });

  it("estimates a positive, deterministic call duration", () => {
    const a = estimateSeconds(DEFAULT_NODES);
    const b = estimateSeconds(DEFAULT_NODES);
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
  });

  it("makeCustomNode creates a unique editable data node", () => {
    const n = makeCustomNode(DEFAULT_NODES);
    expect(n.type).toBe("custom");
    expect(n.capturesData).toBe(true);
    expect(n.fields.length).toBeGreaterThanOrEqual(1);
    // id must not collide with existing
    expect(DEFAULT_NODES.some((x) => x.id === n.id)).toBe(false);
  });

  it("updateFieldValue returns a new list with only the target field changed", () => {
    const target = DEFAULT_NODES.find((n) => n.type === "rpc") as AgentNode;
    const fieldKey = target.fields[0].key;
    const next = updateFieldValue(DEFAULT_NODES, target.id, fieldKey, "नया लाइन");
    const changed = next.find((n) => n.id === target.id)!;
    expect(changed.fields[0].value).toBe("नया लाइन");
    // original untouched (immutability)
    expect(target.fields[0].value).not.toBe("नया लाइन");
    // other nodes unchanged by reference
    const otherOrig = DEFAULT_NODES.find((n) => n.type === "offer")!;
    const otherNext = next.find((n) => n.type === "offer")!;
    expect(otherNext).toEqual(otherOrig);
  });
});
