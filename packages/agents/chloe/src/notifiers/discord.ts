import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import { Notifier } from './index';

interface DiscordNotifierConfig {
  token: string;
  channelId: string;
}

export class DiscordNotifier implements Notifier {
  name = 'discord';
  private client: Client;
  private token: string;
  private channelId: string;
  private ready = false;

  constructor(config: DiscordNotifierConfig) {
    this.token = config.token;
    this.channelId = config.channelId;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
      ],
    });
  }

  async initialize(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.client.once('ready', () => {
          console.log('Discord notifier is ready');
          this.ready = true;
          resolve(true);
        });

        this.client.login(this.token).catch((error) => {
          console.error('Discord login error:', error);
          resolve(false);
        });
      } catch (error) {
        console.error('Discord initialization error:', error);
        resolve(false);
      }
    });
  }

  async send(message: string): Promise<boolean> {
    try {
      if (!this.ready) {
        console.warn('Discord client not ready, attempting to send anyway');
      }

      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel || !(channel instanceof TextChannel)) {
        console.error('Discord channel not found or not a text channel');
        return false;
      }

      await channel.send(message);
      return true;
    } catch (error) {
      console.error('Error sending Discord message:', error);
      return false;
    }
  }

  async shutdown(): Promise<void> {
    try {
      await this.client.destroy();
      console.log('Discord client disconnected');
    } catch (error) {
      console.error('Error shutting down Discord client:', error);
    }
  }
}