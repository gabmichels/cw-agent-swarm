import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  WorkflowSearchQuery,
  WorkflowSearchResult,
  N8nWorkflowTemplate,
  WorkflowDetails,
  WorkflowCategory,
  WorkflowComplexity,
  WorkflowId,
  WorkflowIdGenerator,
  WorkflowSearchError,
  WorkflowDownloadError
} from '../../../types/workflow';
import { logger } from '../../../lib/logging';

// === Workflow JSON Definition ===

interface N8nWorkflowJson {
  readonly name: string;
  readonly nodes: readonly N8nNode[];
  readonly connections: Record<string, unknown>;
  readonly active: boolean;
  readonly settings?: Record<string, unknown>;
  readonly staticData?: Record<string, unknown>;
  readonly tags?: readonly string[];
  readonly triggerCount?: number;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

interface N8nNode {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly typeVersion: number;
  readonly position: readonly [number, number];
  readonly parameters: Record<string, unknown>;
}

// === API Client Interface ===

export interface IN8nWorkflowApiClient {
  // Search Operations  
  searchWorkflows(query: WorkflowSearchQuery): Promise<WorkflowSearchResult>;
  getWorkflowsByCategory(category: WorkflowCategory): Promise<readonly N8nWorkflowTemplate[]>;
  getWorkflowDetails(filename: string): Promise<WorkflowDetails>;
  
  // Browse Operations
  getAllCategories(): Promise<readonly WorkflowCategory[]>;
  getPopularWorkflows(limit?: number): Promise<readonly N8nWorkflowTemplate[]>;
  getRecentWorkflows(limit?: number): Promise<readonly N8nWorkflowTemplate[]>;
  
  // Advanced Discovery
  findSimilarWorkflows(workflowId: WorkflowId): Promise<readonly N8nWorkflowTemplate[]>;
  getWorkflowsByIntegration(service: string): Promise<readonly N8nWorkflowTemplate[]>;
  getWorkflowsByComplexity(complexity: WorkflowComplexity): Promise<readonly N8nWorkflowTemplate[]>;
  
  // Repository Access
  downloadWorkflowJson(filename: string): Promise<N8nWorkflowJson>;
  getRepositoryStats(): Promise<{ totalWorkflows: number; lastUpdated: Date }>;
}

// === Implementation ===

export class N8nWorkflowApiClient implements IN8nWorkflowApiClient {
  private readonly serviceName = 'N8nWorkflowApiClient';
  private readonly httpClient: AxiosInstance;
  private readonly logger = logger;
  private readonly baseUrl: string;

