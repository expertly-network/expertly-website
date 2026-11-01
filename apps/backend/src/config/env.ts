import { Logger } from '@nestjs/common';
import { z } from 'zod';

// Boot-time environment validation. Each entry point (main.ts = API, worker.ts = search worker)
// calls its loader before Nest starts: a missing or malformed variable fails the process right
// away with a list of the offending NAMES (never their values), instead of surfacing later as a
// 500 on the first request that happens to need it. Files may read the parsed result through
// `env()`; existing `process.env` reads elsewhere keep working, they're just validated up front.

const optionalString = z.string().min(1).optional();

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

const httpUrl = z.string().refine(isHttpUrl, 'must be an http(s) URL');

// Optional positive integer (dotenv gives strings). Out-of-range values are a config mistake, not
// something to silently replace with the default.
const optionalPositiveInt = z.coerce.number().int().positive().optional();

/** Splits CORS_ORIGINS ("https://a.com, https://b.com") into trimmed, non-empty entries. */
export function parseCorsOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

const baseShape = {
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: httpUrl,
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Article AI drafting (src/ai/). All optional: unset disables the feature (its endpoints 503).
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'google']).optional(),
  AI_MODEL: optionalString,
  OPENAI_API_KEY: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  GOOGLE_GENERATIVE_AI_API_KEY: optionalString,

  // AI search (src/search/). Defaults live in search.config.ts.
  OPENAI_EMBED_MODEL: optionalString,
  OPENAI_CHAT_MODEL: optionalString,
};

const apiSchema = z.object({
  ...baseShape,
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGINS: optionalString.refine(
    (raw) => parseCorsOrigins(raw).every(isHttpUrl),
    'every entry must be an http(s) origin'
  ),
  SWAGGER_ENABLED: z.enum(['true', 'false']).optional(),
  ARTICLES_REVIEW_MODE: z.enum(['instant', 'editorial']).default('instant'),
  // Mirrors the frontend's SITE_LAUNCHED (set both together): 'false' = founding-cohort
  // pre-launch, when the application doesn't collect peer references. Unset = launched.
  SITE_LAUNCHED: z.enum(['true', 'false']).optional(),
  UNSPLASH_ACCESS_KEY: optionalString,
  LINKEDIN_IMPORT_WEBHOOK_URL: httpUrl.optional(),
  CONSULTATION_REQUEST_LIMIT: optionalPositiveInt,
  CONSULTATION_REQUEST_WINDOW_DAYS: optionalPositiveInt,
  CONSULTATION_PENDING_COOLDOWN_DAYS: optionalPositiveInt,
});

// Cross-variable rules, checked on the raw input so they're reported alongside (not only after)
// per-variable errors. Fail closed: production never falls back to "any origin" for CORS.
function apiCrossChecks(raw: Record<string, string>): string[] {
  const problems: string[] = [];
  if (raw.NODE_ENV === 'production' && parseCorsOrigins(raw.CORS_ORIGINS).length === 0) {
    problems.push('CORS_ORIGINS is required when NODE_ENV=production');
  }
  return problems;
}

// The worker embeds documents with OpenAI on every tick, so its key is mandatory there.
const workerSchema = z.object({ ...baseShape, OPENAI_API_KEY: z.string().min(1) });

export type ApiEnv = z.infer<typeof apiSchema>;
export type WorkerEnv = z.infer<typeof workerSchema>;

let apiEnv: ApiEnv | null = null;

// dotenv turns `KEY=` into an empty string; treat that the same as unset.
function nonEmptyEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && value.trim() !== '') out[key] = value;
  }
  return out;
}

// Problem descriptions by variable NAME — a value is never included.
function validate<T>(
  schema: z.ZodType<T>,
  crossChecks: (raw: Record<string, string>) => string[] = () => []
): { data: T | null; problems: string[] } {
  const raw = nonEmptyEnv();
  const result = schema.safeParse(raw);
  const problems = result.success
    ? []
    : result.error.issues.map((issue) => {
        const name = issue.path.join('.') || '(root)';
        return `${name} ${!(name in raw) ? 'is required' : issue.message}`;
      });
  problems.push(...crossChecks(raw));
  return { data: result.success && problems.length === 0 ? result.data : null, problems };
}

function validateOrExit<T>(
  schema: z.ZodType<T>,
  entry: string,
  crossChecks?: (raw: Record<string, string>) => string[]
): T {
  const { data, problems } = validate(schema, crossChecks);
  if (data) return data;
  const logger = new Logger('Env');
  for (const problem of problems) logger.error(problem);
  logger.error(`Invalid environment for the ${entry} — fix the variables above and restart.`);
  process.exit(1);
}

/** Validates the API's environment; exits the process (code 1) if it's invalid. */
export function loadApiEnv(): ApiEnv {
  apiEnv = validateOrExit(apiSchema, 'API', apiCrossChecks);
  return apiEnv;
}

/** Validates the search worker's environment; exits the process (code 1) if it's invalid. */
export function loadWorkerEnv(): WorkerEnv {
  return validateOrExit(workerSchema, 'search worker');
}

/**
 * The validated API environment. Lazily validates on first use when an entry point hasn't
 * (e.g. a script importing a service directly), throwing instead of exiting.
 */
export function env(): ApiEnv {
  if (apiEnv) return apiEnv;
  const { data, problems } = validate(apiSchema, apiCrossChecks);
  if (!data) throw new Error(`Invalid environment: ${problems.join('; ')}`);
  apiEnv = data;
  return apiEnv;
}
