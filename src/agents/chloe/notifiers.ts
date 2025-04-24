// Notification system for Chloe

/**
 * Base notifier interface
 */
export interface Notifier {
  name: string;
  send(message: string): Promise<void>;
}

/**
 * Console notifier - logs notifications to the console
 */
export class ConsoleNotifier implements Notifier {
  name = 'console';
  
  async send(message: string): Promise<void> {
    console.log(`[NOTIFICATION] ${message}`);
  }
}

/**
 * Discord notifier - sends notifications to a Discord channel
 */
export class DiscordNotifier implements Notifier {
  name = 'discord';
  private token: string;
  private channelId: string;
  private userId: string;
  private webhookUrl?: string;
  private enabled: boolean = false;
  private dmChannelId?: string;
  
  constructor(options: {
    token?: string;
    channelId?: string;
    userId?: string;
    webhookUrl?: string;
    useDm?: boolean;
  }) {
    // Get from options or environment variables
    this.token = options.token || process.env.DISCORD_BOT_TOKEN || '';
    this.channelId = options.channelId || process.env.DISCORD_CHANNEL_ID || '';
    this.userId = options.userId || process.env.DISCORD_USER_ID || '';
    this.webhookUrl = options.webhookUrl || process.env.DISCORD_WEBHOOK_URL;
    
    // Check if we have enough info to enable Discord notifications
    this.enabled = !!(this.token && this.channelId) || !!this.webhookUrl || !!(this.token && this.userId && options.useDm);
    
    if (!this.enabled) {
      console.warn('Discord notifier initialized but not enabled. Missing token, channelId, webhookUrl, or userId for DMs.');
    } else {
      console.log('Discord notifier initialized and enabled.');
      
      // Set up DM channel if requested
      if (options.useDm && this.token && this.userId) {
        this.setupDmChannel().catch(error => {
          console.error('Error setting up DM channel:', error);
        });
      }
    }
  }
  
