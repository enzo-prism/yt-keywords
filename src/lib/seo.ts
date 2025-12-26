import { normalizeKeyword } from "./keywords/normalize";
import type { ScoredVideo } from "./types";

const ANGLE_PATTERNS = [
  { key: "tutorial", label: "Step-by-step tutorial", patterns: [/how to/i, /tutorial/i, /step[- ]by[- ]step/i] },
  { key: "beginner", label: "Beginner-friendly walkthrough", patterns: [/beginner/i, /for beginners/i] },
  { key: "tips", label: "Quick tips and hacks", patterns: [/tips/i, /hacks/i, /tricks/i] },
  { key: "best", label: "Best tools or settings", patterns: [/best/i, /top \d+/i, /ultimate/i] },
  { key: "mistakes", label: "Common mistakes to avoid", patterns: [/mistake/i, /avoid/i] },
  { key: "comparison", label: "Comparison / versus angle", patterns: [/ vs /i, /versus/i, /compare/i] },
  { key: "settings", label: "Settings deep-dive", patterns: [/settings/i] },
  { key: "workflow", label: "Workflow breakdown", patterns: [/workflow/i, /process/i] },
  { key: "updated", label: "Updated for the current year", patterns: [/202[4-9]/] },
];

function detectAngles(titles: string[]) {
  const detected = new Set<string>();
  for (const title of titles) {
    for (const angle of ANGLE_PATTERNS) {
      if (angle.patterns.some((pattern) => pattern.test(title))) {
        detected.add(angle.key);
      }
    }
  }
  return detected;
}

export function buildRecommendedAngles(keyword: string, videos: ScoredVideo[]) {
  const titles = videos.map((video) => video.title);
  const detected = detectAngles(titles);
  const missing = ANGLE_PATTERNS.filter((angle) => !detected.has(angle.key));
  if (missing.length >= 3) {
    return missing.slice(0, 3).map((angle) => angle.label);
  }
  const defaults = [
    "Hands-on walkthrough with real examples",
    "Short-form quick win format",
    "Common mistakes and fixes",
  ];
  return [...missing.map((angle) => angle.label), ...defaults].slice(0, 3);
}

export function buildTitleTemplates(keyword: string) {
  const trimmed = keyword.trim();
  const normalized = trimmed.toLowerCase();
  const base =
    normalized.startsWith("how to ") || normalized.startsWith("how-to ")
      ? trimmed.replace(/^how[- ]to\s+/i, "")
      : trimmed;

  return [
    normalized.startsWith("how to")
      ? trimmed
      : `How to ${base} (Step-by-Step)`,
    `${trimmed} for Beginners`,
    `Best ${base} Tips (${new Date().getFullYear()})`,
    `${trimmed} Explained in 10 Minutes`,
    `${base} Workflow: From Start to Finish`,
  ];
}

export function buildDescriptionTemplate(
  keyword: string,
  relatedKeywords: string[]
) {
  const variants = relatedKeywords
    .filter((term) => term.toLowerCase() !== keyword.toLowerCase())
    .slice(0, 4)
    .join(", ");

  return `${keyword} is the focus of this video. In this guide, you'll learn the exact steps, shortcuts, and workflow to get results fast.${
    variants ? ` We'll also cover ${variants}.` : ""
  }\n\nChapters:\n00:00 Intro\n00:30 Key setup\n02:00 Step-by-step walkthrough\n05:30 Common mistakes\n07:00 Final tips`;
}

export function buildSuggestedTags(keyword: string, relatedKeywords: string[]) {
  const tagSet = new Set<string>();
  const ordered: string[] = [];

  const addTag = (tag: string) => {
    const normalized = normalizeKeyword(tag);
    if (!normalized || tagSet.has(normalized)) return;
    tagSet.add(normalized);
    ordered.push(tag.trim());
  };

  addTag(keyword);
  relatedKeywords.forEach(addTag);

  return ordered.slice(0, 15);
}
