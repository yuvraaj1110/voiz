"use client";

import { useEffect } from "react";
import { PIPELINE, TAGLINE_HTML, DISPOSITION_JSON } from "@/lib/content";
import { useIntroTimeline } from "@/lib/useIntroTimeline";
import { CustomerIcon, AgentIcon, RepIcon, ArrowIcon } from "./icons";

export function IntroSequence({ enabled, onDone }: { enabled: boolean; onDone: () => void }) {
  const { revealed, showTagline, done } = useIntroTimeline({
    nodeCount: PIPELINE.length,
    stepMs: 650,
    holdMs: 3000,
    enabled,
  });

  useEffect(() => {
    if (done) onDone();
  }, [done, onDone]);

  const nodeCls = (i: number) =>
    `w-[218px] text-center fade transition-transform duration-500 ${
      revealed > i ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
    }`;

  return (
    <div className="w-full max-w-[1040px]">
      <div className="flex items-center justify-center min-h-[300px]">
        {/* Customer */}
        <div className={nodeCls(0)}>
          <div className="bg-panel border border-line rounded-2xl px-[18px] py-[26px]">
            <div className="h-9 grid place-items-center"><CustomerIcon className="w-8 h-8 text-fg" /></div>
            <div className="text-[15px] font-medium mt-3.5">{PIPELINE[0].label}</div>
            <div className="flex gap-[3px] justify-center items-center h-[18px] mt-3">
              {[0, 1, 2, 3].map((b) => (
                <span key={b} className="w-[3px] bg-faint rounded-sm animate-pulse" style={{ height: 10 + b * 2 }} />
              ))}
            </div>
            <div className="text-xs font-light text-faint mt-1.5 font-deva">&quot;{PIPELINE[0].caption}&quot;</div>
          </div>
        </div>

        <Arrow show={revealed > 1} />

        {/* Agent */}
        <div className={nodeCls(1)}>
          <div className="bg-panel border border-line rounded-2xl px-[18px] py-[26px]">
            <div className="h-9 grid place-items-center"><AgentIcon className="w-8 h-8 text-fg" /></div>
            <div className="text-[15px] font-medium mt-3.5">{PIPELINE[1].label}</div>
            <span className="inline-block text-[10px] text-ink bg-fg font-semibold px-[9px] py-[3px] rounded-full mt-3 tracking-wide">
              {PIPELINE[1].caption}
            </span>
          </div>
        </div>

        <Arrow show={revealed > 2} />

        {/* JSON */}
        <div className={nodeCls(2)}>
          <div className="bg-panel border border-line rounded-2xl px-[18px] py-[26px]">
            <pre className="font-mono text-xs text-left text-muted leading-[1.75]">
{`{
  interest: "${DISPOSITION_JSON.interest}",
  employment: "${DISPOSITION_JSON.employment}",
  ticket: "${DISPOSITION_JSON.ticket}",
  score: ${DISPOSITION_JSON.score}
}`}
            </pre>
          </div>
          <div className="text-xs font-light text-faint mt-1.5">{PIPELINE[2].label}</div>
        </div>

        <Arrow show={revealed > 3} />

        {/* Rep */}
        <div className={nodeCls(3)}>
          <div className="bg-panel border border-line rounded-2xl px-[18px] py-[26px]">
            <div className="h-9 grid place-items-center"><RepIcon className="w-8 h-8 text-fg" /></div>
            <div className="text-[15px] font-medium mt-3.5">{PIPELINE[3].label}</div>
            <div className="text-xs font-light text-faint mt-1.5">{PIPELINE[3].caption}</div>
          </div>
        </div>
      </div>

      <div
        className={`text-center mt-8 font-extralight text-[25px] tracking-tight fade ${showTagline ? "opacity-100" : "opacity-0"}`}
        dangerouslySetInnerHTML={{ __html: TAGLINE_HTML }}
      />
    </div>
  );
}

function Arrow({ show }: { show: boolean }) {
  return (
    <div className={`w-[58px] flex items-center justify-center fade ${show ? "opacity-100" : "opacity-0"}`}>
      <ArrowIcon className="w-6 h-6 text-line2" />
    </div>
  );
}
