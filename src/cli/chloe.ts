#!/usr/bin/env node
/**
 * CLI for Chloe - allows manual triggering of autonomous features
 */

// Import dotenv and commander using ES modules
import dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
import { ChloeAgent } from '../agents/chloe/core/agent';
import { initializeChloeAutonomy, diagnoseAutonomySystem } from '../agents/chloe/autonomy';
import { notifyDiscord } from '../agents/shared/notifications/utils';

// Define interfaces for CLI options
interface NotificationOptions {
  type: string;
  mention: boolean;
}

const program = new Command();

// Helper function to create and initialize the agent
async function createAgent() {
  console.log('Initializing Chloe agent...');
  const agent = new ChloeAgent();
  await agent.initialize();
  return agent;
}

program
  .name('chloe-cli')
  .description('CLI to manage Chloe\'s autonomous functions')
  .version('1.0.0');

program
  .command('weekly-reflection')
  .description('Manually trigger a weekly reflection')
  .action(async () => {
    try {
      console.log('Running weekly reflection...');
      const agent = await createAgent();
      const reflection = await agent.runWeeklyReflection();
      console.log('Weekly reflection completed successfully:');
      console.log('---');
      console.log(reflection.substring(0, 500) + (reflection.length > 500 ? '...' : ''));
      console.log('---');
      process.exit(0);
    } catch (error) {
      console.error('Error running weekly reflection:', error);
      process.exit(1);
    }
  });

program
  .command('daily-tasks')
  .description('Manually trigger daily tasks')
  .action(async () => {
    try {
      console.log('Running daily tasks...');
      const agent = await createAgent();
      await agent.runDailyTasks();
      console.log('Daily tasks completed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error running daily tasks:', error);
      process.exit(1);
    }
  });

program
  .command('daily-summary')
  .description('Generate and send a daily summary to Discord')
  .action(async () => {
    try {
      console.log('Generating daily summary...');
      const agent = await createAgent();
      const result = await agent.sendDailySummaryToDiscord();
      console.log(`Daily summary ${result ? 'sent successfully' : 'failed to send'}`);
      process.exit(0);
    } catch (error) {
      console.error('Error generating daily summary:', error);
      process.exit(1);
    }
  });

program
  .command('diagnose')
  .description('Run diagnostic checks on Chloe\'s autonomy systems')
  .action(async () => {
    try {
      console.log('Running diagnostics...');
      const diagnostics = await diagnoseAutonomySystem();
      
      console.log('--- DIAGNOSTICS REPORT ---');
      console.log('Memory System:', diagnostics.memory.status);
      console.log(`Message Count: ${diagnostics.memory.messageCount}`);
      console.log('Scheduler:', diagnostics.scheduler.status);
      console.log(`Active Tasks: ${diagnostics.scheduler.activeTasks}`);
      console.log('Planning System:', diagnostics.planning.status);
      console.log('-------------------------');
      
      process.exit(0);
    } catch (error) {
      console.error('Error running diagnostics:', error);
      process.exit(1);
    }
  });

program
  .command('send-notification <message>')
  .description('Send a Discord notification')
  .option('-t, --type <type>', 'Notification type (update, alert, summary)', 'update')
  .option('-m, --mention', 'Add a user mention', false)
  .action(async (message: string, options: NotificationOptions) => {
    try {
      console.log(`Sending ${options.type} notification${options.mention ? ' with mention' : ''}...`);
      
      // Validate type
      const type = ['update', 'alert', 'summary'].includes(options.type) 
        ? options.type
        : 'update';
      
      await notifyDiscord(message, type, options.mention);
      console.log('Notification sent successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error sending notification:', error);
      process.exit(1);
    }
  });

program
  .command('reflect <question>')
  .description('Make Chloe reflect on a specific question')
  .action(async (question: string) => {
    try {
      console.log(`Running reflection on: "${question}"`);
      const agent = await createAgent();
      const reflection = await agent.reflect(question);
      console.log('Reflection completed:');
      console.log('---');
      console.log(reflection);
      console.log('---');
      process.exit(0);
    } catch (error) {
      console.error('Error during reflection:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);

// If no commands were given, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 