/**
 * KnowledgeGapsManager.ts - Manager for identifying and addressing knowledge gaps
 * 
 * This file implements a manager to help agents identify gaps in their knowledge
 * and develop strategies to address those gaps.
 */

import type { BaseManager, ManagerConfig } from './BaseManager';
import type { AgentBase } from '../AgentBase';

/**
 * Configuration for the knowledge gaps manager
 */
export interface KnowledgeGapsManagerConfig extends ManagerConfig {
  /** Whether to automatically detect knowledge gaps */
  enableAutoDetection: boolean;
  
  /** Interval for auto-detection in milliseconds */
  detectionIntervalMs?: number;

  /** Minimum confidence threshold to consider a gap */
  confidenceThreshold: number;
  
  /** Maximum number of knowledge gaps to track */
  maxGapsTracked?: number;
  
  /** Whether to prioritize filling gaps automatically */
  enableAutoPrioritization?: boolean;
  
  /** Maximum age of knowledge gaps before they're re-evaluated (ms) */
  gapReEvaluationAgeMs?: number;
}

/**
 * Knowledge gap representation
 */
export interface KnowledgeGap {
  /** Unique identifier for this gap */
  id: string;
  
  /** Description of the gap */
  description: string;
  
  /** When the gap was identified */
  identifiedAt: Date;
  
  /** Most recent evaluation timestamp */
  lastEvaluatedAt: Date;
  
  /** Priority (1-10, higher is more important) */
  priority: number;
  
  /** Knowledge domain the gap belongs to */
  domain: string;
  
  /** Estimated difficulty to fill (1-10) */
  difficulty: number;
  
  /** Current status */
  status: 'identified' | 'researching' | 'filled' | 'verified' | 'abandoned';
  
  /** Strategy for filling the gap */
  fillStrategy?: string;
  
  /** Resources that may help fill the gap */
  suggestedResources?: string[];
  
  /** Tags for categorization */
  tags: string[];
  
  /** Related gaps */
  relatedGapIds: string[];
}

/**
 * Gap detection source - where the gap was detected
 */
export enum GapDetectionSource {
  USER_QUERY = 'user_query',
  AGENT_REFLECTION = 'agent_reflection',
  TASK_FAILURE = 'task_failure',
  CONFIDENCE_CHECK = 'confidence_check',
  EXTERNAL = 'external'
}

/**
 * Knowledge gap detection result
 */
export interface GapDetectionResult {
  /** Whether gaps were detected */
  gapsDetected: boolean;
  
  /** The identified gaps */
  gaps: KnowledgeGap[];
  
  /** Detection method used */
  method: string;
  
  /** Source of the detection */
  source: GapDetectionSource;
  
  /** Detection context */
  context?: Record<string, unknown>;
}

/**
 * Options for filling knowledge gaps
 */
export interface GapFillingOptions {
  /** Maximum time to spend (ms) */
  timeoutMs?: number;
  
  /** Whether to verify the knowledge after filling */
  verify?: boolean;
  
  /** Resources to use */
  resources?: string[];
  
  /** Confidence threshold required */
  requiredConfidence?: number;
}

/**
 * Result of filling a knowledge gap
 */
export interface GapFillingResult {
  /** Whether the gap was successfully filled */
  success: boolean;
  
  /** The updated gap */
  gap: KnowledgeGap;
  
  /** Knowledge gained (if successful) */
  knowledge?: string;
  
  /** Confidence score (0-1) */
  confidence?: number;
  
  /** Resources used */
  resourcesUsed?: string[];
  
  /** Time spent (ms) */
  timeSpentMs?: number;
  
  /** Error message (if unsuccessful) */
  error?: string;
}

/**
 * Interface for knowledge gaps manager
 */
export interface KnowledgeGapsManager extends BaseManager {
  /**
   * Detect knowledge gaps from input
   * @param input Input text to analyze for gaps
   * @param options Detection options
   * @returns Detection results
   */
  detectGaps(
    input: string,
    options?: {
      source?: GapDetectionSource;
      context?: Record<string, unknown>;
      confidenceThreshold?: number;
    }
  ): Promise<GapDetectionResult>;
  
  /**
   * Get a knowledge gap by ID
   * @param gapId Gap ID
   * @returns The knowledge gap or null if not found
   */
  getGap(gapId: string): Promise<KnowledgeGap | null>;
  
  /**
   * Get all tracked knowledge gaps
   * @param filter Filter options
   * @returns Matching knowledge gaps
   */
  getAllGaps(filter?: {
    status?: KnowledgeGap['status'][];
    domain?: string;
    minPriority?: number;
    maxPriority?: number;
    tags?: string[];
  }): Promise<KnowledgeGap[]>;
  
  /**
   * Update a knowledge gap
   * @param gapId Gap ID
   * @param updates Updates to apply
   * @returns The updated gap
   */
  updateGap(gapId: string, updates: Partial<KnowledgeGap>): Promise<KnowledgeGap>;
  
  /**
   * Add a new knowledge gap
   * @param gap Gap to add
   * @returns The added gap
   */
  addGap(gap: Omit<KnowledgeGap, 'id' | 'identifiedAt' | 'lastEvaluatedAt'>): Promise<KnowledgeGap>;
  
  /**
   * Remove a knowledge gap
   * @param gapId Gap ID
   * @returns Whether the gap was removed
   */
  removeGap(gapId: string): Promise<boolean>;
  
  /**
   * Try to fill a knowledge gap
   * @param gapId Gap ID
   * @param options Filling options
   * @returns Result of the filling attempt
   */
  fillGap(gapId: string, options?: GapFillingOptions): Promise<GapFillingResult>;
  
  /**
   * Prioritize knowledge gaps
   * @returns Prioritized gaps
   */
  prioritizeGaps(): Promise<KnowledgeGap[]>;
  
  /**
   * Generate a learning plan for filling multiple gaps
   * @param gapIds Gaps to include in the plan
   * @returns Learning plan
   */
  generateLearningPlan(gapIds: string[]): Promise<{
    id: string;
    gaps: KnowledgeGap[];
    steps: Array<{
      description: string;
      resources: string[];
      estimatedTimeMinutes: number;
    }>;
    totalEstimatedTimeMinutes: number;
  }>;
  
  /**
   * Evaluate the system's knowledge in a specific domain
   * @param domain Domain to evaluate
   * @returns Evaluation results
   */
  evaluateKnowledgeDomain(domain: string): Promise<{
    domain: string;
    confidenceScore: number;
    identifiedGaps: KnowledgeGap[];
    strengths: string[];
    weaknesses: string[];
  }>;
} 