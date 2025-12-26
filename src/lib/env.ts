import { z } from "zod";

const envSchema = z.object({
  KEYWORDTOOL_API_KEY: z.string().min(1),
  YOUTUBE_API_KEY: z.string().min(1),
  APP_URL: z
    .preprocess(
      (value) => (typeof value === "string" && value.length === 0 ? undefined : value),
      z.string().url().optional().default("http://localhost:3000")
    )
    .default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse({
    KEYWORDTOOL_API_KEY: process.env.KEYWORDTOOL_API_KEY,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    APP_URL: process.env.APP_URL,
  });

  if (!parsed.success) {
    throw new Error("Missing required environment configuration.");
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getEnvStatus() {
  return {
    keywordtoolConfigured: Boolean(process.env.KEYWORDTOOL_API_KEY),
    youtubeConfigured: Boolean(process.env.YOUTUBE_API_KEY),
  };
}
