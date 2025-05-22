/**
 * ImportanceCalculator for FeedbackMemoryManager
 */

import { ImportanceLevel } from '../../constants/memory';

/**
 * Simple importance calculator for feedback memories
 */
export class ImportanceCalculator {
  /**
   * Calculate importance score for feedback
   * 
   * @param content Feedback content
   * @param metadata Additional metadata
   * @returns Importance score between 0 and 1
   */
  calculateImportance(content: string, metadata?: Record<string, any>): number {
    // Simple heuristic - can be expanded with more sophisticated logic
    let score = 0.5; // Default medium importance
    
    // Keywords indicating higher importance
    const highImportanceKeywords = [
      'critical', 'urgent', 'important', 'issue', 'bug', 'error',
      'broken', 'failed', 'crash', 'problem', 'serious', 'major'
    ];
    
    // Keywords indicating lower importance
    const lowImportanceKeywords = [
      'minor', 'trivial', 'cosmetic', 'suggestion', 'consider', 'nice to have',
      'maybe', 'when you have time', 'nitpick', 'small', 'tiny'
    ];
    
    // Check for high importance keywords
    for (const keyword of highImportanceKeywords) {
      if (content.toLowerCase().includes(keyword)) {
        score += 0.1;
      }
    }
    
    // Check for low importance keywords
    for (const keyword of lowImportanceKeywords) {
      if (content.toLowerCase().includes(keyword)) {
        score -= 0.1;
      }
    }
    
    // Apply metadata modifiers if available
    if (metadata) {
      // Explicit importance overrides calculation
      if (metadata.importance !== undefined) {
        return typeof metadata.importance === 'number' 
          ? metadata.importance 
          : this.importanceLevelToScore(metadata.importance as ImportanceLevel);
      }
      
      // User-provided priority
      if (metadata.priority !== undefined) {
        const priority = Number(metadata.priority);
        if (!isNaN(priority)) {
          score += (priority / 10); // Assuming priority is 0-10
        }
      }
      
      // Error-related feedback is more important
      if (metadata.isError) {
        score += 0.2;
      }
    }
    
    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * Convert importance score to ImportanceLevel
   * 
   * @param score Numerical score (0-1)
   * @returns Corresponding ImportanceLevel
   */
  scoreToImportanceLevel(score: number): ImportanceLevel {
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
  importanceLevelToScore(level: ImportanceLevel): number {
    switch (level) {
      case ImportanceLevel.CRITICAL: return 0.9;
      case ImportanceLevel.HIGH: return 0.7;
      case ImportanceLevel.MEDIUM: return 0.5;
      case ImportanceLevel.LOW: return 0.3;
      default: return 0.5;
    }
  }
} 