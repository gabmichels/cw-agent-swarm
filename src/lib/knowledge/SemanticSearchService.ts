import { OpenAI } from 'openai';
import { KnowledgeGraphManager } from '../agents/implementations/memory/KnowledgeGraphManager';
import { KnowledgeNode, KnowledgeNodeType } from '../agents/shared/memory/types';
import { logger } from '../logging';
import { getMemoryServices } from '../../server/memory/services';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Search result with relevance score
 */
export interface SearchResult<T> {
  item: T;
  score: number; // Relevance score (0-1)
  highlights?: string[]; // Key phrases that matched
}

/**
 * User feedback on search result
 */
export interface RelevanceFeedback {
  itemId: string;
  isRelevant: boolean;
  userQuery: string;
  explanation?: string;
}

/**
 * Semantic Search Service for Knowledge Graph
 * Implements Milestone 4.2: Semantic Search Integration
 * - Integrates OpenAI search functionality
 * - Implements knowledge retrieval augmentation 
 * - Adds relevance feedback mechanisms
 */
export class SemanticSearchService {
  private graphManager: KnowledgeGraphManager;
  private feedbackLog: Map<string, RelevanceFeedback[]> = new Map();
  private relevanceBoosts: Map<string, number> = new Map();
  
  constructor(graphManager: KnowledgeGraphManager) {
    this.graphManager = graphManager;
  }
  
