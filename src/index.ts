#!/usr/bin/env node

/**
 * @file CLI entry point for luxemia-social.
 * Sets up all commands and global options using Commander.
 * @module luxemia-social/index
 */

import { Command } from 'commander';
import { registerPostCommand } from './commands/post.js';
import { registerAuthCommand } from './commands/auth.js';
import { registerStatusCommand } from './commands/status.js';
import { registerHistoryCommand } from './commands/history.js';
import { registerScheduleCommand } from './commands/schedule.js';
import { registerRetryCommand } from './commands/retry.js';
import { registerConfigCommand } from './commands/config.js';
import { stopAllSchedules } from './scheduler/cron.js';

/**
 * Create and configure the CLI program.
 * @returns Configured Commander instance
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('luxemia-social')
    .description('CLI tool for automated social media posting via browser automation')
    .version('1.0.0')
    .configureOutput({
      writeErr: (str) => process.stderr.write(str),
      outputError: (str, write) => write(`\n${str}\n`),
    });

  // Register all commands
  registerPostCommand(program);
  registerAuthCommand(program);
  registerStatusCommand(program);
  registerHistoryCommand(program);
  registerScheduleCommand(program);
  registerRetryCommand(program);
  registerConfigCommand(program);

  return program;
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const program = createProgram();

  // Graceful shutdown — stop all scheduled jobs on exit
  process.on('SIGINT', () => {
    stopAllSchedules();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    stopAllSchedules();
    process.exit(0);
  });

  await program.parseAsync(process.argv);

  // If no args provided, show help
  if (process.argv.length <= 2) {
    program.help();
  }
}

// Run the CLI
main().catch((err) => {
  console.error(`\nFatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
