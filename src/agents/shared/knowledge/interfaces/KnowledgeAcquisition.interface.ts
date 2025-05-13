/**
 * Knowledge Acquisition Interface
 * 
 * This file defines interfaces for systematic knowledge acquisition,
 * validation, and integration into an agent's knowledge base.
 */

/**
 * Information source types for knowledge acquisition
 */
export enum KnowledgeSourceType {
  DOCUMENT = 'document',            // Document-based sources (PDF, TXT, etc.)
  WEB = 'web',                      // Web-based sources
  API = 'api',                      // API-retrieved information
  DATABASE = 'database',            // Database-retrieved information
  CONVERSATION = 'conversation',    // Conversation-derived knowledge
  AGENT = 'agent',                  // Information from other agents
  INFERENCE = 'inference',          // Knowledge inferred from existing data
  HUMAN_INPUT = 'human_input',      // Direct human input
  OBSERVATION = 'observation'       // Agent observations
}

/**
 * Knowledge acquisition status
 */
export enum KnowledgeAcquisitionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  ACQUIRED = 'acquired',
  VALIDATED = 'validated',
  INTEGRATION_PENDING = 'integration_pending',
  INTEGRATED = 'integrated',
  FAILED = 'failed',
  REJECTED = 'rejected'
}

/**
 * Knowledge validation level
 */
export enum KnowledgeValidationLevel {
  UNVALIDATED = 'unvalidated',      // No validation performed
  BASIC = 'basic',                  // Basic automated checks
  MODERATE = 'moderate',            // More thorough validation against existing knowledge
  THOROUGH = 'thorough',            // Cross-referencing with multiple sources
  EXPERT = 'expert',                // Expert validation (human or specialized agent)
  PROVEN = 'proven'                 // Proven through application/testing
}

/**
 * Knowledge confidence level
 */
export enum KnowledgeConfidenceLevel {
  UNVERIFIED = 'unverified',        // No confidence established
  LOW = 'low',                      // Low confidence (uncertain)
  MEDIUM = 'medium',                // Medium confidence 
  HIGH = 'high',                    // High confidence
  VERY_HIGH = 'very_high',          // Very high confidence
  CERTAIN = 'certain'               // Certain (proven or axiomatically true)
}

/**
 * Information source for knowledge acquisition
 */
export interface KnowledgeSource {
  /** Unique identifier for this source */
  id: string;
  
  /** Source name or identifier */
  name: string;
  
  /** Type of source */
  type: KnowledgeSourceType;
  
  /** Source location/reference (URI, path, etc.) */
  location: string;
  
  /** Source reliability score (0-1) */
  reliability: number;
  
  /** Source metadata */
  metadata: Record<string, unknown>;
  
  /** When this source was accessed */
  accessedAt: Date;
  
  /** Source retrieval method */
  retrievalMethod?: string;
  
  /** Source access constraints */
  accessConstraints?: string[];
}

/**
 * Knowledge acquisition task
 */
export interface KnowledgeAcquisitionTask {
  /** Unique identifier for this task */
  id: string;
  
  /** Task description */
  description: string;
  
  /** Task creation timestamp */
  createdAt: Date;
  
  /** Task status */
  status: KnowledgeAcquisitionStatus;
  
  /** Knowledge gap this task addresses (if any) */
  knowledgeGapId?: string;
  
  /** Task priority (0-1) */
  priority: number;
  
  /** Task deadline (if any) */
  deadline?: Date;
  
  /** Task source information */
  sources: KnowledgeSource[];
  
  /** Task acquisition approach */
  acquisitionStrategy: {
    /** Strategy name */
    name: string;
    
    /** Strategy description */
    description: string;
    
    /** Strategy parameters */
    parameters: Record<string, unknown>;
  };
  
  /** Task validation requirements */
  validationRequirements: {
    /** Required validation level */
    requiredLevel: KnowledgeValidationLevel;
    
    /** Validation methods to use */
    methods: string[];
    
    /** Minimum required confidence score (0-1) */
    minimumConfidence: number;
  };
  
  /** Knowledge acquisition result (when completed) */
  result?: KnowledgeAcquisitionResult;
}

/**
 * Knowledge acquisition result
 */
export interface KnowledgeAcquisitionResult {
  /** Task ID that produced this result */
  taskId: string;
  
  /** Knowledge entries acquired */
  knowledgeEntries: Array<{
    /** Knowledge content */
    content: string;
    
    /** Knowledge title/summary */
    title: string;
    
    /** Knowledge confidence score (0-1) */
    confidenceScore: number;
    
    /** Confidence level classification */
    confidenceLevel: KnowledgeConfidenceLevel;
    
    /** Validation level achieved */
    validationLevel: KnowledgeValidationLevel;
    
    /** Sources that supported this knowledge */
    sources: string[];
    
    /** Related knowledge IDs */
    relatedKnowledgeIds?: string[];
    
    /** Knowledge entry metadata */
    metadata: Record<string, unknown>;
  }>;
  
  /** Acquisition timestamp */
  acquiredAt: Date;
  
  /** Overall success status */
  success: boolean;
  
  /** Issues encountered during acquisition (if any) */
  issues?: Array<{
    /** Issue type */
    type: string;
    
    /** Issue description */
    description: string;
    
    /** Issue severity */
    severity: 'low' | 'medium' | 'high';
    
    /** Issue resolution (if resolved) */
    resolution?: string;
  }>;
  
