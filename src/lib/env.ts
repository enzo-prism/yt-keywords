import { z } from "zod";

const envSchema = z.object({
  KEYWORDTOOL_API_KEY: z.string().min(1),
  YOUTUBE_API_KEY: z.string().min(1),
  APP_URL: z
    .preprocess(
      (value) =>
        typeof value === "string" && value.length === 0 ? undefined : value,
      z.string().url().optional().default("http://localhost:3000")
    )
    .default("http://localhost:3000"),
  KEYWORDTOOL_TRENDS_ENABLED: z
    .preprocess((value) => (value === "true" ? true : false), z.boolean())
    .optional()
    .default(false),
  KV_REST_API_URL: z.string().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  KV_REST_API_READ_ONLY_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export class EnvError extends Error {
  readonly missingKeys: string[];

  constructor(missingKeys: string[]) {
    super(`Missing required environment configuration: ${missingKeys.join(", ")}`);
    this.missingKeys = missingKeys;
  }
}

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse({
    KEYWORDTOOL_API_KEY: process.env.KEYWORDTOOL_API_KEY,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    APP_URL: process.env.APP_URL,
  });

  if (!parsed.success) {
    const missingKeys = parsed.error.issues
      .map((issue) => issue.path[0])
      .filter((key): key is string => typeof key === "string");
    throw new EnvError(missingKeys);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getEnvStatus() {
  const missingKeys = ["KEYWORDTOOL_API_KEY", "YOUTUBE_API_KEY"].filter(
    (key) => !process.env[key]
  );

  return {
    keywordtoolConfigured: Boolean(process.env.KEYWORDTOOL_API_KEY),
    youtubeConfigured: Boolean(process.env.YOUTUBE_API_KEY),
    kvConfigured: Boolean(
      process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ),
    trendsEnabled: process.env.KEYWORDTOOL_TRENDS_ENABLED === "true",
    missingKeys,
  };
}

export function formatEnvError(error: unknown) {
  if (error instanceof EnvError) {
    const suffix = error.missingKeys.length
      ? ` Missing: ${error.missingKeys.join(", ")}.`
      : "";
    return `Server misconfigured.${suffix}`;
  }
  return "Server misconfigured.";
}
