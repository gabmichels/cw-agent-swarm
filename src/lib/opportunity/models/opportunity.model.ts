/**
 * opportunity.model.ts
 * 
 * Defines data models for the opportunity management system.
 */

import { ulid } from 'ulid';
import { MemoryEntry } from '../../../agents/shared/base/managers/MemoryManager';
import { KnowledgeEntry } from '../../../agents/shared/base/managers/KnowledgeManager.interface';

/**
 * Sources from which opportunities can be detected
 */
export enum OpportunitySource {
  MARKET_DATA = 'market_data',
  NEWS = 'news',
  MEMORY_PATTERN = 'memory_pattern',
  USER_INTERACTION = 'user_interaction',
  CALENDAR = 'calendar',
  SCHEDULE = 'schedule',
  COLLABORATION = 'collaboration',
  KNOWLEDGE_GRAPH = 'knowledge_graph',
  ANALYTICS = 'analytics',
  EXTERNAL_API = 'external_api'
}

/**
 * Types of opportunities that can be detected
 */
export enum OpportunityType {
  TASK_OPTIMIZATION = 'task_optimization',
  ERROR_PREVENTION = 'error_prevention',
  RESOURCE_OPTIMIZATION = 'resource_optimization',
  USER_ASSISTANCE = 'user_assistance',
  SCHEDULE_OPTIMIZATION = 'schedule_optimization',
  KNOWLEDGE_ACQUISITION = 'knowledge_acquisition',
  MARKET_OPPORTUNITY = 'market_opportunity',
  COLLABORATION = 'collaboration',
  IMPROVEMENT = 'improvement',
  RISK_MITIGATION = 'risk_mitigation'
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
 * Opportunity time sensitivity levels
 */
export enum TimeSensitivity {
  IMMEDIATE = 'immediate',     // Within the next hour
  URGENT = 'urgent',           // Within the next 4 hours
  IMPORTANT = 'important',     // Within the next day
  STANDARD = 'standard',       // Within the next 2-3 days
  LONG_TERM = 'long_term'      // Within the next week or more
}

/**
 * Lifecycle stages of an opportunity
 */
export enum OpportunityStatus {
  DETECTED = 'detected',       // Initial state, just detected
  EVALUATING = 'evaluating',   // Being evaluated
  PENDING = 'pending',         // Evaluated but not acted upon
  IN_PROGRESS = 'in_progress', // Being acted upon
  COMPLETED = 'completed',     // Successfully acted upon
  DECLINED = 'declined',       // Deliberately not acted upon
  EXPIRED = 'expired',         // No longer valid or relevant
  FAILED = 'failed'            // Attempt to act upon it failed
}

/**
 * A pattern recognized in data that might indicate an opportunity
 */
export interface RecognizedPattern {
  type: string;
  description: string;
  source: string;
  confidence: number;
  keywords: string[];
  relatedEntities?: string[];
}

/**
 * Resource estimation for acting on an opportunity
 */
export interface ResourceEstimation {
  estimatedMinutes: number;
  priorityLevel: OpportunityPriority;
  complexityLevel: 'low' | 'medium' | 'high';
  requiredCapabilities?: string[];
}

/**
 * Trigger that led to an opportunity being detected
 */
export interface OpportunityTrigger {
  id: string;
  type: string;
  source: OpportunitySource;
  timestamp: Date;
  content: string;
  confidence: number;
  patterns?: RecognizedPattern[];
  context: Record<string, unknown>;
}

/**
 * Contextual information about an opportunity
 */
export interface OpportunityContext {
  agentId: string;
  timestamp: Date;
  source: string;
  recentMemories?: MemoryEntry[];
  relevantKnowledge?: KnowledgeEntry[];
  relatedOpportunities?: string[];
  environmentFactors?: Record<string, unknown>;
  userPreferences?: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

/**
 * Result of acting on an opportunity
 */
export interface OpportunityResult {
  successful: boolean;
  completedAt: Date;
  outcomeDescription: string;
  createdTaskIds?: string[];
  generatedInsights?: string[];
  metrics?: Record<string, number>;
  feedback?: {
    userFeedback?: string;
    systemFeedback?: string;
    rating?: number;
  };
}

/**
 * Score breakdown for an opportunity's evaluation
 */
export interface OpportunityScore {
  overall: number;           // 0-1 overall score
  relevance: number;         // How relevant to agent's goals
  actionability: number;     // How actionable it is
  urgency: number;           // How time-sensitive
  impact: number;            // Potential impact of acting
  confidence: number;        // Confidence in the assessment
  riskLevel: number;         // Risk level (higher = more risky)
  resourceEfficiency: number; // Efficiency of resource use
}

/**
 * Core opportunity model
 */
export interface Opportunity {
  id: string;
  title: string;
  description: string;
  type: OpportunityType;
  priority: OpportunityPriority;
  status: OpportunityStatus;
  source: OpportunitySource;
  trigger: OpportunityTrigger;
  context: OpportunityContext;
  score?: OpportunityScore;
  timeSensitivity: TimeSensitivity;
  resourceNeeded?: ResourceEstimation;
  detectedAt: Date;
  evaluatedAt?: Date;
  updatedAt: Date;
  validUntil?: Date;
  result?: OpportunityResult;
  tags: string[];
}

/**
 * Options for creating a new opportunity
 */
export interface OpportunityCreationOptions {
  title: string;
  description: string;
  type: OpportunityType;
  priority?: OpportunityPriority;
  source: OpportunitySource;
  trigger: Omit<OpportunityTrigger, 'id'>;
  context: Omit<OpportunityContext, 'timestamp'>;
  timeSensitivity?: TimeSensitivity;
  resourceNeeded?: ResourceEstimation;
  validUntil?: Date;
  tags?: string[];
}

/**
 * Filter for querying opportunities
 */
export interface OpportunityFilter {
  ids?: string[];
  types?: OpportunityType[];
  priorities?: OpportunityPriority[];
  statuses?: OpportunityStatus[];
  sources?: OpportunitySource[];
  agentIds?: string[];
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  timeSensitivities?: TimeSensitivity[];
  tags?: string[];
  searchText?: string;
  minConfidence?: number;
}

/**
 * Options for ordering opportunity results
 */
export interface OpportunityOrderOptions {
  field: 'priority' | 'detectedAt' | 'validUntil' | 'score' | 'updatedAt';
  direction: 'asc' | 'desc';
}

/**
 * Create a new opportunity from creation options
 */
export function createOpportunity(options: OpportunityCreationOptions): Opportunity {
  const now = new Date();
  const id = ulid();
  
  // Set default priority if not provided
  const priority = options.priority || OpportunityPriority.MEDIUM;
  
  // Set default time sensitivity if not provided
  const timeSensitivity = options.timeSensitivity || TimeSensitivity.STANDARD;
  
  return {
    id,
    title: options.title,
    description: options.description,
    type: options.type,
    priority,
    status: OpportunityStatus.DETECTED,
    source: options.source,
    trigger: {
      id: ulid(),
      ...options.trigger
    },
    context: {
      ...options.context,
      timestamp: now
    },
    timeSensitivity,
    resourceNeeded: options.resourceNeeded,
    detectedAt: now,
    updatedAt: now,
    validUntil: options.validUntil || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
    tags: options.tags || []
  };
}

/**
 * Update an opportunity's status
 */
export function updateOpportunityStatus(
  opportunity: Opportunity, 
  status: OpportunityStatus,
  result?: OpportunityResult
): Opportunity {
  return {
    ...opportunity,
    status,
    updatedAt: new Date(),
    result: result || opportunity.result
  };
} 