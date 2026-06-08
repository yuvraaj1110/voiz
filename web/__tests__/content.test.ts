import { describe, it, expect } from "vitest";
import { PIPELINE, EYEBROW, TAGLINE_HTML, DISPOSITION_JSON } from "@/lib/content";

describe("content", () => {
  it("defines a 4-node pipeline customer->agent->json->rep", () => {
    expect(PIPELINE.map((n) => n.id)).toEqual(["customer", "agent", "json", "rep"]);
  });

  it("eyebrow names the fintech vertical", () => {
    expect(EYEBROW.toLowerCase()).toContain("lending");
  });

  it("tagline carries the accent span", () => {
    expect(TAGLINE_HTML).toContain('class="accent"');
  });

  it("disposition json has the demo fields", () => {
    expect(DISPOSITION_JSON).toMatchObject({
      interest: expect.any(String),
      employment: expect.any(String),
      ticket: expect.any(String),
      score: expect.any(Number),
    });
  });
});
