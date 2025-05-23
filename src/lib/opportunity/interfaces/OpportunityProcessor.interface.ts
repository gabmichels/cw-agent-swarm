/**
 * OpportunityProcessor.interface.ts
 * 
 * Defines the interface for converting opportunities into actionable tasks.
 */

import { Opportunity, OpportunityFilter } from '../models/opportunity.model';

/**
 * Result of processing an opportunity
 */
export interface ProcessingResult {
  /** Whether processing was successful */
  success: boolean;
  
  /** The opportunity that was processed */
  opportunity: Opportunity;
  
  /** IDs of tasks created from the opportunity */
  taskIds: string[];
  
  /** Error message if processing failed */
  error?: string;
  
  /** Execution statistics */
  stats?: {
    executionTimeMs: number;
    processingDate: Date;
  };
  
  /** Additional processing details */
  details?: Record<string, unknown>;
}

/**
 * Batch processing result
 */
export interface BatchProcessingResult {
  /** Overall success status */
  success: boolean;
  
  /** Individual processing results */
  results: ProcessingResult[];
  
  /** Count of successfully processed opportunities */
  successCount: number;
  
  /** Count of failed processing attempts */
  failureCount: number;
  
  /** Summary of processing operation */
  summary: string;
  
  /** Total execution statistics */
  stats?: {
    totalExecutionTimeMs: number;
    processingDate: Date;
  };
}

/**
 * Task metadata derived from an opportunity
 */
export interface OpportunityTaskMetadata {
  /** ID of the opportunity that generated this task */
  opportunityId: string;
  
  /** Type of the opportunity */
  opportunityType: string;
  
  /** Priority information from the opportunity */
  priorityInfo: {
    originalPriority: string;
    calculatedPriority: string;
    confidenceScore: number;
  };
  
  /** Time sensitivity from the opportunity */
  timeSensitivity: string;
  
  /** Additional context from the opportunity */
  context: Record<string, unknown>;
}

/**
 * Configuration for the opportunity processor
 */
export interface OpportunityProcessorConfig {
  /** Maximum number of tasks to create from a single opportunity */
  maxTasksPerOpportunity?: number;
  
  /** Default task priority if none specified */
  defaultTaskPriority?: string;
  
  /** Whether to automatically mark opportunities as completed after processing */
  autoCompleteOpportunities?: boolean;
  
  /** Custom task generation rules */
  customRules?: Record<string, unknown>;
}

/**
 * Interface for opportunity processing
 */
export interface OpportunityProcessor {
  /**
   * Initialize the processor
   * @param config Optional configuration
   * @returns Promise resolving to true if initialization was successful
   */
  initialize(config?: OpportunityProcessorConfig): Promise<boolean>;
  
  /**
   * Process an opportunity by converting it to one or more tasks
   * @param opportunity The opportunity to process
   * @returns Processing result with task IDs
   */
  processOpportunity(opportunity: Opportunity): Promise<ProcessingResult>;
  
  /**
   * Process multiple opportunities in a batch
   * @param opportunities The opportunities to process
   * @returns Batch processing result
   */
  processBatch(opportunities: Opportunity[]): Promise<BatchProcessingResult>;
  
  /**
   * Process all opportunities matching a filter
   * @param filter Filter to select opportunities
   * @param limit Maximum number of opportunities to process
   * @returns Batch processing result
   */
  processMatchingOpportunities(
    filter: OpportunityFilter,
    limit?: number
  ): Promise<BatchProcessingResult>;
  
  /**
   * Generate task metadata from an opportunity
   * @param opportunity The source opportunity
   * @returns Task metadata
   */
  generateTaskMetadata(opportunity: Opportunity): Promise<OpportunityTaskMetadata>;
  
  /**
   * Check if processor is healthy
   * @returns Health status with lastCheck timestamp
   */
  getHealth(): Promise<{
    isHealthy: boolean;
    lastCheck: Date;
    details?: Record<string, unknown>;
  }>;
} 