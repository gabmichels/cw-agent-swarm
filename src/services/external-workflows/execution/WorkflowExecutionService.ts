import { logger } from '../../../lib/logging';
import {
  ExecutionId,
  ExecutionIdGenerator,
  ExecutionStatus,
  WorkflowExecutionError,
  WorkflowExecutionHistory,
  WorkflowExecutionRequest,
  WorkflowExecutionResult
} from '../../../types/workflow';
import { N8nConnectionManager } from '../integrations/N8nConnectionManager';
import { N8nWorkflowApiClient } from '../integrations/N8nWorkflowApiClient';

// === Execution Service Interface ===

export interface IWorkflowExecutionService {
  // Core Execution Operations
  executeWorkflow(userId: string, request: WorkflowExecutionRequest): Promise<WorkflowExecutionResult>;
  getExecutionStatus(executionId: ExecutionId): Promise<WorkflowExecutionResult>;
  cancelExecution(executionId: ExecutionId): Promise<boolean>;
  getExecutionHistory(userId: string, filters?: ExecutionHistoryFilters): Promise<WorkflowExecutionHistory>;

  // User Instance Management
  validateUserAccess(userId: string, workflowId: string): Promise<boolean>;
  getUserWorkflows(userId: string): Promise<UserWorkflow[]>;
}

// === Supporting Types ===

export interface ExecutionHistoryFilters {
  readonly workflowId?: string;
  readonly status?: ExecutionStatus[];
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
  readonly limit?: number;
  readonly offset?: number;
}

export interface UserWorkflow {
  readonly id: string;
  readonly name: string;
  readonly platform: 'n8n'; // Platform type for this service
  readonly description?: string;
  readonly isActive: boolean;
  readonly lastExecuted?: Date;
  readonly connectionId: string;
  readonly instanceUrl: string;
}

export interface ExecutionContext {
  readonly executionId: ExecutionId;
  readonly userId: string;
  readonly workflowId: string;
  readonly connectionId: string;
  readonly parameters: Record<string, unknown>;
  readonly startedAt: Date;
  readonly timeoutMs?: number;
}

// === Execution Service Implementation ===

export class WorkflowExecutionService implements IWorkflowExecutionService {
  private readonly serviceName = 'WorkflowExecutionService';
  private readonly logger = logger;
  private readonly executionCache = new Map<string, WorkflowExecutionResult>();

  constructor(
    private readonly connectionManager: N8nConnectionManager,
    private readonly apiClient: N8nWorkflowApiClient
  ) { }

  // === Core Execution Operations ===

