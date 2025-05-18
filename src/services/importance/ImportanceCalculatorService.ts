import { ImportanceCalculationRequest, ImportanceCalculationResponse, IImportanceCalculator, LLMCalculatorOptions, RuleBasedCalculatorOptions } from './types';
import { RuleBasedImportanceCalculator } from './RuleBasedImportanceCalculator';
import { LLMImportanceCalculator } from './LLMImportanceCalculator';
import { ImportanceConverter } from './ImportanceConverter';
import { ImportanceLevel } from '../../constants/memory';

/**
 * Modes for importance calculation
 */
export enum ImportanceCalculationMode {
  /**
   * Use only rule-based calculation (faster, less accurate)
   */
  RULE_BASED = 'rule_based',
  
  /**
   * Use only LLM-based calculation (slower, more accurate)
   */
  LLM = 'llm',
  
  /**
   * Use rule-based first, then LLM only if needed (balanced)
   */
  HYBRID = 'hybrid'
}

/**
 * Options for the importance calculator service
 */
export interface ImportanceCalculatorServiceOptions {
  /**
   * Default calculation mode
   */
  defaultMode?: ImportanceCalculationMode;
  
  /**
   * Options for rule-based calculator
   */
  ruleBasedOptions?: RuleBasedCalculatorOptions;
  
  /**
   * Options for LLM-based calculator
   */
  llmOptions?: LLMCalculatorOptions;
  
  /**
   * Confidence threshold for using hybrid mode
   * If rule-based confidence is below this, use LLM
   */
  hybridConfidenceThreshold?: number;
}

/**
 * Main service for importance calculation
 * Manages different calculation strategies
 */
export class ImportanceCalculatorService implements IImportanceCalculator {
  private readonly ruleBasedCalculator: RuleBasedImportanceCalculator;
  private readonly llmCalculator: LLMImportanceCalculator;
  private readonly defaultMode: ImportanceCalculationMode;
  private readonly hybridConfidenceThreshold: number;

  /**
   * Create a new importance calculator service
   * 
   * @param llmService Service for making LLM API calls
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
    options?: ImportanceCalculatorServiceOptions
  ) {
    // Create rule-based calculator
    this.ruleBasedCalculator = new RuleBasedImportanceCalculator(
      options?.ruleBasedOptions
    );
    
    // Create LLM-based calculator
    this.llmCalculator = new LLMImportanceCalculator(
      llmService,
      this.ruleBasedCalculator,
      options?.llmOptions
    );
    
    // Set default mode and threshold
    this.defaultMode = options?.defaultMode || ImportanceCalculationMode.HYBRID;
    this.hybridConfidenceThreshold = options?.hybridConfidenceThreshold || 0.7;
  }

  /**
   * Calculate importance for the given content
   * Uses the specified mode or falls back to default mode
   * 
   * @param request The calculation request parameters
   * @param mode Optional mode to use for this calculation
   * @returns Promise resolving to calculation response
   */
  async calculateImportance(
    request: ImportanceCalculationRequest,
    mode?: ImportanceCalculationMode
  ): Promise<ImportanceCalculationResponse> {
    const calculationMode = mode || this.defaultMode;
    
    switch (calculationMode) {
      case ImportanceCalculationMode.RULE_BASED:
        return this.ruleBasedCalculator.calculateImportance(request);
        
      case ImportanceCalculationMode.LLM:
        return this.llmCalculator.calculateImportance(request);
        
      case ImportanceCalculationMode.HYBRID:
        return this.calculateWithHybridMode(request);
        
      default:
        return this.ruleBasedCalculator.calculateImportance(request);
    }
  }
  
  /**
   * Convert a numeric score to an ImportanceLevel enum
   * 
   * @param score Numeric importance score
   * @returns Corresponding ImportanceLevel
   */
  convertScoreToLevel(score: number): ImportanceLevel {
    return ImportanceConverter.scoreToLevel(score);
  }
  
  /**
   * Convert an ImportanceLevel enum to a representative score
   * 
   * @param level ImportanceLevel enum value
   * @returns Representative numeric score
   */
  convertLevelToScore(level: ImportanceLevel): number {
    return ImportanceConverter.levelToScore(level);
  }
  
  /**
   * Ensure both importance fields are set in metadata
   * 
   * @param metadata Object containing importance fields
   * @returns Updated object with both fields set
   */
  ensureBothImportanceFields<T extends { importance?: ImportanceLevel; importance_score?: number }>(
    metadata: T
  ): T {
    return ImportanceConverter.ensureBothFields(metadata);
  }
  
  /**
   * Calculate importance using hybrid approach
   * Uses rule-based first, then LLM if confidence is low
   * 
   * @param request The calculation request
   * @returns Calculation response from appropriate calculator
   */
  private async calculateWithHybridMode(
    request: ImportanceCalculationRequest
  ): Promise<ImportanceCalculationResponse> {
    // First use rule-based calculator (fast)
    const ruleBasedResult = await this.ruleBasedCalculator.calculateImportance(request);
    
    // Determine if we need LLM calculation
    const needsLLM = this.shouldUseLLM(request, ruleBasedResult);
    
    if (needsLLM) {
      // Use LLM for more accurate assessment
      return this.llmCalculator.calculateImportance(request);
    }
    
    // Rule-based was sufficient
    return ruleBasedResult;
  }
  
  /**
   * Determine if LLM should be used for this calculation
   * based on confidence in rule-based result
   * 
   * @param request Original calculation request
   * @param ruleBasedResult Result from rule-based calculator
   * @returns Whether LLM should be used
   */
  private shouldUseLLM(
    request: ImportanceCalculationRequest,
    ruleBasedResult: ImportanceCalculationResponse
  ): boolean {
    // Check if score is in boundary areas (close to threshold)
    const score = ruleBasedResult.importance_score;
    const isNearThreshold = [0.25, 0.35, 0.55, 0.65, 0.85, 0.95].some(
      threshold => Math.abs(score - threshold) < 0.1
    );
    
    // Check if content is potentially important based on certain criteria
    const isPotentiallyImportant = 
      // Check content length (longer content might need more accurate analysis)
      request.content.length > 300 ||
      // Check if there are multiple keywords (might need disambiguation)
      ruleBasedResult.keywords.length > 3 ||
      // Check if content has certain important patterns
      /\d{4}-\d{2}-\d{2}/.test(request.content) || // Contains dates
      /\d+(\.\d+)?%/.test(request.content) ||      // Contains percentages
      /\$\s*\d+/.test(request.content);            // Contains dollar amounts
    
    // Use LLM if near threshold or potentially important
    return isNearThreshold || isPotentiallyImportant;
  }
} 