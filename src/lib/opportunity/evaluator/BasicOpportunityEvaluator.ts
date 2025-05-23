/**
 * BasicOpportunityEvaluator.ts
 * 
 * Implements a basic opportunity evaluator with scoring functionality.
 */

import { 
  Opportunity,
  OpportunityScore,
  OpportunityPriority,
  TimeSensitivity,
  OpportunityType,
  OpportunitySource
} from '../models/opportunity.model';

import {
  OpportunityEvaluator,
  OpportunityEvaluatorConfig,
  OpportunityEvaluation,
  EvaluationResult
} from '../interfaces/OpportunityEvaluator.interface';

import { OpportunityEvaluationError } from '../errors/OpportunityError';

/**
 * Basic implementation of OpportunityEvaluator
 */
export class BasicOpportunityEvaluator implements OpportunityEvaluator {
  private initialized: boolean = false;
  private lastHealthCheck: Date = new Date();
  private config: Required<OpportunityEvaluatorConfig> = {
    priorityThresholds: {
      critical: 0.8,  // 80% and above is critical
      high: 0.65,     // 65% to 80% is high
      medium: 0.4,    // 40% to 65% is medium
                      // Below 40% is low
    },
    scoreWeights: {
      relevance: 0.2,
      actionability: 0.15,
      urgency: 0.25,
      impact: 0.2,
      confidence: 0.1,
      riskLevel: 0.05,
      resourceEfficiency: 0.05
    },
    timingSettings: {
      evaluationTimeoutMs: 5000,
      reevaluationIntervalMs: 3600000 // 1 hour
    },
    customRules: {}
  };

  /**
   * Initialize the evaluator
   */
  async initialize(config?: OpportunityEvaluatorConfig): Promise<boolean> {
    if (config) {
      // Merge provided config with defaults
      this.config = {
        priorityThresholds: {
          ...this.config.priorityThresholds,
          ...(config.priorityThresholds || {})
        },
        scoreWeights: {
          ...this.config.scoreWeights,
          ...(config.scoreWeights || {})
        },
        timingSettings: {
          ...this.config.timingSettings,
          ...(config.timingSettings || {})
        },
        customRules: config.customRules || {}
      };
    }
    
    this.initialized = true;
    this.lastHealthCheck = new Date();
    return true;
  }

