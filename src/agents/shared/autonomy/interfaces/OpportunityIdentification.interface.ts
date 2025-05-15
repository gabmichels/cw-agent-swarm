/**
 * OpportunityIdentification.interface.ts
 * 
 * Defines interfaces for opportunity identification and trigger detection
 * in autonomous agents.
 */

import { MemoryEntry } from '../../../../lib/agents/base/managers/MemoryManager';
import { KnowledgeEntry } from '../../../../lib/agents/base/managers/KnowledgeManager';

/**
 * Opportunity types that can be identified
 */
export enum OpportunityType {
  TASK_OPTIMIZATION = 'task_optimization',
  ERROR_PREVENTION = 'error_prevention',
  RESOURCE_OPTIMIZATION = 'resource_optimization',
  USER_ASSISTANCE = 'user_assistance',
  SCHEDULE_OPTIMIZATION = 'schedule_optimization',
  KNOWLEDGE_ACQUISITION = 'knowledge_acquisition',
  PERFORMANCE_OPTIMIZATION = 'performance_optimization',
  SYSTEM_OPTIMIZATION = 'system_optimization'
}

/**
 * Priority levels for opportunities
 */
export enum OpportunityPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Options for trigger detection
 */
export interface TriggerDetectionOptions {
  /** Source of the content being analyzed */
  source?: string;
  
  /** Additional context for trigger detection */
  context?: Record<string, unknown>;
  
  /** Minimum confidence threshold */
  minConfidence?: number;
  
  /** Specific trigger types to look for */
  triggerTypes?: string[];
}

/**
 * Trigger detected in content
 */
export interface OpportunityTrigger {
  /** Unique identifier */
  id: string;
  
  /** Trigger type */
  type: string;
  
  /** Source of the trigger */
  source: string;
  
  /** When the trigger was detected */
  timestamp: Date;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Additional context */
  context: Record<string, unknown>;
}

/**
 * Context for an identified opportunity
 */
export interface OpportunityContext {
  /** Original trigger context */
  trigger: Record<string, unknown>;
  
  /** When the context was gathered */
  timestamp: Date;
  
  /** Source of the context */
  source: string;
  
  /** Recent relevant memories */
  recentMemories?: MemoryEntry[];
  
  /** Relevant knowledge items */
  relevantKnowledge?: KnowledgeEntry[];
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * An identified opportunity
 */
export interface IdentifiedOpportunity {
  /** Unique identifier */
  id: string;
  
  /** Opportunity type */
  type: OpportunityType;
  
  /** Original trigger */
  trigger: OpportunityTrigger;
  
  /** Priority level */
  priority: OpportunityPriority;
  
  /** Opportunity context */
  context: OpportunityContext;
  
  /** When the opportunity was detected */
  detectedAt: Date;
  
  /** Current status */
  status: string;
  
  /** When the opportunity expires */
  validUntil?: Date;
  
  /** Last status update */
  lastUpdated?: Date;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Result if opportunity was acted on */
  result?: Record<string, unknown>;
}

/**
 * Result of opportunity detection
 */
export interface OpportunityDetectionResult {
  /** Identified opportunities */
  opportunities: IdentifiedOpportunity[];
  
  /** When detection was performed */
  timestamp: Date;
  
  /** Source of detection */
  source: string;
  
  /** Number of triggers analyzed */
  triggerCount: number;
  
  /** Number of successful identifications */
  successfulIdentifications: number;
}

/**
 * Interface for opportunity identification
 */
export interface OpportunityIdentifier {
  /**
   * Initialize the identifier
   */
  initialize(): Promise<boolean>;
  
  /**
   * Detect triggers in content
   */
  detectTriggers(
    content: string,
    options?: TriggerDetectionOptions
  ): Promise<OpportunityTrigger[]>;
  
  /**
   * Identify opportunities from triggers
   */
  identifyOpportunities(
    triggers: OpportunityTrigger[]
  ): Promise<OpportunityDetectionResult>;
  
  /**
   * Get identified opportunities
   */
  getOpportunities(filter?: {
    type?: OpportunityType;
    priority?: OpportunityPriority;
    status?: string;
  }): Promise<IdentifiedOpportunity[]>;
  
  /**
   * Update opportunity status
   */
  updateOpportunityStatus(
    opportunityId: string,
    status: string,
    result?: Record<string, unknown>
  ): Promise<boolean>;
  
  /**
   * Clear expired opportunities
   */
  clearExpiredOpportunities(): Promise<number>;
} 