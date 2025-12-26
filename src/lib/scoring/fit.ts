import { overlapRatio } from "./tokenize.ts";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function fitScore(
  keywordTokens: string[],
  titleTokens: string[],
  descTokens: string[],
  tagTokens: string[]
): number {
  const titleMatch = overlapRatio(keywordTokens, titleTokens);
  const descMatch = overlapRatio(keywordTokens, descTokens);
  const tagMatch = overlapRatio(keywordTokens, tagTokens);

  const fit = 0.6 * titleMatch + 0.3 * descMatch + 0.1 * tagMatch;
  return clamp(fit, 0, 1);
}
