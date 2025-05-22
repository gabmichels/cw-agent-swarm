#!/usr/bin/env node
/**
 * CLI Entry Point
 * 
 * This is the main entry point for the CLI commands.
 */

import { Command } from 'commander';
import { registerCommands } from './commands';

async function main() {
  try {
    // Create the program
    const program = new Command()
      .name('agent-cli')
      .description('CLI tools for agent management')
      .version('1.0.0');
    
    // Register commands
    registerCommands(program);
    
    // Parse arguments
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the program
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 