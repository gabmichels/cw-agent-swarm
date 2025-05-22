/**
 * CLI Commands
 */
import { Command } from 'commander';
import { createResetAgentLocksCommand } from './reset-agent-locks';

/**
 * Register all commands with the CLI program
 */
export function registerCommands(program: Command): void {
  // Add the reset-agent-locks command
  program.addCommand(createResetAgentLocksCommand());
} 