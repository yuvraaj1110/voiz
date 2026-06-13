"use client";

import { useCallback, useRef, useState } from "react";
import { initialCallState, reduceCall, type CallEvent, type CallState } from "./callReducer";
import { buildDemoScript, eventsForStep } from "./demoScript";
import type { AgentNode } from "./nodes";
import type { CallStatus } from "./useVapiCall";

const CONNECT_MS = 250;

/** Simulated call: replays a scripted Hindi conversation through the real reducer. */
export function useMockCall(nodes: AgentNode[], captureKeys: { nodeId: string; key: string }[]) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [state, setState] = useState<CallState>(initialCallState(0));
  const [error] = useState<string | null>(null);

  const apply = useCallback((ev: CallEvent) => setState((s) => reduceCall(s, ev)), []);
  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const start = useCallback(() => {
    clear();
    setStatus("connecting");
    setState(initialCallState(Date.now()));
    timers.current.push(setTimeout(() => setStatus("live"), CONNECT_MS));

    for (const step of buildDemoScript(nodes, captureKeys)) {
      timers.current.push(
        setTimeout(() => {
          for (const ev of eventsForStep(step, Date.now())) apply(ev);
          if (step.kind === "end") setStatus("ended");
        }, CONNECT_MS + step.atMs),
      );
    }
  }, [nodes, captureKeys, apply, clear]);

  const stop = useCallback(() => {
    clear();
    apply({ kind: "end", reason: "stopped", at: Date.now() });
    setStatus("ended");
  }, [clear, apply]);

  return { status, state, error, start, stop };
}
