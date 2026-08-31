import { readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

/**
 * Configuration, entirely from the environment.
 *
 * The two credentials this server exists to hold — the model key and the
 * speech key — are read here and never leave the process. They are not sent to
 * the iPad, not written to a response, and not logged. See docs/security.md
 * for why an app-side key is not an option regardless of obfuscation.
 */

/** Minimal .env reader. A dependency for `KEY=value` is not worth its supply chain. */
function loadDotEnv(path = '.env') {
  if (!existsSync(path)) return;
  const contents = readFileSync(path, 'utf8');
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // A real environment variable always wins over the file.
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

export const config = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? '0.0.0.0',

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    // Vision plus fast streaming is what tutoring on a worksheet needs.
    model: process.env.TUTOR_MODEL ?? 'claude-sonnet-5',
    maxTokens: Number(process.env.TUTOR_MAX_TOKENS ?? 1024),
    baseURL: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com',
    version: '2023-06-01',
  },

  elevenLabs: {
    apiKey: process.env.ELEVENLABS_API_KEY ?? '',
    voiceId: process.env.ELEVENLABS_VOICE_ID ?? '',
    modelId: process.env.ELEVENLABS_MODEL_ID ?? 'eleven_turbo_v2_5',
    baseURL: process.env.ELEVENLABS_BASE_URL ?? 'https://api.elevenlabs.io',
  },

  /**
   * Signs device tokens. Generated if absent so a dev server starts with no
   * setup — but then tokens do not survive a restart, which is why production
   * must set it.
   */
  tokenSecret: process.env.TOKEN_SECRET ?? randomBytes(32).toString('hex'),
  tokenSecretWasGenerated: !process.env.TOKEN_SECRET,

  limits: {
    /** Tutor requests per device per minute. */
    tutorPerMinute: Number(process.env.RATE_TUTOR_PER_MINUTE ?? 20),
    /** Speech requests per device per minute — each one costs real money. */
    voicePerMinute: Number(process.env.RATE_VOICE_PER_MINUTE ?? 12),
    /** Registrations per IP per hour, so tokens can't be minted in bulk. */
    registrationsPerHour: Number(process.env.RATE_REGISTER_PER_HOUR ?? 30),
    /** Largest accepted request body. Two page images plus text fit easily. */
    maxBodyBytes: Number(process.env.MAX_BODY_BYTES ?? 8 * 1024 * 1024),
    /** Images per request. */
    maxAttachments: 2,
    /** Characters of speech per request. */
    maxSpeechCharacters: 2000,
  },

  isProduction: process.env.NODE_ENV === 'production',
};

/** Problems worth refusing to start over, and problems worth a warning. */
export function validateConfig(cfg = config) {
  const errors = [];
  const warnings = [];

  if (!cfg.anthropic.apiKey) {
    warnings.push('ANTHROPIC_API_KEY is not set — /v1/tutor/message will return "tutor unavailable".');
  }
  if (!cfg.elevenLabs.apiKey || !cfg.elevenLabs.voiceId) {
    warnings.push('ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID is not set — /v1/voice/speak will return "voice unavailable".');
  }
  if (cfg.isProduction && cfg.tokenSecretWasGenerated) {
    errors.push('TOKEN_SECRET must be set in production, otherwise every restart signs out every device.');
  }
  if (cfg.limits.maxBodyBytes > 32 * 1024 * 1024) {
    errors.push('MAX_BODY_BYTES is unreasonably large; an image request is under 2 MB.');
  }

  return { errors, warnings };
}
