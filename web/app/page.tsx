"use client";

import { useEffect, useState } from "react";
import { IntroSequence } from "@/components/IntroSequence";
import { NodeBuilder, type BuildPayload } from "@/components/NodeBuilder";
import { LiveCall } from "@/components/LiveCall";
import { ResultCard } from "@/components/ResultCard";
import { TrialCta } from "@/components/TrialCta";
import { compileAgent } from "@/lib/compiler";
import { resolveMode, type DemoMode } from "@/lib/mode";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import type { AgentNode } from "@/lib/nodes";
import type { CallState } from "@/lib/callReducer";

function FadeIn({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 30);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`w-full transition-all duration-700 ease-out ${shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
      {children}
    </div>
  );
}

function HomeLogo({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="VOIZ — back to builder"
      className="fixed top-5 left-6 z-50 text-[15px] font-bold tracking-[3px] text-amber-300 hover:text-amber-200 transition"
    >
      VOIZ
    </button>
  );
}

type Stage = "intro" | "build" | "live" | "result";

type Deployed = {
  assistantId: string;
  publicKey: string;
  captureKeys: { nodeId: string; key: string }[];
  nodes: AgentNode[];
  maxDurationSec: number;
};

export default function Page() {
  const reduced = usePrefersReducedMotion();
  const [mode, setMode] = useState<DemoMode>("mock");
  useEffect(() => {
    setMode(resolveMode(window.location.search));
  }, []);
  const [stage, setStage] = useState<Stage>("intro");
  const [deployed, setDeployed] = useState<Deployed | null>(null);
  const [result, setResult] = useState<CallState | null>(null);

  function goHome() {
    setDeployed(null);
    setResult(null);
    setStage("build");
  }

  async function handleDeploy(payload: BuildPayload) {
    if (mode === "mock") {
      const compiled = compileAgent(payload.nodes, {
        voice: payload.voice,
        register: payload.register,
        maxDurationSec: payload.maxDurationSec,
      });
      setDeployed({
        assistantId: "demo",
        publicKey: "",
        captureKeys: compiled.captureKeys,
        nodes: payload.nodes,
        maxDurationSec: payload.maxDurationSec,
      });
      setStage("live");
      return;
    }
    const res = await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Deploy failed" }));
      alert(`Deploy failed: ${error}`);
      return;
    }
    const data = await res.json();
    setDeployed({
      assistantId: data.assistantId,
      publicKey: data.publicKey,
      captureKeys: data.captureKeys,
      nodes: payload.nodes,
      maxDurationSec: payload.maxDurationSec,
    });
    setStage("live");
  }

  return (
    <main className="min-h-screen w-full">
      <HomeLogo onClick={goHome} />
      <TrialCta variant="floating" />

      {stage === "intro" && (
        <div className="min-h-screen grid place-items-center px-12 overflow-hidden">
          <IntroSequence enabled={!reduced} onDone={() => setStage("build")} />
        </div>
      )}

      {stage === "build" && (
        <div className="relative min-h-screen">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <div className="absolute -top-48 right-[-8%] w-[620px] h-[620px] rounded-full blur-[130px]" style={{ background: "radial-gradient(circle, rgba(245,158,11,0.20), transparent 70%)" }} />
            <div className="absolute bottom-[-25%] left-[-8%] w-[640px] h-[640px] rounded-full blur-[140px]" style={{ background: "radial-gradient(circle, rgba(217,70,239,0.16), transparent 70%)" }} />
          </div>
          <div className="relative">
            <FadeIn><NodeBuilder onDeploy={handleDeploy} /></FadeIn>
          </div>
        </div>
      )}

      {stage === "live" && deployed && (
        <FadeIn>
          <LiveCall
            mode={mode}
            assistantId={deployed.assistantId}
            publicKey={deployed.publicKey}
            nodes={deployed.nodes}
            captureKeys={deployed.captureKeys}
            onEnded={(s) => { setResult(s); setStage("result"); }}
          />
        </FadeIn>
      )}

      {stage === "result" && result && deployed && (
        <FadeIn>
          <ResultCard call={result} nodes={deployed.nodes} captureKeys={deployed.captureKeys} onRestart={() => setStage("build")} />
        </FadeIn>
      )}
    </main>
  );
}
