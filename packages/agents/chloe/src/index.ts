import { config } from '@crowd-wisdom/core';
import { ChloeAgent } from './agent';
import { setupScheduler } from './scheduler';
import { DiscordNotifier } from './notifiers/discord';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  console.log(`Starting Chloe Agent v${config.system.version}`);
  
  try {
    // Initialize the agent
    const chloe = new ChloeAgent();
    await chloe.initialize();
    
    console.log('Chloe agent initialized successfully');
    
    // Set up notification services if configured
    if (process.env.DISCORD_TOKEN && process.env.DISCORD_CHANNEL_ID) {
      const discordNotifier = new DiscordNotifier({
        token: process.env.DISCORD_TOKEN,
        channelId: process.env.DISCORD_CHANNEL_ID,
      });
      await discordNotifier.initialize();
      chloe.addNotifier(discordNotifier);
      console.log('Discord notifier initialized');
    }
    
    // Set up daily tasks and scheduler
    const scheduler = setupScheduler(chloe);
    scheduler.start();
    console.log('Task scheduler started');
    
    // Run initial tasks
    await chloe.runInitialTasks();
    
    // Keep the process alive
    process.on('SIGINT', async () => {
      console.log('Shutting down Chloe agent...');
      await chloe.shutdown();
      process.exit(0);
    });
  } catch (error) {
    console.error('Error starting Chloe agent:', error);
    process.exit(1);
  }
}

// Start the agent
if (require.main === module) {
  main();
}

export * from './agent';
export * from './tools';
export * from './scheduler';
export * from './notifiers'; 