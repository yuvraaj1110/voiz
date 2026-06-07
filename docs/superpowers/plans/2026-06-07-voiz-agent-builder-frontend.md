# VOIZ Agent Builder — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a clickable, deployable Next.js frontend for the VOIZ Agent Builder — animated story intro (State 0) resolving into a fintech-positioned Build screen (State 1) — with deploy mocked. No live backend yet.

**Architecture:** A self-contained Next.js 14 (App Router) + TypeScript + Tailwind app under `web/`, independent of the existing Node code at the repo root. Pure logic (headline cycling, intro timeline, build-form state) lives in tested hooks/modules; React components render them. Deploy is a mocked async call so the full UI flow is exercisable end-to-end.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS 3, Vitest + React Testing Library (jsdom). Deploy target later: Vercel (root = `web/`).

---

## Scope

**In scope (this plan):** `web/` scaffold, Mono-Minimal dark theme, State 0 intro animation (customer→agent→JSON→rep pipeline, 3s hold, line icons, EN⇄Hindi headline cycle for 3 min then constant English), State 1 Build screen (wide goal textarea, knobs, fintech presets, compliance badge), page wiring State 0→1, mocked deploy, `prefers-reduced-motion` handling.

**Out of scope (later plan):** `/api/generate`, `/api/deploy`, `/api/result`, `/api/vapi-events`, Vapi Web SDK live voice, State 2 (live call) and State 3 (result card).

Reference mockup (approved look/motion): `docs/mockups/landing-intro.html`.

---

## File Structure

```
web/
  package.json              Next app deps + scripts (separate from repo root)
  next.config.mjs           Next config
  tsconfig.json             TypeScript config
  tailwind.config.ts        Theme tokens (Mono-Minimal)
  postcss.config.mjs        Tailwind/postcss
  vitest.config.ts          Vitest + jsdom + RTL
  vitest.setup.ts           jest-dom matchers
  app/
    layout.tsx              Root layout, fonts, globals
    globals.css             Tailwind layers + base theme
    page.tsx                Orchestrates State 0 -> State 1
  lib/
    content.ts              Headline phrases, fintech presets, pipeline data, copy
    useHeadlineCycle.ts     Hook: cycle EN<->Hindi, stop after 3 min, reduced-motion aware
    useIntroTimeline.ts     Hook: drives intro stage progression + 3s hold -> onDone
  components/
    icons.tsx               Thin-stroke line icons (no emoji)
    IntroSequence.tsx       State 0 animated pipeline
    BuildScreen.tsx         State 1 build form (textarea, knobs, presets, badge)
  __tests__/
    content.test.ts
    useHeadlineCycle.test.ts
    useIntroTimeline.test.ts
    BuildScreen.test.tsx
```

---

## Task 1: Branch and scaffold the Next.js app

**Files:**
- Create: `web/package.json`, `web/next.config.mjs`, `web/tsconfig.json`, `web/postcss.config.mjs`, `web/tailwind.config.ts`, `web/app/layout.tsx`, `web/app/globals.css`, `web/app/page.tsx`, `web/.gitignore`

- [ ] **Step 1: Create a feature branch**

Run:
```bash
cd /Users/yuvraajsuri/VOIZ
git checkout -b feat/agent-builder-frontend
```

- [ ] **Step 2: Write `web/package.json`**

```json
{
  "name": "voiz-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "6.4.8",
    "@testing-library/react": "16.0.0",
    "@types/node": "20.14.13",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "@vitejs/plugin-react": "4.3.1",
    "autoprefixer": "10.4.19",
    "jsdom": "24.1.1",
    "postcss": "8.4.40",
    "tailwindcss": "3.4.7",
    "typescript": "5.5.4",
    "vitest": "2.0.5"
  }
}
```

- [ ] **Step 3: Write `web/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true };
export default nextConfig;
```

- [ ] **Step 4: Write `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Write `web/postcss.config.mjs`**

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 6: Write `web/.gitignore`**

```
/node_modules
/.next
/out
next-env.d.ts
*.tsbuildinfo
```

- [ ] **Step 7: Write `web/tailwind.config.ts` (Mono-Minimal tokens)**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0b",       // page background
        panel: "#0f0f11",     // cards / inputs
        line: "#232327",      // borders
        line2: "#2a2a30",
        fg: "#f4f4f5",        // primary text
        muted: "#a1a1aa",     // secondary text
        faint: "#71717a",     // tertiary text
        ph: "#5b5b63",        // placeholder
        gold: "#8a6d3b",      // restrained fintech accent (eyebrow/lock)
        goldline: "#3a2f1c",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        deva: ["var(--font-deva)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 8: Write `web/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { scroll-behavior: smooth; }
  body { @apply bg-ink text-fg font-sans antialiased; }
  /* thin-underline accent used across headlines */
  .accent { @apply font-normal pb-[2px] border-b-2 border-fg; }
}

