import { describe, expect, it } from "vitest";

import { clusterKeywordIdeas } from "@/lib/keywords/cluster";
import type { KeywordIdea } from "@/lib/types";

describe("clusterKeywordIdeas", () => {
  it("clusters by normalized token set and picks highest volume label", () => {
    const ideas: KeywordIdea[] = [
      { keyword: "how to edit videos", volume: 1200 },
      { keyword: "edit videos how to", volume: 900 },
      { keyword: "best video editor", volume: 700 },
    ];

    const result = clusterKeywordIdeas(ideas);
    expect(result.clusters.length).toBe(2);

    const primary = result.clusters.find((cluster) =>
      cluster.keywords.includes("how to edit videos")
    );
    expect(primary?.label).toBe("how to edit videos");
  });
});
