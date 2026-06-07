import { useEffect, useState } from "react";

type Cfg = {
  nodeCount: number;
  stepMs: number;
  lastCardExtraMs: number;
  taglineGapMs: number;
  holdMs: number;
  enabled: boolean;
};

export type IntroState = { revealed: number; showTagline: boolean; done: boolean };

/** Reveals intermediate nodes one per stepMs. The final node is delayed an
 *  extra lastCardExtraMs (a slower beat before the payoff). After the last node,
 *  waits taglineGapMs then shows the tagline; waits holdMs more then sets done
 *  (hand off to Build). When disabled, returns the finished state at once. */
export function useIntroTimeline({
  nodeCount,
  stepMs,
  lastCardExtraMs,
  taglineGapMs,
  holdMs,
  enabled,
}: Cfg): IntroState {
  const [revealed, setRevealed] = useState(enabled ? 1 : nodeCount);
  const [showTagline, setShowTagline] = useState(!enabled);
  const [done, setDone] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    // intermediate nodes (2 .. nodeCount-1) on the steady step cadence
    for (let n = 2; n < nodeCount; n++) {
      timers.push(setTimeout(() => setRevealed(n), stepMs * (n - 1)));
    }
    // final node gets an extra beat
    const lastNodeAt = stepMs * (nodeCount - 1) + lastCardExtraMs;
    timers.push(setTimeout(() => setRevealed(nodeCount), lastNodeAt));

    const taglineAt = lastNodeAt + taglineGapMs;
    timers.push(setTimeout(() => setShowTagline(true), taglineAt));
    timers.push(setTimeout(() => setDone(true), taglineAt + holdMs));

    return () => timers.forEach(clearTimeout);
  }, [nodeCount, stepMs, lastCardExtraMs, taglineGapMs, holdMs, enabled]);

  return { revealed, showTagline, done };
}