/* fade utility for cycling/transition elements */
.fade { transition: opacity 0.5s ease; }
```

- [ ] **Step 9: Write `web/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter, Noto_Sans_Devanagari, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["200", "300", "400", "500"], variable: "--font-inter" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["300", "400"], variable: "--font-deva" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "VOIZ — Hindi voice agents for lending & collections",
  description: "Type a goal, deploy a compliant Hindi voice agent in 60 seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${deva.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 10: Write a placeholder `web/app/page.tsx` (replaced in Task 7)**

```tsx
export default function Page() {
  return <main className="min-h-screen grid place-items-center">VOIZ</main>;
}
```

- [ ] **Step 11: Install dependencies**

Run:
```bash
cd /Users/yuvraajsuri/VOIZ/web && npm install
```
Expected: installs without error; `node_modules` and `package-lock.json` created.

- [ ] **Step 12: Verify the app builds**

Run:
```bash
cd /Users/yuvraajsuri/VOIZ/web && npm run build
```
Expected: "Compiled successfully" and a route `/` listed.

- [ ] **Step 13: Commit**

```bash
cd /Users/yuvraajsuri/VOIZ
git add web/package.json web/package-lock.json web/next.config.mjs web/tsconfig.json \
  web/postcss.config.mjs web/tailwind.config.ts web/app web/.gitignore
git commit -m "feat(web): scaffold Next.js + Tailwind app with Mono-Minimal theme"
```

---

## Task 2: Test tooling (Vitest + RTL)

**Files:**
- Create: `web/vitest.config.ts`, `web/vitest.setup.ts`

- [ ] **Step 1: Write `web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

- [ ] **Step 2: Write `web/vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Add a trivial sanity test `web/__tests__/sanity.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run tests to verify the harness works**

Run:
```bash
cd /Users/yuvraajsuri/VOIZ/web && npm test
```
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
cd /Users/yuvraajsuri/VOIZ
git add web/vitest.config.ts web/vitest.setup.ts web/__tests__/sanity.test.ts
git commit -m "test(web): add Vitest + React Testing Library harness"
```

---

## Task 3: Content module (phrases, presets, pipeline, copy)

**Files:**
- Create: `web/lib/content.ts`
- Test: `web/__tests__/content.test.ts`

- [ ] **Step 1: Write the failing test `web/__tests__/content.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { HEADLINE_PHRASES, PRESETS, PIPELINE, EYEBROW } from "@/lib/content";

describe("content", () => {
  it("alternates headline phrases English, Hindi, English, Hindi", () => {
    expect(HEADLINE_PHRASES.length).toBe(4);
    expect(HEADLINE_PHRASES[0].lang).toBe("en");
    expect(HEADLINE_PHRASES[1].lang).toBe("hi");
    expect(HEADLINE_PHRASES[2].lang).toBe("en");
    expect(HEADLINE_PHRASES[3].lang).toBe("hi");
    // every phrase contains the accent span
    for (const p of HEADLINE_PHRASES) expect(p.html).toContain('class="accent"');
  });

  it("ships 4 fintech presets, each with goal + dataPoints", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(ids).toEqual(["loan", "collections", "kyc", "insurance"]);
    for (const p of PRESETS) {
      expect(p.goal.length).toBeGreaterThan(10);
      expect(p.dataPoints.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("defines a 4-node pipeline customer->agent->json->rep", () => {
    expect(PIPELINE.map((n) => n.id)).toEqual(["customer", "agent", "json", "rep"]);
  });

  it("eyebrow names the fintech vertical", () => {
    expect(EYEBROW.toLowerCase()).toContain("lending");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/yuvraajsuri/VOIZ/web && npx vitest run __tests__/content.test.ts`
Expected: FAIL ("Cannot find module '@/lib/content'").

- [ ] **Step 3: Write `web/lib/content.ts`**