  /** Performance metrics */
  metrics?: {
    /** Time taken for acquisition (ms) */
    acquisitionTimeMs: number;
    
    /** Time taken for validation (ms) */
    validationTimeMs: number;
    
    /** Sources processed count */
    sourcesProcessed: number;
    
    /** Knowledge entries rejected count */
    entriesRejected: number;
  };
}

/**
 * Knowledge integration result
 */
export interface KnowledgeIntegrationResult {
  /** Knowledge acquisition result ID */
  acquisitionResultId: string;
  
  /** Knowledge entries integrated */
  integratedEntryIds: string[];
  
  /** Integration timestamp */
  integratedAt: Date;
  
  /** Integration impact assessment */
  impact: {
    /** Impact on existing knowledge (0-1) */
    knowledgeBaseImpact: number;
    
    /** New relationships formed */
    newRelationships: number;
    
    /** Modified relationships */
    modifiedRelationships: number;
    
    /** Conflicts resolved */
    conflictsResolved: number;
    
    /** Knowledge gaps closed */
    gapsClosed: number;
  };
  
  /** Integration method used */
  integrationMethod: string;
  
  /** Success status */
  success: boolean;
  
  /** Issues encountered during integration (if any) */
  issues?: Array<{
    /** Issue type */
    type: string;
    
    /** Issue description */
    description: string;
    
    /** Issue severity */
    severity: 'low' | 'medium' | 'high';
    
    /** Issue resolution (if resolved) */
    resolution?: string;
  }>;
}

/**
 * Knowledge acquisition manager interface
 */
export interface KnowledgeAcquisition {
  /**
   * Create a knowledge acquisition task
   * 
   * @param description Task description
   * @param options Task options
   * @returns Promise resolving to the created task
   */
  createAcquisitionTask(
    description: string,
    options?: {
      knowledgeGapId?: string;
      priority?: number;
      deadline?: Date;
      sources?: KnowledgeSource[];
      acquisitionStrategy?: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      };
      validationRequirements?: {
        requiredLevel: KnowledgeValidationLevel;
        methods: string[];
        minimumConfidence: number;
      };
    }
  ): Promise<KnowledgeAcquisitionTask>;
  
  /**
   * Execute a knowledge acquisition task
   * 
   * @param taskId ID of the task to execute
   * @returns Promise resolving to the acquisition result
   */
  executeAcquisitionTask(
    taskId: string
  ): Promise<KnowledgeAcquisitionResult>;
  
  /**
   * Integrate acquired knowledge
   * 
   * @param acquisitionResultId ID of the acquisition result to integrate
   * @param options Integration options
   * @returns Promise resolving to the integration result
   */
  integrateAcquiredKnowledge(
    acquisitionResultId: string,
    options?: {
      integrationMethod?: string;
      conflictResolutionStrategy?: string;
      autoResolveConflicts?: boolean;
    }
  ): Promise<KnowledgeIntegrationResult>;
  
  /**
   * Get knowledge acquisition task by ID
   * 
   * @param taskId Task ID
   * @returns Promise resolving to the task or null if not found
   */
  getAcquisitionTask(
    taskId: string
  ): Promise<KnowledgeAcquisitionTask | null>;
  
  /**
   * Find knowledge acquisition tasks
   * 
   * @param options Search options
   * @returns Promise resolving to matching tasks
   */
  findAcquisitionTasks(
    options?: {
      status?: KnowledgeAcquisitionStatus;
      knowledgeGapId?: string;
      priorityMin?: number;
      priorityMax?: number;
      createdAfter?: Date;
      createdBefore?: Date;
      sourceTypes?: KnowledgeSourceType[];
      limit?: number;
    }
  ): Promise<KnowledgeAcquisitionTask[]>;
  
  /**
   * Cancel a knowledge acquisition task
   * 
   * @param taskId ID of the task to cancel
   * @param reason Reason for cancellation
   * @returns Promise resolving to success status
   */
  cancelAcquisitionTask(
    taskId: string,
    reason: string
  ): Promise<boolean>;
  
  /**
   * Update a knowledge acquisition task
   * 
   * @param taskId ID of the task to update
   * @param updates Task updates
   * @returns Promise resolving to the updated task
   */
  updateAcquisitionTask(
    taskId: string,
    updates: Partial<KnowledgeAcquisitionTask>
  ): Promise<KnowledgeAcquisitionTask>;
  
  /**
   * Register a knowledge source
   * 
   * @param source Knowledge source to register
   * @returns Promise resolving to the registered source
   */
  registerKnowledgeSource(
    source: Omit<KnowledgeSource, 'id'>
  ): Promise<KnowledgeSource>;
  
  /**
   * Get knowledge acquisition result
   * 
   * @param taskId ID of the task to get result for
   * @returns Promise resolving to the acquisition result or null if not found
   */
  getAcquisitionResult(
    taskId: string
  ): Promise<KnowledgeAcquisitionResult | null>;
  
  /**
   * Get knowledge integration result
   * 
   * @param acquisitionResultId ID of the acquisition result
   * @returns Promise resolving to the integration result or null if not found
   */
  getIntegrationResult(
    acquisitionResultId: string
  ): Promise<KnowledgeIntegrationResult | null>;
} 