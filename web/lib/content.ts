// Static copy/data for the landing intro. The build screen's configurable
// fintech steps live in lib/nodes.ts.

export const EYEBROW = "Hindi voice agents for lending & collections";

export type PipelineNode = {
  id: "customer" | "agent" | "json" | "rep";
  label: string;
  caption?: string;
};

export const PIPELINE: PipelineNode[] = [
  { id: "customer", label: "Customer", caption: "हाँ जी, बोल रहा हूँ" },
  { id: "agent", label: "VOIZ agent", caption: "DEPLOYED IN 60s" },
  { id: "json", label: "structured disposition" },
  { id: "rep", label: "Sales rep", caption: "picks up pre-qualified" },
];

export const TAGLINE_HTML =
  'From customer to qualified lead — <span class="accent">before a human says hello.</span>';

export const DISPOSITION_JSON = {
  interest: "YES",
  employment: "SALARIED",
  ticket: "5L+",
  score: 92,
};
