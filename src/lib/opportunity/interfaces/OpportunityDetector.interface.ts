/**
 * OpportunityDetector.interface.ts
 * 
 * Defines the interface for opportunity detection.
 */

import { 
  Opportunity,
  OpportunityTrigger,
  OpportunitySource,
  OpportunityFilter
} from '../models/opportunity.model';

/**
 * Options for trigger detection
 */
export interface TriggerDetectionOptions {
  /** Source of the content being analyzed */
  source?: OpportunitySource;
  
  /** Additional context for trigger detection */
  context?: Record<string, unknown>;
  
  /** Minimum confidence threshold (0.0-1.0) */
  minConfidence?: number;
  
  /** Specific trigger types to look for */
  triggerTypes?: string[];
  
  /** Agent ID for which triggers are being detected */
  agentId: string;
}

/**
 * Result of opportunity detection
 */
export interface OpportunityDetectionResult {
  /** Detected opportunities */
  opportunities: Opportunity[];
  
  /** When detection was performed */
  timestamp: Date;
  
  /** Source of detection */
  source: string;
  
  /** Number of triggers analyzed */
  triggerCount: number;
  
  /** Number of successful detections */
  successfulDetections: number;
  
  /** Execution statistics */
  stats?: {
    executionTimeMs: number;
    memoryUsageBytes?: number;
    processingDetails?: Record<string, unknown>;
  };
}

/**
 * Configuration for the opportunity detector
 */
export interface OpportunityDetectorConfig {
  /** Enable or disable specific detection strategies */
  enabledStrategies?: string[];
  
  /** Minimum confidence threshold for all detections */
  globalMinConfidence?: number;
  
  /** Maximum number of opportunities to detect in a single run */
  maxDetectionsPerRun?: number;
  
  /** How aggressively to detect opportunities (0.0-1.0) */
  detectionSensitivity?: number;
  
  /** Strategy-specific configurations */
  strategyConfigs?: Record<string, unknown>;
}

/**
 * Interface for opportunity detection
 */
export interface OpportunityDetector {
  /**
   * Initialize the detector
   * @param config Optional configuration
   * @returns Promise resolving to true if initialization was successful
   */
  initialize(config?: OpportunityDetectorConfig): Promise<boolean>;
  
  /**
   * Detect triggers in content
   * @param content Content to analyze for triggers
   * @param options Detection options
   * @returns Detected triggers
   */
  detectTriggers(
    content: string,
    options: TriggerDetectionOptions
  ): Promise<OpportunityTrigger[]>;
  
  /**
   * Detect opportunities from triggers
   * @param triggers Triggers to analyze
   * @param agentId Agent ID for which opportunities are being detected
   * @returns Detection result with opportunities
   */
  detectOpportunities(
    triggers: OpportunityTrigger[],
    agentId: string
  ): Promise<OpportunityDetectionResult>;
  
  /**
   * Perform a complete detection cycle (detect triggers and opportunities)
   * @param content Content to analyze
   * @param options Detection options
   * @returns Detection result with opportunities
   */
  detectOpportunitiesFromContent(
    content: string,
    options: TriggerDetectionOptions
  ): Promise<OpportunityDetectionResult>;
  
  /**
   * Register a new detection strategy
   * @param strategyId Unique ID for the strategy
   * @param strategy Strategy implementation
   * @returns True if registered successfully
   */
  registerStrategy(strategyId: string, strategy: unknown): Promise<boolean>;
  
  /**
   * Get all available detection strategies
   * @returns List of strategy IDs
   */
  getAvailableStrategies(): Promise<string[]>;
  
  /**
   * Enable or disable a detection strategy
   * @param strategyId Strategy ID
   * @param enabled Whether to enable or disable
   * @returns True if updated successfully
   */
  setStrategyEnabled(strategyId: string, enabled: boolean): Promise<boolean>;
  
  /**
   * Check if detector is healthy
   * @returns Health status with lastCheck timestamp
   */
  getHealth(): Promise<{
    isHealthy: boolean;
    lastCheck: Date;
    details?: Record<string, unknown>;
  }>;
} 