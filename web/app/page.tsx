"use client";

import { useEffect, useState } from "react";
import { IntroSequence } from "@/components/IntroSequence";
import { BuildScreen, type DeployConfig } from "@/components/BuildScreen";
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
  async function handleDeploy(cfg: DeployConfig) {
    await new Promise((r) => setTimeout(r, 1200));
    // eslint-disable-next-line no-console
    console.log("[mock deploy]", cfg);
    alert(`Mock deploy:\n\n${cfg.goal}\n\nData points: ${cfg.dataPoints.join(", ") || "—"}`);
  }

  return (
    <main className="min-h-screen grid place-items-center px-12 py-12 overflow-hidden">
      {!introDone ? (
        <IntroSequence enabled={!reduced} onDone={() => setIntroDone(true)} />
      ) : (
        <FadeIn>
          <BuildScreen headlineEnabled={!reduced} onDeploy={handleDeploy} />
        </FadeIn>
      )}
    </main>
  );
}
