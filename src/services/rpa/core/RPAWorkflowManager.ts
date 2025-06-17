import {
  IRPAWorkflow,
  RPADomainConfig,
  Logger,
  RPAExecutionOptions,
  RPAExecution,
  RPAExecutionContext,
  IdGenerator,
  RPAError,
  RPAWorkflowError,
  ValidationResult
} from '../types/RPATypes';
import { BrowserPool } from '../infrastructure/BrowserPool';
import { WorkflowHealthMonitor } from './WorkflowHealthMonitor';
import { RPARetryManager } from './RPARetryManager';

// Workflow manager handles orchestration, retries, monitoring
export class RPAWorkflowManager {
  private readonly executionQueue: Map<string, RPAExecution> = new Map();
  private readonly healthMonitor: WorkflowHealthMonitor;
  private readonly retryManager: RPARetryManager;
  private readonly browserPool: BrowserPool;

  constructor(
    private readonly config: RPADomainConfig,
    private readonly logger: Logger
  ) {
    this.browserPool = new BrowserPool(config.browserConfig, logger);
    this.healthMonitor = new WorkflowHealthMonitor(logger);
    this.retryManager = new RPARetryManager(config.retryConfig, logger);
    
    this.logger.info('RPA workflow manager initialized', {
      domain: config.domain,
      maxConcurrentExecutions: config.maxConcurrentExecutions
    });
  }

  /**
   * Execute a workflow with monitoring, retries, and proper error handling
   * @param workflow - The workflow to execute
   * @param params - Parameters for the workflow
   * @param options - Execution options
   * @returns The workflow execution result
   */
  async execute<T>(
    workflow: IRPAWorkflow,
    params: Record<string, unknown>,
    options: RPAExecutionOptions = {}
  ): Promise<T> {
    // Check concurrent execution limits
    if (this.executionQueue.size >= this.config.maxConcurrentExecutions) {
      throw new RPAError(
        'Maximum concurrent executions reached',
        'MAX_CONCURRENT_EXECUTIONS_REACHED',
        { 
          current: this.executionQueue.size, 
          max: this.config.maxConcurrentExecutions,
          workflowId: workflow.id
        }
      );
    }

    const execution = await this.createExecution(workflow, params, options);
    
    try {
      // Pre-execution validation
      await this.validateExecution(execution);
      
      // Execute workflow with monitoring
      const result = await this.executeWithMonitoring<T>(execution);
      
      // Post-execution cleanup
      await this.cleanupExecution(execution);
      
      return result;
      
    } catch (error) {
      // Handle failures with retry logic
      return await this.handleExecutionFailure<T>(execution, error);
    }
  }

  /**
   * Create an execution record for tracking
   * @param workflow - The workflow to execute
   * @param params - Parameters for the workflow
   * @param options - Execution options
   * @returns The execution record
   */
  private async createExecution(
    workflow: IRPAWorkflow,
    params: Record<string, unknown>,
    options: RPAExecutionOptions
  ): Promise<RPAExecution> {
    const executionId = IdGenerator.generate('RPA_EXEC').toString();
    const browser = await this.browserPool.getBrowser();
    const page = await browser.newPage();

    // Create execution context with all required dependencies
    const context: RPAExecutionContext = {
      executionId,
      browser,
      page,
      logger: this.logger,
      auditLogger: {
        logWorkflowExecution: async (entry) => this.logger.info('Workflow audit', entry),
        logRPAExecution: async (entry) => this.logger.info('RPA audit', entry)
      },
      credentialManager: {
        getCredentials: async () => null,
        storeCredentials: async () => {},
        deleteCredentials: async () => {}
      },
      antiDetection: {
        setupPage: async () => {},
        getRandomUserAgent: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        getRandomViewport: () => ({ width: 1920, height: 1080 })
      },
      humanBehavior: {
        humanType: async () => {},
        humanClick: async () => {},
        simulateMouseMovement: async () => {},
        randomDelay: async () => {}
      },
      startTime: new Date(),
      metadata: {}
    };

    const execution: RPAExecution = {
      id: executionId,
      workflowId: workflow.id,
      workflow,
      params,
      context,
      options: {
        timeout: options.timeout || this.config.defaultTimeout,
        retryCount: options.retryCount || this.config.retryConfig.maxAttempts,
        priority: options.priority || 'medium',
        metadata: options.metadata || {}
      },
      status: 'pending',
      startTime: new Date()
    };

    this.executionQueue.set(executionId, execution);
    return execution;
  }

  /**
   * Validate execution before running
   * @param execution - The execution to validate
   */
  private async validateExecution(execution: RPAExecution): Promise<void> {
    const { workflow, params } = execution;
    
    // Validate workflow parameters
    const validationResult: ValidationResult = await workflow.validate(params);
    if (!validationResult.isValid) {
      throw new RPAWorkflowError(
        `Workflow validation failed: ${validationResult.errors.join(', ')}`,
        workflow.id,
        { validationErrors: validationResult.errors, params }
      );
    }

    // Check workflow health
    const health = await workflow.getHealthCheck();
    if (health.status === 'unhealthy') {
      throw new RPAWorkflowError(
        `Workflow is unhealthy: ${health.issues.join(', ')}`,
        workflow.id,
        { healthIssues: health.issues }
      );
    }

    this.logger.debug('Workflow execution validated', {
      executionId: execution.id,
      workflowId: workflow.id
    });
  }

