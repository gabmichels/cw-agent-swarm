/**
 * Tool Delegation Protocol
 * 
 * Standardized protocol for agents to request tools from other agents.
 * Following IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions, immutability
 */

import { ulid } from 'ulid';
import { StructuredId } from '../../../types/entity-identifier';

/**
 * Tool delegation request priority levels
 */
export enum ToolDelegationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * Tool delegation request status
 */
export enum ToolDelegationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout'
}

/**
 * Tool capability categories
 */
export enum ToolCapabilityCategory {
  EMAIL = 'email',
  SOCIAL_MEDIA = 'social_media',
  WORKSPACE = 'workspace',
  COMMUNICATION = 'communication',
  ANALYTICS = 'analytics',
  FILE_PROCESSING = 'file_processing',
  CUSTOM = 'custom'
}

/**
 * Immutable tool delegation request
 */
export interface ToolDelegationRequest {
  readonly id: StructuredId;
  readonly requestingAgentId: string;
  readonly targetAgentId?: string; // Optional - can be auto-discovered
  readonly toolName: string;
  readonly toolCategory: ToolCapabilityCategory;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly priority: ToolDelegationPriority;
  readonly deadline?: Date;
  readonly requiresConfirmation: boolean;
  readonly correlationId?: string;
  readonly context: Readonly<{
    reason: string;
    expectedOutcome: string;
    fallbackStrategy?: string;
  }>;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
}

/**
 * Immutable tool delegation response
 */
export interface ToolDelegationResponse {
  readonly id: StructuredId;
  readonly requestId: StructuredId;
  readonly respondingAgentId: string;
  readonly status: ToolDelegationStatus;
  readonly result?: Readonly<Record<string, unknown>>;
  readonly error?: Readonly<{
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }>;
  readonly executionTime?: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
}

/**
 * Tool capability descriptor
 */
export interface ToolCapability {
  readonly name: string;
  readonly category: ToolCapabilityCategory;
  readonly description: string;
  readonly parameters: Readonly<Record<string, {
    type: string;
    required: boolean;
    description: string;
    validation?: Record<string, unknown>;
  }>>;
  readonly permissions: readonly string[];
  readonly estimatedExecutionTime: number;
  readonly reliability: number; // 0-1 score
}

/**
 * Agent tool capabilities
 */
export interface AgentToolCapabilities {
  readonly agentId: string;
  readonly capabilities: readonly ToolCapability[];
  readonly currentLoad: number; // 0-1 utilization
  readonly availability: boolean;
  readonly lastUpdated: Date;
}

/**
 * Tool delegation protocol interface
 */
export interface IToolDelegationProtocol {
  /**
   * Create a tool delegation request
   */
  createRequest(
    requestingAgentId: string,
    toolName: string,
    parameters: Record<string, unknown>,
    options: {
      readonly targetAgentId?: string;
      readonly priority?: ToolDelegationPriority;
      readonly deadline?: Date;
      readonly requiresConfirmation?: boolean;
      readonly context: {
        reason: string;
        expectedOutcome: string;
        fallbackStrategy?: string;
      };
      readonly metadata?: Record<string, unknown>;
    }
  ): ToolDelegationRequest;

  /**
   * Find capable agents for a tool request
   */
  findCapableAgents(
    toolName: string,
    toolCategory: ToolCapabilityCategory,
    requirements?: {
      readonly permissions?: readonly string[];
      readonly maxExecutionTime?: number;
      readonly minReliability?: number;
    }
  ): Promise<readonly AgentToolCapabilities[]>;

  /**
   * Submit a delegation request
   */
  submitRequest(request: ToolDelegationRequest): Promise<ToolDelegationResponse>;

  /**
   * Process incoming delegation request
   */
  processRequest(
    request: ToolDelegationRequest,
    handler: (request: ToolDelegationRequest) => Promise<ToolDelegationResponse>
  ): Promise<ToolDelegationResponse>;

  /**
   * Get request status
   */
  getRequestStatus(requestId: StructuredId): Promise<ToolDelegationStatus>;

  /**
   * Cancel a pending request
   */
  cancelRequest(requestId: StructuredId, reason: string): Promise<boolean>;
}

/**
 * Tool delegation error types
 */
export class ToolDelegationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Readonly<Record<string, unknown>> = {}
  ) {
    super(message);
    this.name = 'ToolDelegationError';
  }
}

export class ToolCapabilityNotFoundError extends ToolDelegationError {
  constructor(
    toolName: string,
    category: ToolCapabilityCategory,
    context: Readonly<Record<string, unknown>> = {}
  ) {
    super(
      `Tool capability not found: ${toolName} in category ${category}`,
      'TOOL_CAPABILITY_NOT_FOUND',
      { toolName, category, ...context }
    );
  }
}

export class AgentNotAvailableError extends ToolDelegationError {
  constructor(
    agentId: string,
    context: Readonly<Record<string, unknown>> = {}
  ) {
    super(
      `Agent not available for tool delegation: ${agentId}`,
      'AGENT_NOT_AVAILABLE',
      { agentId, ...context }
    );
  }
}

/**
 * Pure function to create tool delegation request
 */
export const createToolDelegationRequest = (
  requestingAgentId: string,
  toolName: string,
  toolCategory: ToolCapabilityCategory,
  parameters: Record<string, unknown>,
  options: {
    readonly targetAgentId?: string;
    readonly priority?: ToolDelegationPriority;
    readonly deadline?: Date;
    readonly requiresConfirmation?: boolean;
    readonly context: {
      reason: string;
      expectedOutcome: string;
      fallbackStrategy?: string;
    };
    readonly correlationId?: string;
    readonly metadata?: Record<string, unknown>;
  }
): ToolDelegationRequest => {
  const timestamp = new Date();
  const id = {
    id: ulid(timestamp.getTime()),
    prefix: 'tool_delegation',
    timestamp,
    toString: () => `tool_delegation_${ulid(timestamp.getTime())}`
  } as StructuredId;

  return {
    id,
    requestingAgentId,
    targetAgentId: options.targetAgentId,
    toolName,
    toolCategory,
    parameters: Object.freeze({ ...parameters }),
    priority: options.priority ?? ToolDelegationPriority.NORMAL,
    deadline: options.deadline,
    requiresConfirmation: options.requiresConfirmation ?? false,
    correlationId: options.correlationId,
    context: Object.freeze({ ...options.context }),
    metadata: Object.freeze({ ...options.metadata }),
    createdAt: timestamp
  };
};

/**
 * Pure function to create tool delegation response
 */
export const createToolDelegationResponse = (
  requestId: StructuredId,
  respondingAgentId: string,
  status: ToolDelegationStatus,
  options: {
    readonly result?: Record<string, unknown>;
    readonly error?: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };
    readonly executionTime?: number;
    readonly metadata?: Record<string, unknown>;
  } = {}
): ToolDelegationResponse => {
  const timestamp = new Date();
  const id = {
    id: ulid(timestamp.getTime()),
    prefix: 'tool_delegation_response',
    timestamp,
    toString: () => `tool_delegation_response_${ulid(timestamp.getTime())}`
  } as StructuredId;

  return {
    id,
    requestId,
    respondingAgentId,
    status,
    result: options.result ? Object.freeze({ ...options.result }) : undefined,
    error: options.error ? Object.freeze({ ...options.error }) : undefined,
    executionTime: options.executionTime,
    metadata: Object.freeze({ ...options.metadata }),
    createdAt: timestamp
  };
}; 