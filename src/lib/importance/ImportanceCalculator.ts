/**
 * ImportanceCalculator.ts
 * 
 * This module provides utilities for calculating importance scores and levels for different types of content.
 */

import { ImportanceLevel } from '../../constants/memory';

/**
 * Calculation mode for importance scoring
 */
export enum ImportanceCalculationMode {
  RULE_BASED = 'rule_based',
  LLM_BASED = 'llm_based',
  HYBRID = 'hybrid'
}

/**
 * Content to calculate importance for
 */
export interface ImportanceCalculationContent {
  /**
   * The content to evaluate
   */
  content: string;
  
  /**
   * Type of content (message, document, thought, etc.)
   */
  contentType: string;
  
  /**
   * Source of the content
   */
  source: string;
  
  /**
   * Optional existing score to incorporate (0-1)
   */
  existingScore?: number;
  
  /**
   * Optional tags for the content
   */
  tags?: string[];
  
  /**
   * Optional additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Result of importance calculation
 */
export interface ImportanceCalculationResult {
  /**
   * Importance level category
   */
  importance: ImportanceLevel;
  
  /**
   * Numerical importance score (0-1)
   */
  importance_score: number;
  
  /**
   * Confidence in the calculation (0-1)
   */
  confidence: number;
  
  /**
   * Extracted keywords that influenced the score
   */
  keywords: string[];
  
  /**
   * Reasoning behind the importance calculation
   */
  reasoning: string;
}

/**
 * Service for calculating importance of content
 */
export class ImportanceCalculator {
  /**
   * Calculate importance of content
   * 
   * @param content Content to evaluate
   * @param mode Calculation mode to use
   * @returns Promise resolving to importance calculation result
   */
  async calculateImportance(
    content: ImportanceCalculationContent,
    mode: ImportanceCalculationMode = ImportanceCalculationMode.HYBRID
  ): Promise<ImportanceCalculationResult> {
    // Basic implementation - would typically have more sophisticated logic
    const score = content.existingScore ?? 0.5;
    
    return {
      importance: this.convertScoreToLevel(score),
      importance_score: score,
      confidence: 0.8,
      keywords: [],
      reasoning: "Basic importance calculation"
    };
  }
  
  /**
   * Convert numerical score to ImportanceLevel
   * 
   * @param score Numerical score (0-1)
   * @returns Corresponding ImportanceLevel
   */
  convertScoreToLevel(score: number): ImportanceLevel {
    if (score >= 0.8) return ImportanceLevel.CRITICAL;
    if (score >= 0.6) return ImportanceLevel.HIGH;
    if (score >= 0.4) return ImportanceLevel.MEDIUM;
    return ImportanceLevel.LOW;
  }
  
  /**
   * Convert ImportanceLevel to numerical score
   * 
   * @param level ImportanceLevel to convert
   * @returns Corresponding numerical score
   */
  convertLevelToScore(level: ImportanceLevel): number {
    switch (level) {
      case ImportanceLevel.CRITICAL: return 0.9;
      case ImportanceLevel.HIGH: return 0.7;
      case ImportanceLevel.MEDIUM: return 0.5;
      case ImportanceLevel.LOW: return 0.3;
      default: return 0.5;
    }
  }
}

// Export a default singleton instance
export const importanceCalculator = new ImportanceCalculator(); 