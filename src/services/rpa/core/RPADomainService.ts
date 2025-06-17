import {
  IRPAWorkflow,
  WorkflowInfo,
  RPADomainConfig,
  Logger,
  RPAExecutionOptions,
  RPAError,
  IdGenerator
} from '../types/RPATypes';
import { RPAWorkflowManager } from './RPAWorkflowManager';

// Base domain service - all domain-specific RPA services extend this
export abstract class RPADomainService {
  protected readonly workflows: Map<string, IRPAWorkflow> = new Map();
  protected readonly workflowManager: RPAWorkflowManager;

  constructor(
    protected readonly domain: string,
    protected readonly config: RPADomainConfig,
    protected readonly logger: Logger
  ) {
    this.workflowManager = new RPAWorkflowManager(config, logger);
    this.registerWorkflows();
    this.logger.info('RPA domain service initialized', { 
      domain: this.domain,
      workflowCount: this.workflows.size 
    });
  }

  /**
   * Abstract method to register domain-specific workflows
   * Must be implemented by each domain service
   */
  protected abstract registerWorkflows(): void;

  /**
   * Execute a workflow by ID with the given parameters
   * @param workflowId - The ID of the workflow to execute
   * @param params - Parameters for the workflow
   * @param options - Execution options
   * @returns The workflow execution result
   */
  async executeWorkflow<T>(
    workflowId: string,
    params: Record<string, unknown>,
    options: RPAExecutionOptions = {}
  ): Promise<T> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new RPAError(
        `Workflow not found: ${workflowId}`,
        'WORKFLOW_NOT_FOUND',
        { workflowId, domain: this.domain, availableWorkflows: Array.from(this.workflows.keys()) }
      );
    }

    this.logger.info('Executing RPA workflow', {
      workflowId,
      domain: this.domain,
      params: this.sanitizeParams(params)
    });

    try {
      return await this.workflowManager.execute<T>(workflow, params, options);
    } catch (error) {
      this.logger.error('RPA workflow execution failed', {
        workflowId,
        domain: this.domain,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get information about all available workflows in this domain
   * @returns Array of workflow information
   */
  getAvailableWorkflows(): WorkflowInfo[] {
    return Array.from(this.workflows.values()).map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      domain: workflow.domain,
      capabilities: workflow.requiredCapabilities,
      estimatedDuration: workflow.estimatedDuration
    }));
  }

  /**
   * Get a specific workflow by ID
   * @param workflowId - The workflow ID
   * @returns The workflow instance or undefined
   */
  getWorkflow(workflowId: string): IRPAWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Check if a workflow exists in this domain
   * @param workflowId - The workflow ID to check
   * @returns True if the workflow exists
   */
  hasWorkflow(workflowId: string): boolean {
    return this.workflows.has(workflowId);
  }

  /**
   * Get the domain name
   * @returns The domain name
   */
  getDomain(): string {
    return this.domain;
  }

  /**
   * Get domain configuration
   * @returns The domain configuration
   */
  getConfig(): RPADomainConfig {
    return { ...this.config }; // Return a copy to prevent mutation
  }

  /**
   * Register a workflow with this domain service
   * @param workflow - The workflow to register
   */
  protected registerWorkflow(workflow: IRPAWorkflow): void {
    if (workflow.domain !== this.domain) {
      throw new RPAError(
        `Workflow domain mismatch: expected ${this.domain}, got ${workflow.domain}`,
        'DOMAIN_MISMATCH',
        { workflowId: workflow.id, expectedDomain: this.domain, actualDomain: workflow.domain }
      );
    }

    if (this.workflows.has(workflow.id)) {
      throw new RPAError(
        `Workflow already registered: ${workflow.id}`,
        'WORKFLOW_ALREADY_REGISTERED',
        { workflowId: workflow.id, domain: this.domain }
      );
    }

    this.workflows.set(workflow.id, workflow);
    this.logger.debug('Registered RPA workflow', {
      workflowId: workflow.id,
      domain: this.domain,
      capabilities: workflow.requiredCapabilities
    });
  }

  /**
   * Unregister a workflow from this domain service
   * @param workflowId - The workflow ID to unregister
   */
  protected unregisterWorkflow(workflowId: string): void {
    if (!this.workflows.has(workflowId)) {
      throw new RPAError(
        `Cannot unregister workflow: ${workflowId} not found`,
        'WORKFLOW_NOT_FOUND',
        { workflowId, domain: this.domain }
      );
    }

    this.workflows.delete(workflowId);
    this.logger.debug('Unregistered RPA workflow', {
      workflowId,
      domain: this.domain
    });
  }

  /**
   * Get health status of all workflows in this domain
   * @returns Array of workflow health statuses
   */
  async getWorkflowHealthStatuses(): Promise<Array<{ workflowId: string; health: import('../types/RPATypes').WorkflowHealth }>> {
    const healthChecks = Array.from(this.workflows.entries()).map(async ([workflowId, workflow]) => {
      try {
        const health = await workflow.getHealthCheck();
        return { workflowId, health };
      } catch (error) {
        return {
          workflowId,
          health: {
            status: 'unhealthy' as const,
            lastChecked: new Date(),
            issues: [`Health check failed: ${error instanceof Error ? error.message : String(error)}`]
          }
        };
      }
    });

    return Promise.all(healthChecks);
  }

  /**
   * Sanitize parameters for logging (remove sensitive data)
   * @param params - Parameters to sanitize
   * @returns Sanitized parameters
   */
  private sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential'];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = Array.isArray(value) ? '[ARRAY]' : '[OBJECT]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Cleanup resources when the service is being destroyed
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up RPA domain service', { domain: this.domain });
    await this.workflowManager.cleanup();
    this.workflows.clear();
  }
} 