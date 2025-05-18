import { ImportanceLevel } from '../../constants/memory';
import { ImportanceCalculationRequest, ImportanceCalculationResponse, IImportanceCalculator, RuleBasedCalculatorOptions } from './types';
import { ImportanceConverter } from './ImportanceConverter';

/**
 * Rule-based implementation of importance calculation
 * Uses keyword matching, content analysis, and heuristics
 * to determine importance without requiring LLM calls
 */
export class RuleBasedImportanceCalculator implements IImportanceCalculator {
  // Default keyword weights for different importance levels
  private keywordWeights = {
    critical: [
      'urgent', 'critical', 'emergency', 'immediate', 'crucial', 'vital',
      'security', 'breach', 'violation', 'danger', 'threat', 'risk',
      'password', 'credentials', 'authentication', 'deadline'
    ],
    high: [
      'important', 'significant', 'key', 'essential', 'remember', 'priority',
      'deadline', 'required', 'necessary', 'needed', 'mandate',
      'budget', 'financial', 'payment', 'cost', 'pricing', 'money',
      'exceed', 'limit', 'constraint', 'restriction'  // Added budget-related constraint terms
    ],
    medium: [
      'relevant', 'useful', 'helpful', 'informative', 'valuable', 'worth', 
      'consider', 'note', 'remember', 'update', 'change', 'modify',
      'plan', 'strategy', 'approach', 'method'
    ],
    low: [
      'minor', 'trivial', 'optional', 'later', 'fyi', 'suggestion', 
      'thought', 'idea', 'maybe', 'perhaps', 'whenever', 'sometime'
    ]
  };
  
  // Default factor weights for importance calculation
  private factorWeights = {
    keywordMatch: 0.6,    // Keyword matching has highest influence
    contentLength: 0.1,   // Content length has minor influence
    tagQuality: 0.2,      // Tags have moderate influence
    sourceType: 0.1       // Source type has minor influence
  };
  
  // Source type weights
  private sourceWeights: Record<string, number> = {
    'user': 0.8,          // User content is high importance
    'agent': 0.5,         // Agent-generated content is medium importance
    'system': 0.6,        // System information is medium-high importance
    'file': 0.9,          // File content is high importance
    'document': 0.9,      // Document content is high importance
    'external': 0.6       // External content is medium importance
  };

  /**
   * Create a new rule-based importance calculator
   * 
   * @param options Optional configuration to customize calculator behavior
   */
  constructor(options?: RuleBasedCalculatorOptions) {
    // Apply custom options if provided
    if (options?.keywordWeights) {
      this.keywordWeights = {
        ...this.keywordWeights,
        ...options.keywordWeights
      };
    }
    
    if (options?.factorWeights) {
      this.factorWeights = {
        ...this.factorWeights,
        ...options.factorWeights
      };
    }
  }

  /**
   * Calculate importance for the given content using rule-based approach
   * 
   * @param request The calculation request parameters
   * @returns Promise resolving to calculation response
   */
  async calculateImportance(request: ImportanceCalculationRequest): Promise<ImportanceCalculationResponse> {
    // Final score will be between 0 and 1
    let score = 0;
    const matchedKeywords: string[] = [];
    
    // 1. Check for keyword matches
    const keywordScore = this.calculateKeywordScore(request.content, matchedKeywords);
    score += keywordScore * this.factorWeights.keywordMatch;
    
    // 2. Factor in content length
    if (request.content) {
      const contentLength = request.content.length;
      // Normalize length: longer is better (up to 1000 chars)
      const normalizedLength = Math.min(contentLength / 1000, 1.0);
      score += normalizedLength * this.factorWeights.contentLength;
    }
    
    // 3. Factor in tag quality
    if (request.tags && request.tags.length > 0) {
      const tagQualityScore = this.calculateTagQualityScore(request.tags);
      score += tagQualityScore * this.factorWeights.tagQuality;
    }
    
    // 4. Factor in source type
    if (request.source && this.sourceWeights[request.source]) {
      score += this.sourceWeights[request.source] * this.factorWeights.sourceType;
    }
    
    // 5. Check for critical keywords that should override the score
    const hasCriticalKeywords = this.keywordWeights.critical.some(
      keyword => request.content.toLowerCase().includes(keyword)
    );
    if (hasCriticalKeywords) {
      // If critical keywords are present, boost the score to ensure CRITICAL level
      score = Math.max(score, 0.9);
    }
    
    // Ensure score is between 0 and 1
    score = Math.max(0, Math.min(1, score));
    
    // Convert to importance level
    const importance_level = ImportanceConverter.scoreToLevel(score);
    
    // Generate reasoning text
    const reasoning = this.generateReasoning(score, matchedKeywords, request);
    
    return {
      importance_score: score,
      importance_level,
      reasoning,
      is_critical: importance_level === ImportanceLevel.CRITICAL,
      keywords: matchedKeywords
    };
  }
  
