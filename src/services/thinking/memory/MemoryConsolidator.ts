import { getMemoryServices } from '@/server/memory/services';
import { WorkingMemoryItem } from '../types';
import { ConsolidationOptions } from '../types';
import { IdGenerator } from '@/utils/ulid';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { MemoryType } from '@/server/memory/config/types';

/**
 * Service for consolidating important working memory into long-term memory
 */
export class MemoryConsolidator {
  private llm: ChatOpenAI;
  
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.2
    });
  }
  
  /**
   * Consolidate important items from working memory into long-term memory
   * @param userId User ID to consolidate memory for
   * @param workingMemory Current working memory items
   * @param options Consolidation options
   * @returns IDs of consolidated memory items
   */
  async consolidateWorkingMemory(
    userId: string,
    workingMemory: WorkingMemoryItem[],
    options?: ConsolidationOptions
  ): Promise<string[]> {
    try {
      console.log(`Consolidating working memory for user ${userId}`);
      
      if (!workingMemory || workingMemory.length === 0) {
        console.log('No working memory items to consolidate');
        return [];
      }
      
      // Apply filters based on options
      const minConfidence = options?.minConfidence ?? 0.7;
      const maxItems = options?.maxItems ?? 10;
      
      // Filter items by confidence and importance
      let itemsToConsolidate = workingMemory
        .filter(item => item.confidence >= minConfidence)
        // Sort by priority (higher priority first)
        .sort((a, b) => b.priority - a.priority);
      
      // Apply the importance-weighted ranking
      const importanceRankedItems = this.rankByImportance(itemsToConsolidate);
      
      // Limit to max items
      importanceRankedItems.slice(0, maxItems);
      
      // Get memory services for storage
      const { memoryService } = await getMemoryServices();
      
      // Process and store items
      const consolidatedIds: string[] = [];
      
      for (const item of importanceRankedItems) {
        try {
          // For items to store in long-term memory, we may want to enrich them
          // or generate additional insights
          let enhancedContent = item.content;
          
          // If generating insights is requested, use LLM to enhance the memory
          if (options?.generateInsights) {
            enhancedContent = await this.generateInsight(item);
          }
          
          // Create memory object for storage
          const memoryId = String(IdGenerator.generate("memory"));
          
          // Map memory type to a valid MemoryType
          // Choose an appropriate memory type based on the working memory item type
          let memoryType: MemoryType;
          switch (item.type) {
            case 'fact':
              memoryType = MemoryType.INSIGHT;
              break;
            case 'entity':
              memoryType = MemoryType.REFERENCE;
              break;
            case 'task':
              memoryType = MemoryType.TASK;
              break;
            case 'goal':
              memoryType = MemoryType.GOAL;
              break;
            default:
              memoryType = MemoryType.INSIGHT;
          }
          
          // Store in long-term memory
          await memoryService.addMemory({
            id: memoryId,
            type: memoryType,
            content: enhancedContent,
            metadata: {
              userId: userId,
              tags: [...item.tags, 'consolidated'],
              priority: item.priority,
              confidence: item.confidence,
              originalId: item.id,
              consolidatedAt: new Date().toISOString()
            }
          });
          
          consolidatedIds.push(memoryId);
        } catch (itemError) {
          console.error('Error consolidating memory item:', itemError);
        }
      }
      
      return consolidatedIds;
    } catch (error) {
      console.error('Error consolidating working memory:', error);
      return [];
    }
  }
  
  /**
   * Rank working memory items by importance using multiple factors
   * @param items Working memory items to rank
   * @returns Ranked items by importance
   */
  private rankByImportance(items: WorkingMemoryItem[]): WorkingMemoryItem[] {
    // Calculate a composite importance score for each item
    const scoredItems = items.map(item => {
      // Start with the priority as the base score
      let score = item.priority;
      
      // Boost score based on confidence
      score += item.confidence * 2;
      
      // Boost items with more tags (potentially more contextually relevant)
      score += (item.tags.length * 0.5);
      
      // Boost recent items, decrease score of older items
      const ageInHours = (new Date().getTime() - item.addedAt.getTime()) / (1000 * 60 * 60);
      const recencyFactor = Math.max(0, 1 - (ageInHours / 72)); // Decay over 3 days
      score *= recencyFactor;
      
      // Boost items with related connections
      if (item.relatedTo && item.relatedTo.length > 0) {
        score += (item.relatedTo.length * 0.7);
      }
      
      // Special handling for different types
      switch (item.type) {
        case 'fact':
          // Facts are generally more important for long-term memory
          score *= 1.2;
          break;
        case 'entity':
          // Entities are key information
          score *= 1.1;
          break;
        case 'goal':
          // Goals are critical to remember
          score *= 1.3;
          break;
        case 'task':
          // Tasks may be more ephemeral
          score *= 0.9;
          break;
      }
      
      return { item, score };
    });
    
    // Sort by score (descending) and return just the items
    return scoredItems
      .sort((a, b) => b.score - a.score)
      .map(scored => scored.item);
  }
  
  /**
   * Generate enhanced insights from a memory item using LLM
   * @param item Working memory item to enhance
   * @returns Enhanced memory content
   */
  private async generateInsight(item: WorkingMemoryItem): Promise<string> {
    try {
      // Define the system prompt for insight generation
      const systemPrompt = `You are an AI assistant that helps summarize and enhance memory items.
Review the provided memory item and generate a concise, informative version that:
1. Captures the key information
2. Adds relevant context if available
3. Makes it more useful for future retrieval
4. Is written in a clear, factual style

The goal is to create a memory that will be more valuable when retrieved in the future.`;

      // Prepare context with all information about the memory item
      const contextMessage = `
Memory item:
Content: ${item.content}
Type: ${item.type}
Tags: ${item.tags.join(', ')}
Priority: ${item.priority}
Confidence: ${item.confidence}
${item.relatedTo ? `Related to: ${item.relatedTo.join(', ')}` : ''}

Please generate an enhanced version of this memory that preserves key information
while making it more insightful and useful for future retrieval.
`;

      // Call LLM
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(contextMessage)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Return enhanced content
      return response.content.toString();
    } catch (error) {
      console.error('Error generating memory insight:', error);
      return item.content; // Fall back to original content
    }
  }
} 