import { useEffect, useState } from "react";

type Opts = {
  count: number;
  intervalMs: number;
  stopAfterMs: number;
  enabled: boolean;
};

/** Returns the active headline index. Cycles every intervalMs, then locks to 0
 *  after stopAfterMs. When disabled, stays at 0 forever (reduced motion). */
export function useHeadlineCycle({ count, intervalMs, stopAfterMs, enabled }: Opts): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!enabled || count <= 1) return;

    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, intervalMs);

    const stop = setTimeout(() => {
      clearInterval(interval);
      setIndex(0);
    }, stopAfterMs);

    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [count, intervalMs, stopAfterMs, enabled]);

  return index;
}
