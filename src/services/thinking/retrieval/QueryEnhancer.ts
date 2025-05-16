import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { IdGenerator } from '@/utils/ulid';

/**
 * Query entity extracted from a query
 */
export interface QueryEntity {
  type: string;
  value: string;
  weight: number;
}

/**
 * Enhanced query with variations and structured components
 */
export interface EnhancedQuery {
  /**
   * Original user query
   */
  originalQuery: string;
  
  /**
   * Expanded version with related terms
   */
  expandedQuery?: string;
  
  /**
   * Multiple variations of the query
   */
  variations?: string[];
  
  /**
   * Structured entities extracted from the query
   */
  entities?: QueryEntity[];
  
  /**
   * Hypothetical document titles that would answer the query
   */
  hypotheticalDocuments?: string[];
}

/**
 * Options for query enhancement
 */
export interface QueryEnhancementOptions {
  /**
   * Original query to enhance
   */
  originalQuery: string;
  
  /**
   * Enhancement strategies to apply
   */
  enhancementStrategies: {
    /**
     * Whether to expand the query with related terms
     */
    expansion?: boolean;
    
    /**
     * Whether to generate hypothetical document titles
     */
    hypothetical?: boolean;
    
    /**
     * Whether to extract structured components
     */
    structuredExtraction?: boolean;
    
    /**
     * Whether to generate multiple query variations
     */
    multiQuery?: boolean;
  };
  
  /**
   * Execution options
   */
  executionOptions?: {
    /**
     * Whether to execute enhancement strategies in parallel
     */
    parallel?: boolean;
    
    /**
     * Number of top variations to keep
     */
    topK?: number;
  };
}

/**
 * Service for enhancing queries for better retrieval
 */
