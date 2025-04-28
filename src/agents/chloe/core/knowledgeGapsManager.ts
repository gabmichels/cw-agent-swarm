import { ChatOpenAI } from '@langchain/openai';
import { ChloeMemory } from '../memory';
import { TaskLogger } from '../task-logger';
import * as qdrantServer from '../../../server/qdrant';

export interface KnowledgeGapsManagerOptions {
  memory: ChloeMemory;
  openaiApiKey: string;
  agentId: string;
  collectionName?: string;
  notifyFunction?: (message: string) => Promise<void>;
  logger?: TaskLogger;
  samplingProbability?: number;
  minMessagesForAnalysis?: number;
}

export interface KnowledgeGap {
  id: string;
  agentId: string;
  topic: string;
  description: string;
  detectedAt: string;
  resolved: boolean;
  priority: 'low' | 'medium' | 'high';
  context: string;
  resolution?: string;
  resolvedAt?: string;
}

/**
 * Manages knowledge gaps detected by the agent.
 * Stores and analyzes knowledge gaps to help the agent improve.
 */
export class KnowledgeGapsManager {
  private memory: ChloeMemory;
  private model: ChatOpenAI;
  private agentId: string;
  private collectionName: string;
  private initialized: boolean = false;
  private notifyFunction?: (message: string) => Promise<void>;
  private logger?: TaskLogger;
  private samplingProbability: number;
  private minMessagesForAnalysis: number;

  constructor(options: KnowledgeGapsManagerOptions) {
    this.memory = options.memory;
    this.model = new ChatOpenAI({
      modelName: 'gpt-4o',
      temperature: 0.2,
      openAIApiKey: options.openaiApiKey,
    });
    this.agentId = options.agentId;
    this.collectionName = options.collectionName || `knowledge_gaps_${this.agentId}`;
    this.notifyFunction = options.notifyFunction;
    this.logger = options.logger;
    this.samplingProbability = options.samplingProbability || 0.25;
    this.minMessagesForAnalysis = options.minMessagesForAnalysis || 5;
  }

