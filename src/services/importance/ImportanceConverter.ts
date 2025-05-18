import { ImportanceLevel } from '../../constants/memory';

/**
 * Utility class for bidirectional conversion between numeric importance scores
 * and categorical ImportanceLevel values.
 */
export class ImportanceConverter {
  /**
   * Convert numeric importance score to ImportanceLevel enum
   * 
   * @param score Numeric importance score (0-1)
   * @returns The corresponding ImportanceLevel
   */
  static scoreToLevel(score: number): ImportanceLevel {
    if (score >= 0.9) return ImportanceLevel.CRITICAL;
    if (score >= 0.6) return ImportanceLevel.HIGH;
    if (score >= 0.3) return ImportanceLevel.MEDIUM;
    return ImportanceLevel.LOW;
  }

  /**
   * Convert ImportanceLevel enum to a representative score
   * 
   * @param level ImportanceLevel enum value
   * @returns Representative numeric score (0-1)
   */
  static levelToScore(level: ImportanceLevel): number {
    switch (level) {
      case ImportanceLevel.CRITICAL: return 0.95;
      case ImportanceLevel.HIGH: return 0.75;
      case ImportanceLevel.MEDIUM: return 0.5;
      case ImportanceLevel.LOW: return 0.25;
      default: return 0.5;
    }
  }
  
  /**
   * Ensure both importance fields are properly set
   * 
   * @param metadata Metadata object containing importance fields
   * @returns Updated metadata with both importance fields set
   */
  static ensureBothFields<T extends { importance?: ImportanceLevel; importance_score?: number }>(
    metadata: T
  ): T {
    const result = { ...metadata };
    
    // If importance_score is provided but not importance
    if (result.importance_score !== undefined && result.importance === undefined) {
      result.importance = this.scoreToLevel(result.importance_score);
    }
    // If importance is provided but not importance_score
    else if (result.importance !== undefined && result.importance_score === undefined) {
      result.importance_score = this.levelToScore(result.importance);
    }
    
    return result;
  }
} 