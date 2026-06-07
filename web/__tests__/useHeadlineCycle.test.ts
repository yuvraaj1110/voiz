import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHeadlineCycle } from "@/lib/useHeadlineCycle";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useHeadlineCycle", () => {
  it("starts at index 0", () => {
    const { result } = renderHook(() =>
      useHeadlineCycle({ count: 4, intervalMs: 4000, stopAfterMs: 180000, enabled: true })
    );
    expect(result.current).toBe(0);
  });

  it("advances and wraps around on each interval", () => {
    const { result } = renderHook(() =>
      useHeadlineCycle({ count: 4, intervalMs: 4000, stopAfterMs: 180000, enabled: true })
    );
    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current).toBe(1);
    act(() => { vi.advanceTimersByTime(4000 * 3); });
    expect(result.current).toBe(0);
  });

  it("locks to index 0 after stopAfterMs", () => {
    const { result } = renderHook(() =>
      useHeadlineCycle({ count: 4, intervalMs: 4000, stopAfterMs: 10000, enabled: true })
    );
    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current).toBe(1);
    act(() => { vi.advanceTimersByTime(10000); });
    expect(result.current).toBe(0);
    act(() => { vi.advanceTimersByTime(4000 * 5); });
    expect(result.current).toBe(0);
  });

  it("never cycles when disabled (reduced motion)", () => {
    const { result } = renderHook(() =>
      useHeadlineCycle({ count: 4, intervalMs: 4000, stopAfterMs: 180000, enabled: false })
    );
    act(() => { vi.advanceTimersByTime(4000 * 10); });
    expect(result.current).toBe(0);
  });
});
