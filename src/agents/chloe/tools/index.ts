// Simple tool interface that doesn't rely on external packages
// This should match the definition in src/lib/shared/types/agent.ts
export interface SimpleTool {
  name: string;
  description: string;
  _call(input: string): Promise<string>;
}

import { ChloeMemory } from '../memory';
import { codaIntegration } from './coda';
import { createMarketScanner, MarketScanner } from './marketScanner';
import { IntentRouterTool as ActualIntentRouterTool } from './intentRouter';

/**
 * Searches through Chloe's memory for relevant information
 */
export class SearchMemoryTool implements SimpleTool {
  name = 'search_memory';
  description = 'Search through Chloe\'s memory for relevant information based on a query';
  private memory: ChloeMemory;

  constructor(memory: ChloeMemory) {
    this.memory = memory;
  }

  async _call(query: string): Promise<string> {
    try {
      const results = await this.memory.getRelevantMemories(query, 5);
      if (!results || results.length === 0) {
        return "No relevant memories found.";
      }
      
      return results.map((memory, index) => {
        return `[${index + 1}] ${typeof memory === 'string' ? memory : memory.content}`;
      }).join('\n\n');
    } catch (error) {
      console.error('Error searching memory:', error);
      return "Error searching memory.";
    }
  }
}

/**
 * Summarizes Chloe's recent activity
 */
export class SummarizeRecentActivityTool implements SimpleTool {
  name = 'summarize_recent_activity';
  description = 'Summarize recent activity and tasks performed by Chloe';
  private memory: ChloeMemory;
  private model: any;

  constructor(memory: ChloeMemory, model: any) {
    this.memory = memory;
    this.model = model;
  }

  async _call(args: string): Promise<string> {
    try {
      // Get recent memories
      const recentMemories = await this.memory.getRelevantMemories("recent activities", 15);
      
      if (!recentMemories || recentMemories.length === 0) {
        return "No recent activities found in memory.";
      }
      
      // Use the model to summarize the activities
      const memoryContent = recentMemories.map((m) => typeof m === 'string' ? m : m.content).join('\n');
      
      const response = await this.model.invoke(
        `I need a concise summary of my recent activities based on these memory entries:
        
        ${memoryContent}
        
        Please organize the summary by activity type and highlight any key accomplishments or ongoing tasks.`
      );
      
      return response.content.toString();
    } catch (error) {
      console.error('Error summarizing recent activity:', error);
      return "Error summarizing recent activity.";
    }
  }
}

/**
 * Proposes content ideas for marketing
 */
export class ProposeContentIdeasTool implements SimpleTool {
  name = 'propose_content_ideas';
  description = 'Generate creative content ideas for marketing campaigns or content calendars';
  private model: any;
  private memory: ChloeMemory;

  constructor(model: any, memory: ChloeMemory) {
    this.model = model;
    this.memory = memory;
  }

  async _call(topic: string): Promise<string> {
    try {
      // Search memory for any relevant previous content ideas or themes
      const relevantMemories = await this.memory.getRelevantMemories('content ideas marketing themes', 3);
      const memoryContext = relevantMemories.length > 0 
        ? `Based on previous content themes and ideas: ${relevantMemories.map((m) => typeof m === 'string' ? m : m.content).join('; ')}`
        : '';
      
      const response = await this.model.invoke(
        `You are a creative marketing director tasked with generating innovative content ideas.
        ${memoryContext}
        
        Please generate 5 compelling content ideas related to: ${topic || 'our product/service'}
        
        For each idea, provide:
        1. A catchy title
        2. Content type (blog, video, social media series, etc.)
        3. Brief description (2-3 sentences)
        4. Target audience
        5. Key points to cover
        
        Be original, strategic, and focused on driving engagement.`
      );
      
      return response.content.toString();
    } catch (error) {
      console.error('Error proposing content ideas:', error);
      return "Error generating content ideas.";
    }
  }
}

/**
 * Reflects on performance and suggests improvements
 */
export class ReflectOnPerformanceTool implements SimpleTool {
  name = 'reflect_on_performance';
  description = 'Analyze past actions and outcomes to reflect on performance and suggest improvements';
  private model: any;
  private memory: ChloeMemory;

  constructor(model: any, memory: ChloeMemory) {
    this.model = model;
    this.memory = memory;
  }

