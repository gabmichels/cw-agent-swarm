/**
 * Enhanced Quality Scorer for Tool Response Formatter Phase 5
 * 
 * Provides advanced quality assessment with user engagement prediction,
 * business value analysis, and adaptive scoring based on historical data.
 * 
 * Features:
 * - Multi-dimensional quality assessment
 * - User engagement prediction
 * - Business value alignment scoring
 * - Follow-up likelihood analysis
 * - Task completion probability
 * - Adaptive learning from user feedback
 */

import { createLogger } from '../../lib/logging/winston-logger';
import {
  EnhancedQualityMetrics,
  QualityWeightConfiguration,
  ResponseStyleType,
  ToolCategory,
  ToolResponseContext,
  ULID,
  UserFeedbackData
} from './types';

/**
 * Enhanced quality scorer with machine learning capabilities
 */
export class EnhancedQualityScorer {
  private readonly logger: ReturnType<typeof createLogger>;
  private qualityHistory: Map<string, QualityHistoryEntry[]> = new Map();
  private userFeedbackData: Map<string, UserFeedbackData[]> = new Map();
  private categoryWeights: Map<ToolCategory, QualityWeightConfiguration> = new Map();

  constructor() {
    this.logger = createLogger({
      moduleId: 'enhanced-quality-scorer'
    });
    this.initializeDefaultWeights();
  }

