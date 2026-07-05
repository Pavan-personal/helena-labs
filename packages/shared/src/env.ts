import { z } from 'zod';

const EnvSchema = z.object({
  BTL_API_KEY: z.string().min(1),
  BTL_BASE_URL: z.string().url().default('https://api.badtheorylabs.com/v1'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),

  SLACK_CLIENT_ID: z.string().min(1),
  SLACK_CLIENT_SECRET: z.string().min(1),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_BOT_TOKEN: z.string().min(1),

  DISCORD_APPLICATION_ID: z.string().optional(),
  DISCORD_PUBLIC_KEY: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().optional(),

  GRAFANA_WEBHOOK_SECRET: z.string().min(1),
  SENTRY_WEBHOOK_TOKEN: z.string().min(1),
  GENERIC_WEBHOOK_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),

  GITHUB_APP_ID: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  SENTRY_INTERNAL_TOKEN: z.string().optional(),
  SENTRY_CLIENT_SECRET: z.string().optional(),
  SENTRY_ORG_SLUG: z.string().optional(),

  GRAFANA_TOKEN: z.string().optional(),
  GRAFANA_URL: z.string().optional()
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Env validation failed:', parsed.error.flatten().fieldErrors);
    throw new Error('Missing or invalid environment variables');
  }
  cached = parsed.data;
  return cached;
}