  async _call(args: string): Promise<string> {
    try {
      // Get relevant memories for reflection
      const relevantMemories = await this.memory.getRelevantMemories('performance reflection actions outcomes', 10);
      
      if (!relevantMemories || relevantMemories.length === 0) {
        return "Insufficient data for reflection. More actions and outcomes needed.";
      }
      
      const memoryContent = relevantMemories.map((m) => typeof m === 'string' ? m : m.content).join('\n');
      
      const response = await this.model.invoke(
        `As a reflective AI assistant, please analyze these recent actions and outcomes:
        
        ${memoryContent}
        
        Please provide:
        1. A thoughtful analysis of what worked well
        2. Areas that could be improved
        3. Specific actionable suggestions for future improvement
        4. Any patterns or trends you notice in the decision-making process
        
        Focus on being constructive, specific, and forward-looking.`
      );
      
      return response.content.toString();
    } catch (error) {
      console.error('Error reflecting on performance:', error);
      return "Error performing reflection.";
    }
  }
}

/**
 * Sends notifications to Discord
 */
export class NotifyDiscordTool implements SimpleTool {
  name = 'notify_discord';
  description = 'Send a notification or message to a Discord channel';
  private discordWebhookUrl: string | null;
  private botToken: string | null;
  private channelId: string | null;
  private userId: string | null;
  private enabled: boolean = false;

  constructor(discordWebhookUrl: string | null = null) {
    // Try both webhook and direct API approaches
    this.discordWebhookUrl = discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL || null;
    this.botToken = process.env.DISCORD_BOT_TOKEN || null;
    this.channelId = process.env.DISCORD_CHANNEL_ID || null;
    this.userId = process.env.DISCORD_USER_ID || null;
    
    // Check if either webhook or direct API is configured
    this.enabled = !!(this.discordWebhookUrl || (this.botToken && this.channelId));
    
    // Log configuration status with more details
    console.log('Discord notification configuration:');
    console.log('- WebhookURL:', this.discordWebhookUrl ? '✓ Set' : '✗ Not set');
    console.log('- Bot Token:', this.botToken ? '✓ Set' : '✗ Not set');
    console.log('- Channel ID:', this.channelId ? '✓ Set' : '✗ Not set');
    console.log('- User ID:', this.userId ? '✓ Set' : '✗ Not set');
    console.log('- Enabled:', this.enabled ? '✓ Yes' : '✗ No');
    
    if (this.enabled) {
      console.log('Discord notifier initialized and enabled.');
      if (this.discordWebhookUrl) console.log('- Using webhook URL');
      if (this.botToken && this.channelId) console.log('- Using direct API with bot token and channel ID');
    } else {
      console.warn('Discord notifier initialized but not enabled. Missing token, channelId, or webhookUrl.');
    }
  }

