import axios, { AxiosInstance, AxiosError } from 'axios';
import * as crypto from 'crypto';
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
  WorkflowNotFoundError,
  WorkflowRateLimitError
} from './errors/ExternalWorkflowErrors';

/**
 * Zapier service configuration
 */
export interface ZapierServiceConfig {
  readonly webhookBaseUrl?: string;
  readonly webhookSecret?: string;
  readonly timeoutMs: number;
  readonly retryAttempts: number;
  readonly retryDelayMs: number;
  readonly maxHistoryEntries: number;
}

/**
 * Zapier webhook execution tracking
 */
interface ZapierExecution {
  readonly executionId: string;
  readonly workflowId: string;
  readonly zapUrl: string;
  readonly startedAt: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  readonly timeoutHandle?: NodeJS.Timeout;
}

/**
 * Zapier workflow service implementation
 */
export class ZapierService implements IExternalWorkflowService {
  public readonly platform = 'zapier' as const;
  private readonly httpClient: AxiosInstance;
  private readonly executionCache = new Map<string, WorkflowExecutionResult>();
  private readonly activeExecutions = new Map<string, ZapierExecution>();
  private readonly executionHistory = new Map<string, WorkflowExecutionResult[]>();

  constructor(private readonly config: ZapierServiceConfig) {
    this.httpClient = axios.create({
      timeout: config.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CW-Agent-Swarm/1.0'
      }
    });