  /**
   * Search the knowledge graph using semantic matching
   */
  public async searchKnowledge(
    query: string, 
    options: {
      limit?: number;
      types?: KnowledgeNodeType[];
      threshold?: number;
    } = {}
  ): Promise<SearchResult<KnowledgeNode>[]> {
    try {
      logger.info(`Semantic search for: "${query}"`);
      
      const limit = options.limit || 10;
      const threshold = options.threshold || 0.6;
      
      // Get embedding for the search query
      const embedding = await this.getEmbeddingForText(query);
      if (!embedding) {
        logger.error('Failed to generate embedding for search query');
        return this.fallbackKeywordSearch(query, options);
      }
      
      // Get all nodes of requested types
      const types = options.types || [
        'task', 'concept', 'trend', 'tool', 'strategy', 'insight',
        'project', 'agent', 'entity', 'process', 'resource', 'metric',
        'event', 'decision'
      ] as KnowledgeNodeType[];
      let allNodes: KnowledgeNode[] = [];
      
      for (const type of types) {
        const nodes = await this.graphManager.findNodes('', type, 100);
        allNodes.push(...nodes);
      }
      
      if (allNodes.length === 0) {
        logger.info('No nodes found to search through');
        return [];
      }
      
      // Calculate embeddings for all search candidates
      const nodeEmbeddings = await this.getEmbeddingsForItems(allNodes);
      
      // Calculate semantic similarity scores
      const results = allNodes.map((node, index) => {
        const nodeEmbedding = nodeEmbeddings[index];
        let score = nodeEmbedding ? this.calculateCosineSimilarity(embedding, nodeEmbedding) : 0;
        
        // Apply relevance boost from feedback if available
        if (this.relevanceBoosts.has(node.id)) {
          score *= (1 + this.relevanceBoosts.get(node.id)!);
        }
        
        return {
          item: node,
          score,
          highlights: this.extractHighlights(query, node)
        };
      });
      
      // Filter by threshold and sort by relevance
      return results
        .filter(result => result.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      logger.error(`Error in semantic search: ${error}`);
      // Fall back to keyword search on error
      return this.fallbackKeywordSearch(query, options);
    }
  }
  
  /**
   * Search specific type of knowledge nodes
   */
  public async searchByType(
    query: string,
    type: KnowledgeNodeType,
    options?: { limit?: number; threshold?: number }
  ): Promise<SearchResult<KnowledgeNode>[]> {
    return this.searchKnowledge(query, {
      ...options,
      types: [type]
    });
  }
  
  /**
   * Get embedding for text using OpenAI's API
   */
  private async getEmbeddingForText(text: string): Promise<number[] | null> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text
      });
      return response.data[0].embedding;
    } catch (error) {
      logger.error(`Error getting embedding: ${error}`);
      return null;
    }
  }
  
  /**
   * Get embeddings for multiple items
   */
  private async getEmbeddingsForItems(nodes: KnowledgeNode[]): Promise<(number[] | null)[]> {
    const texts = nodes.map(node => `${node.label}\n${node.description || ''}`);
    const embeddings: (number[] | null)[] = [];
    
    // Process in batches of 10
    for (let i = 0; i < texts.length; i += 10) {
      const batch = texts.slice(i, i + 10);
      try {
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: batch
        });
        embeddings.push(...response.data.map(d => d.embedding));
      } catch (error) {
        logger.error(`Error getting embeddings for batch: ${error}`);
        embeddings.push(...new Array(batch.length).fill(null));
      }
    }
    
    return embeddings;
  }
  
  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  /**
   * Extract relevant highlights from a node
   */
  private extractHighlights(query: string, node: KnowledgeNode): string[] {
    const highlights: string[] = [];
    const keywords = query.toLowerCase().split(/\s+/);
    
    // Check label and description
    const text = `${node.label}\n${node.description || ''}`.toLowerCase();
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        const sentence = this.extractSentence(text, [keyword]);
        if (sentence) highlights.push(sentence);
      }
    }
    
    // Return unique highlights
    const uniqueHighlights = Array.from(new Set(highlights));
    return uniqueHighlights;
  }
  
  /**
   * Extract a sentence containing any of the keywords
   */
  private extractSentence(text: string, keywords: string[]): string {
    const sentences = text.split(/[.!?]+/);
    for (const sentence of sentences) {
      if (keywords.some(kw => sentence.includes(kw))) {
        return sentence.trim();
      }
    }
    return '';
  }
  
  /**
   * Fallback to simple keyword search
   */
  private async fallbackKeywordSearch(
    query: string,
    options: { limit?: number; types?: KnowledgeNodeType[] } = {}
  ): Promise<SearchResult<KnowledgeNode>[]> {
    const keywords = query.toLowerCase().split(/\s+/);
    const limit = options.limit || 10;
    
    const nodes = await this.graphManager.findNodes(query, options.types?.[0], limit);
    const results = nodes.map(node => ({
      item: node,
      score: keywords.filter(kw => 
        `${node.label}\n${node.description || ''}`.toLowerCase().includes(kw)
      ).length / keywords.length,
      highlights: this.extractHighlights(query, node)
    } as SearchResult<KnowledgeNode>));
    
    return results
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }
  
  /**
   * Record user feedback on search results
   */
  public async recordRelevanceFeedback(feedback: RelevanceFeedback): Promise<boolean> {
    try {
      const feedbackList = this.feedbackLog.get(feedback.itemId) || [];
      feedbackList.push(feedback);
      this.feedbackLog.set(feedback.itemId, feedbackList);
      
      // Update relevance boost based on feedback
      this.updateRelevanceBoost(feedback.itemId);
      
      return true;
    } catch (error) {
      logger.error(`Error recording feedback: ${error}`);
      return false;
    }
  }
  
  /**
   * Update relevance boost factor based on feedback
   */
  private updateRelevanceBoost(itemId: string): void {
    const feedbackList = this.feedbackLog.get(itemId) || [];
    if (feedbackList.length === 0) return;
    
    const relevantCount = feedbackList.filter(f => f.isRelevant).length;
    const boost = relevantCount / feedbackList.length;
    this.relevanceBoosts.set(itemId, boost);
  }
  
  /**
   * Get feedback history for an item
   */
  public getFeedbackForItem(itemId: string): RelevanceFeedback[] {
    return this.feedbackLog.get(itemId) || [];
  }
  
  /**
   * Augment a search query with relevant knowledge
   */
  public async augmentQuery(query: string, options?: any): Promise<{
    augmentedQuery: string;
    usedItems: KnowledgeNode[];
  }> {
    try {
      // First, search for relevant items
      const searchResults = await this.searchKnowledge(query, {
        limit: 3,
        threshold: 0.7,
        ...options
      });
      
      if (searchResults.length === 0) {
        return {
          augmentedQuery: query,
          usedItems: []
        };
      }
      
      // Extract relevant information from top results
      const relevantInfo = searchResults.map(result => {
        const item = result.item;
        
        return `Node: ${item.label} - ${item.description || ''}`;
      }).filter(info => info !== '');
      
      // Use OpenAI to augment the query with the relevant information
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL_NAME || "gpt-4.1-2025-04-14",
        messages: [
          {
            role: 'system',
            content: 'You are an assistant that helps augment search queries with relevant context. Use the provided information to enhance the query without changing its intent.'
          },
          {
            role: 'user',
            content: `I want to search for: "${query}"\n\nHere's some relevant information:\n${relevantInfo.join('\n\n')}`
          }
        ],
        temperature: 0.3,
        max_tokens: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) / 10 : 150
      });
      
      const augmentedQuery = response.choices[0]?.message?.content || query;
      
      return {
        augmentedQuery,
        usedItems: searchResults.map(r => r.item)
      };
    } catch (error) {
      logger.error(`Error augmenting query: ${error}`);
      return {
        augmentedQuery: query,
        usedItems: []
      };
    }
  }
} 