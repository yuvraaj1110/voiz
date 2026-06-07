import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIntroTimeline } from "@/lib/useIntroTimeline";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const CFG = { nodeCount: 4, stepMs: 800, taglineGapMs: 1000, holdMs: 1000, enabled: true };

describe("useIntroTimeline", () => {
  it("starts with the first node revealed and not done", () => {
    const { result } = renderHook(() => useIntroTimeline(CFG));
    expect(result.current.revealed).toBe(1);
    expect(result.current.showTagline).toBe(false);
    expect(result.current.done).toBe(false);
  });

  it("reveals all nodes, but holds the tagline back by the gap", () => {
    const { result } = renderHook(() => useIntroTimeline(CFG));
    act(() => { vi.advanceTimersByTime(800 * 3); }); // nodes 2,3,4 (last at 2400)
    expect(result.current.revealed).toBe(4);
    expect(result.current.showTagline).toBe(false); // tagline gap not elapsed yet
    expect(result.current.done).toBe(false);
  });

  it("shows the tagline 1s after the last card", () => {
    const { result } = renderHook(() => useIntroTimeline(CFG));
    act(() => { vi.advanceTimersByTime(800 * 3); }); // last card at 2400
    act(() => { vi.advanceTimersByTime(999); });
    expect(result.current.showTagline).toBe(false);
    act(() => { vi.advanceTimersByTime(2); }); // ~3401 > 3400
    expect(result.current.showTagline).toBe(true);
    expect(result.current.done).toBe(false);
  });

  it("hands off to Build 1s after the tagline", () => {
    const { result } = renderHook(() => useIntroTimeline(CFG));
    act(() => { vi.advanceTimersByTime(800 * 3 + 1000); }); // tagline at 3400
    act(() => { vi.advanceTimersByTime(999); });
    expect(result.current.done).toBe(false);
    act(() => { vi.advanceTimersByTime(2); }); // ~4401 > 4400
    expect(result.current.done).toBe(true);
  });

  it("finishes immediately when disabled (reduced motion)", () => {
    const { result } = renderHook(() => useIntroTimeline({ ...CFG, enabled: false }));
    expect(result.current.done).toBe(true);
    expect(result.current.revealed).toBe(4);
  });
});
