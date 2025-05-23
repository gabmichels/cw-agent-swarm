/**
 * OpportunityManager.interface.ts
 * 
 * Defines the interface for the orchestration layer of the opportunity management system.
 */

import {
  Opportunity,
  OpportunityCreationOptions,
  OpportunityFilter,
  OpportunityOrderOptions,
  OpportunityStatus
} from '../models/opportunity.model';
import { 
  TriggerDetectionOptions, 
  OpportunityDetectionResult,
  OpportunityDetectorConfig 
} from './OpportunityDetector.interface';
import { 
  OpportunityEvaluation, 
  EvaluationResult,
  OpportunityEvaluatorConfig
} from './OpportunityEvaluator.interface';
import { 
  ProcessingResult, 
  BatchProcessingResult,
  OpportunityProcessorConfig
} from './OpportunityProcessor.interface';

/**
 * Configuration for the opportunity manager
 */
export interface OpportunityManagerConfig {
  /** Detector configuration */
  detector?: OpportunityDetectorConfig;
  
  /** Evaluator configuration */
  evaluator?: OpportunityEvaluatorConfig;
  
  /** Processor configuration */
  processor?: OpportunityProcessorConfig;
  
  /** Auto processing settings */
  autoProcessing?: {
    /** Whether to automatically process opportunities after evaluation */
    enabled: boolean;
    
    /** Minimum score for auto-processing */
    minScoreThreshold?: number;
    
    /** Priority threshold for auto-processing */
    minPriorityThreshold?: string;
  };
  
  /** Polling settings */
  polling?: {
    /** Whether to enable background polling for opportunity sources */
    enabled: boolean;
    
    /** Poll interval in milliseconds */
    intervalMs: number;
    
    /** Sources to poll */
    sources: string[];
  };
}

/**
 * Status information for the opportunity management system
 */
export interface OpportunityManagerStatus {
  /** Whether the system is initialized */
  initialized: boolean;
  
  /** Last time the system was active */
  lastActivity: Date;
  
  /** Number of opportunities in the system */
  opportunityCount: number;
  
  /** Number of opportunities by status */
  statusCounts: Record<OpportunityStatus, number>;
  
  /** Active strategies */
  activeStrategies: string[];
  
  /** Health status of components */
  health: {
    registry: { isHealthy: boolean; lastCheck: Date };
    detector: { isHealthy: boolean; lastCheck: Date };
    evaluator: { isHealthy: boolean; lastCheck: Date };
    processor: { isHealthy: boolean; lastCheck: Date };
  };
}

/**
 * Interface for the opportunity management system
 */
export interface OpportunityManager {
  /**
   * Get the unique ID of this opportunity manager
   * @returns The manager ID
   */
  getId(): string;
  
  /**
   * Initialize the opportunity manager
   * @param config Configuration options
   * @returns Promise resolving to true if initialization was successful
   */
  initialize(config?: OpportunityManagerConfig): Promise<boolean>;
  
  /**
   * Get the current system status
   * @returns System status information
   */
  getStatus(): Promise<OpportunityManagerStatus>;
  
  /**
   * Create a new opportunity
   * @param options Opportunity creation options
   * @returns The created opportunity
   */
  createOpportunity(options: OpportunityCreationOptions): Promise<Opportunity>;
  
  /**
   * Create an opportunity for a specific agent
   * @param options Opportunity creation options
   * @param agentId The agent ID
   * @returns The created opportunity
   */
  createOpportunityForAgent(options: OpportunityCreationOptions, agentId: string): Promise<Opportunity>;
  
  /**
   * Get an opportunity by ID
   * @param id The opportunity ID
   * @returns The opportunity or null if not found
   */
  getOpportunityById(id: string): Promise<Opportunity | null>;
  
  /**
   * Update an opportunity
   * @param id The opportunity ID
   * @param updates Partial opportunity data to update
   * @returns The updated opportunity or null if not found
   */
  updateOpportunity(id: string, updates: Partial<Opportunity>): Promise<Opportunity | null>;
  
  /**
   * Delete an opportunity
   * @param id The opportunity ID
   * @returns True if deleted, false if not found
   */
  deleteOpportunity(id: string): Promise<boolean>;
  
  /**
   * Find opportunities matching a filter
   * @param filter Filter criteria
   * @param orderBy Optional ordering
   * @param limit Optional result limit
   * @param offset Optional result offset for pagination
   * @returns Matching opportunities
   */
  findOpportunities(
    filter?: OpportunityFilter,
    orderBy?: OpportunityOrderOptions,
    limit?: number,
    offset?: number
  ): Promise<Opportunity[]>;
  
  /**
   * Find opportunities for a specific agent
   * @param agentId The agent ID
   * @param filter Additional filter criteria
   * @param orderBy Optional ordering
   * @param limit Optional result limit
   * @param offset Optional result offset for pagination
   * @returns Matching opportunities for the agent
   */
  findOpportunitiesForAgent(
    agentId: string,
    filter?: Omit<OpportunityFilter, 'agentIds'>,
    orderBy?: OpportunityOrderOptions,
    limit?: number,
    offset?: number
  ): Promise<Opportunity[]>;
  
  /**
   * Detect opportunities from content
   * @param content Content to analyze
   * @param options Detection options
   * @returns Detection result with opportunities
   */
  detectOpportunities(
    content: string,
    options: TriggerDetectionOptions
  ): Promise<OpportunityDetectionResult>;
  
  /**
   * Evaluate an opportunity
   * @param opportunityId The opportunity ID to evaluate
   * @returns Evaluation result
   */
  evaluateOpportunity(opportunityId: string): Promise<EvaluationResult>;
  
  /**
   * Process an opportunity into tasks
   * @param opportunityId The opportunity ID to process
   * @returns Processing result with task IDs
   */
  processOpportunity(opportunityId: string): Promise<ProcessingResult>;
  
  /**
   * Process all opportunities for an agent that meet criteria
   * @param agentId The agent ID
   * @param filter Additional filter criteria
   * @param limit Maximum number of opportunities to process
   * @returns Batch processing result
   */
  processOpportunitiesForAgent(
    agentId: string,
    filter?: Omit<OpportunityFilter, 'agentIds'>,
    limit?: number
  ): Promise<BatchProcessingResult>;
  
  /**
   * Update the status of an opportunity
   * @param id The opportunity ID
   * @param status The new status
   * @param result Optional result data
   * @returns The updated opportunity or null if not found
   */
  updateOpportunityStatus(
    id: string,
    status: OpportunityStatus,
    result?: Record<string, unknown>
  ): Promise<Opportunity | null>;
  
  /**
   * Start background polling for opportunities
   * @returns True if polling was started
   */
  startPolling(): Promise<boolean>;
  
  /**
   * Stop background polling
   * @returns True if polling was stopped
   */
  stopPolling(): Promise<boolean>;
  
  /**
   * Clear expired opportunities
   * @param before Optional date - delete opportunities that expired before this date
   * @returns Number of deleted opportunities
   */
  clearExpiredOpportunities(before?: Date): Promise<number>;
  
  /**
   * Get health status for all components
   * @returns Health status with component details
   */
  getHealth(): Promise<{
    isHealthy: boolean;
    lastCheck: Date;
    components: {
      registry: { isHealthy: boolean; lastCheck: Date };
      detector: { isHealthy: boolean; lastCheck: Date };
      evaluator: { isHealthy: boolean; lastCheck: Date };
      processor: { isHealthy: boolean; lastCheck: Date };
    };
  }>;
} 