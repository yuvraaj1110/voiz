"use client";

import { useState } from "react";
import { EYEBROW, HEADLINE_PHRASES, PRESETS, type Preset } from "@/lib/content";
import { useHeadlineCycle } from "@/lib/useHeadlineCycle";
import { LockIcon } from "./icons";

export type DeployConfig = { goal: string; dataPoints: string[]; maxDurationSec: number };

export function BuildScreen({
  headlineEnabled,
  onDeploy,
}: {
  headlineEnabled: boolean;
  onDeploy: (cfg: DeployConfig) => Promise<void>;
}) {
  const idx = useHeadlineCycle({
    count: HEADLINE_PHRASES.length,
    intervalMs: 4200,
    stopAfterMs: 180000,
    enabled: headlineEnabled,
  });

  const [goal, setGoal] = useState("");
  const [dataPoints, setDataPoints] = useState<string[]>([]);
  const [maxDurationSec, setMaxDurationSec] = useState(60);
  const [deploying, setDeploying] = useState(false);

  function applyPreset(p: Preset) {
    setGoal(p.goal);
    setDataPoints(p.dataPoints);
  }

  async function handleDeploy() {
    if (!goal.trim() || deploying) return;
    setDeploying(true);
    try {
      await onDeploy({ goal: goal.trim(), dataPoints, maxDurationSec });
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="w-full max-w-[1040px] flex flex-col justify-center">
      <div className="text-[13px] tracking-[3px] text-faint mb-3">VOIZ</div>
      <div className="text-xs tracking-[1.5px] uppercase text-gold mb-[22px]">{EYEBROW}</div>

      <h1
        className="font-extralight text-[clamp(32px,4.6vw,50px)] leading-[1.16] -tracking-[1px] min-h-[118px] fade"
        dangerouslySetInnerHTML={{ __html: HEADLINE_PHRASES[idx].html }}
      />

      <div className="mt-7 w-full bg-panel border border-line2 rounded-[18px] px-7 pt-[26px] pb-5">
        <label htmlFor="goal" className="sr-only">Agent goal</label>
        <textarea
          id="goal"
          aria-label="Agent goal"
          rows={3}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder={`Describe the agent — "RPC the borrower, confirm interest, capture employment & ticket size, hand off under 60 seconds…"`}
          className="w-full bg-transparent text-[19px] font-light text-fg placeholder:text-ph leading-[1.5] resize-none outline-none"
        />

        <div className="flex items-center gap-2.5 mt-7 pt-[18px] border-t border-line flex-wrap">
          <span className="text-xs font-light text-muted border border-line2 px-[11px] py-1.5 rounded-full">
            Hindi · Tier 2/3
          </span>
          <label className="text-xs font-light text-muted border border-line2 px-[11px] py-1.5 rounded-full">
            ≤{" "}
            <select
              aria-label="Max duration"
              value={maxDurationSec}
              onChange={(e) => setMaxDurationSec(Number(e.target.value))}
              className="bg-transparent outline-none text-muted"
            >
              <option className="bg-panel" value={30}>30s</option>
              <option className="bg-panel" value={45}>45s</option>
              <option className="bg-panel" value={60}>60s</option>
            </select>
          </label>
          <span className="text-[11px] text-gold border border-goldline px-[11px] py-1.5 rounded-full inline-flex items-center gap-1.5">
            <LockIcon className="w-3 h-3 text-gold" /> no Aadhaar / PAN / CVV
          </span>
          <button
            onClick={handleDeploy}
            disabled={!goal.trim() || deploying}
            className="ml-auto font-medium text-[15px] bg-fg text-ink px-[22px] py-3 rounded-[11px] disabled:opacity-40 transition-opacity"
          >
            {deploying ? "Deploying…" : "Deploy →"}
          </button>
        </div>
      </div>

      <div className="mt-[22px] flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPreset(p)}
            className="text-xs font-light text-left text-[#c7c7cc] bg-[#101013] border border-line px-[13px] py-2 rounded-[10px] hover:border-line2 transition-colors"
          >
            <span className="font-medium text-fg">{p.label}</span> · {p.caption}
          </button>
        ))}
      </div>
    </div>
  );
}