  async executeWorkflow(
    userId: string,
    request: WorkflowExecutionRequest
  ): Promise<WorkflowExecutionResult> {
    const executionId = ExecutionIdGenerator.generate();

    this.logger.info(`[${this.serviceName}] Starting workflow execution`, {
      executionId: executionId.toString(),
      userId,
      workflowId: request.workflowId
    });

    try {
      // 1. Validate user access to the workflow
      const hasAccess = await this.validateUserAccess(userId, request.workflowId);
      if (!hasAccess) {
        throw new WorkflowExecutionError(
          'User does not have access to execute this workflow',
          executionId.toString(),
          { userId, workflowId: request.workflowId }
        );
      }

      // 2. Get user's N8n connection for this workflow
      const userConnections = await this.connectionManager.getUserConnections(userId);
      if (userConnections.length === 0) {
        throw new WorkflowExecutionError(
          'No N8n connections found for user',
          executionId.toString(),
          { userId }
        );
      }

      // For now, use the first active connection
      // TODO: In Phase 3, implement workflow-to-connection mapping
      const connection = userConnections[0];

      // 3. Create execution context
      const context: ExecutionContext = {
        executionId,
        userId,
        workflowId: request.workflowId,
        connectionId: connection.instanceUrl, // Using instanceUrl as identifier for now
        parameters: request.parameters || {},
        startedAt: new Date(),
        timeoutMs: request.timeoutMs
      };

      // 4. Execute the workflow via API client
      const result = await this.apiClient.executeWorkflow(
        request.workflowId,
        request.parameters
      );

      // 5. Update result with our execution context
      const finalResult: WorkflowExecutionResult = {
        ...result,
        executionId: executionId.toString(),
        workflowId: request.workflowId,
        startedAt: context.startedAt,
        metadata: {
          userId,
          connectionId: context.connectionId,
          originalExecutionId: result.executionId
        }
      };

      // 6. Cache the result for quick access
      this.executionCache.set(executionId.toString(), finalResult);

      this.logger.info(`[${this.serviceName}] Workflow execution initiated successfully`, {
        executionId: executionId.toString(),
        status: result.status,
        originalExecutionId: result.executionId
      });

      return finalResult;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to execute workflow`, {
        executionId: executionId.toString(),
        userId,
        workflowId: request.workflowId,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof WorkflowExecutionError) {
        throw error;
      }

      throw new WorkflowExecutionError(
        'Failed to execute workflow',
        executionId.toString(),
        { userId, workflowId: request.workflowId, originalError: error }
      );
    }
  }

  async getExecutionStatus(executionId: ExecutionId): Promise<WorkflowExecutionResult> {
    this.logger.debug(`[${this.serviceName}] Getting execution status`, {
      executionId: executionId.toString()
    });

    try {
      // 1. Check cache first
      const cachedResult = this.executionCache.get(executionId.toString());
      if (cachedResult) {
        // If execution is still running, fetch fresh status
        if (cachedResult.status === 'pending' || cachedResult.status === 'running') {
          const freshStatus = await this.fetchFreshExecutionStatus(cachedResult);
          if (freshStatus) {
            this.executionCache.set(executionId.toString(), freshStatus);
            return freshStatus;
          }
        }
        return cachedResult;
      }

      // 2. If not in cache, this execution might not exist or be from another session
      throw new WorkflowExecutionError(
        `Execution not found: ${executionId.toString()}`,
        executionId.toString()
      );

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to get execution status`, {
        executionId: executionId.toString(),
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof WorkflowExecutionError) {
        throw error;
      }

      throw new WorkflowExecutionError(
        'Failed to get execution status',
        executionId.toString(),
        { originalError: error }
      );
    }
  }