  async initialize(): Promise<boolean> {
    try {
      // Check if the collection exists, if not create it
      const collections = await qdrantServer.getAllMemories(null, 100);
      const collectionExists = collections.some(
        (collection: { name: string }) => collection.name === this.collectionName
      );

      if (!collectionExists) {
        // Since there's no direct createCollection, we'll use resetCollection
        // which recreates the collection if it doesn't exist
        await qdrantServer.resetCollection('document' as any);

        this.logger?.logEntry({
          type: 'action',
          content: `Created knowledge gaps collection: ${this.collectionName}`,
        });
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing knowledge gaps system:', error);
      return false;
    }
  }

  async processConversation(conversation: { messages: any[] }): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Skip processing based on sampling probability
    if (Math.random() > this.samplingProbability) {
      return false;
    }

    // Check if there are enough messages to analyze
    if (conversation.messages.length < this.minMessagesForAnalysis) {
      return false;
    }

    try {
      // Format conversation for analysis
      const formattedConversation = this.formatConversation(conversation.messages);
      
      // Analyze the conversation for knowledge gaps
      const knowledgeGaps = await this.analyzeConversation(formattedConversation);
      
      // Store any detected knowledge gaps
      if (knowledgeGaps && knowledgeGaps.length > 0) {
        for (const gap of knowledgeGaps) {
          await this.storeKnowledgeGap(gap);
          
          // Notify if a notification function is provided
          if (this.notifyFunction) {
            await this.notifyFunction(
              `🧠 Detected knowledge gap: ${gap.topic} (${gap.priority} priority)`
            );
          }
        }
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error processing conversation for knowledge gaps:', error);
      this.logger?.logEntry({
        type: 'action',
        content: `Error processing conversation for knowledge gaps: ${error}`,
      });
      return false;
    }
  }

  private formatConversation(messages: any[]): string {
    return messages
      .map((msg) => {
        const role = msg.role === 'user' ? 'Human' : 'AI';
        return `${role}: ${msg.content}`;
      })
      .join('\n\n');
  }

  private async analyzeConversation(conversation: string): Promise<KnowledgeGap[]> {
    const prompt = `
You are analyzing a conversation to identify knowledge gaps that the AI assistant has. 
A knowledge gap is something the AI should know but doesn't, or a topic where the AI's knowledge is outdated or incomplete.

Please analyze the following conversation and identify any knowledge gaps:

${conversation}

If you find any knowledge gaps, format them as follows:
{
  "knowledgeGaps": [
    {
      "topic": "Brief topic name",
      "description": "Detailed description of what the AI doesn't know or needs to improve on",
      "priority": "low|medium|high",
      "context": "The specific part of the conversation that revealed this gap"
    }
  ]
}

If no knowledge gaps are detected, return an empty array: { "knowledgeGaps": [] }
`;

    try {
      const response = await this.model.invoke(prompt);
      const content = response.content.toString();
      
      // Extract JSON from the response
      const jsonMatch = content.match(/```json\n([\s\S]*)\n```/) || 
                        content.match(/```\n([\s\S]*)\n```/) ||
                        content.match(/{[\s\S]*}/);
      
      if (jsonMatch) {
        const jsonString = jsonMatch[0].replace(/```json\n|```\n|```/g, '');
        const result = JSON.parse(jsonString);
        return result.knowledgeGaps.map((gap: any) => ({
          ...gap,
          id: this.generateId(),
          agentId: this.agentId,
          detectedAt: new Date().toISOString(),
          resolved: false,
        }));
      }
      
      // Try to parse the entire response as JSON if no match found
      try {
        const result = JSON.parse(content);
        return result.knowledgeGaps.map((gap: any) => ({
          ...gap,
          id: this.generateId(),
          agentId: this.agentId,
          detectedAt: new Date().toISOString(),
          resolved: false,
        }));
      } catch {
        console.error('Could not parse JSON response');
        return [];
      }
    } catch (error) {
      console.error('Error analyzing conversation:', error);
      return [];
    }
  }

  async storeKnowledgeGap(gap: KnowledgeGap): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Get embedding for the topic and description
      const embeddingText = `${gap.topic} - ${gap.description}`;
      const embeddingResponse = await qdrantServer.getEmbedding(embeddingText);
      
      // Store in vector database
      await qdrantServer.addMemory(
        'document',
        embeddingText,
        {
          ...gap,
          type: 'knowledge_gap'
        }
      );

      this.logger?.logEntry({
        type: 'action',
        content: `Stored knowledge gap: ${gap.topic} (${gap.priority} priority)`,
      });

      return true;
    } catch (error) {
      console.error('Error storing knowledge gap:', error);
      return false;
    }
  }

  async getUnresolvedKnowledgeGaps(): Promise<KnowledgeGap[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const response = await qdrantServer.searchMemory(
        'document',
        'unresolved knowledge gaps',
        {
          filter: {
            agentId: this.agentId,
            resolved: false,
            type: 'knowledge_gap'
          },
          limit: 100,
        }
      );

      return response.map((item: qdrantServer.MemoryRecord) => 
        item.metadata as unknown as KnowledgeGap
      );
    } catch (error) {
      console.error('Error getting unresolved knowledge gaps:', error);
      return [];
    }
  }

  async resolveKnowledgeGap(
    gapId: string,
    resolution: string
  ): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Get the existing gap
      const searchResult = await qdrantServer.searchMemory(
        'document',
        `knowledge gap ${gapId}`,
        {
          filter: {
            id: gapId,
            type: 'knowledge_gap'
          },
          limit: 1,
        }
      );

      if (searchResult.length === 0) {
        console.error(`Knowledge gap with ID ${gapId} not found`);
        return false;
      }

      const gap = searchResult[0].metadata as unknown as KnowledgeGap;
      const updatedGap: KnowledgeGap = {
        ...gap,
        resolved: true,
        resolution,
        resolvedAt: new Date().toISOString(),
      };

      // Update in the database - we add a new memory since we can't directly update
      await qdrantServer.addMemory(
        'document',
        `${gap.topic} - ${gap.description} (RESOLVED)`,
        {
          ...updatedGap,
          type: 'knowledge_gap'
        }
      );

      this.logger?.logEntry({
        type: 'action',
        content: `Resolved knowledge gap: ${gap.topic}`,
      });

      // Notify if a notification function is provided
      if (this.notifyFunction) {
        await this.notifyFunction(`🎓 Resolved knowledge gap: ${gap.topic}`);
      }

      return true;
    } catch (error) {
      console.error('Error resolving knowledge gap:', error);
      return false;
    }
  }

  async generateKnowledgeGapSummary(): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const unresolvedGaps = await this.getUnresolvedKnowledgeGaps();
      
      if (unresolvedGaps.length === 0) {
        return "No knowledge gaps detected.";
      }
      
      // Sort by priority
      const sortedGaps = [...unresolvedGaps].sort((a, b) => {
        const priorityValues: Record<string, number> = { high: 3, medium: 2, low: 1 };
        return priorityValues[b.priority] - priorityValues[a.priority];
      });
      
      const prompt = `
Generate a concise summary of the following knowledge gaps:

${sortedGaps.map(gap => `
- Topic: ${gap.topic}
  Priority: ${gap.priority}
  Description: ${gap.description}
`).join('\n')}

Organize them by priority and suggest how they should be addressed.
`;

      const response = await this.model.invoke(prompt);
      return response.content.toString();
    } catch (error) {
      console.error('Error generating knowledge gap summary:', error);
      return "Error generating knowledge gap summary.";
    }
  }

  async searchKnowledgeGaps(query: string): Promise<KnowledgeGap[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Search using the server's search functionality
      const results = await qdrantServer.searchMemory(
        'document',
        query,
        {
          filter: {
            type: 'knowledge_gap'
          },
          limit: 10
        }
      );

      return results.map((item: qdrantServer.MemoryRecord) => 
        item.metadata as unknown as KnowledgeGap
      );
    } catch (error) {
      console.error('Error searching knowledge gaps:', error);
      return [];
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
} 