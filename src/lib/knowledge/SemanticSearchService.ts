import { OpenAI } from 'openai';
import { KnowledgeGraph } from './KnowledgeGraph';
import { KnowledgeConcept, KnowledgePrinciple, ResearchEntry, DomainFramework } from './types';
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
      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text
      });
      
      return response.data[0].embedding;
    } catch (error) {
      logger.error(`Error generating embedding: ${error}`);
      return null;
    }
  }
  
  /**
   * Get embeddings for multiple items
   */
  private async getEmbeddingsForItems(items: any[]): Promise<(number[] | null)[]> {
    try {
      // Get embeddings from memory services
      const { embeddingService } = await getMemoryServices();
      
      // Extract text to embed from each item
      const textsToEmbed = items.map(item => {
        switch (item._type) {
          case 'concept':
            return `${item.name}: ${item.description}`;
          case 'principle':
            return `${item.name}: ${item.description}`;
          case 'framework':
            return `${item.name}: ${item.description}`;
          case 'research':
            return `${item.title}: ${item.summary || item.content.substring(0, 500)}`;
          default:
            return '';
        }
      });
      
      // Generate embeddings in batches to avoid rate limits
      const embeddings: (number[] | null)[] = [];
      const batchSize = 5;
      
      for (let i = 0; i < textsToEmbed.length; i += batchSize) {
        const batch = textsToEmbed.slice(i, i + batchSize);
        
        const batchEmbeddings = await Promise.all(
          batch.map(async text => {
            if (!text) return null;
            try {
              const embeddingResult = await embeddingService.getEmbedding(text);
              return embeddingResult.embedding;
            } catch (error) {
              logger.error(`Error generating embedding for batch item: ${error}`);
              return null;
            }
          })
        );
        
        embeddings.push(...batchEmbeddings);
      }
      
      return embeddings;
    } catch (error) {
      logger.error(`Error generating embeddings for items: ${error}`);
      return items.map(() => null);
    }
  }
  
  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;
    
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
   * Extract relevant highlights from an item based on the query
   */
  private extractHighlights(query: string, item: any): string[] {
    const highlights: string[] = [];
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 3);
    
    if (keywords.length === 0) return highlights;
    
    // Define a helper to check if text contains keywords
    const containsKeywords = (text: string): boolean => {
      if (!text) return false;
      text = text.toLowerCase();
      return keywords.some(keyword => text.includes(keyword));
    };
    
    switch (item._type) {
      case 'concept': {
        // Get description highlight
        if (containsKeywords(item.description)) {
          highlights.push(this.extractSentence(item.description, keywords));
        }
        
        // Get example highlights
        if (item.examples && Array.isArray(item.examples)) {
          for (const example of item.examples) {
            if (containsKeywords(example)) {
              highlights.push(example);
              if (highlights.length >= 3) break;
            }
          }
        }
        break;
      }
      
      case 'principle': {
        // Get description highlight
        if (containsKeywords(item.description)) {
          highlights.push(this.extractSentence(item.description, keywords));
        }
        
        // Get example highlights
        if (item.examples && Array.isArray(item.examples)) {
          for (const example of item.examples) {
            if (containsKeywords(example)) {
              highlights.push(example);
              if (highlights.length >= 3) break;
            }
          }
        }
        break;
      }
      
      case 'framework': {
        // Get description highlight
        if (containsKeywords(item.description)) {
          highlights.push(this.extractSentence(item.description, keywords));
        }
        
        // Get step highlights
        if (item.steps && Array.isArray(item.steps)) {
          for (const step of item.steps) {
            if (containsKeywords(step.description)) {
              highlights.push(`${step.name}: ${step.description}`);
              if (highlights.length >= 3) break;
            }
          }
        }
        break;
      }
      
      case 'research': {
        // Get content highlight
        if (containsKeywords(item.content)) {
          highlights.push(this.extractSentence(item.content, keywords));
        }
        break;
      }
    }
    
    return highlights.slice(0, 3); // Limit to 3 highlights
  }
  
  /**
   * Extract the most relevant sentence from text based on keywords
   */
  private extractSentence(text: string, keywords: string[]): string {
    if (!text) return '';
    
    // Split text into sentences
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    // Score each sentence based on keyword occurrences
    const scoredSentences = sentences.map(sentence => {
      const sentenceLower = sentence.toLowerCase();
      let score = 0;
      
      keywords.forEach(keyword => {
        if (sentenceLower.includes(keyword.toLowerCase())) {
          score++;
        }
      });
      
      return { sentence, score };
    });
    
    // Sort by score and get the highest scoring sentence
    scoredSentences.sort((a, b) => b.score - a.score);
    
    return scoredSentences[0]?.sentence || text.substring(0, 100);
  }
  
  /**
   * Fallback search method using keyword matching
   */
  private fallbackKeywordSearch(
    query: string, 
    options: any = {}
  ): SearchResult<any>[] {
    logger.info(`Falling back to keyword search for: "${query}"`);
    
    const limit = options.limit || 10;
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 3);
    
    if (keywords.length === 0) return [];
    
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
   * Get all feedback for a specific item
   */
  public getFeedbackForItem(itemId: string): RelevanceFeedback[] {
    return this.feedbackLog.get(itemId) || [];
  }
  
  /**
   * Augment a search query with relevant knowledge
   */
  public async augmentQuery(query: string, options?: any): Promise<{
    augmentedQuery: string;
    usedItems: any[];
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
        
        switch (item._type) {
          case 'concept':
            return `Concept: ${item.name} - ${item.description}`;
          case 'principle':
            return `Principle: ${item.name} - ${item.description}`;
          case 'framework':
            return `Framework: ${item.name} - ${item.description}`;
          case 'research':
            return `Research: ${item.title} - ${item.summary || item.content.substring(0, 200)}`;
          default:
            return '';
        }
      }).filter(info => info !== '');
      
      // Use OpenAI to augment the query with the relevant information
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
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
        max_tokens: 150
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