  async cancelExecution(executionId: ExecutionId): Promise<boolean> {
    this.logger.debug(`[${this.serviceName}] Cancelling execution`, {
      executionId: executionId.toString()
    });

    try {
      // 1. Get execution details from cache
      const execution = this.executionCache.get(executionId.toString());
      if (!execution) {
        throw new WorkflowExecutionError(
          `Execution not found: ${executionId.toString()}`,
          executionId.toString()
        );
      }

      // 2. Only cancel if execution is still running
      if (execution.status !== 'pending' && execution.status !== 'running') {
        this.logger.warn(`[${this.serviceName}] Cannot cancel execution in status: ${execution.status}`, {
          executionId: executionId.toString(),
          status: execution.status
        });
        return false;
      }

      // 3. Use the original execution ID for cancellation
      const originalExecutionId = execution.metadata?.originalExecutionId as string;
      if (!originalExecutionId) {
        throw new WorkflowExecutionError(
          'Original execution ID not found in metadata',
          executionId.toString()
        );
      }

      // 4. Cancel via API client
      const success = await this.apiClient.cancelExecution(originalExecutionId);

      if (success) {
        // 5. Update cached status
        const updatedExecution: WorkflowExecutionResult = {
          ...execution,
          status: 'cancelled',
          completedAt: new Date()
        };
        this.executionCache.set(executionId.toString(), updatedExecution);

        this.logger.info(`[${this.serviceName}] Execution cancelled successfully`, {
          executionId: executionId.toString(),
          originalExecutionId
        });
      }

      return success;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to cancel execution`, {
        executionId: executionId.toString(),
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof WorkflowExecutionError) {
        throw error;
      }

      throw new WorkflowExecutionError(
        'Failed to cancel execution',
        executionId.toString(),
        { originalError: error }
      );
    }
  }

  async getExecutionHistory(
    userId: string,
    filters: ExecutionHistoryFilters = {}
  ): Promise<WorkflowExecutionHistory> {
    this.logger.debug(`[${this.serviceName}] Getting execution history`, {
      userId,
      filters
    });

    try {
      // 1. Get executions from cache (in a real implementation, this would be from database)
      const userExecutions = Array.from(this.executionCache.values())
        .filter(exec => exec.metadata?.userId === userId);

      // 2. Apply filters
      let filteredExecutions = userExecutions;

      if (filters.workflowId) {
        filteredExecutions = filteredExecutions.filter(
          exec => exec.workflowId === filters.workflowId
        );
      }

      if (filters.status && filters.status.length > 0) {
        filteredExecutions = filteredExecutions.filter(
          exec => filters.status!.includes(exec.status)
        );
      }

      if (filters.dateFrom) {
        filteredExecutions = filteredExecutions.filter(
          exec => exec.startedAt >= filters.dateFrom!
        );
      }

      if (filters.dateTo) {
        filteredExecutions = filteredExecutions.filter(
          exec => exec.startedAt <= filters.dateTo!
        );
      }

      // 3. Sort by start date (newest first)
      filteredExecutions.sort(
        (a, b) => b.startedAt.getTime() - a.startedAt.getTime()
      );

      // 4. Apply pagination
      const offset = filters.offset || 0;
      const limit = filters.limit || 50;
      const paginatedExecutions = filteredExecutions.slice(offset, offset + limit);

      const history: WorkflowExecutionHistory = {
        executions: paginatedExecutions,
        total: filteredExecutions.length,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit
      };

      this.logger.debug(`[${this.serviceName}] Execution history retrieved`, {
        userId,
        total: history.total,
        returned: history.executions.length
      });

      return history;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to get execution history`, {
        userId,
        filters,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new WorkflowExecutionError(
        'Failed to get execution history',
        undefined,
        { userId, originalError: error }
      );
    }
  }

  // === User Instance Management ===

  async validateUserAccess(userId: string, workflowId: string): Promise<boolean> {
    this.logger.debug(`[${this.serviceName}] Validating user access`, {
      userId,
      workflowId
    });

    try {
      // 1. Check if user has any N8n connections
      const userConnections = await this.connectionManager.getUserConnections(userId);
      if (userConnections.length === 0) {
        this.logger.debug(`[${this.serviceName}] User has no N8n connections`, { userId });
        return false;
      }

      // 2. For now, allow access if user has any connection
      // TODO: In Phase 3, implement proper workflow ownership validation
      this.logger.debug(`[${this.serviceName}] User access validated`, {
        userId,
        workflowId,
        connections: userConnections.length
      });

      return true;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to validate user access`, {
        userId,
        workflowId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async getUserWorkflows(userId: string): Promise<UserWorkflow[]> {
    this.logger.debug(`[${this.serviceName}] Getting user workflows`, { userId });

    try {
      // 1. Get user's N8n connections
      const userConnections = await this.connectionManager.getUserConnections(userId);
      if (userConnections.length === 0) {
        return [];
      }

      // 2. For each connection, fetch available workflows
      // TODO: In a real implementation, this would query the user's N8n instance
      // For now, return mock workflows based on connections
      const workflows: UserWorkflow[] = userConnections.flatMap((connection, index) => [
        {
          id: `workflow_${index}_1`,
          name: `Email Notification Workflow`,
          platform: 'n8n' as const,
          description: 'Send email notifications based on triggers',
          isActive: true,
          connectionId: connection.instanceUrl,
          instanceUrl: connection.instanceUrl
        },
        {
          id: `workflow_${index}_2`,
          name: `Data Sync Workflow`,
          platform: 'n8n' as const,
          description: 'Synchronize data between systems',
          isActive: true,
          connectionId: connection.instanceUrl,
          instanceUrl: connection.instanceUrl
        }
      ]);

      this.logger.debug(`[${this.serviceName}] User workflows retrieved`, {
        userId,
        count: workflows.length
      });

      return workflows;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to get user workflows`, {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  // === Private Helper Methods ===

  private async fetchFreshExecutionStatus(
    cachedExecution: WorkflowExecutionResult
  ): Promise<WorkflowExecutionResult | null> {
    try {
      const originalExecutionId = cachedExecution.metadata?.originalExecutionId as string;
      if (!originalExecutionId) {
        return null;
      }

      const freshResult = await this.apiClient.getExecution(originalExecutionId);

      // Merge with our execution context
      return {
        ...freshResult,
        executionId: cachedExecution.executionId,
        metadata: cachedExecution.metadata
      };

    } catch (error) {
      this.logger.warn(`[${this.serviceName}] Failed to fetch fresh execution status`, {
        executionId: cachedExecution.executionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
} 