    this.httpClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 429) {
          const resetAt = new Date(Date.now() + 60000);
          throw new WorkflowRateLimitError('zapier', resetAt, {
            originalError: error.message,
            status: error.response.status
          });
        }
        throw error;
      }
    );
  }

  async testConnection(): Promise<boolean> {
    try {
      return this.validateConfiguration();
    } catch (error) {
      throw new WorkflowConnectionError(
        'zapier',
        `Failed to validate Zapier configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error: error instanceof Error ? error.message : error }
      );
    }
  }

  async getStatus(): Promise<WorkflowPlatformStatus> {
    const lastChecked = new Date();
    
    try {
      const isConnected = await this.testConnection();
      
      return {
        platform: this.platform,
        isConnected,
        lastChecked,
        health: isConnected ? 'healthy' : 'unhealthy',
        issues: isConnected ? [] : ['Configuration validation failed']
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

  async executeWorkflow(request: WorkflowExecutionRequest): Promise<WorkflowExecutionResult> {
    const executionId = WorkflowIdGenerator.generate('zap_exec');
    const startedAt = new Date();
    const logs: WorkflowExecutionLog[] = [];

    try {
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
        message: 'Starting Zapier webhook trigger',
        context: { workflowId: request.workflowId, parameters: request.parameters }
      });

      if (!this.isValidWebhookUrl(request.workflowId)) {
        throw new WorkflowValidationError(
          request.workflowId,
          ['Invalid Zapier webhook URL format']
        );
      }

      const execution: ZapierExecution = {
        executionId: executionId.toString(),
        workflowId: request.workflowId,
        zapUrl: request.workflowId,
        startedAt,
        status: 'running'
      };

      this.activeExecutions.set(executionId.toString(), execution);

      const response = await this.httpClient.post(request.workflowId, {
        ...request.parameters,
        _execution_id: executionId.toString(),
        _initiated_by: request.initiatedBy,
        _session_id: request.sessionId,
        _priority: request.priority,
        _timestamp: startedAt.toISOString()
      });

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      logs.push({
        timestamp: completedAt,
        level: 'info',
        message: 'Zapier webhook triggered successfully',
        context: { 
          status: response.status,
          responseData: response.data,
          durationMs 
        }
      });

      const result: WorkflowExecutionResult = {
        executionId,
        workflowId: request.workflowId,
        status: response.status >= 200 && response.status < 300 ? 'completed' : 'failed',
        startedAt,
        completedAt,
        durationMs,
        result: response.data,
        logs,
        error: response.status >= 400 ? {
          code: 'WEBHOOK_ERROR',
          message: `Webhook returned status ${response.status}`,
          details: { status: response.status, data: response.data }
        } : undefined
      };

      execution.status = result.status;
      this.activeExecutions.set(executionId.toString(), execution);
      this.executionCache.set(executionId.toString(), result);
      this.addToHistory(request.workflowId, result);

      return result;

    } catch (error) {
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      logs.push({
        timestamp: completedAt,
        level: 'error',
        message: 'Zapier webhook execution failed',
        context: { error: error instanceof Error ? error.message : error }
      });

      if (error instanceof WorkflowValidationError || 
          error instanceof WorkflowRateLimitError) {
        throw error;
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

      this.activeExecutions.delete(executionId.toString());
      this.executionCache.set(executionId.toString(), result);
      this.addToHistory(request.workflowId, result);

      return result;
    }
  }

  async getExecutionStatus(executionId: string): Promise<WorkflowExecutionResult> {
    const cachedResult = this.executionCache.get(executionId);
    if (cachedResult) {
      return cachedResult;
    }

    const activeExecution = this.activeExecutions.get(executionId);
    if (activeExecution) {
      const result: WorkflowExecutionResult = {
        executionId: WorkflowIdGenerator.parse(executionId),
        workflowId: activeExecution.workflowId,
        status: activeExecution.status,
        startedAt: activeExecution.startedAt,
        logs: []
      };
      return result;
    }

    throw new WorkflowNotFoundError(executionId, 'zapier');
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false;
    }

    if (execution.timeoutHandle) {
      clearTimeout(execution.timeoutHandle);
    }

    const cancelledResult: WorkflowExecutionResult = {
      executionId: WorkflowIdGenerator.parse(executionId),
      workflowId: execution.workflowId,
      status: 'cancelled',
      startedAt: execution.startedAt,
      completedAt: new Date(),
      durationMs: Date.now() - execution.startedAt.getTime(),
      logs: [{
        timestamp: new Date(),
        level: 'info',
        message: 'Execution cancelled by user'
      }]
    };

    this.executionCache.set(executionId, cancelledResult);
    this.activeExecutions.delete(executionId);
    this.addToHistory(execution.workflowId, cancelledResult);

    return true;
  }

  async getExecutionHistory(workflowId: string, limit = 50): Promise<WorkflowExecutionHistory> {
    const executions = this.executionHistory.get(workflowId) || [];
    const limitedExecutions = executions.slice(-limit);

    const successfulExecutions = limitedExecutions.filter(e => e.status === 'completed');
    const totalExecutions = limitedExecutions.length;
    const successRate = totalExecutions > 0 ? successfulExecutions.length / totalExecutions : 0;
    const averageDurationMs = successfulExecutions.length > 0 ?
      successfulExecutions.reduce((sum, e) => sum + (e.durationMs || 0), 0) / successfulExecutions.length :
      0;

    const estimatedCostPerExecution = 0.02;
    const totalCostUsd = totalExecutions * estimatedCostPerExecution;

    return {
      workflowId,
      executions: limitedExecutions,
      totalExecutions,
      successRate,
      averageDurationMs,
      totalCostUsd
    };
  }

  async validateParameters(workflowId: string, parameters: Record<string, unknown>): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    if (!this.isValidWebhookUrl(workflowId)) {
      errors.push({
        field: 'workflowId',
        code: 'INVALID_WEBHOOK_URL',
        message: 'Invalid Zapier webhook URL format'
      });
    }

    try {
      JSON.stringify(parameters);
    } catch (error) {
      errors.push({
        field: 'parameters',
        code: 'NON_SERIALIZABLE_PARAMETERS',
        message: 'Parameters must be JSON serializable'
      });
    }

    const reservedNames = ['_execution_id', '_initiated_by', '_session_id', '_priority', '_timestamp'];
    for (const reservedName of reservedNames) {
      if (reservedName in parameters) {
        errors.push({
          field: reservedName,
          code: 'RESERVED_PARAMETER_NAME',
          message: `Parameter name '${reservedName}' is reserved`
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private isValidWebhookUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname === 'hooks.zapier.com' && 
             parsedUrl.pathname.startsWith('/hooks/catch/');
    } catch {
      return false;
    }
  }

  private validateConfiguration(): boolean {
    return this.config.timeoutMs > 0 && 
           this.config.retryAttempts >= 0 && 
           this.config.retryDelayMs >= 0;
  }

  private addToHistory(workflowId: string, result: WorkflowExecutionResult): void {
    const history = this.executionHistory.get(workflowId) || [];
    history.push(result);

    if (history.length > this.config.maxHistoryEntries) {
      history.splice(0, history.length - this.config.maxHistoryEntries);
    }

    this.executionHistory.set(workflowId, history);
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  async handleWebhookCallback(
    executionId: string,
    payload: Record<string, unknown>,
    signature?: string
  ): Promise<void> {
    if (signature && !this.verifyWebhookSignature(JSON.stringify(payload), signature)) {
      throw new WorkflowExecutionError(
        executionId,
        'Invalid webhook signature'
      );
    }

    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return;
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - execution.startedAt.getTime();

    const result: WorkflowExecutionResult = {
      executionId: WorkflowIdGenerator.parse(executionId),
      workflowId: execution.workflowId,
      status: 'completed',
      startedAt: execution.startedAt,
      completedAt,
      durationMs,
      result: payload,
      logs: [{
        timestamp: completedAt,
        level: 'info',
        message: 'Webhook callback received',
        context: { payload }
      }]
    };

    this.executionCache.set(executionId, result);
    this.activeExecutions.delete(executionId);
    this.addToHistory(execution.workflowId, result);
  }
}
