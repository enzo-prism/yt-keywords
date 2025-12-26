function normalizeInput(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeKeyword(value: string) {
  return normalizeInput(value);
}

export function isLowSignalAutocompleteVariant(keyword: string, seed: string) {
  const normalizedKeyword = normalizeInput(keyword);
  const normalizedSeed = normalizeInput(seed);

  if (!normalizedKeyword || !normalizedSeed) return false;
  if (normalizedKeyword === normalizedSeed) return false;

  const keywordTokens = normalizedKeyword.split(" ");
  const seedTokens = normalizedSeed.split(" ");

  if (keywordTokens.length === seedTokens.length + 1) {
    const lastToken = keywordTokens[keywordTokens.length - 1];
    const firstToken = keywordTokens[0];
    if (
      lastToken.length === 1 &&
      keywordTokens.slice(0, -1).join(" ") === normalizedSeed
    ) {
      return true;
    }
    if (
      firstToken.length === 1 &&
      keywordTokens.slice(1).join(" ") === normalizedSeed
    ) {
      return true;
    }
  }

  const lastToken = keywordTokens[keywordTokens.length - 1] ?? "";
  if (
    lastToken.length === 1 &&
    normalizedKeyword.startsWith(normalizedSeed) &&
    Math.abs(normalizedKeyword.length - normalizedSeed.length) <= 2
  ) {
    return true;
  }

  if (
    normalizedKeyword.length - normalizedSeed.length <= 2 &&
    normalizedKeyword.startsWith(normalizedSeed)
  ) {
    const suffix = normalizedKeyword.slice(normalizedSeed.length).trim();
    if (suffix.length > 0 && suffix.length <= 1) {
      return true;
    }
  }

  return false;
}

export function applyIncludeExclude(
  keyword: string,
  includeTerms: string[],
  excludeTerms: string[]
) {
  const normalizedKeyword = normalizeInput(keyword);
  const normalizedIncludes = includeTerms
    .map(normalizeInput)
    .filter((term) => term.length > 0);
  const normalizedExcludes = excludeTerms
    .map(normalizeInput)
    .filter((term) => term.length > 0);

  if (
    normalizedIncludes.length > 0 &&
    !normalizedIncludes.every((term) => normalizedKeyword.includes(term))
  ) {
    return false;
  }

  if (
    normalizedExcludes.length > 0 &&
    normalizedExcludes.some((term) => normalizedKeyword.includes(term))
  ) {
    return false;
  }

  return true;
}