```ts
export type Phrase = { lang: "en" | "hi"; html: string };

export const HEADLINE_PHRASES: Phrase[] = [
  { lang: "en", html: 'Deploy a <span class="accent">loan qualification</span> agent in 60 seconds.' },
  { lang: "hi", html: '<span class="font-deva">60 सेकंड में एक <span class="accent">loan qualification</span> एजेंट बनाइए।</span>' },
  { lang: "en", html: 'Spin up an <span class="accent">EMI collections</span> agent in Hindi.' },
  { lang: "hi", html: '<span class="font-deva">Hindi में <span class="accent">EMI collections</span> एजेंट तैनात करें।</span>' },
];

export const EYEBROW = "Hindi voice agents for lending & collections";

export type Preset = {
  id: string;
  label: string;
  caption: string;
  goal: string;
  dataPoints: string[];
};

export const PRESETS: Preset[] = [
  {
    id: "loan",
    label: "Loan lead qualification",
    caption: "RPC → interest → ticket size",
    goal: "RPC the borrower in Hindi, confirm interest in a personal loan, then capture employment type and ticket size. Hand off under 60 seconds.",
    dataPoints: ["employment", "ticket size"],
  },
  {
    id: "collections",
    label: "EMI / collections",
    caption: "DPD → Promise-to-Pay",
    goal: "Reach the right borrower in Hindi, confirm the overdue EMI, and capture a Promise-to-Pay date. Stay polite and under 60 seconds.",
    dataPoints: ["promise-to-pay date"],
  },
  {
    id: "kyc",
    label: "KYC follow-up",
    caption: "pending documents",
    goal: "Reach the applicant in Hindi and confirm which pending KYC documents they will re-submit. Under 60 seconds.",
    dataPoints: ["pending documents"],
  },
  {
    id: "insurance",
    label: "Insurance renewal",
    caption: "nudge & confirm",
    goal: "Reach the policyholder in Hindi, remind them of the upcoming renewal, and confirm intent to renew. Under 60 seconds.",
    dataPoints: ["renewal intent"],
  },
];

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/yuvraajsuri/VOIZ/web && npx vitest run __tests__/content.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/yuvraajsuri/VOIZ
git add web/lib/content.ts web/__tests__/content.test.ts
git commit -m "feat(web): content module (headlines, fintech presets, pipeline)"
```

---

## Task 4: `useHeadlineCycle` hook

Cycles the headline index every `intervalMs`; after `stopAfterMs` it locks to index 0 (English). If `enabled` is false (reduced motion), it stays at index 0 and never cycles.

**Files:**
- Create: `web/lib/useHeadlineCycle.ts`
- Test: `web/__tests__/useHeadlineCycle.test.ts`

- [ ] **Step 1: Write the failing test `web/__tests__/useHeadlineCycle.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHeadlineCycle } from "@/lib/useHeadlineCycle";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useHeadlineCycle", () => {
  it("starts at index 0", () => {
    const { result } = renderHook(() =>
      useHeadlineCycle({ count: 4, intervalMs: 4000, stopAfterMs: 180000, enabled: true })
    );
    expect(result.current).toBe(0);
  });

  it("advances and wraps around on each interval", () => {
    const { result } = renderHook(() =>
      useHeadlineCycle({ count: 4, intervalMs: 4000, stopAfterMs: 180000, enabled: true })
    );
    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current).toBe(1);
    act(() => { vi.advanceTimersByTime(4000 * 3); });
    expect(result.current).toBe(0); // wrapped 2->3->0
  });

  it("locks to index 0 after stopAfterMs", () => {
    const { result } = renderHook(() =>
      useHeadlineCycle({ count: 4, intervalMs: 4000, stopAfterMs: 10000, enabled: true })
    );
    act(() => { vi.advanceTimersByTime(4000); }); // index 1
    expect(result.current).toBe(1);
    act(() => { vi.advanceTimersByTime(10000); }); // past stop -> back to 0
    expect(result.current).toBe(0);
    act(() => { vi.advanceTimersByTime(4000 * 5); }); // no further cycling
    expect(result.current).toBe(0);
  });

  it("never cycles when disabled (reduced motion)", () => {
    const { result } = renderHook(() =>
      useHeadlineCycle({ count: 4, intervalMs: 4000, stopAfterMs: 180000, enabled: false })
    );
    act(() => { vi.advanceTimersByTime(4000 * 10); });
    expect(result.current).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/yuvraajsuri/VOIZ/web && npx vitest run __tests__/useHeadlineCycle.test.ts`
