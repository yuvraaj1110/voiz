import { useEffect, useState } from "react";

type Cfg = {
  nodeCount: number;
  stepMs: number;
  holdMs: number;
  enabled: boolean;
};

export type IntroState = { revealed: number; showTagline: boolean; done: boolean };

/** Reveals nodes one per stepMs; after the last node shows the tagline and waits
 *  holdMs, then sets done. When disabled, returns the finished state at once. */
export function useIntroTimeline({ nodeCount, stepMs, holdMs, enabled }: Cfg): IntroState {
  const [revealed, setRevealed] = useState(enabled ? 1 : nodeCount);
  const [showTagline, setShowTagline] = useState(!enabled);
  const [done, setDone] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let n = 2; n <= nodeCount; n++) {
      timers.push(setTimeout(() => setRevealed(n), stepMs * (n - 1)));
    }
    const allRevealedAt = stepMs * (nodeCount - 1);
    timers.push(setTimeout(() => setShowTagline(true), allRevealedAt));
    timers.push(setTimeout(() => setDone(true), allRevealedAt + holdMs));

    return () => timers.forEach(clearTimeout);
  }, [nodeCount, stepMs, holdMs, enabled]);

  return { revealed, showTagline, done };
}
