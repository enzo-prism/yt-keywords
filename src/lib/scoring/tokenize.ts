const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "with",
  "how",
  "what",
  "why",
  "when",
  "where",
  "is",
  "are",
  "was",
  "were",
  "be",
  "by",
  "from",
  "at",
  "your",
  "you",
  "me",
  "my",
  "we",
  "our",
  "us",
]);

export function tokenize(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return [];

  return cleaned
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
}

export function overlapRatio(keywordTokens: string[], fieldTokens: string[]): number {
  if (keywordTokens.length === 0) return 0;
  const fieldSet = new Set(fieldTokens);
  const uniqueKeywords = Array.from(new Set(keywordTokens));
  const overlap = uniqueKeywords.filter((token) => fieldSet.has(token)).length;
  return overlap / uniqueKeywords.length;
}
