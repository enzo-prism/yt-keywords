import { describe, expect, it } from "vitest";

import { fitScore } from "@/lib/scoring/fit";
import { logNorm } from "@/lib/scoring/opportunity";
import { tokenize } from "@/lib/scoring/tokenize";

describe("tokenize", () => {
  it("removes punctuation and stopwords", () => {
    expect(tokenize("How to grow on YouTube!")).toEqual(["grow", "youtube"]);
  });
});

describe("fitScore", () => {
  it("combines title, description, and tags", () => {
    const keywordTokens = tokenize("grow youtube");
    const titleTokens = tokenize("grow youtube");
    const descTokens = tokenize("grow youtube");
    const tagTokens = tokenize("grow youtube");

    expect(fitScore(keywordTokens, titleTokens, descTokens, tagTokens)).toBeCloseTo(
      1,
      6
    );
  });
});

describe("scoring", () => {
  it("logNorm guards when min equals max", () => {
    expect(logNorm(100, 100, 100)).toBe(0.5);
  });
});