Expected: FAIL ("Cannot find module '@/lib/useHeadlineCycle'").

- [ ] **Step 3: Write `web/lib/useHeadlineCycle.ts`**

```ts
import { useEffect, useState } from "react";

type Opts = {
  count: number;
  intervalMs: number;
  stopAfterMs: number;
  enabled: boolean;
};

/** Returns the active headline index. Cycles every intervalMs, then locks to 0
 *  after stopAfterMs. When disabled, stays at 0 forever (reduced motion). */
export function useHeadlineCycle({ count, intervalMs, stopAfterMs, enabled }: Opts): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!enabled || count <= 1) return;

    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, intervalMs);

    const stop = setTimeout(() => {
      clearInterval(interval);
      setIndex(0);
    }, stopAfterMs);

    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [count, intervalMs, stopAfterMs, enabled]);

  return index;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/yuvraajsuri/VOIZ/web && npx vitest run __tests__/useHeadlineCycle.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/yuvraajsuri/VOIZ
git add web/lib/useHeadlineCycle.ts web/__tests__/useHeadlineCycle.test.ts
git commit -m "feat(web): useHeadlineCycle hook (EN<->Hindi, 3-min stop, reduced-motion)"
```

---

## Task 5: `useIntroTimeline` hook

Drives the intro: reveals pipeline nodes one by one, shows the tagline, holds 3s after the last node, then signals done. Exposes how many nodes are revealed, whether the tagline is shown, and whether the intro has finished. If `enabled` is false, it finishes immediately.

**Files:**
- Create: `web/lib/useIntroTimeline.ts`
- Test: `web/__tests__/useIntroTimeline.test.ts`

- [ ] **Step 1: Write the failing test `web/__tests__/useIntroTimeline.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIntroTimeline } from "@/lib/useIntroTimeline";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const CFG = { nodeCount: 4, stepMs: 600, holdMs: 3000, enabled: true };

describe("useIntroTimeline", () => {
  it("starts with the first node revealed and not done", () => {
    const { result } = renderHook(() => useIntroTimeline(CFG));
    expect(result.current.revealed).toBe(1);
    expect(result.current.showTagline).toBe(false);
    expect(result.current.done).toBe(false);
  });

  it("reveals all nodes then shows the tagline", () => {
    const { result } = renderHook(() => useIntroTimeline(CFG));
    act(() => { vi.advanceTimersByTime(600 * 3); }); // nodes 2,3,4
    expect(result.current.revealed).toBe(4);
    expect(result.current.showTagline).toBe(true);
    expect(result.current.done).toBe(false);
  });

  it("signals done only after the 3s hold past the last node", () => {
    const { result } = renderHook(() => useIntroTimeline(CFG));
    act(() => { vi.advanceTimersByTime(600 * 3); }); // all revealed
    act(() => { vi.advanceTimersByTime(2999); });
    expect(result.current.done).toBe(false);
    act(() => { vi.advanceTimersByTime(2); });
    expect(result.current.done).toBe(true);
  });

  it("finishes immediately when disabled (reduced motion)", () => {
    const { result } = renderHook(() => useIntroTimeline({ ...CFG, enabled: false }));
    expect(result.current.done).toBe(true);
    expect(result.current.revealed).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/yuvraajsuri/VOIZ/web && npx vitest run __tests__/useIntroTimeline.test.ts`
Expected: FAIL ("Cannot find module '@/lib/useIntroTimeline'").

- [ ] **Step 3: Write `web/lib/useIntroTimeline.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/yuvraajsuri/VOIZ/web && npx vitest run __tests__/useIntroTimeline.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/yuvraajsuri/VOIZ
git add web/lib/useIntroTimeline.ts web/__tests__/useIntroTimeline.test.ts
git commit -m "feat(web): useIntroTimeline hook (staged reveal, 3s hold, reduced-motion)"
```

---

## Task 6: Line icons

**Files:**
- Create: `web/components/icons.tsx`

- [ ] **Step 1: Write `web/components/icons.tsx`**

