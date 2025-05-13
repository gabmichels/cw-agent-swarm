/**
 * Plan Adaptation Interface
 * 
 * This file defines interfaces for plan adaptation strategies,
 * enabling dynamic plan modifications and optimizations.
 */

/**
 * Adaptation trigger types
 */
export enum AdaptationTriggerType {
  ENVIRONMENTAL_CHANGE = 'environmental_change', // Changes in environment/context
  RESOURCE_CONSTRAINT = 'resource_constraint',   // Resource limitations
  EFFICIENCY_OPTIMIZATION = 'efficiency',        // Improve execution efficiency
  ERROR_RECOVERY = 'error_recovery',             // Recovering from errors
  USER_FEEDBACK = 'user_feedback',               // Based on user feedback
  GOAL_CHANGE = 'goal_change',                   // Changes in goal/objective
  OPPORTUNITY = 'opportunity',                   // Exploit new opportunities
  RISK_MITIGATION = 'risk_mitigation',           // Mitigate identified risks
  PERIODIC = 'periodic',                         // Regular review/adaptation
  MANUAL = 'manual'                              // Manual trigger
}

/**
 * Adaptation scope
 */
export enum AdaptationScope {
  FULL_PLAN = 'full_plan',         // Adapt entire plan
  STEP_SEQUENCE = 'step_sequence', // Adapt a sequence of steps
  SINGLE_STEP = 'single_step',     // Adapt a single step
  PARAMETERS = 'parameters'        // Adapt parameter values only
}

/**
 * Adaptation strategy type
 */
export enum AdaptationStrategyType {
  SUBSTITUTION = 'substitution',   // Replace steps with alternatives
  REORDERING = 'reordering',       // Change step order
  ELIMINATION = 'elimination',     // Remove unnecessary steps
  INSERTION = 'insertion',         // Insert additional steps
  PARAMETERIZATION = 'parameterization', // Adjust parameters
  DECOMPOSITION = 'decomposition', // Break steps into sub-steps
  CONSOLIDATION = 'consolidation', // Combine steps
  PARALLELIZATION = 'parallelization', // Make steps parallel
  SERIALIZATION = 'serialization', // Make steps sequential
  DELEGATION = 'delegation'        // Delegate to other agent/system
}

/**
 * Adaptation impact assessment
 */
export interface AdaptationImpact {
  /** Impact on execution time (negative = faster) */
  timeImpactPercent: number;
  
  /** Impact on resource usage (negative = less) */
  resourceImpactPercent: number;
  
  /** Impact on plan reliability (positive = more reliable) */
  reliabilityImpactPercent: number;
  
  /** Impact on plan quality (positive = better quality) */
  qualityImpactPercent: number;
  
  /** Overall benefit score (-100 to 100) */
  overallBenefitScore: number;
  
  /** Affected steps */
  affectedSteps: string[];
  
  /** Introduced risks */
  introducedRisks?: Array<{
    description: string;
    severity: 'high' | 'medium' | 'low';
    mitigationStrategy?: string;
  }>;
  
  /** Required resources */
  requiredResources?: Record<string, number>;
}

/**
 * Adaptation opportunity
 */
export interface AdaptationOpportunity {
  /** Unique identifier */
  id: string;
  
  /** Plan ID */
  planId: string;
  
  /** Adaptation trigger */
  trigger: {
    /** Trigger type */
    type: AdaptationTriggerType;
    
    /** Trigger source */
    source: string;
    
    /** Trigger description */
    description: string;
    
    /** Trigger timestamp */
    timestamp: Date;
    
    /** Trigger context */
    context?: Record<string, unknown>;
  };
  
  /** Adaptation scope */
  scope: AdaptationScope;
  
  /** Target steps (if applicable) */
  targetSteps?: string[];
  
  /** Priority score (0-100) */
  priorityScore: number;
  
  /** Applicable strategy types */
  applicableStrategies: AdaptationStrategyType[];
  
  /** Discovery timestamp */
  discoveredAt: Date;
  
  /** Expiration timestamp */
  expiresAt?: Date;
}

/**
 * Adaptation action
 */
export interface AdaptationAction {
  /** Strategy type */
  strategyType: AdaptationStrategyType;
  
  /** Action description */
  description: string;
  
  /** Target steps */
  targetSteps: string[];
  