  constructor(port = 8001) {
    this.baseUrl = `http://localhost:${port}`;
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  // === Search Operations ===

  async searchWorkflows(query: WorkflowSearchQuery): Promise<WorkflowSearchResult> {
    this.logger.debug(`[${this.serviceName}] Searching workflows`, { query });

    try {
      const response = await this.httpClient.get('/api/workflows/search', {
        params: this.buildSearchParams(query)
      });

      const result = this.transformSearchResult(response.data);
      this.logger.debug(`[${this.serviceName}] Search completed`, {
        resultCount: result.workflows.length,
        total: result.total
      });

      return result;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Search failed`, {
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new WorkflowSearchError(
        'Failed to search workflows',
        { query, originalError: error }
      );
    }
  }

  async getWorkflowsByCategory(category: WorkflowCategory): Promise<readonly N8nWorkflowTemplate[]> {
    this.logger.debug(`[${this.serviceName}] Fetching workflows by category`, { category });

    try {
      const response = await this.httpClient.get(`/api/workflows/category/${category}`);
      const workflows = response.data.map((item: any) => this.transformWorkflowItem(item));

      this.logger.debug(`[${this.serviceName}] Category workflows retrieved`, {
        category,
        count: workflows.length
      });

      return workflows;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to get workflows by category`, {
        category,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new WorkflowSearchError(
        `Failed to get workflows for category: ${category}`,
        { category, originalError: error }
      );
    }
  }

  async getWorkflowDetails(filename: string): Promise<WorkflowDetails> {
    this.logger.debug(`[${this.serviceName}] Fetching workflow details`, { filename });

    try {
      const response = await this.httpClient.get(`/api/workflows/details/${filename}`);
      const details = this.transformWorkflowDetails(response.data);

      this.logger.debug(`[${this.serviceName}] Workflow details retrieved`, {
        filename,
        name: details.name
      });

      return details;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to get workflow details`, {
        filename,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new WorkflowSearchError(
        `Failed to get details for workflow: ${filename}`,
        { filename, originalError: error }
      );
    }
  }

  // === Browse Operations ===

  async getAllCategories(): Promise<readonly WorkflowCategory[]> {
    this.logger.debug(`[${this.serviceName}] Fetching all categories`);

    try {
      const response = await this.httpClient.get('/api/categories');
      const categories = response.data as WorkflowCategory[];

      this.logger.debug(`[${this.serviceName}] Categories retrieved`, {
        count: categories.length
      });

      return categories;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to get categories`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new WorkflowSearchError(
        'Failed to get workflow categories',
        { originalError: error }
      );
    }
  }

  async getPopularWorkflows(limit = 20): Promise<readonly N8nWorkflowTemplate[]> {
    this.logger.debug(`[${this.serviceName}] Fetching popular workflows`, { limit });

    try {
      const response = await this.httpClient.get('/api/workflows/popular', {
        params: { limit }
      });
      const workflows = response.data.map((item: any) => this.transformWorkflowItem(item));

      this.logger.debug(`[${this.serviceName}] Popular workflows retrieved`, {
        count: workflows.length
      });

      return workflows;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to get popular workflows`, {
        limit,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new WorkflowSearchError(
        'Failed to get popular workflows',
        { limit, originalError: error }
      );
    }
  }

  async getRecentWorkflows(limit = 20): Promise<readonly N8nWorkflowTemplate[]> {
    this.logger.debug(`[${this.serviceName}] Fetching recent workflows`, { limit });

    try {
      const response = await this.httpClient.get('/api/workflows/recent', {
        params: { limit }
      });
      const workflows = response.data.map((item: any) => this.transformWorkflowItem(item));

      this.logger.debug(`[${this.serviceName}] Recent workflows retrieved`, {
        count: workflows.length
      });

      return workflows;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to get recent workflows`, {
        limit,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new WorkflowSearchError(
        'Failed to get recent workflows',
        { limit, originalError: error }
      );
    }
  }

  // === Advanced Discovery ===

  async findSimilarWorkflows(workflowId: WorkflowId): Promise<readonly N8nWorkflowTemplate[]> {
    this.logger.debug(`[${this.serviceName}] Finding similar workflows`, { workflowId: workflowId.toString() });

    try {
      const response = await this.httpClient.get(`/api/workflows/similar/${workflowId.toString()}`);
      const workflows = response.data.map((item: any) => this.transformWorkflowItem(item));

      this.logger.debug(`[${this.serviceName}] Similar workflows retrieved`, {
        workflowId: workflowId.toString(),
        count: workflows.length
      });

      return workflows;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to find similar workflows`, {
        workflowId: workflowId.toString(),
        error: error instanceof Error ? error.message : String(error)
      });
      throw new WorkflowSearchError(
        `Failed to find similar workflows for: ${workflowId.toString()}`,
        { workflowId: workflowId.toString(), originalError: error }
      );
    }
  }

  async getWorkflowsByIntegration(service: string): Promise<readonly N8nWorkflowTemplate[]> {
    this.logger.debug(`[${this.serviceName}] Fetching workflows by integration`, { service });

    try {
      const response = await this.httpClient.get(`/api/workflows/integration/${service}`);
      const workflows = response.data.map((item: any) => this.transformWorkflowItem(item));

      this.logger.debug(`[${this.serviceName}] Integration workflows retrieved`, {
        service,
        count: workflows.length
      });

      return workflows;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to get workflows by integration`, {
        service,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new WorkflowSearchError(
        `Failed to get workflows for integration: ${service}`,
        { service, originalError: error }
      );
    }
  }

  async getWorkflowsByComplexity(complexity: WorkflowComplexity): Promise<readonly N8nWorkflowTemplate[]> {
    this.logger.debug(`[${this.serviceName}] Fetching workflows by complexity`, { complexity });

    try {
      const response = await this.httpClient.get(`/api/workflows/complexity/${complexity}`);
      const workflows = response.data.map((item: any) => this.transformWorkflowItem(item));

      this.logger.debug(`[${this.serviceName}] Complexity workflows retrieved`, {
        complexity,
        count: workflows.length
      });

      return workflows;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to get workflows by complexity`, {
        complexity,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new WorkflowSearchError(
        `Failed to get workflows for complexity: ${complexity}`,
        { complexity, originalError: error }
      );
    }
  }

  // === Repository Access ===

  async downloadWorkflowJson(filename: string): Promise<N8nWorkflowJson> {
    this.logger.debug(`[${this.serviceName}] Downloading workflow JSON`, { filename });

    try {
      const response = await this.httpClient.get(`/api/workflows/download/${filename}`);
      const workflowJson = response.data as N8nWorkflowJson;

      this.logger.debug(`[${this.serviceName}] Workflow JSON downloaded`, {
        filename,
        nodeCount: workflowJson.nodes.length
      });

      return workflowJson;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to download workflow JSON`, {
        filename,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new WorkflowDownloadError(
        `Failed to download workflow: ${filename}`,
        { filename, originalError: error }
      );
    }
  }

  async getRepositoryStats(): Promise<{ totalWorkflows: number; lastUpdated: Date }> {
    this.logger.debug(`[${this.serviceName}] Fetching repository stats`);

    try {
      const response = await this.httpClient.get('/api/stats');
      const stats = {
        totalWorkflows: response.data.totalWorkflows,
        lastUpdated: new Date(response.data.lastUpdated)
      };

      this.logger.debug(`[${this.serviceName}] Repository stats retrieved`, stats);

      return stats;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to get repository stats`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new WorkflowSearchError(
        'Failed to get repository statistics',
        { originalError: error }
      );
    }
  }

  // === Private Utility Methods ===

  private buildSearchParams(query: WorkflowSearchQuery): Record<string, string | number> {
    const params: Record<string, string | number> = {};

    if (query.q) params.q = query.q;
    if (query.category) params.category = query.category;
    if (query.trigger) params.trigger = query.trigger;
    if (query.complexity) params.complexity = query.complexity;
    if (query.integrations) params.integrations = query.integrations.join(',');
    if (query.minNodes) params.minNodes = query.minNodes;
    if (query.maxNodes) params.maxNodes = query.maxNodes;
    if (query.active !== undefined) params.active = query.active.toString();
    if (query.limit) params.limit = query.limit;
    if (query.offset) params.offset = query.offset;
    if (query.sortBy) params.sortBy = query.sortBy;
    if (query.sortOrder) params.sortOrder = query.sortOrder;

    return params;
  }

  private transformSearchResult(data: any): WorkflowSearchResult {
    return {
      workflows: data.workflows.map((item: any) => this.transformWorkflowItem(item)),
      total: data.total,
      categories: data.categories || [],
      integrations: data.integrations || [],
      searchTime: data.searchTime || 0,
      suggestions: data.suggestions || [],
      filters: data.filters || {
        availableCategories: [],
        availableTriggers: [],
        availableComplexities: [],
        nodeCountRange: { min: 0, max: 100 }
      }
    };
  }

  private transformWorkflowItem(data: any): N8nWorkflowTemplate {
    return {
      id: WorkflowIdGenerator.generate(),
      filename: data.filename,
      name: data.name,
      description: data.description || '',
      category: data.category,
      complexity: data.complexity,
      nodeCount: data.nodeCount || 0,
      triggerType: data.triggerType || 'manual',
      integrations: data.integrations || [],
      tags: data.tags || [],
      active: data.active !== false,
      downloadUrl: `${this.baseUrl}/api/workflows/download/${data.filename}`,
      diagramUrl: data.diagramUrl,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined
    };
  }

  private transformWorkflowDetails(data: any): WorkflowDetails {
    return {
      filename: data.filename,
      name: data.name,
      description: data.description || '',
      nodeCount: data.nodeCount || 0,
      complexity: data.complexity,
      triggerType: data.triggerType || 'manual',
      integrations: data.integrations || [],
      tags: data.tags || [],
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
      downloadUrl: `${this.baseUrl}/api/workflows/download/${data.filename}`,
      diagramUrl: data.diagramUrl,
      documentation: data.documentation,
      prerequisites: data.prerequisites || []
    };
  }
} 