```tsx
type IconProps = { className?: string };

const base = "stroke-current fill-none";
const common = {
  viewBox: "0 0 24 24",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function CustomerIcon({ className }: IconProps) {
  return (
    <svg {...common} className={`${base} ${className ?? ""}`}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function AgentIcon({ className }: IconProps) {
  return (
    <svg {...common} className={`${base} ${className ?? ""}`}>
      <line x1="2" y1="10" x2="2" y2="14" />
      <line x1="6" y1="6" x2="6" y2="18" />
      <line x1="10" y1="3" x2="10" y2="21" />
      <line x1="14" y1="7" x2="14" y2="17" />
      <line x1="18" y1="5" x2="18" y2="19" />
      <line x1="22" y1="10" x2="22" y2="14" />
    </svg>
  );
}

export function RepIcon({ className }: IconProps) {
  return (
    <svg {...common} className={`${base} ${className ?? ""}`}>
      <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
      <path d="M21 15a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2z" />
      <path d="M3 15a2 2 0 0 0 2 2h1v-5H5a2 2 0 0 0-2 2z" />
      <path d="M12 19a3 3 0 0 0 3-3" />
    </svg>
  );
}

export function ArrowIcon({ className }: IconProps) {
  return (
    <svg {...common} className={`${base} ${className ?? ""}`}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg {...common} className={`${base} ${className ?? ""}`}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
```

- [ ] **Step 2: Type-check (no test; visual primitives)**

Run: `cd /Users/yuvraajsuri/VOIZ/web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/yuvraajsuri/VOIZ
git add web/components/icons.tsx
git commit -m "feat(web): thin-stroke line icons (customer/agent/rep/arrow/lock)"
```

---

## Task 7: IntroSequence component (State 0)

**Files:**
- Create: `web/components/IntroSequence.tsx`

- [ ] **Step 1: Write `web/components/IntroSequence.tsx`**

```tsx
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
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/yuvraajsuri/VOIZ/web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/yuvraajsuri/VOIZ
git add web/components/IntroSequence.tsx
git commit -m "feat(web): IntroSequence (State 0) animated pipeline + tagline"
```

---

## Task 8: BuildScreen component (State 1)

Renders the eyebrow, the cycling headline, the wide goal textarea, knob chips, fintech preset buttons (clicking fills the textarea + data points), the compliance badge, and a Deploy button that calls a (mocked) async `onDeploy`. Shows a "Deploying…" state.

**Files:**
- Create: `web/components/BuildScreen.tsx`
- Test: `web/__tests__/BuildScreen.test.tsx`

- [ ] **Step 1: Write the failing test `web/__tests__/BuildScreen.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BuildScreen } from "@/components/BuildScreen";

describe("BuildScreen", () => {
  it("renders the fintech eyebrow and a goal textarea", () => {
    render(<BuildScreen headlineEnabled={false} onDeploy={vi.fn()} />);
    expect(screen.getByText(/lending & collections/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /agent goal/i })).toBeInTheDocument();
  });

  it("fills the goal when a preset is clicked", () => {
    render(<BuildScreen headlineEnabled={false} onDeploy={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /loan lead qualification/i }));
    const box = screen.getByRole("textbox", { name: /agent goal/i }) as HTMLTextAreaElement;
    expect(box.value).toMatch(/RPC the borrower/i);
  });

  it("calls onDeploy with the current goal and shows a deploying state", async () => {
    const onDeploy = vi.fn().mockResolvedValue(undefined);
    render(<BuildScreen headlineEnabled={false} onDeploy={onDeploy} />);
    fireEvent.click(screen.getByRole("button", { name: /loan lead qualification/i }));
    fireEvent.click(screen.getByRole("button", { name: /deploy/i }));
    await waitFor(() =>
      expect(onDeploy).toHaveBeenCalledWith(expect.objectContaining({ goal: expect.stringMatching(/RPC/i) }))
    );
  });

  it("disables deploy when the goal is empty", () => {
    render(<BuildScreen headlineEnabled={false} onDeploy={vi.fn()} />);
    expect(screen.getByRole("button", { name: /deploy/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/yuvraajsuri/VOIZ/web && npx vitest run __tests__/BuildScreen.test.tsx`
Expected: FAIL ("Cannot find module '@/components/BuildScreen'").

- [ ] **Step 3: Write `web/components/BuildScreen.tsx`**

```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/yuvraajsuri/VOIZ/web && npx vitest run __tests__/BuildScreen.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/yuvraajsuri/VOIZ
git add web/components/BuildScreen.tsx web/__tests__/BuildScreen.test.tsx
git commit -m "feat(web): BuildScreen (State 1) with presets, knobs, mocked deploy"
```

