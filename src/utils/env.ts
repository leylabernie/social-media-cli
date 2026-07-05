/**
 * @file Environment variable validation and typed config export.
 * @module luxemia-social/utils/env
 */

import 'dotenv/config';
import { error } from './logger.js';

/** Valid log level values */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Typed environment configuration object */
export interface EnvConfig {
  /** OpenAI API key for caption generation */
  OPENAI_API_KEY: string;
  /** Facebook page URL to post to */
  FB_PAGE_URL: string;
  /** Pinterest board name for pinning */
  PINTEREST_BOARD_NAME: string;
  /** Default platforms to post to (comma-separated list) */
  DEFAULT_PLATFORMS: string[];
  /** Log level for CLI output */
  LOG_LEVEL: LogLevel;
}

/**
 * Validate that a required environment variable is set.
 * @param key - The environment variable name
 * @returns The variable value
 * @throws Error if the variable is not set
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    error(`Missing required environment variable: ${key}`);
    throw new Error(`Environment variable ${key} is required. Set it in .env file.`);
  }
  return value;
}

/**
 * Read an optional environment variable with a fallback.
 * @param key - The environment variable name
 * @param fallback - Default value if not set
 * @returns The variable value or fallback
 */
function getEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

/**
 * Parse a comma-separated list from an environment variable.
 * @param key - The environment variable name
 * @param fallback - Default value if not set
 * @returns Array of trimmed, non-empty strings
 */
function getEnvList(key: string, fallback: string): string[] {
  const raw = process.env[key] ?? fallback;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Validated environment configuration */
const env: EnvConfig = {
  OPENAI_API_KEY: requireEnv('OPENAI_API_KEY'),
  FB_PAGE_URL: getEnv('FB_PAGE_URL', 'https://www.facebook.com/luxemiashop'),
  PINTEREST_BOARD_NAME: getEnv('PINTEREST_BOARD_NAME', 'LuxeMia Products'),
  DEFAULT_PLATFORMS: getEnvList('DEFAULT_PLATFORMS', 'x,instagram,facebook,pinterest,linkedin'),
  LOG_LEVEL: (getEnv('LOG_LEVEL', 'info') as LogLevel),
};

export default env;
export { env };
