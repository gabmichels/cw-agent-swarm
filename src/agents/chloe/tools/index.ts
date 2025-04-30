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
import { createApifyTools } from './apifyManager';

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
      console.log('CodaDocumentTool._call input:', input);
      
      // Split the input into action and arguments
      // Format should be: action|title|content
      const parts = input.split('|');
      
      // Validate that we have at least an action
      if (parts.length === 0 || !parts[0]) {
        console.error('Invalid input format: Missing action');
        return "Error: Invalid input format. Expected format: action|title|content";
      }
      
      const action = parts[0].trim().toLowerCase();
      const args = parts.slice(1).map(arg => arg.trim());
      
      console.log(`CodaDocumentTool processing action: ${action} with ${args.length} arguments`);

      switch (action) {
        case 'list_documents':
          const docs = await codaIntegration.listDocs();
          if (docs.length === 0) {
            return "No documents found in the Coda workspace.";
          }
          return docs.map(doc => `${doc.name} (ID: ${doc.id})`).join('\n');

        case 'read_document':
          if (!args[0]) {
            return "Error: Document ID is required for reading.";
          }
          const content = await codaIntegration.readDoc(args[0]);
          return content || "No content found or document not accessible.";

        case 'create_document':
          // Need at least a title for creating a document
          if (args.length === 0 || !args[0]) {
            return "Error: Title is required for document creation.";
          }
          
          const title = args[0];
          // Join the rest of the arguments as content, or use a default if none provided
          const newDocContent = args.length > 1 
            ? args.slice(1).join('\n\n')
            : `# ${title}\n\nThis document was created automatically.`;
          
          console.log(`Creating Coda doc with title: "${title}", content length: ${newDocContent.length} characters`);
          
          const newDoc = await codaIntegration.createDoc(title, newDocContent);
          return `Document created: "${newDoc.name}" (ID: ${newDoc.id})\nYou can access it at: ${newDoc.browserLink}`;

        case 'update':
          if (args.length < 2) {
            return "Error: Document ID and content are required for updating.";
          }
          const [docId, ...updateParts] = args;
          const updateContent = updateParts.join('\n\n');
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
  // Get Apify tools
  const apifyTools = createApifyTools();
  
  return {
    searchMemory: new SearchMemoryTool(memory),
    summarizeRecentActivity: new SummarizeRecentActivityTool(memory, model),
    proposeContentIdeas: new ProposeContentIdeasTool(model, memory),
    reflectOnPerformance: new ReflectOnPerformanceTool(model, memory),
    notifyDiscord: new NotifyDiscordTool(discordWebhookUrl),
    codaDocument: new CodaDocumentTool(),
    marketScan: new MarketScanTool(),
    // Add the new test tools
    createCodaTestDoc: new CreateCodaTestDocTool(),
    readCodaPage: new ReadCodaPageTool(),
    appendCodaLine: new AppendCodaLineTool(),
    
    // Add Apify tools
    // These will be registered as separate tools in the ToolManager
    ...apifyTools
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