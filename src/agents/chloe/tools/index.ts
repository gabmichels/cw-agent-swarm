// Simple tool interface that doesn't rely on external packages
interface SimpleTool {
  name: string;
  description: string;
  _call(input: string): Promise<string>;
}

import { ChloeMemory } from '../memory';
import { codaIntegration } from './coda';
import { createMarketScanner, MarketScanner } from './marketScanner';

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
      
      return results.map((memory: string, index: number) => {
        return `[${index + 1}] ${memory}`;
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
      const memoryContent = recentMemories.map((m: string) => m).join('\n');
      
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
        ? `Based on previous content themes and ideas: ${relevantMemories.map((m: string) => m).join('; ')}`
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
      
      const memoryContent = relevantMemories.map((m: string) => m).join('\n');
      
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

  constructor(discordWebhookUrl: string | null = null) {
    this.discordWebhookUrl = discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL || null;
  }

  async _call(message: string): Promise<string> {
    try {
      if (!this.discordWebhookUrl) {
        console.warn('Discord webhook URL not configured');
        return "Discord notifications are not configured. Message not sent.";
      }
      
      const response = await fetch(this.discordWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: message,
          username: 'Chloe CMO',
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Discord notification failed: ${response.status}`);
      }
      
      return "Discord notification sent successfully.";
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

// Export all tools in a factory function
export const createChloeTools = (memory: ChloeMemory, model: any, discordWebhookUrl?: string) => {
  return {
    searchMemory: new SearchMemoryTool(memory),
    summarizeRecentActivity: new SummarizeRecentActivityTool(memory, model),
    proposeContentIdeas: new ProposeContentIdeasTool(model, memory),
    reflectOnPerformance: new ReflectOnPerformanceTool(model, memory),
    notifyDiscord: new NotifyDiscordTool(discordWebhookUrl),
    codaDocument: new CodaDocumentTool(),
    marketScan: new MarketScanTool(),
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
}; 