  /**
   * Calculate score based on keyword presence
   * 
   * @param content The content to analyze
   * @param matchedKeywords Array to populate with matched keywords
   * @returns Score between 0 and 1 based on keyword matches
   */
  private calculateKeywordScore(content: string, matchedKeywords: string[]): number {
    if (!content) return 0;
    
    const lowercaseContent = content.toLowerCase();
    let score = 0;
    
    // Check for critical keywords - highest weight
    const criticalMatches = this.keywordWeights.critical.filter(
      keyword => {
        if (lowercaseContent.includes(keyword)) {
          matchedKeywords.push(keyword);
          return true;
        }
        return false;
      }
    );
    if (criticalMatches.length > 0) {
      score += Math.min(criticalMatches.length / 2, 1) * 0.9; // 90% weight for critical
    }
    
    // Check for high importance keywords
    const highMatches = this.keywordWeights.high.filter(
      keyword => {
        if (lowercaseContent.includes(keyword)) {
          matchedKeywords.push(keyword);
          return true;
        }
        return false;
      }
    );
    if (highMatches.length > 0) {
      // Give extra weight to budget-related keywords
      const budgetKeywords = ['budget', 'financial', 'cost', 'money', 'payment', 'pricing'];
      const hasBudgetKeywords = highMatches.some(kw => budgetKeywords.includes(kw));
      if (hasBudgetKeywords) {
        score += Math.min(highMatches.length / 2, 1) * 0.8; // 80% weight for budget-related
      } else {
        score += Math.min(highMatches.length / 3, 1) * 0.6; // 60% weight for other high
      }
    }
    
    // Check for medium importance keywords
    const mediumMatches = this.keywordWeights.medium.filter(
      keyword => {
        if (lowercaseContent.includes(keyword)) {
          matchedKeywords.push(keyword);
          return true;
        }
        return false;
      }
    );
    if (mediumMatches.length > 0) {
      // Boost medium importance score to ensure it reaches MEDIUM level
      score = Math.max(score, 0.4); // Ensure at least MEDIUM level (increased from 0.3)
      score += Math.min(mediumMatches.length / 3, 1) * 0.4; // Additional weight for more matches (increased from 0.3)
    }
    
    // Apply a penalty for low importance keywords
    const lowMatches = this.keywordWeights.low.filter(
      keyword => {
        if (lowercaseContent.includes(keyword)) {
          matchedKeywords.push(keyword);
          return true;
        }
        return false;
      }
    );
    if (lowMatches.length > 0) {
      score -= Math.min(lowMatches.length / 4, 0.5) * 0.2; // 20% penalty for low
    }
    
    // Ensure score is within 0-1 range
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * Calculate score based on tag quality
   * 
   * @param tags Array of tags to evaluate
   * @returns Score between 0 and 1 based on tag quality
   */
  private calculateTagQualityScore(tags: string[]): number {
    // If no tags, return minimum score
    if (!tags || tags.length === 0) {
      return 0;
    }
    
    // For simple string tags, use count as a quality indicator
    // More tags suggest better tagging quality (up to 10 tags)
    const countFactor = Math.min(tags.length / 10, 1) * 0.7;
    
    // Average tag length as a quality indicator
    // Longer tags tend to be more specific and meaningful
    const avgTagLength = tags.reduce((sum, tag) => sum + tag.length, 0) / tags.length;
    const lengthFactor = Math.min(avgTagLength / 10, 1) * 0.3;
    
    return Math.min(countFactor + lengthFactor, 1);
  }
  
  /**
   * Generate reasoning text to explain importance calculation
   * 
   * @param score The calculated importance score
   * @param matchedKeywords Keywords that matched in the content
   * @param request The original calculation request
   * @returns Human-readable explanation of importance calculation
   */
  private generateReasoning(
    score: number, 
    matchedKeywords: string[], 
    request: ImportanceCalculationRequest
  ): string {
    // Create explanatory text based on score and matched keywords
    let reasoning = `Importance score: ${score.toFixed(2)} (${ImportanceConverter.scoreToLevel(score)})`;
    
    if (matchedKeywords.length > 0) {
      reasoning += `. Contains important keywords: ${matchedKeywords.join(', ')}`;
    }
    
    if (request.source) {
      reasoning += `. Source type '${request.source}' contributes to importance.`;
    }
    
    if (request.tags && request.tags.length > 0) {
      reasoning += ` Tagged with ${request.tags.length} relevant tags.`;
    }
    
    if (score >= 0.9) {
      reasoning += ' Requires immediate attention due to critical nature.';
    } else if (score >= 0.6) {
      reasoning += ' Contains highly important information.';
    } else if (score >= 0.3) {
      reasoning += ' Contains moderately important information.';
    } else {
      reasoning += ' Contains routine or minor information.';
    }
    
    return reasoning;
  }
} 