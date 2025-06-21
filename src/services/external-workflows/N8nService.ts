import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  IExternalWorkflowService,
  WorkflowExecutionRequest,
  WorkflowExecutionResult,
  WorkflowExecutionHistory,
  WorkflowPlatformStatus,
  ValidationResult,
  ValidationError,
  WorkflowIdGenerator,
  WorkflowExecutionLog
} from './interfaces/ExternalWorkflowInterfaces';
import {
  WorkflowConnectionError,
  WorkflowExecutionError,
  WorkflowValidationError,
  WorkflowTimeoutError,
  WorkflowNotFoundError,
  WorkflowRateLimitError
} from './errors/ExternalWorkflowErrors';

/**
 * N8N API response interfaces
 */
interface N8nExecutionResponse {
  id: string;
  finished: boolean;
  mode: string;
  retryOf?: string;
  retrySuccessId?: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  data?: {
    resultData?: {
      runData?: Record<string, unknown>;
    };
    executionData?: {
      contextData?: Record<string, unknown>;
      nodeExecutionStack?: unknown[];
      metadata?: Record<string, unknown>;
      waitingExecution?: Record<string, unknown>;
      waitingExecutionSource?: Record<string, unknown>;
    };
  };
}

interface N8nWorkflowResponse {
  id: string;
  name: string;
  active: boolean;
  nodes: N8nNode[];
  connections: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  versionId: string;
}

interface N8nNode {
  id: string;
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  position: [number, number];
}

interface N8nExecuteWorkflowRequest {
  workflowData?: N8nWorkflowResponse;
  runData?: Record<string, unknown>;
}

/**
 * N8N service configuration
 */
export interface N8nServiceConfig {
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly username?: string;
  readonly password?: string;
  readonly timeoutMs: number;
  readonly retryAttempts: number;
  readonly retryDelayMs: number;
}

/**
 * N8N workflow service implementation
 * Provides integration with N8N workflow automation platform
 */
export class N8nService implements IExternalWorkflowService {
  public readonly platform = 'n8n' as const;
  private readonly httpClient: AxiosInstance;
  private readonly executionCache = new Map<string, WorkflowExecutionResult>();