  /**
   * Execute workflow with monitoring and proper error handling
   * @param execution - The execution to run
   * @returns The workflow result
   */
  private async executeWithMonitoring<T>(execution: RPAExecution): Promise<T> {
    const { workflow, params, context } = execution;
    
    // Update execution status
    execution.status = 'running';
    
    // Start monitoring
    this.healthMonitor.startMonitoring(execution);
    
    try {
      // Execute workflow
      const result = await workflow.execute(params, context);

      // Update execution status
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.result = result;

      // Log successful execution
      await context.auditLogger.logWorkflowExecution({
        executionId: context.executionId,
        workflowId: workflow.id,
        success: true,
        duration: execution.endTime.getTime() - context.startTime.getTime(),
        result
      });

      this.logger.info('Workflow execution completed successfully', {
        executionId: execution.id,
        workflowId: workflow.id,
        duration: execution.endTime.getTime() - context.startTime.getTime()
      });

      return result as T;
      
    } catch (error) {
      // Update execution status
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = error instanceof Error ? error : new Error(String(error));

      // Log failed execution
      await context.auditLogger.logWorkflowExecution({
        executionId: context.executionId,
        workflowId: workflow.id,
        success: false,
        duration: execution.endTime.getTime() - context.startTime.getTime(),
        error: execution.error.message
      });

      throw error;
      
    } finally {
      // Stop monitoring
      this.healthMonitor.stopMonitoring(execution.id);
    }
  }

  /**
   * Handle execution failures with retry logic
   * @param execution - The failed execution
   * @param error - The error that occurred
   * @returns The retry result or throws the error
   */
  private async handleExecutionFailure<T>(
    execution: RPAExecution,
    error: unknown
  ): Promise<T> {
    const workflowError = error instanceof Error ? error : new Error(String(error));
    
    this.logger.warn('Workflow execution failed', {
      executionId: execution.id,
      workflowId: execution.workflow.id,
      error: workflowError.message
    });

    // Check if retry is possible and configured
    if (this.retryManager.shouldRetry(execution, workflowError)) {
      this.logger.info('Retrying workflow execution', {
        executionId: execution.id,
        workflowId: execution.workflow.id,
        attempt: (execution.context.metadata.retryAttempt as number || 0) + 1
      });

      // Prepare for retry
      await this.prepareForRetry(execution);
      
      // Execute retry
      return await this.retryManager.retry(execution, () => 
        this.executeWithMonitoring<T>(execution)
      );
    }

    // Cleanup failed execution
    await this.cleanupExecution(execution);
    
    // If no retry or retry exhausted, throw the error
    throw new RPAWorkflowError(
      `Workflow execution failed: ${workflowError.message}`,
      execution.workflow.id,
      { 
        executionId: execution.id,
        originalError: workflowError.message,
        retryAttempts: execution.context.metadata.retryAttempt || 0
      }
    );
  }

  /**
   * Prepare execution for retry
   * @param execution - The execution to prepare for retry
   */
  private async prepareForRetry(execution: RPAExecution): Promise<void> {
    // Close current page and create a new one
    try {
      await execution.context.page.close();
    } catch (error) {
      this.logger.warn('Failed to close page for retry', { 
        executionId: execution.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Create new page
    execution.context.page = await execution.context.browser.newPage();
    
    // Reset execution status
    execution.status = 'pending';
    execution.startTime = new Date();
    execution.endTime = undefined;
    execution.error = undefined;
    execution.result = undefined;

    // Update retry metadata
    execution.context.metadata.retryAttempt = 
      (execution.context.metadata.retryAttempt as number || 0) + 1;
  }

  /**
   * Clean up execution resources
   * @param execution - The execution to clean up
   */
  private async cleanupExecution(execution: RPAExecution): Promise<void> {
    try {
      // Close page
      if (execution.context.page && !execution.context.page.isClosed()) {
        await execution.context.page.close();
      }

      // Return browser to pool
      await this.browserPool.returnBrowser(execution.context.browser);

      // Remove from execution queue
      this.executionQueue.delete(execution.id);

      this.logger.debug('Execution cleanup completed', {
        executionId: execution.id,
        workflowId: execution.workflow.id
      });

    } catch (error) {
      this.logger.error('Failed to cleanup execution', {
        executionId: execution.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get current execution statistics
   * @returns Execution statistics
   */
  getExecutionStats(): {
    totalExecutions: number;
    runningExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
  } {
    const executions = Array.from(this.executionQueue.values());
    return {
      totalExecutions: executions.length,
      runningExecutions: executions.filter(e => e.status === 'running').length,
      completedExecutions: executions.filter(e => e.status === 'completed').length,
      failedExecutions: executions.filter(e => e.status === 'failed').length
    };
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up RPA workflow manager');
    
    // Stop all running executions
    const runningExecutions = Array.from(this.executionQueue.values())
      .filter(e => e.status === 'running');
    
    for (const execution of runningExecutions) {
      await this.cleanupExecution(execution);
    }

    // Cleanup browser pool
    await this.browserPool.cleanup();
    
    // Clear execution queue
    this.executionQueue.clear();
  }
} 