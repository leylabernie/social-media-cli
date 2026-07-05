/**
 * @file Colored logging utility using chalk.
 * Respects LOG_LEVEL environment variable for output filtering.
 * @module luxemia-social/utils/logger
 */

import chalk from 'chalk';
import env from './env.js';

/** Numeric priority for each log level (lower = more verbose) */
const LEVEL_PRIORITY: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if a message at the given level should be displayed.
 * @param level - The log level to check
 * @returns True if the message should be shown
 */
function shouldLog(level: string): boolean {
  const currentLevel = env.LOG_LEVEL ?? 'info';
  const currentPriority = LEVEL_PRIORITY[currentLevel] ?? 1;
  const messagePriority = LEVEL_PRIORITY[level] ?? 0;
  return messagePriority >= currentPriority;
}

/**
 * Log a debug message (gray, magnifying glass).
 * Only shown when LOG_LEVEL=debug.
 * @param message - The message to log
 * @param args - Additional arguments
 */
export function debug(message: string, ...args: unknown[]): void {
  if (!shouldLog('debug')) return;
  console.error(chalk.gray(`🔍 ${message}`), ...args);
}

/**
 * Log an info message (blue, robot emoji).
 * @param message - The message to log
 * @param args - Additional arguments
 */
export function info(message: string, ...args: unknown[]): void {
  if (!shouldLog('info')) return;
  console.error(chalk.blue(`🤖 ${message}`), ...args);
}

/**
 * Log a success message (green, checkmark).
 * @param message - The message to log
 * @param args - Additional arguments
 */
export function success(message: string, ...args: unknown[]): void {
  if (!shouldLog('info')) return;
  console.error(chalk.green(`✓ ${message}`), ...args);
}

/**
 * Log a warning message (yellow, warning emoji).
 * @param message - The message to log
 * @param args - Additional arguments
 */
export function warn(message: string, ...args: unknown[]): void {
  if (!shouldLog('warn')) return;
  console.error(chalk.yellow(`⚠️ ${message}`), ...args);
}

/**
 * Log an error message (red, cross mark).
 * @param message - The message to log
 * @param args - Additional arguments
 */
export function error(message: string, ...args: unknown[]): void {
  if (!shouldLog('error')) return;
  console.error(chalk.red(`✗ ${message}`), ...args);
}

/**
 * Log a section header (white, rocket emoji).
 * Used to visually separate major CLI stages.
 * @param message - The header message
 */
export function header(message: string): void {
  if (!shouldLog('info')) return;
  console.error(chalk.white.bold(`\n🚀 ${message}\n`));
}

/**
 * Log a writing/posting action (white, memo emoji).
 * @param message - The message to log
 * @param args - Additional arguments
 */
export function write(message: string, ...args: unknown[]): void {
  if (!shouldLog('info')) return;
  console.error(chalk.white(`📝 ${message}`), ...args);
}
