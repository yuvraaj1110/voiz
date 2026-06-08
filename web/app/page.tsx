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
      className={`w-full transition-all duration-700 ease-out ${
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
    <main className="min-h-screen w-full">
      {!introDone ? (
        <div className="min-h-screen grid place-items-center px-12 overflow-hidden">
          <IntroSequence enabled={!reduced} onDone={() => setIntroDone(true)} />
        </div>
      ) : (
        <div className="relative min-h-screen">
          {/* personality backdrop: dotted canvas + ambient brand glows */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <div
              className="absolute -top-48 right-[-8%] w-[620px] h-[620px] rounded-full blur-[130px]"
              style={{ background: "radial-gradient(circle, rgba(245,158,11,0.20), transparent 70%)" }}
            />
            <div
              className="absolute bottom-[-25%] left-[-8%] w-[640px] h-[640px] rounded-full blur-[140px]"
              style={{ background: "radial-gradient(circle, rgba(217,70,239,0.16), transparent 70%)" }}
            />
          </div>
          <div className="relative">
            <FadeIn>
              <NodeBuilder onDeploy={handleDeploy} />
            </FadeIn>
          </div>
        </div>
      )}
    </main>
  );
}
