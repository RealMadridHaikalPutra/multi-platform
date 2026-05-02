import { config as loadDotEnv } from "dotenv";
import { z } from "zod";

loadDotEnv();

const useDummy = ["true", "1", "yes"].includes(String(process.env.USE_DUMMY_DATA ?? "").toLowerCase());

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
};

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

const CommonSchema = z.object({
  USE_DUMMY_DATA: z.coerce.boolean().default(false),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().default("multi-marketplace-sync"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  QUEUE_NAME: z.string().default("sync-events"),
  EXTERNAL_RETRY_ATTEMPTS: z.coerce.number().int().min(1).default(3),
  EXTERNAL_RETRY_BASE_DELAY_MS: z.coerce.number().int().min(50).default(250)
});

const RequiredSchema = CommonSchema.extend({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  SHOPEE_BASE_URL: optionalUrl,
  SHOPEE_PARTNER_ID: optionalString,
  SHOPEE_PARTNER_KEY: optionalString,
  SHOPEE_WEBHOOK_SECRET: optionalString,

  TIKTOK_BASE_URL: optionalUrl,
  TIKTOK_APP_KEY: optionalString,
  TIKTOK_APP_SECRET: optionalString,
  TIKTOK_WEBHOOK_SECRET: optionalString
});

const DummySchema = CommonSchema.extend({
  DATABASE_URL: z.string().min(1).default("postgresql://dummy:dummy@localhost:5432/dummy"),
  REDIS_URL: z.string().min(1).default("redis://127.0.0.1:6379"),

  SHOPEE_BASE_URL: z.string().url().default("https://example.invalid"),
  SHOPEE_PARTNER_ID: z.string().optional(),
  SHOPEE_PARTNER_KEY: z.string().optional(),
  SHOPEE_WEBHOOK_SECRET: z.string().min(1).default("dummy-secret"),

  TIKTOK_BASE_URL: z.string().url().default("https://example.invalid"),
  TIKTOK_APP_KEY: z.string().optional(),
  TIKTOK_APP_SECRET: z.string().optional(),
  TIKTOK_WEBHOOK_SECRET: z.string().min(1).default("dummy-secret")
});

export type Env = z.infer<typeof RequiredSchema>;

export const env: Env = (useDummy ? DummySchema : RequiredSchema).parse(process.env);
