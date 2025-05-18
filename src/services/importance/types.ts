import { ImportanceLevel } from '../../constants/memory';

/**
 * Request parameters for importance calculation
 */
export interface ImportanceCalculationRequest {
  /**
   * The content to evaluate for importance
   */
  content: string;
  
  /**
   * Type of content (message, thought, document, etc.)
   */
  contentType: string;
  
  /**
   * Optional user context for relevance judgment
   */
  userContext?: string;
  
  /**
   * Optional pre-calculated score to validate/adjust
   */
  existingScore?: number;
  
  /**
   * Content tags for additional context
   */
  tags?: string[];
  
  /**
   * Content source (user, agent, system)
   */
  source?: string;
}

/**
 * Response from importance calculation
 */
export interface ImportanceCalculationResponse {
  /**
   * Numeric importance score between 0 and 1
   */
  importance_score: number;
  
  /**
   * Categorical importance level
   */
  importance_level: ImportanceLevel;
  
  /**
   * Explanation for the assigned importance
   */
  reasoning: string;
  
  /**
   * Flag for critical content that requires immediate attention
   */
  is_critical: boolean;
  
  /**
   * Key terms that influenced the importance calculation
   */
  keywords: string[];
}

/**
 * Base interface for importance calculation services
 */
export interface IImportanceCalculator {
  /**
   * Calculate importance for the given content
   * 
   * @param request The calculation request parameters
   * @returns Promise resolving to calculation response
   */
  calculateImportance(request: ImportanceCalculationRequest): Promise<ImportanceCalculationResponse>;
}

/**
 * Configuration options for rule-based importance calculator
 */
export interface RuleBasedCalculatorOptions {
  /**
   * Custom keyword weights for different importance levels
   */
  keywordWeights?: {
    critical?: string[];
    high?: string[];
    medium?: string[];
    low?: string[];
  };
  
  /**
   * Weights for different factors in importance calculation
   */
  factorWeights?: {
    keywordMatch?: number;
    contentLength?: number;
    tagQuality?: number;
    sourceType?: number;
  };
}

/**
 * Configuration options for LLM-based importance calculator
 */
export interface LLMCalculatorOptions {
  /**
   * Model to use for importance assessment
   */
  model?: string;
  
  /**
   * Maximum tokens to use in the LLM request
   */
  maxTokens?: number;
  
  /**
   * Temperature for LLM generation
   */
  temperature?: number;
  
  /**
   * Whether to cache results
   */
  enableCaching?: boolean;
  
  /**
   * TTL for cached results in seconds
   */
  cacheTTL?: number;
} 