  /** Action details */
  details: {
    /** Steps to add (for INSERTION) */
    stepsToAdd?: Array<{
      /** Step template ID or definition */
      stepTemplate: string | Record<string, unknown>;
      
      /** Insert position (step ID to insert before/after) */
      position: {
        relativeTo: string;
        insertBefore: boolean;
      };
      
      /** Step parameters */
      parameters?: Record<string, unknown>;
    }>;
    
    /** Steps to remove (for ELIMINATION) */
    stepsToRemove?: string[];
    
    /** Steps to replace (for SUBSTITUTION) */
    replacements?: Array<{
      /** Original step ID */
      originalStepId: string;
      
      /** Replacement step template or definition */
      replacementStep: string | Record<string, unknown>;
      
      /** Parameters for replacement */
      parameters?: Record<string, unknown>;
    }>;
    
    /** New step order (for REORDERING) */
    newStepOrder?: string[];
    
    /** Parameter changes (for PARAMETERIZATION) */
    parameterChanges?: Array<{
      /** Step ID */
      stepId: string;
      
      /** Parameter name */
      paramName: string;
      
      /** New value */
      newValue: unknown;
      
      /** Reason for change */
      reason?: string;
    }>;
    
    /** Step decomposition (for DECOMPOSITION) */
    decomposition?: Array<{
      /** Original step ID */
      originalStepId: string;
      
      /** Sub-steps to replace it */
      subSteps: Array<{
        /** Step template or definition */
        stepTemplate: string | Record<string, unknown>;
        
        /** Parameters */
        parameters?: Record<string, unknown>;
      }>;
    }>;
    
    /** Step consolidation (for CONSOLIDATION) */
    consolidation?: {
      /** Steps to consolidate */
      stepIds: string[];
      
      /** Consolidated step */
      consolidatedStep: {
        /** Step template or definition */
        stepTemplate: string | Record<string, unknown>;
        
        /** Parameters */
        parameters?: Record<string, unknown>;
      };
    };
    
    /** Parallelization config (for PARALLELIZATION) */
    parallelization?: {
      /** Steps to parallelize */
      stepIds: string[];
      
      /** Max concurrent steps */
      maxConcurrency?: number;
      
      /** Dependencies to maintain */
      dependencies?: Array<{
        /** Step that must finish before */
        predecessor: string;
        
        /** Step that must wait */
        successor: string;
      }>;
    };
    
    /** Serialization config (for SERIALIZATION) */
    serialization?: {
      /** Steps to serialize */
      stepIds: string[];
      
      /** New execution order */
      executionOrder: string[];
    };
    
    /** Delegation config (for DELEGATION) */
    delegation?: {
      /** Steps to delegate */
      stepIds: string[];
      
      /** Target to delegate to */
      delegateTarget: string;
      
      /** Delegation parameters */
      delegationParams?: Record<string, unknown>;
    };
  };
  
  /** Expected impact */
  expectedImpact: AdaptationImpact;
}

/**
 * Adaptation execution result
 */
export interface AdaptationResult {
  /** Success status */
  success: boolean;
  
  /** Original plan ID */
  originalPlanId: string;
  
  /** Modified plan ID (if different) */
  modifiedPlanId: string;
  
  /** Applied opportunity */
  opportunity: AdaptationOpportunity;
  
  /** Applied action */
  action: AdaptationAction;
  
  /** Execution timestamp */
  timestamp: Date;
  
  /** Execution duration in milliseconds */
  durationMs: number;
  
  /** Modified steps */
  modifiedSteps: string[];
  
  /** Log messages */
  logs: Array<{
    level: 'info' | 'warning' | 'error';
    message: string;
    timestamp: Date;
  }>;
  
  /** Error details (if failed) */
  error?: Error | string;
  
  /** Measured impact (if available) */
  measuredImpact?: Partial<AdaptationImpact>;
}

/**
 * Adaptation strategy config
 */
export interface AdaptationStrategyConfig {
  /** Strategy ID */
  id: string;
  
  /** Strategy type */
  type: AdaptationStrategyType;
  
  /** Strategy name */
  name: string;
  
  /** Strategy description */
  description: string;
  
  /** Trigger types this strategy handles */
  triggerTypes: AdaptationTriggerType[];
  
  /** Strategy priority (higher = tried first) */
  priority: number;
  
  /** Minimum confidence threshold (0-1) */
  minConfidenceThreshold: number;
  
  /** Required capabilities */
  requiredCapabilities?: string[];
  
  /** Additional parameters */
  parameters?: Record<string, unknown>;
  
  /** Enabled status */
  enabled: boolean;
}

/**
 * Plan adaptation strategy interface
 */
export interface PlanAdaptationStrategy {
  /** Strategy configuration */
  config: AdaptationStrategyConfig;
  
  /**
   * Check if strategy can handle adaptation opportunity
   * 
   * @param opportunity Adaptation opportunity
   * @param context Additional context
   * @returns Promise resolving to compatibility assessment
   */
  canHandleOpportunity(
    opportunity: AdaptationOpportunity,
    context?: Record<string, unknown>
  ): Promise<{
    canHandle: boolean;
    confidence: number;
    reason: string;
  }>;
  
  /**
   * Generate adaptation actions
   * 
   * @param opportunity Adaptation opportunity
   * @param plan Plan data
   * @param context Additional context
   * @returns Promise resolving to adaptation actions
   */
  generateAdaptationActions(
    opportunity: AdaptationOpportunity,
    plan: Record<string, unknown>,
    context?: Record<string, unknown>
  ): Promise<AdaptationAction[]>;
  
