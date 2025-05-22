import { ChatOpenAI } from '@langchain/openai';
import { MemoryManager } from '../base/managers/MemoryManager.interface';
import { createChatOpenAI } from '../../../lib/core/llm';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

/**
 * Types of memory relevance
 */
export enum RelevanceType {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  IRRELEVANT = 'irrelevant'
}

/**
 * Interface for memory with relevance score
 */
export interface ScoredMemory {
  id: string;
  content: string;
  metadata: Record<string, any>;
  relevanceScore: number;
  relevanceType: RelevanceType;
  recency: number; // 0-1 score where 1 is most recent
}

/**
 * Options for retrieving relevant memories
 */
export interface RelevantMemoryOptions {
  /** The query to match against */
  query: string;
  
  /** Maximum number of memories to retrieve */
  limit?: number;
  
  /** Whether to include critical memories regardless of relevance */
  includeCritical?: boolean;
  
  /** Minimum relevance score threshold (0-1) */
  minRelevance?: number;
  
  /** Maximum total token budget for memories */
  maxTokens?: number;
  
  /** Tags to filter memories by */
  tags?: string[];
  
  /** Types of memories to include */
  types?: string[];
  
  /** Additional metadata filters */
  metadata?: Record<string, any>;
}

/**
 * Class for scoring and retrieving relevant memories
 */
export class RelevanceScorer {
  private model: ChatOpenAI;
  private memoryManager: MemoryManager;
  
  /**
   * Create a new RelevanceScorer
   * 
   * @param memoryManager Memory manager to use for retrieval
   * @param modelName Name of the model to use for scoring
   */
  constructor(memoryManager: MemoryManager, modelName: string = process.env.OPENAI_MODEL_NAME || 'gpt-4') {
    this.memoryManager = memoryManager;
    this.model = createChatOpenAI({
      model: modelName,
      temperature: 0,
      maxTokens: 100
    });
  }
  
  /**
   * Calculate relevance score between a memory and a query
   * 
   * @param memory Memory content
   * @param query Query to score against
   * @returns Relevance score between 0 and 1
   */
  async calculateRelevanceScore(memory: string, query: string): Promise<number> {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `Determine how relevant the following memory is to the query. Rate from 0 to 1, where 0 is completely irrelevant and 1 is highly relevant.`],
      ["human", `Memory: ${memory}\n\nQuery: ${query}\n\nRelevance score (0.0 to 1.0):`]
    ]);
    
    const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
    
    try {
      const resultText = await chain.invoke({});
      // Extract the score from the result
      const score = parseFloat(resultText.trim());
      return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
    } catch (error) {
      console.error('Error calculating relevance score:', error);
      return 0;
    }
  }
  
  /**
   * Retrieve and score memories relevant to a query
   * 
   * @param options Options for retrieving relevant memories
   * @returns Array of scored memories
   */
  async getRelevantMemories(options: RelevantMemoryOptions): Promise<ScoredMemory[]> {
    const { 
      query, 
      limit = 10, 
      includeCritical = true,
      minRelevance = 0.3,
      maxTokens = 4000,
      tags = [],
      types = ['user_input', 'agent_response', 'critical_memory'],
      metadata = {}
    } = options;
    
    // Get critical memories if requested
    let criticalMemories: ScoredMemory[] = [];
    if (includeCritical) {
      const critical = await this.memoryManager.searchMemories('', {
        metadata: { type: 'critical_memory' },
        limit: 20
      });
      
      criticalMemories = critical.map(mem => ({
        id: mem.id,
        content: mem.content,
        metadata: mem.metadata,
        relevanceScore: 1.0, // Max score for critical memories
        relevanceType: RelevanceType.CRITICAL,
        recency: this.calculateRecency(mem.metadata.timestamp || mem.metadata.createdAt)
      }));
    }
    
    // Get semantically relevant memories using vector search
    const searchResults = await this.memoryManager.searchMemories(query, {
      limit: limit * 2, // Get more than needed to account for filtering
      metadata: { 
        ...metadata,
        type: types
      }
    });
    
    // Filter by tags if specified
    const tagFiltered = tags.length > 0
      ? searchResults.filter(mem => {
          const memoryTags = (mem.metadata.tags || []) as string[];
          return tags.some(tag => memoryTags.includes(tag));
        })
      : searchResults;
    
    // Score relevance for each memory
    const scoringPromises = tagFiltered.map(async mem => {
      const relevanceScore = await this.calculateRelevanceScore(mem.content, query);
      return {
        id: mem.id,
        content: mem.content,
        metadata: mem.metadata,
        relevanceScore,
        relevanceType: this.getRelevanceType(relevanceScore),
        recency: this.calculateRecency(mem.metadata.timestamp || mem.metadata.createdAt)
      };
    });
    
    const scoredMemories = await Promise.all(scoringPromises);
    
    // Filter by minimum relevance score
    const relevantMemories = scoredMemories.filter(mem => mem.relevanceScore >= minRelevance);
    
    // Combine critical and relevant memories
    const allMemories = [...criticalMemories, ...relevantMemories];
    
    // Sort by combined relevance and recency score
    allMemories.sort((a, b) => {
      // Combined score formula: 70% relevance, 30% recency
      const scoreA = 0.7 * a.relevanceScore + 0.3 * a.recency;
      const scoreB = 0.7 * b.relevanceScore + 0.3 * b.recency;
      return scoreB - scoreA; // Descending order
    });
    
    // Take the top memories according to limit
    const topMemories = allMemories.slice(0, limit);
    
    return topMemories;
  }
  
  /**
   * Calculate recency score based on timestamp
   * 
   * @param timestamp Timestamp to calculate recency from
   * @returns Recency score between 0 and 1
   */
  private calculateRecency(timestamp: unknown): number {
    if (!timestamp) return 0;
    
    try {
      const memoryDate = new Date(timestamp as string | number | Date);
      const now = new Date();
      
      // Check if date is valid
      if (isNaN(memoryDate.getTime())) return 0;
      
      const ageInMilliseconds = now.getTime() - memoryDate.getTime();
      
      // Convert to hours for a more manageable scale
      const ageInHours = ageInMilliseconds / (1000 * 60 * 60);
      
      // Exponential decay function
      // 1.0 for recent memories, decreasing to 0.0 for older ones
      // Half-life of 24 hours (recency = 0.5 after 24 hours)
      return Math.exp(-ageInHours / 24);
    } catch (error) {
      console.error('Error calculating recency:', error);
      return 0;
    }
  }
  
  /**
   * Get relevance type from score
   * 
   * @param score Relevance score (0-1)
   * @returns Relevance type
   */
  private getRelevanceType(score: number): RelevanceType {
    if (score >= 0.9) return RelevanceType.CRITICAL;
    if (score >= 0.7) return RelevanceType.HIGH;
    if (score >= 0.5) return RelevanceType.MEDIUM;
    if (score >= 0.3) return RelevanceType.LOW;
    return RelevanceType.IRRELEVANT;
  }
} 