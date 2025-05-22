/**
 * ImportanceCalculatorService.ts
 * 
 * Service for calculating importance of content using various strategies.
 */

import { ImportanceLevel } from '../../constants/memory';
import { ImportanceCalculator, ImportanceCalculationContent, ImportanceCalculationMode, ImportanceCalculationResult } from './ImportanceCalculator';

/**
 * Service for calculating importance of content using different strategies
 */
export class ImportanceCalculatorService {
  private calculator: ImportanceCalculator;
  
  /**
   * Rule-based calculator for importance
   */
  public readonly ruleBasedCalculator: any;
  
  /**
   * LLM-based calculator for importance
   */
  public readonly llmCalculator: any;
  
  /**
   * Default calculation mode
   */
  public readonly defaultMode: ImportanceCalculationMode = ImportanceCalculationMode.HYBRID;
  
  /**
   * Confidence threshold for hybrid mode
   */
  public readonly hybridConfidenceThreshold: number = 0.7;
  
  /**
   * Constructor
   */
  constructor() {
    this.calculator = new ImportanceCalculator();
    this.ruleBasedCalculator = {};
    this.llmCalculator = {};
  }
  
  /**
   * Calculate importance of content
   * 
   * @param content Content to evaluate
   * @param mode Calculation mode to use
   * @returns Promise resolving to importance calculation result
   */
  async calculateImportance(
    content: ImportanceCalculationContent,
    mode: ImportanceCalculationMode = this.defaultMode
  ): Promise<ImportanceCalculationResult> {
    return this.calculator.calculateImportance(content, mode);
  }
  
  /**
   * Convert numerical score to ImportanceLevel
   * 
   * @param score Numerical score (0-1)
   * @returns Corresponding ImportanceLevel
   */
  convertScoreToLevel(score: number): ImportanceLevel {
    return this.calculator.convertScoreToLevel(score);
  }
  
  /**
   * Convert ImportanceLevel to numerical score
   * 
   * @param level ImportanceLevel to convert
   * @returns Corresponding numerical score
   */
  convertLevelToScore(level: ImportanceLevel): number {
    return this.calculator.convertLevelToScore(level);
  }
  
  /**
   * Ensure both importance score and level are present in an object
   * 
   * @param obj Object with importance data
   * @returns Object with both importance score and level
   */
  ensureBothImportanceFields(obj: any): any {
    if (!obj) return obj;
    
    const result = { ...obj };
    
    if (result.importance && result.importance_score === undefined) {
      result.importance_score = this.convertLevelToScore(result.importance);
    } else if (result.importance_score !== undefined && !result.importance) {
      result.importance = this.convertScoreToLevel(result.importance_score);
    }
    
    return result;
  }
}

// Export a default singleton instance
export const importanceCalculatorService = new ImportanceCalculatorService(); 