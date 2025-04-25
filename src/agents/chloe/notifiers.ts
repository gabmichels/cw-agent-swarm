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
    // This method is no longer used - it's been replaced by inline code in sendDirectMessage
    // Kept for backward compatibility
    console.log('Using deprecated setupDmChannel method');
    return;
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
      // Try to set up a DM channel if we don't have one
      let dmChannelId = this.dmChannelId;
      
      if (!dmChannelId) {
        console.log('No DM channel available, attempting to create one...');
        
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
            const errorText = await response.text();
            console.error(`Failed to create DM channel: ${response.status} ${response.statusText}`, errorText);
            throw new Error(`Failed to create DM channel: ${response.status}`);
          }
          
          const data = await response.json();
          if (!data.id) {
            throw new Error('Discord API returned no channel ID');
          }
          
          dmChannelId = data.id;
          this.dmChannelId = dmChannelId;
          console.log(`Successfully created DM channel: ${dmChannelId}`);
        } catch (error) {
          console.error('Error creating DM channel:', error);
          // Last resort fallback to logging
          console.log(`[DM FALLBACK] ${message}`);
          return;
        }
      }
      
      // Format the message
      const formattedMessage = this.formatMessage(message, type);
      
      // Send message to the DM channel
      const response = await fetch(`https://discord.com/api/v10/channels/${dmChannelId}/messages`, {
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
        const errorText = await response.text();
        console.error(`Discord DM error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Discord DM error: ${response.status}`);
      }
      
      console.log('Discord direct message sent successfully');
    } catch (error) {
      console.error('Error sending Discord direct message:', error);
      // If all else fails, log to console
      console.log(`[DISCORD DM FAILED] ${message}`);
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
      // Format the message based on type
      const formattedMessage = this.formatMessage(message, type);
      
      // If DM is explicitly requested, try that first
      if (useDm && this.token && this.userId) {
        await this.sendDirectMessage(message, type);
        return;
      }
      
      // Try channel message first if we have the credentials
      if (this.token && this.channelId) {
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
              content: formattedMessage,
            }),
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Discord API channel message failed: ${response.status} ${response.statusText}`, errorText);
            throw new Error(`Discord API error: ${response.status}`);
          }
          
          console.log('Discord notification sent successfully via channel message');
          return;
        } catch (error) {
          console.error('Error sending to channel, will try DM if possible:', error);
          
          // If we have userId, try direct message as backup
          if (this.token && this.userId) {
            try {
              console.log('Trying direct message as fallback...');
              const fallbackMsg = `*Note: This message was sent as DM because channel message failed*\n\n${formattedMessage}`;
              await this.sendDirectMessage(fallbackMsg, type);
              return;
            } catch (dmError) {
              console.error('Direct message fallback also failed:', dmError);
            }
          }
        }
      }
      
      // Last resort: log to console
      console.log(`[DISCORD FALLBACK] ${formattedMessage}`);
      
    } catch (error) {
      console.error('Discord notification completely failed:', error);
      console.log(`[NOTIFICATION FALLBACK] ${message}`);
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
    // This method is no longer used - webhooks have been deprioritized in favor of direct API
    // Kept for backward compatibility
    console.log('Using deprecated sendViaWebhook method');
    return;
  }
  
  private async sendViaAPI(message: string, type: string): Promise<void> {
    // This method is no longer used - API calls are now handled directly in the send method
    // Kept for backward compatibility
    console.log('Using deprecated sendViaAPI method');
    return;
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