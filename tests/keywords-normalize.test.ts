import { describe, expect, it } from "vitest";

import {
  applyIncludeExclude,
  isLowSignalAutocompleteVariant,
  normalizeKeyword,
} from "@/lib/keywords/normalize";

describe("normalizeKeyword", () => {
  it("normalizes casing and punctuation", () => {
    expect(normalizeKeyword(" How to Edit Videos!! ")).toBe(
      "how to edit videos"
    );
  });
});

describe("isLowSignalAutocompleteVariant", () => {
  it("flags single-letter appended variants", () => {
    expect(
      isLowSignalAutocompleteVariant("how to edit videos a", "how to edit videos")
    ).toBe(true);
  });

  it("flags single-letter prepended variants", () => {
    expect(
      isLowSignalAutocompleteVariant("a how to edit videos", "how to edit videos")
    ).toBe(true);
  });

  it("does not flag unrelated keyword", () => {
    expect(
      isLowSignalAutocompleteVariant("how to edit videos fast", "how to edit videos")
    ).toBe(false);
  });
});

describe("applyIncludeExclude", () => {
  it("requires all include terms", () => {
    expect(
      applyIncludeExclude("how to edit videos", ["edit", "videos"], [])
    ).toBe(true);
    expect(applyIncludeExclude("how to edit videos", ["edit", "tiktok"], [])).toBe(
      false
    );
  });

  it("rejects excluded terms", () => {
    expect(applyIncludeExclude("how to edit videos", [], ["tiktok"])).toBe(true);
    expect(applyIncludeExclude("how to edit tiktok videos", [], ["tiktok"])).toBe(
      false
    );
  });
});