  /**
   * Calculate enhanced quality metrics for a response
   */
  async calculateEnhancedQuality(
    response: string,
    context: ToolResponseContext,
    weights?: Partial<QualityWeightConfiguration>
  ): Promise<EnhancedQualityMetrics> {
    const effectiveWeights = this.getEffectiveWeights(context.toolCategory, weights);

    try {
      // Calculate base quality metrics
      const contextRelevance = this.calculateContextRelevance(response, context);
      const personaConsistency = this.calculatePersonaConsistency(response, context);
      const clarityScore = this.calculateClarityScore(response, context);
      const actionabilityScore = this.calculateActionabilityScore(response, context);

      // Calculate enhanced metrics
      const lengthOptimization = this.calculateLengthOptimization(response, context);
      const emojiAppropriatenesss = this.calculateEmojiAppropriateness(response, context);
      const businessValueAlignment = this.calculateBusinessValueAlignment(response, context);
      const userEngagementPrediction = this.calculateUserEngagementPrediction(response, context);
      const followUpLikelihood = this.calculateFollowUpLikelihood(response, context);
      const taskCompletionProbability = this.calculateTaskCompletionProbability(response, context);

      // Calculate weighted overall score
      const overallScore = this.calculateWeightedScore({
        contextRelevance,
        personaConsistency,
        clarityScore,
        actionabilityScore,
        lengthOptimization,
        emojiAppropriatenesss,
        businessValueAlignment,
        userEngagementPrediction
      }, effectiveWeights);

      const enhancedMetrics: EnhancedQualityMetrics = {
        contextRelevance,
        personaConsistency,
        clarityScore,
        actionabilityScore,
        overallScore,
        lengthOptimization,
        emojiAppropriatenesss,
        businessValueAlignment,
        userEngagementPrediction,
        followUpLikelihood,
        taskCompletionProbability
      };

      // Store quality history for learning
      await this.storeQualityHistory(context, enhancedMetrics);

      this.logger.debug('Enhanced quality metrics calculated', {
        contextId: context.id,
        overallScore,
        metrics: enhancedMetrics
      });

      return enhancedMetrics;

    } catch (error) {
      this.logger.error('Enhanced quality calculation failed', {
        contextId: context.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Fallback to basic scoring
      return this.calculateFallbackQuality(response, context);
    }
  }

  /**
   * Calculate context relevance score
   */
  private calculateContextRelevance(response: string, context: ToolResponseContext): number {
    let score = 0.5; // Base score

    const lowerResponse = response.toLowerCase();
    const toolId = context.toolResult.toolId.toLowerCase();
    const intent = context.executionIntent.toLowerCase();
    const originalMessage = context.originalUserMessage.toLowerCase();

    // Tool mention relevance (0.25 max)
    if (lowerResponse.includes(toolId)) score += 0.15;
    if (lowerResponse.includes(toolId.replace('_', ' '))) score += 0.1;

    // Intent relevance (0.25 max)
    const intentWords = intent.split(' ').filter(word => word.length > 2);
    const matchedIntentWords = intentWords.filter(word => lowerResponse.includes(word));
    score += (matchedIntentWords.length / Math.max(intentWords.length, 1)) * 0.25;

    // Original message relevance (0.25 max)
    const messageWords = originalMessage.split(' ').filter(word => word.length > 2);
    const matchedMessageWords = messageWords.filter(word => lowerResponse.includes(word));
    score += (matchedMessageWords.length / Math.max(messageWords.length, 1)) * 0.25;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate persona consistency score
   */
  private calculatePersonaConsistency(response: string, context: ToolResponseContext): number {
    let score = 0.7; // Base score assuming reasonable consistency

    const persona = context.agentPersona;
    const responseStyle = context.responseConfig.responseStyle;

    // Communication style consistency
    if (persona.communicationStyle) {
      score += this.evaluateCommunicationStyleConsistency(response, persona.communicationStyle) * 0.2;
    }

    // Response style adherence
    score += this.evaluateResponseStyleAdherence(response, responseStyle) * 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate clarity score based on readability and structure
   */
  private calculateClarityScore(response: string, context: ToolResponseContext): number {
    let score = 0.5; // Base score

    // Sentence length analysis (0.2 max)
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / sentences.length;
    if (avgSentenceLength <= 20) score += 0.2;
    else if (avgSentenceLength <= 30) score += 0.1;

    // Structure indicators (0.2 max)
    if (response.includes('\n') || response.includes('-') || response.includes('•')) score += 0.1;
    if (response.match(/\d+\./)) score += 0.1; // Numbered lists

    // Jargon and complexity (0.1 max)
    const complexWords = response.match(/\b\w{10,}\b/g) || [];
    if (complexWords.length / response.split(' ').length < 0.1) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate actionability score
   */
  private calculateActionabilityScore(response: string, context: ToolResponseContext): number {
    let score = 0.3; // Base score

    const lowerResponse = response.toLowerCase();

    // Action words and phrases (0.3 max)
    const actionIndicators = [
      'next', 'should', 'can', 'try', 'consider', 'recommend', 'suggest',
      'follow up', 'continue', 'proceed', 'check', 'review', 'update'
    ];
    const foundActions = actionIndicators.filter(indicator => lowerResponse.includes(indicator));
    score += Math.min(foundActions.length * 0.05, 0.3);

    // Question indicators (0.2 max)
    const questionCount = (response.match(/\?/g) || []).length;
    score += Math.min(questionCount * 0.1, 0.2);

    // Next steps language (0.2 max)
    if (lowerResponse.includes('next step') || lowerResponse.includes('what would you like')) score += 0.1;
    if (lowerResponse.includes('i can help') || lowerResponse.includes('would you like me to')) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate length optimization score
   */
  private calculateLengthOptimization(response: string, context: ToolResponseContext): number {
    const currentLength = response.length;
    const maxLength = context.responseConfig.maxResponseLength;
    const optimalLength = maxLength * 0.75; // 75% of max is considered optimal

    // Calculate how close to optimal length
    const lengthRatio = currentLength / optimalLength;

    if (lengthRatio >= 0.7 && lengthRatio <= 1.3) {
      return 1.0; // Optimal range
    } else if (lengthRatio >= 0.5 && lengthRatio <= 1.5) {
      return 0.8; // Good range
    } else if (lengthRatio >= 0.3 && lengthRatio <= 2.0) {
      return 0.6; // Acceptable range
    } else {
      return 0.3; // Poor length optimization
    }
  }

  /**
   * Calculate emoji appropriateness score
   */
  private calculateEmojiAppropriateness(response: string, context: ToolResponseContext): number {
    const emojiCount = (response.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
    const shouldIncludeEmojis = context.responseConfig.includeEmojis;
    const responseStyle = context.responseConfig.responseStyle;

    if (!shouldIncludeEmojis) {
      return emojiCount === 0 ? 1.0 : 0.5; // Penalize emoji use when not desired
    }

    // Evaluate emoji appropriateness based on style
    if (responseStyle === 'business' || responseStyle === 'technical') {
      return emojiCount <= 1 ? 1.0 : 0.7; // Minimal emojis for professional styles
    }

    if (responseStyle === 'casual' || responseStyle === 'conversational') {
      if (emojiCount >= 1 && emojiCount <= 3) return 1.0; // Good emoji usage
      if (emojiCount === 0 || emojiCount > 5) return 0.6; // Too few or too many
    }

    return 0.8; // Default reasonable score
  }

  /**
   * Calculate business value alignment score
   */
  private calculateBusinessValueAlignment(response: string, context: ToolResponseContext): number {
    let score = 0.5; // Base score

    const lowerResponse = response.toLowerCase();

    // Business value indicators
    const businessTerms = [
      'efficiency', 'productivity', 'save time', 'automate', 'streamline',
      'improve', 'optimize', 'reduce cost', 'roi', 'value', 'benefit',
      'success', 'complete', 'achieve', 'accomplish', 'deliver'
    ];

    const foundTerms = businessTerms.filter(term => lowerResponse.includes(term));
    score += Math.min(foundTerms.length * 0.08, 0.4);

    // Outcome focus
    if (lowerResponse.includes('result') || lowerResponse.includes('outcome')) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate user engagement prediction score
   */
  private calculateUserEngagementPrediction(response: string, context: ToolResponseContext): number {
    let score = 0.5; // Base score

    // Engagement indicators
    const engagementFactors = [
      response.includes('?'), // Questions encourage engagement
      response.includes('!'), // Enthusiasm
      response.length > 50, // Sufficient detail
      response.includes('you'), // Direct address
      response.includes('would you like'), // Offers
      response.includes('let me know'), // Follow-up invitation
    ];

    const engagementCount = engagementFactors.filter(Boolean).length;
    score += engagementCount * 0.08;

    // Historical engagement data (if available)
    const userHistory = this.getUserEngagementHistory(context.userId, context.agentId);
    if (userHistory) {
      score += userHistory.averageEngagement * 0.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate follow-up likelihood
   */
  private calculateFollowUpLikelihood(response: string, context: ToolResponseContext): number {
    let score = 0.3; // Base score

    const lowerResponse = response.toLowerCase();

    // Follow-up indicators
    if (lowerResponse.includes('next')) score += 0.2;
    if (lowerResponse.includes('?')) score += 0.2;
    if (lowerResponse.includes('would you like')) score += 0.2;
    if (lowerResponse.includes('anything else')) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate task completion probability
   */
  private calculateTaskCompletionProbability(response: string, context: ToolResponseContext): number {
    let score = 0.5; // Base score

    // Success indicators
    if (context.toolResult.success) score += 0.3;

    // Completion language
    const lowerResponse = response.toLowerCase();
    if (lowerResponse.includes('completed') || lowerResponse.includes('finished')) score += 0.2;
    if (lowerResponse.includes('successfully') || lowerResponse.includes('done')) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Initialize default quality weights for different tool categories
   */
  private initializeDefaultWeights(): void {
    const defaultWeights: QualityWeightConfiguration = {
      contextRelevance: 0.25,
      personaConsistency: 0.15,
      clarityScore: 0.15,
      actionabilityScore: 0.15,
      lengthOptimization: 0.10,
      emojiAppropriateness: 0.05,
      businessValueAlignment: 0.10,
      userEngagementPrediction: 0.05
    };

    // Category-specific weight adjustments
    this.categoryWeights.set(ToolCategory.WORKSPACE, {
      ...defaultWeights,
      businessValueAlignment: 0.20, // Higher for business tools
      actionabilityScore: 0.20
    });

    this.categoryWeights.set(ToolCategory.SOCIAL_MEDIA, {
      ...defaultWeights,
      userEngagementPrediction: 0.15, // Higher for social media
      emojiAppropriateness: 0.10
    });

    this.categoryWeights.set(ToolCategory.EXTERNAL_API, {
      ...defaultWeights,
      clarityScore: 0.25, // Higher for technical APIs
      contextRelevance: 0.30
    });

    this.categoryWeights.set(ToolCategory.WORKFLOW, {
      ...defaultWeights,
      actionabilityScore: 0.25, // Higher for workflow tools
      businessValueAlignment: 0.15
    });

    this.categoryWeights.set(ToolCategory.RESEARCH, {
      ...defaultWeights,
      clarityScore: 0.20, // Higher for research clarity
      contextRelevance: 0.30
    });
  }

  /**
   * Get effective weights for quality calculation
   */
  private getEffectiveWeights(
    category: ToolCategory,
    overrides?: Partial<QualityWeightConfiguration>
  ): QualityWeightConfiguration {
    const baseWeights = this.categoryWeights.get(category) || this.categoryWeights.get(ToolCategory.CUSTOM)!;

    if (!overrides) {
      return baseWeights;
    }

    return {
      ...baseWeights,
      ...overrides
    };
  }

  /**
   * Calculate weighted overall score
   */
  private calculateWeightedScore(
    metrics: Record<string, number>,
    weights: QualityWeightConfiguration
  ): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [key, weight] of Object.entries(weights)) {
      if (metrics[key] !== undefined) {
        totalScore += metrics[key] * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0.5;
  }

  /**
   * Store quality history for learning and improvement
   */
  private async storeQualityHistory(
    context: ToolResponseContext,
    metrics: EnhancedQualityMetrics
  ): Promise<void> {
    const key = `${context.agentId}:${context.toolCategory}`;

    if (!this.qualityHistory.has(key)) {
      this.qualityHistory.set(key, []);
    }

    const history = this.qualityHistory.get(key)!;
    history.push({
      timestamp: new Date(),
      contextId: context.id,
      metrics,
      responseStyle: context.responseConfig.responseStyle
    });

    // Keep only recent history (last 100 entries)
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  /**
   * Get user engagement history for prediction
   */
  private getUserEngagementHistory(userId: string, agentId: string): { averageEngagement: number } | null {
    const feedbacks = this.userFeedbackData.get(userId) || [];

    if (feedbacks.length === 0) {
      return null;
    }

    const averageRating = feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length;
    return {
      averageEngagement: averageRating / 5 // Normalize to 0-1 scale
    };
  }

  /**
   * Calculate fallback quality metrics
   */
  private calculateFallbackQuality(response: string, context: ToolResponseContext): EnhancedQualityMetrics {
    const baseScore = 0.6; // Conservative fallback score

    return {
      contextRelevance: baseScore,
      personaConsistency: baseScore,
      clarityScore: baseScore,
      actionabilityScore: baseScore,
      overallScore: baseScore,
      lengthOptimization: baseScore,
      emojiAppropriatenesss: baseScore,
      businessValueAlignment: baseScore,
      userEngagementPrediction: baseScore,
      followUpLikelihood: baseScore,
      taskCompletionProbability: baseScore
    };
  }

  /**
   * Evaluate communication style consistency
   */
  private evaluateCommunicationStyleConsistency(response: string, style: string): number {
    // Implementation would analyze response tone, vocabulary, and structure
    // against the expected communication style
    return 0.8; // Placeholder implementation
  }

  /**
   * Evaluate response style adherence
   */
  private evaluateResponseStyleAdherence(response: string, style: ResponseStyleType): number {
    // Implementation would check response characteristics against style requirements
    return 0.8; // Placeholder implementation
  }
}

/**
 * Quality history entry for learning and improvement
 */
interface QualityHistoryEntry {
  readonly timestamp: Date;
  readonly contextId: ULID;
  readonly metrics: EnhancedQualityMetrics;
  readonly responseStyle: ResponseStyleType;
} 