import { OpenAI } from 'openai';
import { KnowledgeGraph } from './KnowledgeGraph';
import { KnowledgeConcept, KnowledgePrinciple, ResearchEntry, DomainFramework } from './types';
import { logger } from '../logging';
import * as serverQdrant from '../../server/qdrant';

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
  private knowledgeGraph: KnowledgeGraph;
  private feedbackLog: Map<string, RelevanceFeedback[]> = new Map();
  private relevanceBoosts: Map<string, number> = new Map();
  
  constructor(knowledgeGraph: KnowledgeGraph) {
    this.knowledgeGraph = knowledgeGraph;
  }
  
  /**
   * Search the knowledge graph using semantic matching
   */
  public async searchKnowledge(
    query: string, 
    options: {
      limit?: number;
      categories?: string[];
      types?: ('concept' | 'principle' | 'framework' | 'research')[];
      threshold?: number;
    } = {}
  ): Promise<SearchResult<any>[]> {
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
      
      // Collect all knowledge items to search through
      let allItems: any[] = [];
      
      // Collect items based on requested types
      const types = options.types || ['concept', 'principle', 'framework', 'research'];
      
      if (types.includes('concept')) {
        const concepts = this.knowledgeGraph.getAllConcepts();
        allItems.push(...concepts.map(c => ({ ...c, _type: 'concept' })));
      }
      
      if (types.includes('principle')) {
        const principles = this.knowledgeGraph.getAllPrinciples();
        allItems.push(...principles.map((p: KnowledgePrinciple) => ({ ...p, _type: 'principle' })));
      }
      
      if (types.includes('framework')) {
        const frameworks = this.knowledgeGraph.getAllFrameworks();
        allItems.push(...frameworks.map((f: DomainFramework) => ({ ...f, _type: 'framework' })));
      }
      
      if (types.includes('research')) {
        const research = this.knowledgeGraph.getAllResearch();
        allItems.push(...research.map((r: ResearchEntry) => ({ ...r, _type: 'research' })));
      }
      
      // Filter by categories if provided
      if (options.categories && options.categories.length > 0) {
        allItems = allItems.filter(item => {
          const category = item.category || item.domain || '';
          const subcategory = item.subcategory || '';
          return options.categories!.some(c => 
            category.toLowerCase().includes(c.toLowerCase()) || 
            subcategory.toLowerCase().includes(c.toLowerCase())
          );
        });
      }
      
      if (allItems.length === 0) {
        logger.info('No items found to search through');
        return [];
      }
      
      // Calculate embeddings for all search candidates
      // In a production system, we would cache these embeddings
      const itemEmbeddings = await this.getEmbeddingsForItems(allItems);
      
      // Calculate semantic similarity scores
      const results = allItems.map((item, index) => {
        const itemEmbedding = itemEmbeddings[index];
        let score = itemEmbedding ? this.calculateCosineSimilarity(embedding, itemEmbedding) : 0;
        
        // Apply relevance boost from feedback if available
        if (this.relevanceBoosts.has(item.id)) {
          score *= (1 + this.relevanceBoosts.get(item.id)!);
        }
        
        return {
          item,
          score,
          highlights: this.extractHighlights(query, item)
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
   * Search specific type of knowledge items
   */
  public async searchConcepts(query: string, options?: any): Promise<SearchResult<KnowledgeConcept>[]> {
    const results = await this.searchKnowledge(query, {
      ...options,
      types: ['concept']
    });
    return results.map(r => ({
      item: r.item,
      score: r.score,
      highlights: r.highlights
    }));
  }
  
  public async searchPrinciples(query: string, options?: any): Promise<SearchResult<KnowledgePrinciple>[]> {
    const results = await this.searchKnowledge(query, {
      ...options,
      types: ['principle']
    });
    return results.map(r => ({
      item: r.item,
      score: r.score,
      highlights: r.highlights
    }));
  }
  
  public async searchFrameworks(query: string, options?: any): Promise<SearchResult<DomainFramework>[]> {
    const results = await this.searchKnowledge(query, {
      ...options,
      types: ['framework']
    });
    return results.map(r => ({
      item: r.item,
      score: r.score,
      highlights: r.highlights
    }));
  }
  
  public async searchResearch(query: string, options?: any): Promise<SearchResult<ResearchEntry>[]> {
    const results = await this.searchKnowledge(query, {
      ...options,
      types: ['research']
    });
    return results.map(r => ({
      item: r.item,
      score: r.score,
      highlights: r.highlights
    }));
  }
  
  /**
   * Get embedding for text using OpenAI's API
   */
  private async getEmbeddingForText(text: string): Promise<number[] | null> {
    try {
      const embeddingResponse = await serverQdrant.getEmbedding(text);
      
      if (!embeddingResponse || !embeddingResponse.embedding) {
        logger.error('Failed to get embedding from server');
        return null;
      }
      
      return embeddingResponse.embedding;
    } catch (error) {
      logger.error(`Error getting embedding: ${error}`);
      return null;
    }
  }
  
  /**
   * Get embeddings for multiple items
   */
  private async getEmbeddingsForItems(items: any[]): Promise<(number[] | null)[]> {
    try {
      // Prepare text representations for each item
      const texts = items.map(item => {
        switch (item._type) {
          case 'concept':
            return `${item.name}. ${item.description}`;
          case 'principle':
            return `${item.name}. ${item.description}. ${item.examples?.join('. ')}`;
          case 'framework':
            return `${item.name}. ${item.description}. ${item.steps?.map((s: any) => s.description).join('. ')}`;
          case 'research':
            return `${item.title}. ${item.content}`;
          default:
            return JSON.stringify(item);
        }
      });
      
      // Get embeddings in batches to avoid rate limits
      const batchSize = 10;
      const embeddings: (number[] | null)[] = new Array(texts.length).fill(null);
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchPromises = batch.map(text => this.getEmbeddingForText(text));
        const batchResults = await Promise.all(batchPromises);
        
        for (let j = 0; j < batchResults.length; j++) {
          embeddings[i + j] = batchResults[j];
        }
      }
      
      return embeddings;
    } catch (error) {
      logger.error(`Error getting batch embeddings: ${error}`);
      return new Array(items.length).fill(null);
    }
  }
  
  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      logger.warn(`Vector dimensions don't match: ${a.length} vs ${b.length}`);
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }
  
  /**
   * Extract text highlights that match the query
   */
  private extractHighlights(query: string, item: any): string[] {
    const highlights: string[] = [];
    const keywords = query.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    
    if (keywords.length === 0) {
      return highlights;
    }
    
    // Function to check if text contains any keywords
    const containsKeywords = (text: string): boolean => {
      if (!text) return false;
      const lowerText = text.toLowerCase();
      return keywords.some(keyword => lowerText.includes(keyword));
    };
    
    // Extract highlights from different fields based on item type
    switch (item._type) {
      case 'concept':
        if (containsKeywords(item.description)) {
          highlights.push(this.extractSentence(item.description, keywords));
        }
        break;
        
      case 'principle':
        if (containsKeywords(item.description)) {
          highlights.push(this.extractSentence(item.description, keywords));
        }
        
        // Check examples
        if (item.examples && Array.isArray(item.examples)) {
          item.examples.forEach((example: string) => {
            if (containsKeywords(example)) {
              highlights.push(example);
            }
          });
        }
        break;
        
      case 'framework':
        if (containsKeywords(item.description)) {
          highlights.push(this.extractSentence(item.description, keywords));
        }
        
        // Check steps
        if (item.steps && Array.isArray(item.steps)) {
          item.steps.forEach((step: any) => {
            if (containsKeywords(step.description)) {
              highlights.push(`${step.name}: ${step.description}`);
            }
          });
        }
        break;
        
      case 'research':
        if (containsKeywords(item.content)) {
          highlights.push(this.extractSentence(item.content, keywords));
        }
        break;
    }
    
    return highlights.slice(0, 3); // Limit to 3 highlights
  }
  
  /**
   * Extract a sentence containing keywords
   */
  private extractSentence(text: string, keywords: string[]): string {
    if (!text) return '';
    
    // Split text into sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Find sentences containing keywords
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      if (keywords.some(keyword => lowerSentence.includes(keyword))) {
        return sentence.trim();
      }
    }
    
    // If no sentence contains keywords, return the first sentence
    return sentences.length > 0 ? sentences[0].trim() : '';
  }
  
  /**
   * Fallback to keyword-based search when embedding search fails
   */
  private fallbackKeywordSearch(
    query: string, 
    options: any = {}
  ): SearchResult<any>[] {
    logger.info(`Falling back to keyword search for: "${query}"`);
    
    const limit = options.limit || 10;
    const keywords = query.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    
    if (keywords.length === 0) {
      return [];
    }
    
    // Collect all items
    let allItems: any[] = [];
    
    // Collect items based on requested types
    const types = options.types || ['concept', 'principle', 'framework', 'research'];
    
    if (types.includes('concept')) {
      const concepts = this.knowledgeGraph.getAllConcepts();
      allItems.push(...concepts.map(c => ({ ...c, _type: 'concept' })));
    }
    
    if (types.includes('principle')) {
      const principles = this.knowledgeGraph.getAllPrinciples();
      allItems.push(...principles.map((p: KnowledgePrinciple) => ({ ...p, _type: 'principle' })));
    }
    
    if (types.includes('framework')) {
      const frameworks = this.knowledgeGraph.getAllFrameworks();
      allItems.push(...frameworks.map((f: DomainFramework) => ({ ...f, _type: 'framework' })));
    }
    
    if (types.includes('research')) {
      const research = this.knowledgeGraph.getAllResearch();
      allItems.push(...research.map((r: ResearchEntry) => ({ ...r, _type: 'research' })));
    }
    
    // Filter by categories if provided
    if (options.categories && options.categories.length > 0) {
      allItems = allItems.filter(item => {
        const category = item.category || item.domain || '';
        const subcategory = item.subcategory || '';
        return options.categories.some((c: string) => 
          category.toLowerCase().includes(c.toLowerCase()) || 
          subcategory.toLowerCase().includes(c.toLowerCase())
        );
      });
    }
    
    // Score items based on keyword matches
    const results = allItems.map(item => {
      let score = 0;
      const highlights = [];
      
      // Calculate score based on item type
      switch (item._type) {
        case 'concept': {
          // Check name
          const nameMatches = keywords.filter(keyword => 
            item.name.toLowerCase().includes(keyword)
          ).length;
          score += nameMatches * 0.3;
          
          // Check description
          const descMatches = keywords.filter(keyword => 
            item.description.toLowerCase().includes(keyword)
          ).length;
          score += descMatches * 0.2;
          
          if (nameMatches > 0 || descMatches > 0) {
            highlights.push(this.extractSentence(item.description, keywords));
          }
          break;
        }
        
        case 'principle': {
          // Check name
          const nameMatches = keywords.filter(keyword => 
            item.name.toLowerCase().includes(keyword)
          ).length;
          score += nameMatches * 0.3;
          
          // Check description
          const descMatches = keywords.filter(keyword => 
            item.description.toLowerCase().includes(keyword)
          ).length;
          score += descMatches * 0.2;
          
          // Check examples
          let exampleMatches = 0;
          if (item.examples && Array.isArray(item.examples)) {
            item.examples.forEach((example: string) => {
              const matches = keywords.filter(keyword => 
                example.toLowerCase().includes(keyword)
              ).length;
              exampleMatches += matches;
              
              if (matches > 0) {
                highlights.push(example);
              }
            });
          }
          score += exampleMatches * 0.1;
          break;
        }
        
        case 'framework': {
          // Check name
          const nameMatches = keywords.filter(keyword => 
            item.name.toLowerCase().includes(keyword)
          ).length;
          score += nameMatches * 0.3;
          
          // Check description
          const descMatches = keywords.filter(keyword => 
            item.description.toLowerCase().includes(keyword)
          ).length;
          score += descMatches * 0.2;
          
          if (nameMatches > 0 || descMatches > 0) {
            highlights.push(this.extractSentence(item.description, keywords));
          }
          
          // Check steps
          if (item.steps && Array.isArray(item.steps)) {
            item.steps.forEach((step: any) => {
              const matches = keywords.filter(keyword => 
                step.description.toLowerCase().includes(keyword)
              ).length;
              score += matches * 0.1;
              
              if (matches > 0) {
                highlights.push(`${step.name}: ${step.description}`);
              }
            });
          }
          break;
        }
        
        case 'research': {
          // Check title
          const titleMatches = keywords.filter(keyword => 
            item.title.toLowerCase().includes(keyword)
          ).length;
          score += titleMatches * 0.3;
          
          // Check content
          const contentMatches = keywords.filter(keyword => 
            item.content.toLowerCase().includes(keyword)
          ).length;
          score += contentMatches * 0.2;
          
          if (titleMatches > 0 || contentMatches > 0) {
            highlights.push(this.extractSentence(item.content, keywords));
          }
          break;
        }
      }
      
      // Normalize score to 0-1 range
      score = Math.min(1, score / keywords.length);
      
      return {
        item,
        score,
        highlights: highlights.slice(0, 3) // Limit to 3 highlights
      };
    });
    
    // Sort by relevance and limit results
    return results
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  /**
   * Record user feedback on search result relevance
   */
  public async recordRelevanceFeedback(feedback: RelevanceFeedback): Promise<boolean> {
    try {
      const { itemId, isRelevant, userQuery } = feedback;
      
      // Ensure we have a feedback array for this item
      if (!this.feedbackLog.has(itemId)) {
        this.feedbackLog.set(itemId, []);
      }
      
      // Add feedback to the log
      this.feedbackLog.get(itemId)!.push(feedback);
      
      // Update relevance boost for this item
      this.updateRelevanceBoost(itemId);
      
      // Log the feedback
      logger.info(`Recorded relevance feedback for item ${itemId}: ${isRelevant ? 'relevant' : 'not relevant'} to query "${userQuery}"`);
      
      return true;
    } catch (error) {
      logger.error(`Error recording relevance feedback: ${error}`);
      return false;
    }
  }
  
  /**
   * Update relevance boost for an item based on feedback
   */
  private updateRelevanceBoost(itemId: string): void {
    const feedbacks = this.feedbackLog.get(itemId);
    if (!feedbacks || feedbacks.length === 0) return;
    
    // Calculate boost based on positive feedback ratio
    const totalFeedback = feedbacks.length;
    const positiveFeedback = feedbacks.filter(f => f.isRelevant).length;
    const ratio = positiveFeedback / totalFeedback;
    
    // Apply a boost between -0.2 and +0.2 based on feedback
    const boost = (ratio - 0.5) * 0.4;
    
    this.relevanceBoosts.set(itemId, boost);
  }
  
  /**
   * Get all relevance feedback for an item
   */
  public getFeedbackForItem(itemId: string): RelevanceFeedback[] {
    return this.feedbackLog.get(itemId) || [];
  }
  
  /**
   * Create a knowledge retrieval augmentation
   * This uses knowledge graph items to enhance a user query
   */
  public async augmentQuery(query: string, options?: any): Promise<{
    augmentedQuery: string;
    usedItems: any[];
  }> {
    try {
      // Search for relevant knowledge items
      const searchResults = await this.searchKnowledge(query, {
        limit: 3,
        threshold: 0.7,
        ...options
      });
      
      if (searchResults.length === 0) {
        return { augmentedQuery: query, usedItems: [] };
      }
      
      // Extract relevant information from search results
      const knowledgeContext = searchResults.map(result => {
        const item = result.item;
        
        switch (item._type) {
          case 'concept':
            return `Concept "${item.name}": ${item.description}`;
          case 'principle':
            return `Principle "${item.name}": ${item.description}`;
          case 'framework':
            return `Framework "${item.name}": ${item.description}`;
          case 'research':
            return `Research "${item.title}": ${item.content.substring(0, 200)}...`;
          default:
            return JSON.stringify(item);
        }
      }).join('\n\n');
      
      // Use OpenAI to create an enhanced query
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-2025-04-14",
        messages: [
          { 
            role: "system", 
            content: "You are a query enhancement system. Your task is to improve search queries by incorporating domain knowledge. Create an enhanced version of the user's query that includes specific terminology and concepts from the provided knowledge context. Keep the enhanced query concise (under 50 words)."
          },
          { 
            role: "user", 
            content: `Original query: "${query}"\n\nKnowledge context:\n${knowledgeContext}\n\nProvide an enhanced version of the query that incorporates relevant terminology and concepts from the knowledge context.`
          }
        ],
        temperature: 0.3
      });
      
      const enhancedQuery = response.choices[0]?.message?.content?.trim() || query;
      
      return {
        augmentedQuery: enhancedQuery,
        usedItems: searchResults.map(r => r.item)
      };
    } catch (error) {
      logger.error(`Error augmenting query: ${error}`);
      return { augmentedQuery: query, usedItems: [] };
    }
  }
} 