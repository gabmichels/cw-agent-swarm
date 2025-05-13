/**
 * Knowledge Validation Interface
 * 
 * This file defines interfaces for validating knowledge entries,
 * ensuring their accuracy, consistency, and reliability.
 */

import { KnowledgeValidationLevel, KnowledgeConfidenceLevel } from './KnowledgeAcquisition.interface';

/**
 * Types of knowledge validation methods
 */
export enum ValidationMethodType {
  CONSISTENCY_CHECK = 'consistency_check',     // Check for internal consistency
  CROSS_REFERENCE = 'cross_reference',         // Cross-reference with other sources
  EXPERT_REVIEW = 'expert_review',             // Review by an expert (agent or human)
  FACT_CHECK = 'fact_check',                   // Check against known facts
  LOGIC_VALIDATION = 'logic_validation',       // Validate logical structure
  SOURCE_CREDIBILITY = 'source_credibility',   // Evaluate source credibility
  STATISTICAL_ANALYSIS = 'statistical_analysis', // Statistical validation
  TEST_CASE = 'test_case',                     // Validate with test cases
  PEER_REVIEW = 'peer_review',                 // Peer review by other agents
  APPLICATION_TEST = 'application_test'        // Test by applying the knowledge
}

/**
 * Types of knowledge validation issues
 */
export enum ValidationIssueType {
  INCONSISTENCY = 'inconsistency',             // Internal inconsistency
  FACTUAL_ERROR = 'factual_error',             // Factual incorrectness
  LOGICAL_FALLACY = 'logical_fallacy',         // Logical fallacy
  INSUFFICIENT_EVIDENCE = 'insufficient_evidence', // Not enough evidence
  OUTDATED_INFORMATION = 'outdated_information', // Information is outdated
  SOURCE_UNRELIABILITY = 'source_unreliability', // Source is unreliable
  CONTRADICTION = 'contradiction',             // Contradicts existing knowledge
  AMBIGUITY = 'ambiguity',                     // Ambiguous information
  BIAS = 'bias',                               // Information shows bias
  INCOMPLETE = 'incomplete'                    // Information is incomplete
}

/**
 * Knowledge validation method
 */
export interface ValidationMethod {
  /** Unique identifier for this validation method */
  id: string;
  
  /** Validation method name */
  name: string;
  
  /** Validation method type */
  type: ValidationMethodType;
  
  /** Validation method description */
  description: string;
  
  /** Method parameters */
  parameters: Record<string, unknown>;
  
  /** Method reliability score (0-1) */
  reliability: number;
  
  /** Validation levels this method can achieve */
  achievableValidationLevels: KnowledgeValidationLevel[];
  
  /** Required resources */
  requiredResources?: string[];
  
  /** Method limitations */
  limitations?: string[];
  
  /** Method implementation provider */
  implementationProvider?: string;
}

/**
 * Knowledge validation context
 */
export interface ValidationContext {
  /** Existing knowledge entries used for validation */
  existingKnowledgeIds: string[];
  
  /** External resources */
  externalResources: Array<{
    /** Resource name */
    name: string;
    
    /** Resource type */
    type: string;
    
    /** Resource location */
    location: string;
    
    /** Resource access method */
    accessMethod?: string;
  }>;
  
  /** Domain context */
  domain?: string;
  
  /** Temporal context */
  timeframe?: {
    /** Start date */
    from?: Date;
    
    /** End date */
    to?: Date;
    
    /** Time sensitivity */
    sensitivity?: 'low' | 'medium' | 'high';
  };
  
  /** Authentication context */
  authentication?: {
    /** Authentication type */
    type: string;
    
    /** Authentication parameters */
    parameters: Record<string, unknown>;
  };
  
  /** Additional context parameters */
  additionalParameters?: Record<string, unknown>;
}

/**
 * Knowledge validation request
 */
export interface ValidationRequest {
  /** Unique identifier for this validation request */
  id: string;
  
  /** Knowledge entry ID to validate */
  knowledgeEntryId: string;
  
  /** Knowledge content to validate */
  content: string;
  
  /** Request timestamp */
  requestedAt: Date;
  
  /** Required validation level */
  requiredLevel: KnowledgeValidationLevel;
  
  /** Minimum required confidence */
  minimumConfidence: number;
  
  /** Validation methods to use */
  methodIds: string[];
  
  /** Validation context */
  context: ValidationContext;
  
  /** Request priority (0-1) */
  priority: number;
  
  /** Request deadline */
  deadline?: Date;
  
  /** Request status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  
  /** Validation result (when completed) */
  result?: ValidationResult;
}

/**
 * Validation step result
 */
export interface ValidationStepResult {
  /** Validation method ID used */
  methodId: string;
  
  /** Step execution timestamp */
  executedAt: Date;
  
  /** Step success status */
  success: boolean;
  
  /** Confidence score from this step (0-1) */
  confidenceScore: number;
  
  /** Issues found by this step */
  issues: Array<{
    /** Issue type */
    type: ValidationIssueType;
    
    /** Issue description */
    description: string;
    
    /** Issue severity */
    severity: 'low' | 'medium' | 'high';
    
    /** Supporting evidence */
    evidence?: string;
    
    /** Suggested correction */
    suggestedCorrection?: string;
  }>;
  
  /** Evidence supporting validation */
  supportingEvidence?: string[];
  
  /** Step execution metrics */
  metrics?: {
    /** Execution time (ms) */
    executionTimeMs: number;
    
    /** Resources consumed */
    resourcesConsumed: Record<string, number>;
    
    /** API calls made */
    apiCallsMade: number;
  };
  
