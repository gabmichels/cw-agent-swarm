/**
 * Tool to search memory for relevant information
 */
export class SearchMemoryTool {
  name = 'search_memory';
  description = 'Searches Chloe\'s memory for relevant information';

  constructor(private memoryService?: any) {}
  
  async call(args: { query: string; type?: string; limit?: number }): Promise<string> {
    try {
      // Lazy load memory service if needed
      if (!this.memoryService) {
        const { getMemoryServices } = require('../../server/memory/services');
        const services = await getMemoryServices();
        this.memoryService = services.searchService;
      }
      
      const type = args.type || null;
      const limit = args.limit || 5;
      
      // Search memory using the new abstracted memory service
      const searchOptions = {
        types: type ? [type] : undefined,
        limit
      };
      
      const results = await this.memoryService.search(args.query, searchOptions);
      
      if (!results || results.length === 0) {
        return 'No relevant memories found.';
      }
      
      // Format results
      const formatted = results.map((memory: any, index: number) => {
        const content = memory.content || memory.text || ''; // Support both old and new field names
        return `${index + 1}. [${memory.type}] ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`;
      }).join('\n\n');
      
      return `Found ${results.length} relevant memories:\n\n${formatted}`;
    } catch (error) {
      console.error('Error searching memory:', error);
      return `Error searching memory: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Tool to summarize recent activity
 */
export class SummarizeRecentActivityTool {
  name = 'summarize_recent_activity';
  description = 'Summarizes recent activities and interactions';
  
  constructor(private memoryService?: any) {}
  
  async call(args: { hours?: number; type?: string; limit?: number }): Promise<string> {
    try {
      // Lazy load memory service if needed
      if (!this.memoryService) {
        const { getMemoryServices } = require('../../server/memory/services');
        const services = await getMemoryServices();
        this.memoryService = services.memoryService;
      }
      
      const hours = args.hours || 24;
      const type = args.type || 'message';
      const limit = args.limit || 10;
      
      // Calculate time range
      const since = new Date();
      since.setHours(since.getHours() - hours);
      
      // Get recent messages using the standardized memory service
      const filter = {
        must: [
          {
            key: 'type',
            match: { eq: type }
          },
          {
            key: 'timestamp',
            range: { gte: since.getTime() }
          }
        ]
      };
      
      const recentEntries = await this.memoryService.searchMemories({
        limit,
        filter,
        sortBy: { key: 'timestamp', order: 'desc' }
      });
      
      if (!recentEntries || recentEntries.length === 0) {
        return `No activity found in the last ${hours} hours.`;
      }
      
      // Use LLM to generate a summary since we need to replace the direct summarizeChat call
      const { ChatOpenAI } = require('@langchain/openai');
      const llmClient = new ChatOpenAI({
        modelName: process.env.OPENAI_CHEAP_MODEL || 'gpt-3.5-turbo',
        temperature: 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
      
      // Format entries for the LLM
      const entriesText = recentEntries.map((entry: any, index: number) => {
        const content = entry.content || entry.text || '';
        const role = entry.role || entry.sender || 'unknown';
        return `[${index + 1}] ${role}: ${content}`;
      }).join('\n\n');
      
      const messages = [
        { role: 'system', content: 'You are Chloe, a marketing expert AI assistant. Summarize the recent conversation history provided below.' },
        { role: 'user', content: `Please summarize the following conversation from the last ${hours} hours:\n\n${entriesText}` }
      ];
      
      const response = await llmClient.invoke(messages);
      return response.content;
    } catch (error) {
      console.error('Error summarizing recent activity:', error);
      return `Error summarizing activity: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Tool to propose content ideas
 */
export class ProposeContentIdeasTool {
  name = 'propose_content_ideas';
  description = 'Generates marketing content ideas based on a theme or topic';
  
  constructor(private llmClient?: any) {}
  
  async call(args: { theme: string; count?: number }): Promise<string> {
    try {
      if (!args.theme) {
        return 'Error: Theme is required';
      }
      
      // Lazy load LLM client if needed
      if (!this.llmClient) {
        const { ChatOpenAI } = require('@langchain/openai');
        this.llmClient = new ChatOpenAI({
          modelName: process.env.OPENAI_CHEAP_MODEL || 'gpt-4.1-nano-2025-04-14',
          temperature: 0.7,
          openAIApiKey: process.env.OPENAI_API_KEY,
        });
      }
      
      const count = args.count || 5;
      
      // Generate content ideas
      const prompt = `Generate ${count} creative content ideas for marketing related to the theme "${args.theme}". 
      For each idea, provide:
      1. A catchy title
      2. The content format (blog post, social media post, video, etc.)
      3. A brief description (1-2 sentences)
      4. Target audience
      
      Format the response as a numbered list.`;
      
      const messages = [
        { role: 'system', content: 'You are a creative marketing content strategist.' },
        { role: 'user', content: prompt }
      ];
      
      const response = await this.llmClient.invoke(messages);
      return response.content;
    } catch (error) {
      console.error('Error generating content ideas:', error);
      return `Error generating content ideas: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Tool to reflect on performance
 */
export class ReflectOnPerformanceTool {
  name = 'reflect_on_performance';
  description = 'Analyzes marketing performance and generates insights';
  
  constructor(private llmClient?: any) {}
  
  async call(args: { metric: string; data?: string }): Promise<string> {
    try {
      if (!args.metric) {
        return 'Error: Metric to reflect on is required';
      }
      
      // Lazy load LLM client if needed
      if (!this.llmClient) {
        const { ChatOpenAI } = require('@langchain/openai');
        this.llmClient = new ChatOpenAI({
          modelName: process.env.OPENAI_CHEAP_MODEL || 'gpt-3.5-turbo',
          temperature: 0.7,
          openAIApiKey: process.env.OPENAI_API_KEY,
        });
      }
      
      // Generate reflection
      const data = args.data || 'Limited data available';
      
      const prompt = `As Chloe, the Chief Marketing Officer, reflect on the performance of ${args.metric}.
      
      Data available:
      ${data}
      
      Provide:
      1. Analysis of current performance
      2. Insights and patterns
      3. Recommendations for improvement
      4. Metrics to track going forward`;
      
      const messages = [
        { role: 'system', content: 'You are Chloe, the Chief Marketing Officer AI assistant.' },
        { role: 'user', content: prompt }
      ];
      
      const response = await this.llmClient.invoke(messages);
      return response.content;
    } catch (error) {
      console.error('Error reflecting on performance:', error);
      return `Error reflecting on performance: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Tool to notify users via Discord
 */
export class NotifyDiscordTool {
  name = 'notify_discord';
  description = 'Sends a notification to the configured Discord channel';
  private discordNotifier: any;

  constructor() {
    // Lazy load the notifier to avoid circular dependencies
    try {
      const { DiscordNotifier } = require('./notifiers');
      this.discordNotifier = new DiscordNotifier({});
    } catch (error) {
      console.error('Error initializing Discord notifier:', error);
    }
  }

  async call(args: { message: string; type?: 'update' | 'alert' | 'summary'; mention?: boolean }): Promise<string> {
    if (!args.message) {
      return 'Error: Message is required';
    }

    try {
      // Import dynamically to avoid circular dependencies
      if (!this.discordNotifier) {
        const { DiscordNotifier } = require('./notifiers');
        this.discordNotifier = new DiscordNotifier({});
      }

      const messageType = args.type || 'update';
      const shouldMention = args.mention === true;

      if (shouldMention) {
        await this.discordNotifier.sendWithMention(args.message, messageType);
      } else {
        await this.discordNotifier.send(args.message, messageType);
      }

      return `Successfully sent ${messageType} notification to Discord`;
    } catch (error) {
      console.error('Error sending Discord notification:', error);
      return `Error sending notification: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Create all available tools for Chloe
 * @deprecated Use the named version from tools/index.ts instead
 */
export function createChloeToolsArray(): any[] {
  return [
    new SearchMemoryTool(),
    new SummarizeRecentActivityTool(),
    new ProposeContentIdeasTool(),
    new ReflectOnPerformanceTool(),
    new NotifyDiscordTool()
  ];
}

// Re-export the object-based version from tools/index.ts
export { createChloeTools } from './tools/index'; 