  async _call(input: string): Promise<string> {
    try {
      if (!this.enabled) {
        console.warn('Discord notifier is not enabled. Message not sent:', input.substring(0, 100) + '...');
        return "Discord notifications are not configured. Message not sent. Please set DISCORD_WEBHOOK_URL or DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID in your environment variables.";
      }
      
      console.log('Attempting to send Discord notification...');
      
      // Try webhook first if available
      if (this.discordWebhookUrl) {
        console.log('Using webhook method for Discord notification');
        const response = await fetch(this.discordWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: input,
            username: 'Chloe CMO',
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Discord webhook error: Status ${response.status} - ${errorText}`);
          throw new Error(`Discord webhook notification failed: ${response.status} - ${errorText}`);
        }
        
        console.log('Discord notification sent successfully via webhook.');
        return "Discord notification sent successfully via webhook.";
      }
      
      // Fall back to direct API if webhook is not available
      if (this.botToken && this.channelId) {
        console.log('Using direct API method for Discord notification');
        const response = await fetch(`https://discord.com/api/v10/channels/${this.channelId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${this.botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: input,
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Discord API error: Status ${response.status} - ${errorText}`);
          throw new Error(`Discord API notification failed: ${response.status} - ${errorText}`);
        }
        
        console.log('Discord notification sent successfully via API.');
        return "Discord notification sent successfully via API.";
      }
      
      return "Discord notification not sent - no valid configuration.";
    } catch (error: unknown) {
      console.error('Error sending Discord notification:', error);
      return `Error sending Discord notification: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Tool to interact with Coda documents
 */
export class CodaDocumentTool implements SimpleTool {
  name = 'coda_document';
  description = 'Create, read, or update documents in Coda workspace';

  async _call(input: string): Promise<string> {
    try {
      const [action, ...args] = input.split('|').map(arg => arg.trim());

      switch (action.toLowerCase()) {
        case 'list':
          const docs = await codaIntegration.listDocs();
          if (docs.length === 0) {
            return "No documents found in the Coda workspace.";
          }
          return docs.map(doc => `${doc.name} (ID: ${doc.id})`).join('\n');

        case 'read':
          if (!args[0]) {
            return "Error: Document ID is required for reading.";
          }
          const content = await codaIntegration.readDoc(args[0]);
          return content || "No content found or document not accessible.";

        case 'create':
          if (args.length < 2) {
            return "Error: Title and content are required for document creation.";
          }
          const [title, ...contentParts] = args;
          const newDocContent = contentParts.join('|');
          const newDoc = await codaIntegration.createDoc(title, newDocContent);
          return `Document created: "${newDoc.name}" (ID: ${newDoc.id})`;

        case 'update':
          if (args.length < 2) {
            return "Error: Document ID and content are required for updating.";
          }
          const [docId, ...updateParts] = args;
          const updateContent = updateParts.join('|');
          await codaIntegration.updateDoc(docId, updateContent);
          return `Document updated successfully (ID: ${docId})`;

        default:
          return `Unknown action: ${action}. Available actions: list, read, create, update`;
      }
    } catch (error) {
      console.error('Error using Coda document tool:', error);
      return `Error using Coda document tool: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Tool to run market scans
 */
export class MarketScanTool implements SimpleTool {
  name = 'market_scan';
  description = 'Scan market sources for trends, news, and insights';
  private scanner: MarketScanner;

  constructor() {
    this.scanner = createMarketScanner();
  }

  async _call(input: string): Promise<string> {
    try {
      const categories = input.trim() ? input.split(',').map(c => c.trim()) : undefined;
      
      const scanCount = await this.scanner.runMarketScan(categories);
      
      if (scanCount === 0) {
        return "No new market signals found or scanner is disabled.";
      }
      
      return `Market scan complete! Processed ${scanCount} signals${categories ? ` in categories: ${categories.join(', ')}` : ''}.
The signals have been saved to memory and can be retrieved using the search_memory tool.`;
    } catch (error) {
      console.error('Error running market scan:', error);
      return `Error running market scan: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Handles intent routing by classifying user input and directing to appropriate tools
 */
export class IntentRouterTool implements SimpleTool {
  name = 'intent_router';
  description = 'Route intents to appropriate tools based on the input';
  private actualTool: any;

  constructor() {
    // Dynamically import the actual implementation to avoid circular dependencies
    import('./intentRouter').then(module => {
      const ActualTool = module.IntentRouterTool;
      this.actualTool = new ActualTool();
      console.log('IntentRouterTool loaded successfully');
    }).catch(error => {
      console.error('Failed to load IntentRouterTool:', error);
    });
  }

  async _call(input: string): Promise<string> {
    try {
      // If we have the actual tool loaded, use it
      if (this.actualTool) {
        console.log('Delegating to actual IntentRouterTool');
        // Call execute and handle if it doesn't exist
        let result;
        if (typeof this.actualTool.execute === 'function') {
          result = await this.actualTool.execute({ input });
        } else if (typeof this.actualTool._call === 'function') {
          result = await this.actualTool._call(input);
        } else {
          throw new Error('No executable method found on IntentRouterTool implementation');
        }
        
        console.log('IntentRouter result:', JSON.stringify(result, null, 2));
        
        if (result.success) {
          // Use the formatted display output if available
          if (result.display) {
            console.log('Using display property from result:', result.display);
            return result.display;
          } else {
            console.log('No display property found in result');
          }
          
          if (result.result && typeof result.result === 'object') {
            // Handle different result formats based on the action
            if (result.action === 'propose_content_ideas' && Array.isArray(result.result.ideas)) {
              return `Content ideas: \n${result.result.ideas.join('\n')}`;
            } else if (result.action === 'reflect_on_performance' && result.result.reflection) {
              return result.result.reflection;
            } else {
              return JSON.stringify(result.result);
            }
          }
          return `Intent matched: ${result.intent} (${Math.round((result.confidence || 0) * 100)}% confidence)`;
        } else {
          // Use display message for errors if available
          return result.display || result.message || 'Intent routing failed';
        }
      }
      
      // Fallback if actual tool isn't loaded yet
      console.log("IntentRouterTool implementation not loaded yet - using fallback");
      return "Intent routing is initializing. Please try again in a moment.";
    } catch (error) {
      console.error('Error in intent router:', error);
      return `Error routing intent: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

// Add temporary Coda test tools
/**
 * Temporary tool to create a test Coda document
 */
export class CreateCodaTestDocTool implements SimpleTool {
  name = 'create_coda_test_doc';
  description = 'Create a test document in Coda workspace';

  async _call(input: string): Promise<string> {
    try {
      const title = input || `Test Document ${new Date().toISOString()}`;
      const content = `# Test Document
      
This is a test document created at ${new Date().toLocaleString()}.

## Test Section

This document was created automatically to test the Coda integration.`;

      const newDoc = await codaIntegration.createDoc(title, content);
      return `Test document created successfully!\n\nTitle: "${newDoc.name}"\nID: ${newDoc.id}\nURL: ${newDoc.browserLink}`;
    } catch (error) {
      console.error('Error creating test Coda document:', error);
      return `Error creating test Coda document: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Temporary tool to read a specific Coda page
 */
export class ReadCodaPageTool implements SimpleTool {
  name = 'read_coda_page';
  description = 'Read a specific page from Coda';

  async _call(input: string): Promise<string> {
    try {
      const pageId = input || 'canvas-12gCwjgwEO';
      const content = await codaIntegration.readDoc(pageId);
      
      if (!content) {
        return `No content found for page ID: ${pageId}`;
      }
      
      return `Content from page ${pageId}:\n\n${content}`;
    } catch (error) {
      console.error('Error reading Coda page:', error);
      return `Error reading Coda page: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Temporary tool to append a test line to a specific Coda page
 */
export class AppendCodaLineTool implements SimpleTool {
  name = 'append_coda_line';
  description = 'Append a test line to a specific Coda page';

  async _call(input: string): Promise<string> {
    try {
      const pageId = 'canvas-12gCwjgwEO';
      
      // First read the existing content
      const existingContent = await codaIntegration.readDoc(pageId);
      
      if (!existingContent) {
        return `No content found for page ID: ${pageId}`;
      }
      
      // Append a new line
      const timestamp = new Date().toLocaleString();
      const testLine = input || `Test line added at ${timestamp}`;
      const newContent = `${existingContent}\n\n${testLine}`;
      
      // Update the document
      await codaIntegration.updateDoc(pageId, newContent);
      
      return `Successfully appended line to Coda page ${pageId}:\n"${testLine}"`;
    } catch (error) {
      console.error('Error appending to Coda page:', error);
      return `Error appending to Coda page: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

// Update the createChloeTools function to include the new test tools
export const createChloeTools = (memory: ChloeMemory, model: any, discordWebhookUrl?: string): { 
  [key: string]: SimpleTool; // Use only the index signature for flexibility
} => {
  return {
    searchMemory: new SearchMemoryTool(memory),
    summarizeRecentActivity: new SummarizeRecentActivityTool(memory, model),
    proposeContentIdeas: new ProposeContentIdeasTool(model, memory),
    reflectOnPerformance: new ReflectOnPerformanceTool(model, memory),
    notifyDiscord: new NotifyDiscordTool(discordWebhookUrl),
    codaDocument: new CodaDocumentTool(),
    marketScan: new MarketScanTool(),
    intentRouter: new ActualIntentRouterTool() as unknown as SimpleTool, // Use type assertion to satisfy TypeScript
    
    // Add the new test tools
    createCodaTestDoc: new CreateCodaTestDocTool(),
    readCodaPage: new ReadCodaPageTool(),
    appendCodaLine: new AppendCodaLineTool()
  };
};

// For backward compatibility
export const chloeTools = {
  searchMemory: async (query: string) => "Tools not initialized. Please use createChloeTools().",
  summarizeRecentActivity: async () => "Tools not initialized. Please use createChloeTools().",
  proposeContentIdeas: async (topic: string) => "Tools not initialized. Please use createChloeTools().",
  reflectOnPerformance: async () => "Tools not initialized. Please use createChloeTools().",
  notifyDiscord: async (message: string) => "Tools not initialized. Please use createChloeTools().",
  codaDocument: async (input: string) => "Tools not initialized. Please use createChloeTools().",
  marketScan: async (input: string) => "Tools not initialized. Please use createChloeTools().",
  intentRouter: async (input: string) => "Tools not initialized. Please use createChloeTools().",
}; 