  /** Raw result data */
  rawData?: Record<string, unknown>;
}

/**
 * Knowledge validation result
 */
export interface ValidationResult {
  /** Validation request ID */
  requestId: string;
  
  /** Knowledge entry ID */
  knowledgeEntryId: string;
  
  /** Validation completion timestamp */
  completedAt: Date;
  
  /** Overall validation success */
  success: boolean;
  
  /** Achieved validation level */
  achievedLevel: KnowledgeValidationLevel;
  
  /** Overall confidence score (0-1) */
  confidenceScore: number;
  
  /** Confidence level classification */
  confidenceLevel: KnowledgeConfidenceLevel;
  
  /** Individual validation steps */
  steps: ValidationStepResult[];
  
  /** All issues found */
  issues: Array<{
    /** Issue type */
    type: ValidationIssueType;
    
    /** Issue description */
    description: string;
    
    /** Issue severity */
    severity: 'low' | 'medium' | 'high';
    
    /** Source step ID */
    sourceStepId: string;
    
    /** Supporting evidence */
    evidence?: string;
    
    /** Suggested correction */
    suggestedCorrection?: string;
    
    /** Issue resolution status */
    resolved: boolean;
    
    /** Resolution description (if resolved) */
    resolution?: string;
  }>;
  
  /** Corrections applied */
  corrections?: Array<{
    /** Original content */
    original: string;
    
    /** Corrected content */
    corrected: string;
    
    /** Reason for correction */
    reason: string;
    
    /** Issue ID that prompted this correction */
    issueId?: string;
  }>;
  
  /** Overall validation metrics */
  metrics: {
    /** Total execution time (ms) */
    totalExecutionTimeMs: number;
    
    /** Methods applied count */
    methodsApplied: number;
    
    /** Issues found count */
    issuesFound: number;
    
    /** Corrections made count */
    correctionsMade: number;
    
    /** Resources consumed */
    resourcesConsumed: Record<string, number>;
  };
}

/**
 * Knowledge validation interface
 */
export interface KnowledgeValidation {
  /**
   * Register a validation method
   * 
   * @param method Validation method to register
   * @returns Promise resolving to the registered method
   */
  registerValidationMethod(
    method: Omit<ValidationMethod, 'id'>
  ): Promise<ValidationMethod>;
  
  /**
   * Get a validation method
   * 
   * @param methodId Method ID
   * @returns Promise resolving to the validation method or null if not found
   */
  getValidationMethod(
    methodId: string
  ): Promise<ValidationMethod | null>;
  
  /**
   * Find validation methods
   * 
   * @param options Search options
   * @returns Promise resolving to matching methods
   */
  findValidationMethods(
    options?: {
      methodType?: ValidationMethodType;
      minReliability?: number;
      validationLevel?: KnowledgeValidationLevel;
      requiredResources?: string[];
      limit?: number;
    }
  ): Promise<ValidationMethod[]>;
  
  /**
   * Create a validation request
   * 
   * @param knowledgeEntryId Knowledge entry ID to validate
   * @param content Knowledge content to validate
   * @param options Validation options
   * @returns Promise resolving to the created request
   */
  createValidationRequest(
    knowledgeEntryId: string,
    content: string,
    options?: {
      requiredLevel?: KnowledgeValidationLevel;
      minimumConfidence?: number;
      methodIds?: string[];
      context?: Partial<ValidationContext>;
      priority?: number;
      deadline?: Date;
    }
  ): Promise<ValidationRequest>;
  
  /**
   * Execute a validation request
   * 
   * @param requestId Request ID
   * @returns Promise resolving to the validation result
   */
  executeValidationRequest(
    requestId: string
  ): Promise<ValidationResult>;
  
  /**
   * Get a validation request
   * 
   * @param requestId Request ID
   * @returns Promise resolving to the validation request or null if not found
   */
  getValidationRequest(
    requestId: string
  ): Promise<ValidationRequest | null>;
  
  /**
   * Get a validation result
   * 
   * @param requestId Request ID
   * @returns Promise resolving to the validation result or null if not found
   */
  getValidationResult(
    requestId: string
  ): Promise<ValidationResult | null>;
  
  /**
   * Find validation requests
   * 
   * @param options Search options
   * @returns Promise resolving to matching requests
   */
  findValidationRequests(
    options?: {
      status?: 'pending' | 'in_progress' | 'completed' | 'failed';
      knowledgeEntryId?: string;
      requiredLevel?: KnowledgeValidationLevel;
      priorityMin?: number;
      priorityMax?: number;
      createdAfter?: Date;
      createdBefore?: Date;
      limit?: number;
    }
  ): Promise<ValidationRequest[]>;
  
  /**
   * Cancel a validation request
   * 
   * @param requestId Request ID
   * @param reason Reason for cancellation
   * @returns Promise resolving to success status
   */
  cancelValidationRequest(
    requestId: string,
    reason: string
  ): Promise<boolean>;
  
  /**
   * Validate knowledge directly (convenience method)
   * 
   * @param content Knowledge content to validate
   * @param options Validation options
   * @returns Promise resolving to the validation result
   */
  validateKnowledge(
    content: string,
    options?: {
      knowledgeEntryId?: string;
      requiredLevel?: KnowledgeValidationLevel;
      minimumConfidence?: number;
      methodIds?: string[];
      context?: Partial<ValidationContext>;
    }
  ): Promise<ValidationResult>;
} 