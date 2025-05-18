import { ImportanceCalculationRequest, ImportanceCalculationResponse, IImportanceCalculator, LLMCalculatorOptions } from './types';
import { RuleBasedImportanceCalculator } from './RuleBasedImportanceCalculator';
import { ImportanceLevel } from '../../constants/memory';

// Type definition for the structure returned by LLM
interface LLMImportanceResponse {
  importance_score: number;
  importance_level: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  is_critical: boolean;
  keywords: string[];
}

/**
 * LLM-based implementation of importance calculation
 * Uses OpenAI's models to evaluate content importance
 */
export class LLMImportanceCalculator implements IImportanceCalculator {
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly enableCaching: boolean;
  private readonly cacheTTL: number;
  
  // Cache for LLM results to avoid redundant API calls
  private cache: Map<string, { 
    response: ImportanceCalculationResponse; 
    timestamp: number;
  }> = new Map();

  /**
   * Create a new LLM-based importance calculator
   * 
   * @param llmService Service for making LLM API calls
   * @param fallbackCalculator Fallback calculator for when LLM fails
   * @param options Configuration options
   */
  constructor(
    private readonly llmService: {
      generateStructuredOutput: <T>(
        model: string,
        prompt: string,
        outputSchema: Record<string, unknown>
      ) => Promise<T>
    },
    private readonly fallbackCalculator: RuleBasedImportanceCalculator,
    options?: LLMCalculatorOptions
  ) {
    this.model = options?.model || process.env.OPENAI_CHEAP_MODEL || 'gpt-3.5-turbo';
    this.maxTokens = options?.maxTokens || 300;
    this.temperature = options?.temperature || 0.3;
    this.enableCaching = options?.enableCaching !== undefined ? options.enableCaching : true;
    this.cacheTTL = options?.cacheTTL || 3600; // Default 1 hour cache
  }

  /**
   * Calculate importance for the given content using LLM assessment
   * Falls back to rule-based calculation on failure
   * 
   * @param request The calculation request parameters
   * @returns Promise resolving to calculation response
   */
  async calculateImportance(request: ImportanceCalculationRequest): Promise<ImportanceCalculationResponse> {
    try {
      // Check cache if enabled
      if (this.enableCaching) {
        const cacheKey = this.generateCacheKey(request);
        const cachedResult = this.cache.get(cacheKey);
        
        if (cachedResult && (Date.now() - cachedResult.timestamp < this.cacheTTL * 1000)) {
          return cachedResult.response;
        }
      }
      
      // Create the prompt for LLM
      const prompt = this.createImportancePrompt(request);
      
      // Define the output schema for structured response
      const outputSchema = {
        importance_score: { type: 'number', minimum: 0, maximum: 1 },
        importance_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        reasoning: { type: 'string' },
        is_critical: { type: 'boolean' },
        keywords: { type: 'array', items: { type: 'string' } }
      };
      
      // Call LLM with structured output parsing
      const llmResult = await this.llmService.generateStructuredOutput<LLMImportanceResponse>(
        this.model,
        prompt,
        outputSchema
      );
      
      // Convert LLM response to standardized format
      const response: ImportanceCalculationResponse = {
        importance_score: llmResult.importance_score,
        importance_level: this.convertStringToImportanceLevel(llmResult.importance_level),
        reasoning: llmResult.reasoning,
        is_critical: llmResult.is_critical,
        keywords: llmResult.keywords
      };
      
      // Cache result if caching is enabled
      if (this.enableCaching) {
        const cacheKey = this.generateCacheKey(request);
        this.cache.set(cacheKey, {
          response,
          timestamp: Date.now()
        });
      }
      
      return response;
    } catch (error) {
      console.error('Error in LLM importance calculation, falling back to rule-based:', error);
      // Fall back to rule-based calculation
      return this.fallbackCalculator.calculateImportance(request);
    }
  }
  
  /**
   * Create the prompt for LLM to assess content importance
   * 
   * @param request The calculation request
   * @returns Formatted prompt string for LLM
   */
  private createImportancePrompt(request: ImportanceCalculationRequest): string {
    return `
    Analyze the following content and determine its importance on a scale of 0.0-1.0:
    
    CONTENT TYPE: ${request.contentType}
    CONTENT: "${request.content}"
    ${request.tags?.length ? `TAGS: ${request.tags.join(', ')}` : ''}
    ${request.source ? `SOURCE: ${request.source}` : ''}
    ${request.userContext ? `USER CONTEXT: ${request.userContext}` : ''}
    
    Assign an importance score where:
    - 0.0-0.3: Low importance (routine information)
    - 0.3-0.6: Medium importance (useful but not critical)
    - 0.6-0.9: High importance (significant information)
    - 0.9-1.0: Critical importance (vital information)
    
    Return only a JSON object with the following format:
    {
      "importance_score": number, // 0.0-1.0
      "importance_level": "low"|"medium"|"high"|"critical",
      "reasoning": "string", // Brief explanation
      "is_critical": boolean,
      "keywords": ["array of keywords influencing this importance"]
    }
    `;
  }
  
  /**
   * Generate a cache key for a request
   * 
   * @param request The request to generate a key for
   * @returns A unique string key for the request
   */
  private generateCacheKey(request: ImportanceCalculationRequest): string {
    // Create a deterministic key based on content and type
    const contentHash = this.simpleHash(request.content);
    const typeHash = this.simpleHash(request.contentType);
    return `${contentHash}_${typeHash}`;
  }
  
  /**
   * Simple string hashing function
   * 
   * @param str String to hash
   * @returns A simple numeric hash
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Convert string importance level to enum
   * 
   * @param level String representation of importance level
   * @returns The corresponding ImportanceLevel enum value
   */
  private convertStringToImportanceLevel(level: string): ImportanceLevel {
    switch (level.toLowerCase()) {
      case 'critical': return ImportanceLevel.CRITICAL;
      case 'high': return ImportanceLevel.HIGH;
      case 'medium': return ImportanceLevel.MEDIUM;
      case 'low': return ImportanceLevel.LOW;
      default: return ImportanceLevel.MEDIUM;
    }
  }
} 