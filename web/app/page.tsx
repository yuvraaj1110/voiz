"use client";

import { useEffect, useState } from "react";
import { IntroSequence } from "@/components/IntroSequence";
import { NodeBuilder, type BuildPayload } from "@/components/NodeBuilder";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

/** Fades + rises its children in on mount, for a smooth handoff from the intro. */
function FadeIn({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 30);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className={`w-full flex justify-center transition-all duration-700 ease-out ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      }`}
    >
      {children}
    </div>
  );
}

export default function Page() {
  const reduced = usePrefersReducedMotion();
  const [introDone, setIntroDone] = useState(false);

  // Mocked deploy until the backend plan lands.
  async function handleDeploy(payload: BuildPayload) {
    await new Promise((r) => setTimeout(r, 1200));
    // eslint-disable-next-line no-console
    console.log("[mock deploy]", payload);
    alert(
      `Mock deploy:\n\n${payload.nodes.length} steps · est. ${payload.estSeconds}s\n` +
        `${payload.dataPoints} data point(s) · voice ${payload.voice}`,
    );
  }

  return (
    <main className="min-h-screen grid place-items-center px-12 py-12 overflow-hidden">
      {!introDone ? (
        <IntroSequence enabled={!reduced} onDone={() => setIntroDone(true)} />
      ) : (
        <FadeIn>
          <NodeBuilder onDeploy={handleDeploy} />
        </FadeIn>
      )}
    </main>
  );
}