  /**
   * Apply adaptation action
   * 
   * @param action Adaptation action
   * @param plan Plan data
   * @param context Additional context
   * @returns Promise resolving to adaptation result
   */
  applyAdaptation(
    action: AdaptationAction,
    plan: Record<string, unknown>,
    context?: Record<string, unknown>
  ): Promise<AdaptationResult>;
}

/**
 * Plan adaptation system interface
 */
export interface PlanAdaptationSystem {
  /**
   * Initialize the adaptation system
   * 
   * @param options Configuration options
   * @returns Promise resolving to initialization success
   */
  initialize(options?: Record<string, unknown>): Promise<boolean>;
  
  /**
   * Register an adaptation strategy
   * 
   * @param strategy Adaptation strategy
   * @returns Promise resolving to success
   */
  registerStrategy(strategy: PlanAdaptationStrategy): Promise<boolean>;
  
  /**
   * Unregister an adaptation strategy
   * 
   * @param strategyId Strategy ID
   * @returns Promise resolving to success
   */
  unregisterStrategy(strategyId: string): Promise<boolean>;
  
  /**
   * Get all registered strategies
   * 
   * @returns Promise resolving to array of registered strategies
   */
  getRegisteredStrategies(): Promise<PlanAdaptationStrategy[]>;
  
  /**
   * Enable a strategy
   * 
   * @param strategyId Strategy ID
   * @returns Promise resolving to success
   */
  enableStrategy(strategyId: string): Promise<boolean>;
  
  /**
   * Disable a strategy
   * 
   * @param strategyId Strategy ID
   * @returns Promise resolving to success
   */
  disableStrategy(strategyId: string): Promise<boolean>;
  
  /**
   * Detect adaptation opportunities
   * 
   * @param planId Plan ID
   * @param trigger Optional specific trigger
   * @returns Promise resolving to detected opportunities
   */
  detectOpportunities(
    planId: string,
    trigger?: {
      type: AdaptationTriggerType;
      source: string;
      description: string;
      context?: Record<string, unknown>;
    }
  ): Promise<AdaptationOpportunity[]>;
  
  /**
   * Generate adaptation actions for an opportunity
   * 
   * @param opportunityId Opportunity ID
   * @returns Promise resolving to adaptation actions
   */
  generateActions(opportunityId: string): Promise<AdaptationAction[]>;
  
  /**
   * Evaluate an adaptation action
   * 
   * @param action Adaptation action
   * @param planId Plan ID
   * @returns Promise resolving to impact assessment
   */
  evaluateAction(
    action: AdaptationAction,
    planId: string
  ): Promise<AdaptationImpact>;
  
  /**
   * Apply an adaptation action
   * 
   * @param opportunityId Opportunity ID
   * @param action Adaptation action
   * @returns Promise resolving to adaptation result
   */
  applyAdaptation(
    opportunityId: string,
    action: AdaptationAction
  ): Promise<AdaptationResult>;
  
  /**
   * Get adaptation history for a plan
   * 
   * @param planId Plan ID
   * @returns Promise resolving to adaptation history
   */
  getAdaptationHistory(planId: string): Promise<AdaptationResult[]>;
  
  /**
   * Trigger adaptation process
   * 
   * @param planId Plan ID
   * @param trigger Adaptation trigger
   * @param options Additional options
   * @returns Promise resolving to adaptation results
   */
  triggerAdaptation(
    planId: string,
    trigger: {
      type: AdaptationTriggerType;
      source: string;
      description: string;
      context?: Record<string, unknown>;
    },
    options?: {
      /** Automatically apply best adaptation */
      autoApply?: boolean;
      
      /** Preferred strategy types */
      preferredStrategies?: AdaptationStrategyType[];
      
      /** Scope for adaptation */
      scope?: AdaptationScope;
      
      /** Target steps (for scoped adaptations) */
      targetSteps?: string[];
    }
  ): Promise<{
    /** Detected opportunities */
    opportunities: AdaptationOpportunity[];
    
    /** Generated actions */
    actions: AdaptationAction[];
    
    /** Applied adaptation (if auto-apply enabled) */
    appliedAdaptation?: AdaptationResult;
  }>;
  
  /**
   * Get adaptation statistics
   * 
   * @param timeRange Optional time range
   * @returns Promise resolving to adaptation statistics
   */
  getAdaptationStatistics(timeRange?: { start: Date; end: Date }): Promise<{
    totalOpportunities: number;
    totalActions: number;
    totalApplications: number;
    successRate: number;
    opportunitiesByTrigger: Record<AdaptationTriggerType, number>;
    actionsByStrategy: Record<AdaptationStrategyType, number>;
    averageImpact: {
      timeImpactPercent: number;
      resourceImpactPercent: number;
      reliabilityImpactPercent: number;
      qualityImpactPercent: number;
      overallBenefitScore: number;
    };
    mostEffectiveStrategies: Array<{
      type: AdaptationStrategyType;
      averageBenefitScore: number;
      usageCount: number;
    }>;
  }>;
  
  /**
   * Shutdown the adaptation system
   * 
   * @returns Promise resolving to shutdown success
   */
  shutdown(): Promise<boolean>;
} 