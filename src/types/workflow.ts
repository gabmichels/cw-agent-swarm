// Core workflow types for N8N premade workflows integration
import { ulid } from 'ulid';

// === Core Type Definitions ===

export type WorkflowCategory = 
  | 'messaging' 
  | 'productivity' 
  | 'email' 
  | 'social_media' 
  | 'ecommerce' 
  | 'analytics' 
  | 'calendar' 
  | 'forms' 
  | 'development' 
  | 'files' 
  | 'crm' 
  | 'general';

export type WorkflowComplexity = 'simple' | 'medium' | 'complex';

export type TriggerType = 'webhook' | 'schedule' | 'manual' | 'email' | 'form' | 'api';

// === ULID-based Entity ID ===

export interface WorkflowId {
  readonly id: string; // ULID
  readonly prefix: 'wf';
  readonly timestamp: Date;
  toString(): string;
}

export class WorkflowIdGenerator {
  static generate(): WorkflowId {
    const timestamp = new Date();
    const id = ulid(timestamp.getTime());
    return {
      id,
      prefix: 'wf',
      timestamp,
      toString: () => `wf_${id}`
    };
  }
  
  static parse(structuredId: string): WorkflowId {
    if (!structuredId.startsWith('wf_')) {
      throw new Error(`Invalid workflow ID format: ${structuredId}`);
    }
    
    const id = structuredId.substring(3);
    // Extract timestamp from ULID
    const timestamp = new Date(parseInt(id.substring(0, 10), 32) * Math.pow(2, 16));
    
    return {
      id,
      prefix: 'wf',
      timestamp,
      toString: () => structuredId
    };
  }
}

// === Core Workflow Entity ===

export interface N8nWorkflowTemplate {
  readonly id: WorkflowId;
  readonly filename: string; // Original repository filename
  readonly name: string;
  readonly description: string;
  readonly category: WorkflowCategory;
  readonly complexity: WorkflowComplexity;
  readonly nodeCount: number;
  readonly triggerType: TriggerType;
  readonly integrations: readonly string[];
  readonly tags: readonly string[];
  readonly active: boolean;
  readonly downloadUrl: string;
  readonly diagramUrl?: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

// === Integration Metadata ===

export interface Integration {
  readonly name: string;
  readonly displayName: string;
  readonly category: string;
  readonly iconUrl?: string;
  readonly documentationUrl?: string;
  readonly isPopular: boolean;
}

// === Search & Discovery ===

export interface WorkflowSearchQuery {
  readonly q?: string;
  readonly category?: WorkflowCategory;
  readonly trigger?: TriggerType;
  readonly complexity?: WorkflowComplexity;
  readonly integrations?: readonly string[];
  readonly minNodes?: number;
  readonly maxNodes?: number;
  readonly active?: boolean;
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: 'name' | 'popularity' | 'complexity' | 'recent';
  readonly sortOrder?: 'asc' | 'desc';
}

export interface WorkflowSearchResult {
  readonly workflows: readonly N8nWorkflowTemplate[];
  readonly total: number;
  readonly categories: readonly CategoryCount[];
  readonly integrations: readonly IntegrationCount[];
  readonly searchTime: number;
  readonly suggestions: readonly string[];
  readonly filters: SearchFilters;
}

export interface CategoryCount {
  readonly category: WorkflowCategory;
  readonly count: number;
}

export interface IntegrationCount {
  readonly integration: string;
  readonly count: number;
}

export interface SearchFilters {
  readonly availableCategories: readonly WorkflowCategory[];
  readonly availableTriggers: readonly TriggerType[];
  readonly availableComplexities: readonly WorkflowComplexity[];
  readonly nodeCountRange: { min: number; max: number };
}

// === Workflow Details ===

export interface WorkflowDetails {
  readonly filename: string;
  readonly name: string;
  readonly description: string;
  readonly nodeCount: number;
  readonly complexity: WorkflowComplexity;
  readonly triggerType: TriggerType;
  readonly integrations: readonly Integration[];
  readonly tags: readonly string[];
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
  readonly downloadUrl: string;
  readonly diagramUrl?: string;
  readonly documentation?: string;
  readonly prerequisites: readonly string[];
}

// === Repository Management ===

export interface RepositoryStats {
  readonly totalWorkflows: number;
  readonly activeWorkflows: number;
  readonly totalNodes: number;
  readonly uniqueIntegrations: number;
  readonly categories: readonly WorkflowCategory[];
  readonly lastUpdated: Date;
  readonly diskUsage: string;
  readonly searchIndexSize: string;
}

export interface RepositoryHealth {
  readonly status: 'healthy' | 'unhealthy';
  readonly issues: readonly string[];
  readonly lastCheck: Date;
  readonly uptime: number;
}

export interface ServerStatus {
  readonly isRunning: boolean;
  readonly port: number;
  readonly responseTime: number;
  readonly uptime: number;
  readonly memoryUsage: string;
  readonly errorRate: number;
  readonly lastHealthCheck: Date;
}

// === Error Types ===

export class WorkflowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export class WorkflowSearchError extends WorkflowError {
  constructor(
    message: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'SEARCH_FAILED', context);
    this.name = 'WorkflowSearchError';
  }
}

export class WorkflowDownloadError extends WorkflowError {
  constructor(
    message: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'DOWNLOAD_FAILED', context);
    this.name = 'WorkflowDownloadError';
  }
}

export class RepositoryError extends WorkflowError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `REPOSITORY_${code}`, context);
    this.name = 'RepositoryError';
  }
} 