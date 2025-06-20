/**
 * Tool Delegation Protocol
 * 
 * Implements standardized protocol for agents to request tool execution from other agents.
 * Following IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions, immutable data.
 */

import { ulid } from 'ulid';
import { StructuredId } from '../../../types/entity-identifier';

/**
 * Tool delegation request structure
 */
export interface ToolDelegationRequest {
  readonly id: string;
  readonly fromAgentId: string;
  readonly toAgentId: string;
  readonly toolName: string;
  readonly parameters: Record<string, unknown>;
  readonly priority: ToolDelegationPriority;
  readonly timeout: number;
  readonly correlationId: string;
  readonly createdAt: Date;
  readonly requiredCapabilities: readonly string[];
  readonly metadata: Record<string, unknown>;
}

/**
 * Tool delegation response structure
 */
export interface ToolDelegationResponse {
  readonly id: string;
  readonly requestId: string;
  readonly fromAgentId: string;
  readonly toAgentId: string;
  readonly status: ToolDelegationStatus;
  readonly result?: unknown;
  readonly error?: ToolDelegationError;
  readonly executionTime: number;
  readonly completedAt: Date;
  readonly metadata: Record<string, unknown>;
}

/**
 * Tool delegation priority levels
 */
export enum ToolDelegationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical'
}

/**
 * Tool delegation status
 */
export enum ToolDelegationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REJECTED = 'rejected',
  TIMEOUT = 'timeout'
}

/**
 * Tool delegation error structure
 */
export interface ToolDelegationError {
  readonly code: string;
  readonly message: string;
  readonly details: Record<string, unknown>;
  readonly timestamp: Date;
}

/**
 * Tool capability descriptor
 */
export interface ToolCapability {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly requiredPermissions: readonly string[];
  readonly parameters: ToolParameterSchema;
  readonly executionTime: ToolExecutionTimeEstimate;
}

/**
 * Tool parameter schema
 */
export interface ToolParameterSchema {
  readonly type: 'object';
  readonly properties: Record<string, ToolParameterProperty>;
  readonly required: readonly string[];
}

/**
 * Tool parameter property
 */
export interface ToolParameterProperty {
  readonly type: string;
  readonly description: string;
  readonly required: boolean;
  readonly enum?: readonly string[];
  readonly pattern?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
}

/**
 * Tool execution time estimate
 */
export interface ToolExecutionTimeEstimate {
  readonly average: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly confidence: number;
}

/**
 * Pure function to create tool delegation request
 */
export function createToolDelegationRequest(params: {
  readonly fromAgentId: string;
  readonly toAgentId: string;
  readonly toolName: string;
  readonly parameters: Record<string, unknown>;
  readonly priority?: ToolDelegationPriority;
  readonly timeout?: number;
  readonly requiredCapabilities?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}): ToolDelegationRequest {
  const id = ulid();
  const correlationId = ulid();
  const createdAt = new Date();

  return {
    id,
    fromAgentId: params.fromAgentId,
    toAgentId: params.toAgentId,
    toolName: params.toolName,
    parameters: { ...params.parameters },
    priority: params.priority ?? ToolDelegationPriority.NORMAL,
    timeout: params.timeout ?? 30000,
    correlationId,
    createdAt,
    requiredCapabilities: params.requiredCapabilities ?? [],
    metadata: { ...params.metadata ?? {} }
  };
}

/**
 * Pure function to create tool delegation response
 */
export function createToolDelegationResponse(params: {
  readonly requestId: string;
  readonly fromAgentId: string;
  readonly toAgentId: string;
  readonly status: ToolDelegationStatus;
  readonly result?: unknown;
  readonly error?: ToolDelegationError;
  readonly executionTime: number;
  readonly metadata?: Record<string, unknown>;
}): ToolDelegationResponse {
  const id = ulid();
  const completedAt = new Date();

  return {
    id,
    requestId: params.requestId,
    fromAgentId: params.fromAgentId,
    toAgentId: params.toAgentId,
    status: params.status,
    result: params.result,
    error: params.error,
    executionTime: params.executionTime,
    completedAt,
    metadata: { ...params.metadata ?? {} }
  };
}

/**
 * Pure function to create tool delegation error
 */
export function createToolDelegationError(params: {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}): ToolDelegationError {
  return {
    code: params.code,
    message: params.message,
    details: { ...params.details ?? {} },
    timestamp: new Date()
  };
}

/**
 * Validation functions
 */
export function validateToolDelegationRequest(request: ToolDelegationRequest): readonly string[] {
  const errors: string[] = [];

  if (!request.id) errors.push('Request ID is required');
  if (!request.fromAgentId) errors.push('From agent ID is required');
  if (!request.toAgentId) errors.push('To agent ID is required');
  if (!request.toolName) errors.push('Tool name is required');
  if (!request.parameters) errors.push('Parameters are required');
  if (request.timeout <= 0) errors.push('Timeout must be positive');

  return errors;
}

export function validateToolDelegationResponse(response: ToolDelegationResponse): readonly string[] {
  const errors: string[] = [];

  if (!response.id) errors.push('Response ID is required');
  if (!response.requestId) errors.push('Request ID is required');
  if (!response.fromAgentId) errors.push('From agent ID is required');
  if (!response.toAgentId) errors.push('To agent ID is required');
  if (!response.status) errors.push('Status is required');
  if (response.executionTime < 0) errors.push('Execution time cannot be negative');

  return errors;
}

/**
 * Tool delegation protocol constants
 */
export const TOOL_DELEGATION_CONSTANTS = {
  DEFAULT_TIMEOUT: 30000,
  MAX_TIMEOUT: 300000,
  MIN_TIMEOUT: 1000,
  MAX_PARAMETER_SIZE: 1024 * 1024, // 1MB
  MAX_RESULT_SIZE: 10 * 1024 * 1024, // 10MB
  DEFAULT_PRIORITY: ToolDelegationPriority.NORMAL
} as const; 