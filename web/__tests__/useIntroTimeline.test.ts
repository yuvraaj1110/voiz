import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIntroTimeline } from "@/lib/useIntroTimeline";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const CFG = {
  nodeCount: 4,
  stepMs: 800,
  lastCardExtraMs: 1000,
  taglineGapMs: 2000,
  holdMs: 1000,
  enabled: true,
};

describe("useIntroTimeline", () => {
  it("starts with the first node revealed and not done", () => {
    const { result } = renderHook(() => useIntroTimeline(CFG));
    expect(result.current.revealed).toBe(1);
    expect(result.current.showTagline).toBe(false);
    expect(result.current.done).toBe(false);
  });

  it("reveals intermediate nodes on the step cadence", () => {
    const { result } = renderHook(() => useIntroTimeline(CFG));
    act(() => { vi.advanceTimersByTime(800 * 2); }); // node 2 @800, node 3 @1600
    expect(result.current.revealed).toBe(3);
    expect(result.current.done).toBe(false);
  });

  it("delays the last card by the extra beat", () => {
    const { result } = renderHook(() => useIntroTimeline(CFG));
    act(() => { vi.advanceTimersByTime(2400); }); // would be the last card without the extra
    expect(result.current.revealed).toBe(3);
    act(() => { vi.advanceTimersByTime(1001); }); // 3401 > 3400 (2400 + 1000 extra)
    expect(result.current.revealed).toBe(4);
  });

  it("shows the tagline 2s after the last card", () => {
    const { result } = renderHook(() => useIntroTimeline(CFG));
    act(() => { vi.advanceTimersByTime(3400); }); // last card
    act(() => { vi.advanceTimersByTime(1999); });
    expect(result.current.showTagline).toBe(false);
    act(() => { vi.advanceTimersByTime(2); }); // ~5401 > 5400
    expect(result.current.showTagline).toBe(true);
    expect(result.current.done).toBe(false);
  });

  it("hands off to Build holdMs after the tagline", () => {
    const { result } = renderHook(() => useIntroTimeline(CFG));
    act(() => { vi.advanceTimersByTime(5400); }); // tagline
    act(() => { vi.advanceTimersByTime(999); });
    expect(result.current.done).toBe(false);
    act(() => { vi.advanceTimersByTime(2); }); // ~6401 > 6400
    expect(result.current.done).toBe(true);
  });

  it("finishes immediately when disabled (reduced motion)", () => {
    const { result } = renderHook(() => useIntroTimeline({ ...CFG, enabled: false }));
    expect(result.current.done).toBe(true);
    expect(result.current.revealed).toBe(4);
  });
});