---

## Task 9: Wire the page (State 0 → State 1) + reduced motion

**Files:**
- Create: `web/lib/usePrefersReducedMotion.ts`
- Modify: `web/app/page.tsx` (replace placeholder from Task 1)

- [ ] **Step 1: Write `web/lib/usePrefersReducedMotion.ts`**

```ts
import { useEffect, useState } from "react";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}
```

- [ ] **Step 2: Replace `web/app/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { IntroSequence } from "@/components/IntroSequence";
import { BuildScreen, type DeployConfig } from "@/components/BuildScreen";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

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
        <BuildScreen headlineEnabled={!reduced} onDeploy={handleDeploy} />
      )}
    </main>
  );
}
```

- [ ] **Step 3: Run the full test suite**

Run: `cd /Users/yuvraajsuri/VOIZ/web && npm test`
Expected: PASS (all suites: sanity, content, useHeadlineCycle, useIntroTimeline, BuildScreen).

- [ ] **Step 4: Type-check and build**

Run: `cd /Users/yuvraajsuri/VOIZ/web && npx tsc --noEmit && npm run build`
Expected: no type errors; "Compiled successfully".

- [ ] **Step 5: Manual smoke check**

Run: `cd /Users/yuvraajsuri/VOIZ/web && npm run dev`
Open http://localhost:3000 — verify: intro plays (customer→agent→JSON→rep), holds ~3s, build box slides in, headline cycles EN⇄Hindi, clicking a preset fills the textarea, Deploy shows "Deploying…" then the mock alert. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
cd /Users/yuvraajsuri/VOIZ
git add web/lib/usePrefersReducedMotion.ts web/app/page.tsx
git commit -m "feat(web): wire State 0 -> State 1 page flow with reduced-motion support"
```

---

## Task 10: Web README + run docs

**Files:**
- Create: `web/README.md`

- [ ] **Step 1: Write `web/README.md`**

```markdown
# VOIZ Agent Builder — Web (frontend)

Next.js frontend for the plug-and-play Hindi voice-agent builder. This is the
**frontend-only** slice: animated intro → fintech Build screen with a mocked
deploy. Live generation/voice arrive in a later plan.

## Run

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

## Test

```bash
npm test           # Vitest + React Testing Library
```

## Build

```bash
npm run build
```

## Structure

- `app/` — App Router pages (`page.tsx` orchestrates State 0 → State 1)
- `components/` — `IntroSequence` (State 0), `BuildScreen` (State 1), `icons`
- `lib/` — `content` (copy/presets), `useHeadlineCycle`, `useIntroTimeline`,
  `usePrefersReducedMotion`

## Deploy (later)

Vercel project root = `web/`. Backend env vars (`ANTHROPIC_API_KEY`,
`VAPI_*`) are added when the backend plan lands.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/yuvraajsuri/VOIZ
git add web/README.md
git commit -m "docs(web): frontend run/test/build instructions"
```

- [ ] **Step 3: Push the branch**

```bash
cd /Users/yuvraajsuri/VOIZ
git push -u origin feat/agent-builder-frontend
```

---

## Self-Review Notes

**Spec coverage (frontend scope):**
- State 0 intro (customer→agent→JSON→rep, 3s hold, line icons, tagline) → Tasks 5, 6, 7. ✓
- EN⇄Hindi headline cycle, 3-min then English → Task 4 + Task 8. ✓
- State 1 Build (wide textarea, knobs, fintech presets, compliance badge) → Task 8. ✓
- Mono-Minimal dark, no emoji → Tasks 1 (theme), 6 (icons). ✓
- Fintech positioning/lingo → Task 3 content (eyebrow, presets, JSON fields). ✓
- `prefers-reduced-motion` → Task 9. ✓
- Backend/live voice explicitly deferred → not in this plan. ✓

**Placeholder scan:** No TBDs; every code step shows full code. Mocked deploy is intentional and labeled.

**Type consistency:** `DeployConfig` defined in Task 8, imported in Task 9. Hook option names (`count`, `intervalMs`, `stopAfterMs`, `enabled` / `nodeCount`, `stepMs`, `holdMs`, `enabled`) match between hook source and tests. `PIPELINE`/`PRESETS`/`HEADLINE_PHRASES` shapes consistent across content, components, and tests.
```
