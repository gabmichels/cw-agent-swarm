/**
 * OpportunityEvaluator.interface.ts
 * 
 * Defines the interface for opportunity evaluation and scoring.
 */

import { 
  Opportunity,
  OpportunityScore,
  OpportunityPriority,
  TimeSensitivity
} from '../models/opportunity.model';

/**
 * Detailed evaluation of an opportunity
 */
export interface OpportunityEvaluation {
  /** The opportunity being evaluated */
  opportunity: Opportunity;
  
  /** Score breakdown */
  score: OpportunityScore;
  
  /** Recommended priority */
  recommendedPriority: OpportunityPriority;
  
  /** Recommended time sensitivity */
  recommendedTimeSensitivity: TimeSensitivity;
  
  /** Evaluation timestamp */
  evaluatedAt: Date;
  
  /** Evaluation insights */
  insights: string[];
  
  /** Action recommendations */
  recommendations: string[];
  
  /** Dependencies on other opportunities if any */
  dependencies?: string[];
  
  /** Risk assessment */
  riskAssessment?: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    mitigationStrategies?: string[];
  };
}

/**
 * Configuration for the opportunity evaluator
 */
export interface OpportunityEvaluatorConfig {
  /** Priority thresholds for different score ranges */
  priorityThresholds?: {
    critical: number; // Score threshold for critical priority
    high: number;     // Score threshold for high priority
    medium: number;   // Score threshold for medium priority
  };
  
  /** Weighting factors for different score components */
  scoreWeights?: {
    relevance: number;
    actionability: number;
    urgency: number;
    impact: number;
    confidence: number;
    riskLevel: number;
    resourceEfficiency: number;
  };
  
  /** Evaluation timing settings */
  timingSettings?: {
    evaluationTimeoutMs: number;  // Max time for evaluation
    reevaluationIntervalMs: number; // Time between re-evaluations
  };
  
  /** Custom evaluation rules */
  customRules?: Record<string, unknown>;
}

/**
 * Result of evaluating an opportunity
 */
export interface EvaluationResult {
  /** The completed evaluation */
  evaluation: OpportunityEvaluation;
  
  /** Whether evaluation was successful */
  success: boolean;
  
  /** Error message if evaluation failed */
  error?: string;
  
  /** Execution statistics */
  stats?: {
    executionTimeMs: number;
    evaluationDate: Date;
  };
}

/**
 * Interface for opportunity evaluation
 */
export interface OpportunityEvaluator {
  /**
   * Initialize the evaluator
   * @param config Optional configuration
   * @returns Promise resolving to true if initialization was successful
   */
  initialize(config?: OpportunityEvaluatorConfig): Promise<boolean>;
  
  /**
   * Evaluate an opportunity
   * @param opportunity The opportunity to evaluate
   * @returns Evaluation result
   */
  evaluateOpportunity(opportunity: Opportunity): Promise<EvaluationResult>;
  
  /**
   * Score an opportunity
   * @param opportunity The opportunity to score
   * @returns Score breakdown
   */
  scoreOpportunity(opportunity: Opportunity): Promise<OpportunityScore>;
  
  /**
   * Determine time sensitivity for an opportunity
   * @param opportunity The opportunity to analyze
   * @returns Recommended time sensitivity with explanation
   */
  determineTimeSensitivity(
    opportunity: Opportunity
  ): Promise<{
    timeSensitivity: TimeSensitivity;
    explanation: string;
  }>;
  
  /**
   * Determine priority for an opportunity
   * @param opportunity The opportunity to analyze
   * @param score Optional pre-calculated score
   * @returns Recommended priority with explanation
   */
  determinePriority(
    opportunity: Opportunity,
    score?: OpportunityScore
  ): Promise<{
    priority: OpportunityPriority;
    explanation: string;
  }>;
  
  /**
   * Generate action recommendations for an opportunity
   * @param opportunity The opportunity to analyze
   * @returns List of recommended actions
   */
  generateRecommendations(opportunity: Opportunity): Promise<string[]>;
  
  /**
   * Assess risks associated with an opportunity
   * @param opportunity The opportunity to analyze
   * @returns Risk assessment details
   */
  assessRisks(opportunity: Opportunity): Promise<{
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    mitigationStrategies?: string[];
  }>;
  
  /**
   * Check if evaluator is healthy
   * @returns Health status with lastCheck timestamp
   */
  getHealth(): Promise<{
    isHealthy: boolean;
    lastCheck: Date;
    details?: Record<string, unknown>;
  }>;
} 