  /**
   * Set up a DM channel with the specified user
   */
  private async setupDmChannel(): Promise<void> {
    if (!this.token || !this.userId) {
      console.warn('Cannot set up DM channel: Missing token or userId');
      return;
    }
    
    try {
      const response = await fetch('https://discord.com/api/v10/users/@me/channels', {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient_id: this.userId
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create DM channel: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      this.dmChannelId = data.id;
      console.log('Successfully set up DM channel with user');
    } catch (error) {
      console.error('Error setting up DM channel:', error);
      throw error;
    }
  }
  
  /**
   * Send a direct message to the user
   */
  async sendDirectMessage(message: string, type: "update" | "alert" | "summary" = "update"): Promise<void> {
    if (!this.token || !this.userId) {
      console.warn('Cannot send direct message: Missing token or userId');
      return;
    }
    
    try {
      // Ensure we have a DM channel
      if (!this.dmChannelId) {
        await this.setupDmChannel();
      }
      
      if (!this.dmChannelId) {
        throw new Error('Failed to get or create DM channel');
      }
      
      // Format the message
      const formattedMessage = this.formatMessage(message, type);
      
      // Send message to the DM channel
      const response = await fetch(`https://discord.com/api/v10/channels/${this.dmChannelId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: formattedMessage,
        })
      });
      
      if (!response.ok) {
        throw new Error(`Discord DM error: ${response.status} ${response.statusText}`);
      }
      
      console.log('Discord direct message sent successfully');
    } catch (error) {
      console.error('Error sending Discord direct message:', error);
      throw error;
    }
  }
  
  /**
   * Send a message to Discord
   * @param message The message content
   * @param type Optional message type for formatting (update, alert, summary)
   * @param useDm Whether to send as a direct message
   */
  async send(message: string, type: "update" | "alert" | "summary" = "update", useDm = false): Promise<void> {
    if (!this.enabled) {
      console.warn('Discord notifier is not enabled. Message not sent:', message);
      return;
    }
    
    try {
      // If DM is requested and we have the needed info, send DM
      if (useDm && this.token && this.userId) {
        return this.sendDirectMessage(message, type);
      }
      
      // Format the message based on type
      let formattedMessage = this.formatMessage(message, type);
      
      // Send via webhook if available (preferred)
      if (this.webhookUrl) {
        return this.sendViaWebhook(formattedMessage, type);
      }
      
      // Otherwise use the Discord API directly
      return this.sendViaAPI(formattedMessage, type);
    } catch (error) {
      console.error('Error sending Discord notification:', error);
    }
  }
  
  private formatMessage(message: string, type: "update" | "alert" | "summary"): string {
    // Add formatting based on message type
    switch (type) {
      case "alert":
        return `🚨 **ALERT**: ${message}`;
      case "summary":
        return `📊 **SUMMARY**\n${message}`;
      case "update":
      default:
        return `📢 **UPDATE**: ${message}`;
    }
  }
  
  private async sendViaWebhook(message: string, type: string): Promise<void> {
    if (!this.webhookUrl) return;
    
    try {
      // Set up the webhook payload
      const payload = {
        content: message,
        // Additional options like username, avatar_url could be added here
        username: 'Chloe Agent',
        avatar_url: 'https://i.imgur.com/DFrKAdZ.png', // Can be customized
      };
      
      // Send the webhook request
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`Discord webhook error: ${response.status} ${response.statusText}`);
      }
      
      console.log('Discord notification sent successfully via webhook');
    } catch (error) {
      console.error('Error sending Discord webhook:', error);
      throw error;
    }
  }
  
  private async sendViaAPI(message: string, type: string): Promise<void> {
    if (!this.token || !this.channelId) return;
    
    try {
      // Discord API endpoint for sending channel messages
      const apiUrl = `https://discord.com/api/v10/channels/${this.channelId}/messages`;
      
      // Send the API request
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: message,
          // Can add embeds or other formatting options here
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
      }
      
      console.log('Discord notification sent successfully via API');
    } catch (error) {
      console.error('Error sending Discord API message:', error);
      throw error;
    }
  }
  
  /**
   * Send a message with a mention to grab attention
   */
  async sendWithMention(message: string, type: "update" | "alert" | "summary" = "alert"): Promise<void> {
    if (!this.userId) {
      return this.send(message, type);
    }
    
    // Add a user mention to the beginning of the message
    const mentionedMessage = `<@${this.userId}> ${message}`;
    return this.send(mentionedMessage, type);
  }
  
  /**
   * Helper method to send a formatted alert message
   */
  async sendAlert(message: string, withMention: boolean = false, useDm: boolean = false): Promise<void> {
    return withMention 
      ? this.sendWithMention(message, "alert") 
      : this.send(message, "alert", useDm);
  }
  
  /**
   * Helper method to send a formatted summary message
   */
  async sendSummary(message: string, withMention: boolean = false, useDm: boolean = false): Promise<void> {
    return withMention 
      ? this.sendWithMention(message, "summary") 
      : this.send(message, "summary", useDm);
  }

  /**
   * Helper method to send as a direct message
   */
  async sendDm(message: string, type: "update" | "alert" | "summary" = "update"): Promise<void> {
    return this.sendDirectMessage(message, type);
  }
}

/**
 * Helper function to create a notifier based on the configuration
 */
export function createNotifier(type: 'console' | 'discord', options: any = {}): Notifier {
  switch (type) {
    case 'discord':
      return new DiscordNotifier(options);
    case 'console':
    default:
      return new ConsoleNotifier();
  }
}

/**
 * Helper function to notify Discord specifically
 */
export async function notifyDiscord(
  message: string, 
  type: "update" | "alert" | "summary" = "update", 
  withMention: boolean = false,
  useDm: boolean = false
): Promise<void> {
  const discordNotifier = new DiscordNotifier({ useDm });
  
  if (withMention) {
    return discordNotifier.sendWithMention(message, type);
  } else {
    return discordNotifier.send(message, type, useDm);
  }
}

/**
 * Helper function to send a direct message via Discord
 */
export async function sendDiscordDm(
  message: string,
  type: "update" | "alert" | "summary" = "alert"
): Promise<void> {
  const discordNotifier = new DiscordNotifier({ useDm: true });
  return discordNotifier.sendDm(message, type);
} 