export class QueryEnhancer {
  private llm: ChatOpenAI;
  
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.2
    });
  }
  
  /**
   * Enhance a query using multiple strategies
   * @param options Enhancement options
   * @returns Enhanced query
   */
  async enhanceQuery(options: QueryEnhancementOptions): Promise<EnhancedQuery> {
    try {
      console.log(`Enhancing query: ${options.originalQuery}`);
      
      // Create result object with original query
      const result: EnhancedQuery = {
        originalQuery: options.originalQuery
      };
      
      // Determine which strategies to apply
      const strategies = options.enhancementStrategies;
      
      // Execute strategies in parallel or sequentially
      if (options.executionOptions?.parallel) {
        // Execute all strategies in parallel
        const promises: Promise<any>[] = [];
        
        if (strategies.expansion) {
          promises.push(
            this.expandQuery(options.originalQuery)
              .then(expanded => { result.expandedQuery = expanded; })
          );
        }
        
        if (strategies.multiQuery) {
          const count = options.executionOptions?.topK || 3;
          promises.push(
            this.generateQueryVariations(options.originalQuery, count)
              .then(variations => { result.variations = variations; })
          );
        }
        
        if (strategies.structuredExtraction) {
          promises.push(
            this.extractQueryEntities(options.originalQuery)
              .then(entities => { result.entities = entities; })
          );
        }
        
        if (strategies.hypothetical) {
          promises.push(
            this.generateHypotheticalDocuments(options.originalQuery)
              .then(docs => { result.hypotheticalDocuments = docs; })
          );
        }
        
        // Wait for all strategies to complete
        await Promise.all(promises);
      } else {
        // Execute strategies sequentially
        if (strategies.expansion) {
          result.expandedQuery = await this.expandQuery(options.originalQuery);
        }
        
        if (strategies.multiQuery) {
          const count = options.executionOptions?.topK || 3;
          result.variations = await this.generateQueryVariations(options.originalQuery, count);
        }
        
        if (strategies.structuredExtraction) {
          result.entities = await this.extractQueryEntities(options.originalQuery);
        }
        
        if (strategies.hypothetical) {
          result.hypotheticalDocuments = await this.generateHypotheticalDocuments(options.originalQuery);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error enhancing query:', error);
      // Return basic result with original query
      return { originalQuery: options.originalQuery };
    }
  }
  
  /**
   * Generate multiple variations of the original query
   * @param query Original query
   * @param count Number of variations to generate
   * @returns Array of query variations
   */
  async generateQueryVariations(query: string, count: number = 3): Promise<string[]> {
    try {
      // Define system prompt for query variation generation
      const systemPrompt = `You are an AI assistant that helps generate variations of search queries.
Your task is to create ${count} different versions of the user's query that capture the same intent.
These variations should help improve search results by using different wordings, synonyms, or approaches.

Return your response as a JSON list of strings, like this:
{
  "variations": [
    "variation 1",
    "variation 2",
    "variation 3"
  ]
}`;

      // Call LLM
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Generate ${count} variations of this query: "${query}"`)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Parse the response
      const content = response.content.toString();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        if (data.variations && Array.isArray(data.variations)) {
          return data.variations.slice(0, count);
        }
      }
      
      // Fallback if parsing fails
      return [query];
    } catch (error) {
      console.error('Error generating query variations:', error);
      return [query];
    }
  }
  
  /**
   * Extract structured entities from a query
   * @param query Query to analyze
   * @returns Extracted entities
   */
  async extractQueryEntities(query: string): Promise<QueryEntity[]> {
    try {
      // Define system prompt for entity extraction
      const systemPrompt = `You are an AI assistant that extracts key entities from search queries.
Your task is to identify important concepts, objects, attributes, and constraints in the query.
Assign a weight to each entity based on its importance to the query (0.0 to 1.0).

Return your response as a JSON array, like this:
{
  "entities": [
    {"type": "concept", "value": "quantum computing", "weight": 0.9},
    {"type": "attribute", "value": "performance", "weight": 0.7},
    {"type": "constraint", "value": "after 2020", "weight": 0.5}
  ]
}`;

      // Call LLM
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Extract key entities from this query: "${query}"`)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Parse the response
      const content = response.content.toString();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        if (data.entities && Array.isArray(data.entities)) {
          return data.entities;
        }
      }
      
      // Fallback if parsing fails
      return [];
    } catch (error) {
      console.error('Error extracting query entities:', error);
      return [];
    }
  }
  
  /**
   * Expand query with related terms to improve retrieval
   * @param query Original query
   * @returns Expanded query with related terms
   */
  async expandQuery(query: string): Promise<string> {
    try {
      // Define system prompt for query expansion
      const systemPrompt = `You are an AI assistant that expands search queries.
Your task is to enhance the user's query by adding related terms, synonyms, and concepts.
Do not change the original meaning of the query, only enhance it with relevant terms.

Return only the expanded query as plain text, nothing else.`;

      // Call LLM
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Expand this search query with related terms: "${query}"`)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Return expanded query
      return response.content.toString();
    } catch (error) {
      console.error('Error expanding query:', error);
      return query; // Fall back to original query
    }
  }
  
  /**
   * Generate hypothetical document titles that would answer the query
   * @param query Original query
   * @returns List of hypothetical document titles
   */
  async generateHypotheticalDocuments(query: string): Promise<string[]> {
    try {
      // Define system prompt for hypothetical document generation
      const systemPrompt = `You are an AI assistant that generates hypothetical document titles.
Your task is to create 3-5 titles for documents that would perfectly answer the user's query.
These should represent ideal documents that the user is likely looking for.

Return your response as a JSON list of strings, like this:
{
  "documentTitles": [
    "Title 1",
    "Title 2",
    "Title 3"
  ]
}`;

      // Call LLM
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Generate hypothetical document titles for this query: "${query}"`)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Parse the response
      const content = response.content.toString();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        if (data.documentTitles && Array.isArray(data.documentTitles)) {
          return data.documentTitles;
        }
      }
      
      // Fallback if parsing fails
      return [];
    } catch (error) {
      console.error('Error generating hypothetical documents:', error);
      return [];
    }
  }
} 