/**
 * Discord notification channel for the NotificationManager
 * Provides integration with Discord using discord.js
 */

// Import discord.js only on the server side
import type { Client, TextChannel } from 'discord.js';

// Import interfaces
import { NotificationChannel } from '../interfaces/NotificationManager.interface';

// Declare types but don't import directly
type GatewayIntentBits = any;

/**
 * Discord channel configuration options
 */
export interface DiscordChannelConfig {
  token: string;
  channelId: string;
  username?: string;
  avatarUrl?: string;
}

/**
 * Error class for Discord channel operations
 */
export class DiscordChannelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscordChannelError';
  }
}

/**
 * Discord channel implementation
 */
export class DiscordNotificationChannel {
  private client: Client | null = null;
  private token: string;
  private channelId: string;
  private username?: string;
  private avatarUrl?: string;
  private ready = false;
  
  /**
   * Create a new Discord channel instance
   * 
   * @param config Discord channel configuration
   */
  constructor(config: DiscordChannelConfig) {
    this.token = config.token;
    this.channelId = config.channelId;
    this.username = config.username;
    this.avatarUrl = config.avatarUrl;
  }
  
  /**
   * Initialize the Discord client
   * 
   * @returns Promise resolving to initialization success
   */
  async initialize(): Promise<boolean> {
    // Only initialize on the server
    if (typeof window !== 'undefined') {
      console.warn('Discord client cannot be initialized in browser environment');
      return false;
    }
    
    return new Promise(async (resolve) => {
      try {
        // Dynamically import discord.js to avoid client-side bundling issues
        const { Client, GatewayIntentBits } = await import('discord.js');
        
        // Create Discord client
        this.client = new Client({
          intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
          ],
        });
        
        // Set up ready event handler
        this.client.once('ready', () => {
          console.log('Discord notification channel is ready');
          this.ready = true;
          resolve(true);
        });
        
        // Log in to Discord
        this.client.login(this.token).catch((error: Error) => {
          console.error('Discord login error:', error);
          resolve(false);
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Discord initialization error:', errorMessage);
        resolve(false);
      }
    });
  }
  
  /**
   * Send a message to Discord
   * 
   * @param title Message title or notification title
   * @param content Message content
   * @param options Additional options
   * @returns Promise resolving to sending success
   */
  async send(
    title: string,
    content: string,
    options?: {
      mention?: string;
      embeds?: any[];
      files?: any[];
    }
  ): Promise<boolean> {
    // Only run on server
    if (typeof window !== 'undefined') {
      console.warn('Discord client cannot send messages in browser environment');
      return false;
    }
    
    try {
      if (!this.client || !this.ready) {
        console.warn('Discord client not ready, cannot send message');
        return false;
      }
      
      // Get the channel
      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel || !('send' in channel)) {
        console.error('Discord channel not found or not a text channel');
        return false;
      }
      
      // Format the message
      let formattedMessage = '';
      
      // Add mention if provided
      if (options?.mention) {
        formattedMessage += `${options.mention} `;
      }
      
      // Add title and content
      formattedMessage += `**${title}**\n${content}`;
      
      // Send the message (simple string version)
      await (channel as TextChannel).send(formattedMessage);
      
      // If we have embeds or files, log that they're not supported in this implementation
      if ((options?.embeds && options.embeds.length > 0) || 
          (options?.files && options.files.length > 0)) {
        console.warn('Discord notification channel: embeds and files not supported with current implementation');
      }
      
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error sending Discord message:', errorMessage);
      return false;
    }
  }
  
  /**
   * Shutdown the Discord client
   * 
   * @returns Promise resolving when shutdown is complete
   */
  async shutdown(): Promise<void> {
    // Only run on server
    if (typeof window !== 'undefined') {
      return;
    }
    
    try {
      if (this.client) {
        await this.client.destroy();
        console.log('Discord client disconnected');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error shutting down Discord client:', errorMessage);
    }
  }
  
  /**
   * Check if the Discord client is ready
   * 
   * @returns Boolean indicating readiness
   */
  isReady(): boolean {
    return this.ready;
  }
} 