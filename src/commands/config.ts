/**
 * @file Config command — show and manage application configuration.
 * Displays current environment settings and allows viewing .env values.
 * @module luxemia-social/commands/config
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Command } from 'commander';
import { header, info, success, error, warn } from '../utils/logger.js';
import env from '../utils/env.js';
import chalk from 'chalk';

/** Path to the .env file */
const ENV_PATH = path.resolve(process.cwd(), '.env');

/**
 * Read the raw .env file contents.
 * @returns Contents of .env file, or null if not found
 */
function readEnvFile(): string | null {
  if (!fs.existsSync(ENV_PATH)) return null;
  return fs.readFileSync(ENV_PATH, 'utf-8');
}

/**
 * Parse .env file contents into key-value pairs.
 * @param content - Raw .env file contents
 * @returns Record of environment variables
 */
function parseEnvFile(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.substring(0, eq).trim();
    const value = trimmed.substring(eq + 1).trim();
    vars[key] = value;
  }
  return vars;
}

/**
 * Update a key in the .env file.
 * @param key - Variable name
 * @param value - New value
 */
function updateEnvFile(key: string, value: string): void {
  let content = readEnvFile() ?? '';
  const lines = content.split('\n');
  let found = false;

  const updated = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    updated.push(`${key}=${value}`);
  }

  fs.writeFileSync(ENV_PATH, updated.join('\n') + '\n');
}

/**
 * Mask a sensitive value for display.
 * @param value - The value to mask
 * @returns Masked string showing first 8 and last 4 characters
 */
function maskValue(value: string): string {
  if (value.length <= 16) return '*'.repeat(value.length);
  return `${value.substring(0, 8)}...${value.substring(value.length - 4)}`;
}

/**
 * Register the config command with the CLI.
 * @param program - Commander program instance
 */
export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('Show or update configuration')
    .option('-s, --set <key=value>', 'Set a configuration value')
    .action((options: { set?: string }) => {
      try {
        header('Luxemia Social — Configuration');

        if (options.set) {
          const eq = options.set.indexOf('=');
          if (eq === -1) {
            error('Invalid format. Use: --set KEY=value');
            process.exit(1);
          }
          const key = options.set.substring(0, eq).trim();
          const value = options.set.substring(eq + 1).trim();

          updateEnvFile(key, value);
          success(`Updated ${key} in .env`);
          info('Restart the CLI for changes to take effect.');
          return;
        }

        // Show current config
        const envFile = readEnvFile();
        const vars = envFile ? parseEnvFile(envFile) : {};

        info('Current configuration:\n');

        const configEntries = [
          ['OPENAI_API_KEY', maskValue(env.OPENAI_API_KEY)],
          ['FB_PAGE_URL', env.FB_PAGE_URL],
          ['PINTEREST_BOARD_NAME', env.PINTEREST_BOARD_NAME],
          ['DEFAULT_PLATFORMS', env.DEFAULT_PLATFORMS.join(', ')],
          ['LOG_LEVEL', env.LOG_LEVEL],
        ];

        for (const [key, value] of configEntries) {
          const inFile = key in vars ? chalk.green('✓') : chalk.gray('○');
          console.error(`  ${inFile} ${chalk.cyan(key.padEnd(24, ' '))} ${value}`);
        }

        // Show .env file status
        if (!envFile) {
          warn('\nNo .env file found. Create one from .env.example');
        } else {
          info(`\n.env file: ${ENV_PATH}`);
        }

        // Show data directories
        info('\nData directories:');
        const dirs = [
          ['Profiles', path.resolve(process.cwd(), '.browser-profiles')],
          ['Cache', path.resolve(process.cwd(), '.cache')],
          ['Database', path.resolve(process.cwd(), 'data')],
        ];
        for (const [name, dir] of dirs) {
          const exists = fs.existsSync(dir) ? chalk.green('✓') : chalk.red('✗');
          console.error(`  ${exists} ${name.padEnd(12, ' ')} ${dir}`);
        }

        console.error('');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error(`Config command failed: ${message}`);
        process.exit(1);
      }
    });
}
