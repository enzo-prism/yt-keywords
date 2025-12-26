import { tokenize } from "../scoring/tokenize.ts";
import type { KeywordIdea } from "../types.ts";
import { normalizeKeyword } from "./normalize.ts";

export type KeywordCluster = {
  id: string;
  label: string;
  keywords: string[];
};

export function clusterKeywordIdeas(ideas: KeywordIdea[]) {
  const clusters = new Map<string, { id: string; items: KeywordIdea[] }>();
  const keywordToCluster = new Map<string, KeywordCluster>();

  for (const idea of ideas) {
    const tokens = tokenize(idea.keyword).sort();
    const baseKey = tokens.length ? tokens.join(" ") : normalizeKeyword(idea.keyword);
    const key = baseKey || normalizeKeyword(idea.keyword) || idea.keyword;
    const entry = clusters.get(key) ?? { id: key, items: [] };
    entry.items.push(idea);
    clusters.set(key, entry);
  }

  const clusterList: KeywordCluster[] = [];

  for (const entry of clusters.values()) {
    const sortedItems = [...entry.items].sort((a, b) => {
      if (b.volume !== a.volume) return b.volume - a.volume;
      return a.keyword.length - b.keyword.length;
    });
    const label = sortedItems[0]?.keyword ?? entry.items[0]?.keyword ?? "";
    const keywords = entry.items.map((item) => item.keyword);
    const cluster: KeywordCluster = {
      id: entry.id,
      label,
      keywords,
    };
    clusterList.push(cluster);

    for (const item of entry.items) {
      keywordToCluster.set(normalizeKeyword(item.keyword), cluster);
    }
  }

  return { clusters: clusterList, keywordToCluster };
}