  constructor(private readonly config: N8nServiceConfig) {
    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'X-N8N-API-KEY': config.apiKey })
      },
      ...(config.username && config.password && {
        auth: {
          username: config.username,
          password: config.password
        }
      })
    });

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 429) {
          const resetAt = new Date(Date.now() + 60000); // Default 1 minute
          throw new WorkflowRateLimitError('n8n', resetAt, {
            originalError: error.message,
            status: error.response.status
          });
        }
        throw error;
      }
    );
  }

  /**
   * Test connection to N8N instance
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/rest/active');
      return response.status === 200;
    } catch (error) {
      throw new WorkflowConnectionError(
        'n8n',
        `Failed to connect to N8N: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error: error instanceof Error ? error.message : error }
      );
    }
  }

  /**
   * Get N8N platform status and health information
   */
  async getStatus(): Promise<WorkflowPlatformStatus> {
    const lastChecked = new Date();
    
    try {
      const isConnected = await this.testConnection();
      
      // Get version info if available
      let version: string | undefined;
      try {
        const versionResponse = await this.httpClient.get('/rest/version');
        version = versionResponse.data?.version;
      } catch {
        // Version endpoint might not be available
      }

      return {
        platform: this.platform,
        isConnected,
        lastChecked,
        version,
        health: isConnected ? 'healthy' : 'unhealthy',
        issues: isConnected ? [] : ['Connection failed']
      };
    } catch (error) {
      return {
        platform: this.platform,
        isConnected: false,
        lastChecked,
        health: 'unhealthy',
        issues: [error instanceof Error ? error.message : 'Unknown connection error']
      };
    }
  }

  /**
   * Execute a workflow on N8N
   */
  async executeWorkflow(request: WorkflowExecutionRequest): Promise<WorkflowExecutionResult> {
    const executionId = WorkflowIdGenerator.generate('n8n_exec');
    const startedAt = new Date();
    const logs: WorkflowExecutionLog[] = [];

    try {
      // Validate parameters first
      const validationResult = await this.validateParameters(request.workflowId, request.parameters);
      if (!validationResult.isValid) {
        throw new WorkflowValidationError(
          request.workflowId,
          validationResult.errors.map(e => e.message)
        );
      }

      logs.push({
        timestamp: new Date(),
        level: 'info',
        message: 'Starting workflow execution',
        context: { workflowId: request.workflowId, parameters: request.parameters }
      });

      // Execute workflow
      const executeRequest: N8nExecuteWorkflowRequest = {
        runData: request.parameters
      };

      const response = await this.httpClient.post(
        `/rest/workflows/${request.workflowId}/execute`,
        executeRequest
      );

      const executionData: N8nExecutionResponse = response.data;
      
      // Poll for completion if needed
      const finalResult = await this.waitForCompletion(
        executionData.id,
        request.timeoutMs || this.config.timeoutMs
      );

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      logs.push({
        timestamp: completedAt,
        level: 'info',
        message: 'Workflow execution completed',
        context: { executionId: executionData.id, durationMs }
      });

      const result: WorkflowExecutionResult = {
        executionId,
        workflowId: request.workflowId,
        status: finalResult.finished ? 'completed' : 'failed',
        startedAt,
        completedAt,
        durationMs,
        result: finalResult.data?.resultData,
        logs,
        error: !finalResult.finished ? {
          code: 'EXECUTION_FAILED',
          message: 'Workflow execution did not complete successfully'
        } : undefined
      };

      // Cache the result
      this.executionCache.set(executionId.toString(), result);
      
      return result;

    } catch (error) {
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      logs.push({
        timestamp: completedAt,
        level: 'error',
        message: 'Workflow execution failed',
        context: { error: error instanceof Error ? error.message : error }
      });

      if (error instanceof WorkflowValidationError || 
          error instanceof WorkflowRateLimitError) {
        throw error;
      }

      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new WorkflowNotFoundError(request.workflowId, 'n8n');
      }

      const result: WorkflowExecutionResult = {
        executionId,
        workflowId: request.workflowId,
        status: 'failed',
        startedAt,
        completedAt,
        durationMs,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown execution error',
          details: axios.isAxiosError(error) ? {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
          } : undefined
        },
        logs
      };

      this.executionCache.set(executionId.toString(), result);
      return result;
    }
  }

  /**
   * Get workflow execution status
   */
  async getExecutionStatus(executionId: string): Promise<WorkflowExecutionResult> {
    // Check cache first
    const cachedResult = this.executionCache.get(executionId);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      const response = await this.httpClient.get(`/rest/executions/${executionId}`);
      const executionData: N8nExecutionResponse = response.data;

      const result: WorkflowExecutionResult = {
        executionId: WorkflowIdGenerator.parse(executionId),
        workflowId: executionData.workflowId,
        status: executionData.finished ? 'completed' : 'running',
        startedAt: new Date(executionData.startedAt),
        completedAt: executionData.stoppedAt ? new Date(executionData.stoppedAt) : undefined,
        durationMs: executionData.stoppedAt ? 
          new Date(executionData.stoppedAt).getTime() - new Date(executionData.startedAt).getTime() : 
          undefined,
        result: executionData.data?.resultData,
        logs: []
      };

      return result;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new WorkflowNotFoundError(executionId, 'n8n');
      }
      
      throw new WorkflowExecutionError(
        executionId,
        `Failed to get execution status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Cancel a running workflow execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    try {
      await this.httpClient.post(`/rest/executions/${executionId}/stop`);
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new WorkflowNotFoundError(executionId, 'n8n');
      }
      return false;
    }
  }

  /**
   * Get workflow execution history
   */
  async getExecutionHistory(workflowId: string, limit = 50): Promise<WorkflowExecutionHistory> {
    try {
      const response = await this.httpClient.get('/rest/executions', {
        params: {
          filter: JSON.stringify({ workflowId }),
          limit,
          includeData: false
        }
      });

      const executions: N8nExecutionResponse[] = response.data.data || [];
      
      const executionResults = executions.map(exec => ({
        executionId: WorkflowIdGenerator.generate('n8n_exec'),
        workflowId: exec.workflowId,
        status: exec.finished ? 'completed' as const : 'failed' as const,
        startedAt: new Date(exec.startedAt),
        completedAt: exec.stoppedAt ? new Date(exec.stoppedAt) : undefined,
        durationMs: exec.stoppedAt ? 
          new Date(exec.stoppedAt).getTime() - new Date(exec.startedAt).getTime() : 
          undefined,
        result: exec.data?.resultData,
        logs: []
      }));

      const successfulExecutions = executionResults.filter(e => e.status === 'completed');
      const totalExecutions = executionResults.length;
      const successRate = totalExecutions > 0 ? successfulExecutions.length / totalExecutions : 0;
      const averageDurationMs = successfulExecutions.length > 0 ?
        successfulExecutions.reduce((sum, e) => sum + (e.durationMs || 0), 0) / successfulExecutions.length :
        0;

      return {
        workflowId,
        executions: executionResults,
        totalExecutions,
        successRate,
        averageDurationMs,
        totalCostUsd: 0 // N8N typically doesn't have per-execution costs
      };
    } catch (error) {
      throw new WorkflowExecutionError(
        workflowId,
        `Failed to get execution history: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate workflow parameters
   */
  async validateParameters(workflowId: string, parameters: Record<string, unknown>): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    try {
      // Get workflow definition to validate against
      const response = await this.httpClient.get(`/rest/workflows/${workflowId}`);
      const workflow: N8nWorkflowResponse = response.data;

      // Basic validation - ensure workflow exists and is active
      if (!workflow.active) {
        errors.push({
          field: 'workflow',
          code: 'WORKFLOW_INACTIVE',
          message: 'Workflow is not active'
        });
      }

      // Additional parameter validation could be added here
      // based on workflow node requirements

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        errors.push({
          field: 'workflowId',
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow ${workflowId} not found`
        });
      } else {
        errors.push({
          field: 'validation',
          code: 'VALIDATION_ERROR',
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }

      return {
        isValid: false,
        errors
      };
    }
  }

  /**
   * Wait for workflow execution to complete
   */
  private async waitForCompletion(
    executionId: string,
    timeoutMs: number
  ): Promise<N8nExecutionResponse> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await this.httpClient.get(`/rest/executions/${executionId}`);
        const execution: N8nExecutionResponse = response.data;

        if (execution.finished || execution.stoppedAt) {
          return execution;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        // If we can't get status, assume execution failed
        throw new WorkflowExecutionError(
          executionId,
          `Failed to poll execution status: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    throw new WorkflowTimeoutError(executionId, timeoutMs);
  }
} 