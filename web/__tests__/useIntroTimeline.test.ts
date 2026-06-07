import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIntroTimeline } from "@/lib/useIntroTimeline";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const CFG = { nodeCount: 4, stepMs: 600, holdMs: 3000, enabled: true };

describe("useIntroTimeline", () => {
  it("starts with the first node revealed and not done", () => {
    const { result } = renderHook(() => useIntroTimeline(CFG));
    expect(result.current.revealed).toBe(1);
    expect(result.current.showTagline).toBe(false);
    expect(result.current.done).toBe(false);
  });

  it("reveals all nodes then shows the tagline", () => {
    const { result } = renderHook(() => useIntroTimeline(CFG));
    act(() => { vi.advanceTimersByTime(600 * 3); }); // nodes 2,3,4
    expect(result.current.revealed).toBe(4);
    expect(result.current.showTagline).toBe(true);
    expect(result.current.done).toBe(false);
  });

  it("signals done only after the 3s hold past the last node", () => {
    const { result } = renderHook(() => useIntroTimeline(CFG));
    act(() => { vi.advanceTimersByTime(600 * 3); }); // all revealed
    act(() => { vi.advanceTimersByTime(2999); });
    expect(result.current.done).toBe(false);
    act(() => { vi.advanceTimersByTime(2); });
    expect(result.current.done).toBe(true);
  });

  it("finishes immediately when disabled (reduced motion)", () => {
    const { result } = renderHook(() => useIntroTimeline({ ...CFG, enabled: false }));
    expect(result.current.done).toBe(true);
    expect(result.current.revealed).toBe(4);
  });
});