  /**
   * Ensure the evaluator is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new OpportunityEvaluationError(
        'Evaluator not initialized',
        'EVALUATOR_NOT_INITIALIZED',
        { initialized: this.initialized }
      );
    }
  }

  /**
   * Evaluate an opportunity
   */
  async evaluateOpportunity(opportunity: Opportunity): Promise<EvaluationResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      // Set a timeout for evaluation
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new OpportunityEvaluationError(
            'Evaluation timeout',
            'EVALUATION_TIMEOUT',
            { timeoutMs: this.config.timingSettings.evaluationTimeoutMs }
          ));
        }, this.config.timingSettings.evaluationTimeoutMs);
      });
      
      // Score the opportunity
      const scorePromise = this.scoreOpportunity(opportunity);
      const score = await Promise.race([scorePromise, timeoutPromise]) as OpportunityScore;
      
      // Determine time sensitivity
      const timeSensitivityResult = await this.determineTimeSensitivity(opportunity);
      
      // Determine priority
      const priorityResult = await this.determinePriority(opportunity, score);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(opportunity);
      
      // Assess risks
      const riskAssessment = await this.assessRisks(opportunity);
      
      // Create evaluation
      const evaluation: OpportunityEvaluation = {
        opportunity,
        score,
        recommendedPriority: priorityResult.priority,
        recommendedTimeSensitivity: timeSensitivityResult.timeSensitivity,
        evaluatedAt: new Date(),
        insights: [
          timeSensitivityResult.explanation,
          priorityResult.explanation,
          `Overall score: ${score.overall.toFixed(2)}`
        ],
        recommendations,
        riskAssessment
      };
      
      // Create evaluation result
      const executionTime = Date.now() - startTime;
      
      return {
        evaluation,
        success: true,
        stats: {
          executionTimeMs: executionTime,
          evaluationDate: new Date()
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        evaluation: null as any, // Required by interface but we have an error
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stats: {
          executionTimeMs: executionTime,
          evaluationDate: new Date()
        }
      };
    }
  }

  /**
   * Score an opportunity
   */
  async scoreOpportunity(opportunity: Opportunity): Promise<OpportunityScore> {
    this.ensureInitialized();
    
    // Define base scores
    const baseScores = {
      relevance: this.calculateRelevanceScore(opportunity),
      actionability: this.calculateActionabilityScore(opportunity),
      urgency: this.calculateUrgencyScore(opportunity),
      impact: this.calculateImpactScore(opportunity),
      confidence: opportunity.trigger.confidence,
      riskLevel: this.calculateRiskScore(opportunity),
      resourceEfficiency: this.calculateResourceEfficiencyScore(opportunity)
    };
    
    // Apply weights
    const weights = this.config.scoreWeights;
    const weightedScores = {
      relevance: baseScores.relevance * weights.relevance,
      actionability: baseScores.actionability * weights.actionability,
      urgency: baseScores.urgency * weights.urgency,
      impact: baseScores.impact * weights.impact,
      confidence: baseScores.confidence * weights.confidence,
      riskLevel: (1 - baseScores.riskLevel) * weights.riskLevel, // Invert risk for overall score
      resourceEfficiency: baseScores.resourceEfficiency * weights.resourceEfficiency
    };
    
    // Calculate overall score
    const overall = Object.values(weightedScores).reduce((sum, score) => sum + score, 0);
    
    return {
      overall,
      relevance: baseScores.relevance,
      actionability: baseScores.actionability,
      urgency: baseScores.urgency,
      impact: baseScores.impact,
      confidence: baseScores.confidence,
      riskLevel: baseScores.riskLevel,
      resourceEfficiency: baseScores.resourceEfficiency
    };
  }

  /**
   * Calculate relevance score based on opportunity type and agent context
   */
  private calculateRelevanceScore(opportunity: Opportunity): number {
    // Higher relevance for certain types
    const typeRelevance: Record<OpportunityType, number> = {
      [OpportunityType.TASK_OPTIMIZATION]: 0.8,
      [OpportunityType.ERROR_PREVENTION]: 0.9,
      [OpportunityType.RESOURCE_OPTIMIZATION]: 0.7,
      [OpportunityType.USER_ASSISTANCE]: 0.85,
      [OpportunityType.SCHEDULE_OPTIMIZATION]: 0.75,
      [OpportunityType.KNOWLEDGE_ACQUISITION]: 0.7,
      [OpportunityType.MARKET_OPPORTUNITY]: 0.8,
      [OpportunityType.COLLABORATION]: 0.75,
      [OpportunityType.IMPROVEMENT]: 0.7,
      [OpportunityType.RISK_MITIGATION]: 0.85
    };
    
    // Higher relevance for certain sources
    const sourceRelevance: Record<OpportunitySource, number> = {
      [OpportunitySource.MARKET_DATA]: 0.75,
      [OpportunitySource.NEWS]: 0.7,
      [OpportunitySource.MEMORY_PATTERN]: 0.85,
      [OpportunitySource.USER_INTERACTION]: 0.9,
      [OpportunitySource.CALENDAR]: 0.8,
      [OpportunitySource.SCHEDULE]: 0.8,
      [OpportunitySource.COLLABORATION]: 0.75,
      [OpportunitySource.KNOWLEDGE_GRAPH]: 0.7,
      [OpportunitySource.ANALYTICS]: 0.8,
      [OpportunitySource.EXTERNAL_API]: 0.7
    };
    
    // Base score from type and source
    const baseScore = (typeRelevance[opportunity.type] + sourceRelevance[opportunity.source]) / 2;
    
    // Adjust based on related memories
    const memoryFactor = opportunity.context.recentMemories?.length 
      ? Math.min(0.2, opportunity.context.recentMemories.length * 0.05)
      : 0;
    
    // Adjust based on related knowledge
    const knowledgeFactor = opportunity.context.relevantKnowledge?.length
      ? Math.min(0.2, opportunity.context.relevantKnowledge.length * 0.05)
      : 0;
    
    // Boost for keyword matches
    const keywordBoost = opportunity.trigger.patterns?.length
      ? Math.min(0.2, opportunity.trigger.patterns.length * 0.05)
      : 0;
    
    // Combine factors (capped at 1.0)
    return Math.min(1.0, baseScore + memoryFactor + knowledgeFactor + keywordBoost);
  }

  /**
   * Calculate actionability score
   */
  private calculateActionabilityScore(opportunity: Opportunity): number {
    // Base actionability by type
    const typeActionability: Record<OpportunityType, number> = {
      [OpportunityType.TASK_OPTIMIZATION]: 0.9,
      [OpportunityType.ERROR_PREVENTION]: 0.85,
      [OpportunityType.RESOURCE_OPTIMIZATION]: 0.8,
      [OpportunityType.USER_ASSISTANCE]: 0.9,
      [OpportunityType.SCHEDULE_OPTIMIZATION]: 0.85,
      [OpportunityType.KNOWLEDGE_ACQUISITION]: 0.7,
      [OpportunityType.MARKET_OPPORTUNITY]: 0.6,
      [OpportunityType.COLLABORATION]: 0.75,
      [OpportunityType.IMPROVEMENT]: 0.8,
      [OpportunityType.RISK_MITIGATION]: 0.75
    };
    
    // Base score from type
    const baseScore = typeActionability[opportunity.type];
    
    // Reduce score if resource needs are high
    const resourcePenalty = opportunity.resourceNeeded 
      ? Math.min(0.3, opportunity.resourceNeeded.estimatedMinutes / 120 * 0.3)
      : 0;
    
    // Reduce score if required capabilities are missing
    const capabilityPenalty = opportunity.resourceNeeded?.requiredCapabilities?.length
      ? Math.min(0.3, opportunity.resourceNeeded.requiredCapabilities.length * 0.1)
      : 0;
    
    // Contextual boost if we have relevant knowledge
    const knowledgeBoost = opportunity.context.relevantKnowledge?.length
      ? Math.min(0.2, opportunity.context.relevantKnowledge.length * 0.05)
      : 0;
    
    // Final score (capped between 0.1 and 1.0)
    return Math.max(0.1, Math.min(1.0, baseScore - resourcePenalty - capabilityPenalty + knowledgeBoost));
  }

  /**
   * Calculate urgency score
   */
  private calculateUrgencyScore(opportunity: Opportunity): number {
    // Base urgency by time sensitivity
    const timeSensitivityUrgency: Record<TimeSensitivity, number> = {
      [TimeSensitivity.IMMEDIATE]: 1.0,
      [TimeSensitivity.URGENT]: 0.8,
      [TimeSensitivity.IMPORTANT]: 0.6,
      [TimeSensitivity.STANDARD]: 0.4,
      [TimeSensitivity.LONG_TERM]: 0.2
    };
    
    // Base score from time sensitivity
    const baseScore = timeSensitivityUrgency[opportunity.timeSensitivity];
    
    // Increase urgency if validity period is short
    let validityFactor = 0;
    if (opportunity.validUntil) {
      const now = new Date();
      const validUntil = opportunity.validUntil;
      const hoursRemaining = (validUntil.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursRemaining < 24) {
        validityFactor = 0.3; // Less than a day
      } else if (hoursRemaining < 72) {
        validityFactor = 0.2; // Less than 3 days
      } else if (hoursRemaining < 168) {
        validityFactor = 0.1; // Less than a week
      }
    }
    
    // Final score (capped at 1.0)
    return Math.min(1.0, baseScore + validityFactor);
  }

  /**
   * Calculate impact score
   */
  private calculateImpactScore(opportunity: Opportunity): number {
    // Base impact by type
    const typeImpact: Record<OpportunityType, number> = {
      [OpportunityType.TASK_OPTIMIZATION]: 0.7,
      [OpportunityType.ERROR_PREVENTION]: 0.9,
      [OpportunityType.RESOURCE_OPTIMIZATION]: 0.75,
      [OpportunityType.USER_ASSISTANCE]: 0.8,
      [OpportunityType.SCHEDULE_OPTIMIZATION]: 0.6,
      [OpportunityType.KNOWLEDGE_ACQUISITION]: 0.65,
      [OpportunityType.MARKET_OPPORTUNITY]: 0.85,
      [OpportunityType.COLLABORATION]: 0.7,
      [OpportunityType.IMPROVEMENT]: 0.65,
      [OpportunityType.RISK_MITIGATION]: 0.85
    };
    
    // Start with base impact for type
    let impactScore = typeImpact[opportunity.type];
    
    // Adjust based on patterns recognized
    if (opportunity.trigger.patterns && opportunity.trigger.patterns.length > 0) {
      // Sum up pattern confidences
      const totalPatternConfidence = opportunity.trigger.patterns.reduce(
        (sum, pattern) => sum + pattern.confidence, 
        0
      );
      
      // Average confidence multiplied by a factor
      const patternFactor = Math.min(0.2, (totalPatternConfidence / opportunity.trigger.patterns.length) * 0.3);
      impactScore += patternFactor;
    }
    
    // Final score (capped at 1.0)
    return Math.min(1.0, impactScore);
  }

  /**
   * Calculate risk score (higher = more risky)
   */
  private calculateRiskScore(opportunity: Opportunity): number {
    // Base risk by type
    const typeRisk: Record<OpportunityType, number> = {
      [OpportunityType.TASK_OPTIMIZATION]: 0.3,
      [OpportunityType.ERROR_PREVENTION]: 0.4,
      [OpportunityType.RESOURCE_OPTIMIZATION]: 0.35,
      [OpportunityType.USER_ASSISTANCE]: 0.5,
      [OpportunityType.SCHEDULE_OPTIMIZATION]: 0.3,
      [OpportunityType.KNOWLEDGE_ACQUISITION]: 0.2,
      [OpportunityType.MARKET_OPPORTUNITY]: 0.7,
      [OpportunityType.COLLABORATION]: 0.5,
      [OpportunityType.IMPROVEMENT]: 0.4,
      [OpportunityType.RISK_MITIGATION]: 0.6
    };
    
    // Start with base risk for type
    let riskScore = typeRisk[opportunity.type];
    
    // Higher risk for lower confidence
    const confidenceRisk = (1 - opportunity.trigger.confidence) * 0.3;
    
    // Higher risk for complex resource needs
    const complexityRisk = opportunity.resourceNeeded?.complexityLevel === 'high'
      ? 0.2
      : opportunity.resourceNeeded?.complexityLevel === 'medium'
        ? 0.1
        : 0;
    
    // Final score (capped between 0.1 and 1.0)
    return Math.max(0.1, Math.min(1.0, riskScore + confidenceRisk + complexityRisk));
  }
  
  /**
   * Calculate resource efficiency score
   */
  private calculateResourceEfficiencyScore(opportunity: Opportunity): number {
    // No resource estimation means we assume good efficiency
    if (!opportunity.resourceNeeded) {
      return 0.8;
    }
    
    // Calculate efficiency based on time needed
    const timeNeeded = opportunity.resourceNeeded.estimatedMinutes;
    
    // Score based on time needed (shorter = more efficient)
    let efficiencyScore;
    if (timeNeeded <= 15) {
      efficiencyScore = 0.9; // Very quick
    } else if (timeNeeded <= 30) {
      efficiencyScore = 0.8; // Quick
    } else if (timeNeeded <= 60) {
      efficiencyScore = 0.7; // Moderate
    } else if (timeNeeded <= 120) {
      efficiencyScore = 0.6; // Substantial
    } else if (timeNeeded <= 240) {
      efficiencyScore = 0.4; // Time-consuming
    } else {
      efficiencyScore = 0.2; // Very time-consuming
    }
    
    // Adjust for complexity
    if (opportunity.resourceNeeded.complexityLevel === 'high') {
      efficiencyScore -= 0.1;
    }
    
    // Final score (capped between 0.1 and 1.0)
    return Math.max(0.1, Math.min(1.0, efficiencyScore));
  }

  /**
   * Determine time sensitivity for an opportunity
   */
  async determineTimeSensitivity(
    opportunity: Opportunity
  ): Promise<{
    timeSensitivity: TimeSensitivity;
    explanation: string;
  }> {
    this.ensureInitialized();
    
    // Check for explicit validity period
    if (opportunity.validUntil) {
      const now = new Date();
      const validUntil = opportunity.validUntil;
      const hoursRemaining = (validUntil.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursRemaining <= 1) {
        return {
          timeSensitivity: TimeSensitivity.IMMEDIATE,
          explanation: 'Opportunity expires within the next hour'
        };
      } else if (hoursRemaining <= 4) {
        return {
          timeSensitivity: TimeSensitivity.URGENT,
          explanation: 'Opportunity expires within the next 4 hours'
        };
      } else if (hoursRemaining <= 24) {
        return {
          timeSensitivity: TimeSensitivity.IMPORTANT,
          explanation: 'Opportunity expires within the next day'
        };
      } else if (hoursRemaining <= 72) {
        return {
          timeSensitivity: TimeSensitivity.STANDARD,
          explanation: 'Opportunity expires within the next 3 days'
        };
      } else {
        return {
          timeSensitivity: TimeSensitivity.LONG_TERM,
          explanation: 'Opportunity has a longer validity period'
        };
      }
    }
    
    // Type-based sensitivities
    const typeSensitivity: Record<OpportunityType, TimeSensitivity> = {
      [OpportunityType.ERROR_PREVENTION]: TimeSensitivity.URGENT,
      [OpportunityType.USER_ASSISTANCE]: TimeSensitivity.IMPORTANT,
      [OpportunityType.TASK_OPTIMIZATION]: TimeSensitivity.STANDARD,
      [OpportunityType.SCHEDULE_OPTIMIZATION]: TimeSensitivity.STANDARD,
      [OpportunityType.RESOURCE_OPTIMIZATION]: TimeSensitivity.STANDARD,
      [OpportunityType.COLLABORATION]: TimeSensitivity.IMPORTANT,
      [OpportunityType.MARKET_OPPORTUNITY]: TimeSensitivity.IMPORTANT,
      [OpportunityType.KNOWLEDGE_ACQUISITION]: TimeSensitivity.LONG_TERM,
      [OpportunityType.IMPROVEMENT]: TimeSensitivity.LONG_TERM,
      [OpportunityType.RISK_MITIGATION]: TimeSensitivity.IMPORTANT
    };
    
    return {
      timeSensitivity: typeSensitivity[opportunity.type],
      explanation: `Time sensitivity based on opportunity type: ${opportunity.type}`
    };
  }

  /**
   * Determine priority for an opportunity
   */
  async determinePriority(
    opportunity: Opportunity,
    score?: OpportunityScore
  ): Promise<{
    priority: OpportunityPriority;
    explanation: string;
  }> {
    this.ensureInitialized();
    
    // If score is not provided, calculate it
    const opportunityScore = score || await this.scoreOpportunity(opportunity);
    const overallScore = opportunityScore.overall;
    
    // Use thresholds to determine priority
    const thresholds = this.config.priorityThresholds;
    
    if (overallScore >= thresholds.critical) {
      return {
        priority: OpportunityPriority.CRITICAL,
        explanation: `Overall score ${overallScore.toFixed(2)} meets the critical threshold of ${thresholds.critical}`
      };
    } else if (overallScore >= thresholds.high) {
      return {
        priority: OpportunityPriority.HIGH,
        explanation: `Overall score ${overallScore.toFixed(2)} meets the high threshold of ${thresholds.high}`
      };
    } else if (overallScore >= thresholds.medium) {
      return {
        priority: OpportunityPriority.MEDIUM,
        explanation: `Overall score ${overallScore.toFixed(2)} meets the medium threshold of ${thresholds.medium}`
      };
    } else {
      return {
        priority: OpportunityPriority.LOW,
        explanation: `Overall score ${overallScore.toFixed(2)} is below the medium threshold of ${thresholds.medium}`
      };
    }
  }

  /**
   * Generate action recommendations for an opportunity
   */
  async generateRecommendations(opportunity: Opportunity): Promise<string[]> {
    this.ensureInitialized();
    
    const recommendations: string[] = [];
    
    // Add type-specific recommendations
    switch (opportunity.type) {
      case OpportunityType.TASK_OPTIMIZATION:
        recommendations.push('Analyze current task flow for optimization');
        recommendations.push('Identify redundant steps that can be eliminated');
        recommendations.push('Consider automation opportunities for repetitive tasks');
        break;
        
      case OpportunityType.ERROR_PREVENTION:
        recommendations.push('Implement preventive measures immediately');
        recommendations.push('Document the potential error and its impact');
        recommendations.push('Develop monitoring to detect similar issues');
        break;
        
      case OpportunityType.USER_ASSISTANCE:
        recommendations.push('Proactively reach out to the user with help');
        recommendations.push('Prepare contextual information based on user needs');
        recommendations.push('Follow up to ensure user\'s needs were met');
        break;
        
      case OpportunityType.MARKET_OPPORTUNITY:
        recommendations.push('Research market conditions relevant to this opportunity');
        recommendations.push('Identify potential competitive advantages');
        recommendations.push('Develop a strategy to capitalize on the opportunity');
        break;
        
      // Add cases for other opportunity types...
      
      default:
        recommendations.push('Evaluate the opportunity details thoroughly');
        recommendations.push('Create an action plan based on priority level');
        recommendations.push('Set appropriate follow-up actions');
    }
    
    // Add time-sensitivity recommendations
    switch (opportunity.timeSensitivity) {
      case TimeSensitivity.IMMEDIATE:
      case TimeSensitivity.URGENT:
        recommendations.push('Take immediate action due to high time sensitivity');
        recommendations.push('Consider delegating other tasks to focus on this opportunity');
        break;
        
      case TimeSensitivity.IMPORTANT:
        recommendations.push('Schedule action within the next 24 hours');
        recommendations.push('Prepare resources needed to act on this opportunity');
        break;
        
      case TimeSensitivity.STANDARD:
      case TimeSensitivity.LONG_TERM:
        recommendations.push('Develop a strategic approach for this opportunity');
        recommendations.push('Integrate into regular planning cycles');
        break;
    }
    
    // Add source-specific recommendations
    switch (opportunity.source) {
      case OpportunitySource.USER_INTERACTION:
        recommendations.push('Maintain context from user interaction when taking action');
        recommendations.push('Consider user preferences and communication style');
        break;
        
      case OpportunitySource.MEMORY_PATTERN:
        recommendations.push('Reference relevant past experiences when acting');
        recommendations.push('Look for similar patterns in other contexts');
        break;
        
      // Add cases for other sources...
    }
    
    return recommendations;
  }

  /**
   * Assess risks associated with an opportunity
   */
  async assessRisks(opportunity: Opportunity): Promise<{
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    mitigationStrategies?: string[];
  }> {
    this.ensureInitialized();
    
    const riskScore = (await this.scoreOpportunity(opportunity)).riskLevel;
    const factors: string[] = [];
    const mitigationStrategies: string[] = [];
    
    // Determine risk level from score
    let level: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 0.8) {
      level = 'critical';
    } else if (riskScore >= 0.6) {
      level = 'high';
    } else if (riskScore >= 0.4) {
      level = 'medium';
    } else {
      level = 'low';
    }
    
    // Add common risk factors
    if (opportunity.trigger.confidence < 0.6) {
      factors.push('Low confidence in opportunity detection');
      mitigationStrategies.push('Gather additional confirming evidence');
    }
    
    if (opportunity.resourceNeeded?.complexityLevel === 'high') {
      factors.push('High implementation complexity');
      mitigationStrategies.push('Break down into smaller, manageable steps');
    }
    
    // Add type-specific risks
    switch (opportunity.type) {
      case OpportunityType.ERROR_PREVENTION:
        factors.push('Potential for false positive detection');
        mitigationStrategies.push('Verify error potential before taking action');
        break;
        
      case OpportunityType.MARKET_OPPORTUNITY:
        factors.push('Market conditions may change rapidly');
        mitigationStrategies.push('Implement continuous monitoring of relevant indicators');
        break;
        
      case OpportunityType.USER_ASSISTANCE:
        factors.push('User might not require the identified assistance');
        mitigationStrategies.push('Confirm with user before providing extensive help');
        break;
        
      // Add cases for other types...
    }
    
    // Add time-sensitivity risks
    if (opportunity.timeSensitivity === TimeSensitivity.IMMEDIATE || 
        opportunity.timeSensitivity === TimeSensitivity.URGENT) {
      factors.push('Time pressure may lead to rushed decisions');
      mitigationStrategies.push('Prioritize critical aspects and revisit details later');
    }
    
    return {
      level,
      factors,
      mitigationStrategies
    };
  }

  /**
   * Check if evaluator is healthy
   */
  async getHealth(): Promise<{
    isHealthy: boolean;
    lastCheck: Date;
    details?: Record<string, unknown>;
  }> {
    this.lastHealthCheck = new Date();
    
    return {
      isHealthy: this.initialized,
      lastCheck: this.lastHealthCheck,
      details: {
        configuredThresholds: this.config.priorityThresholds,
        scoreWeights: this.config.scoreWeights
      }
    };
  }
} 