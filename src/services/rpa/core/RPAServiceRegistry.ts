import { RPADomainService } from './RPADomainService';
import { WorkflowInfo, RPAError, Logger } from '../types/RPATypes';

/**
 * Central registry for all RPA domain services
 * Manages registration, discovery, and execution of workflows across domains
 */
export class RPAServiceRegistry {
  private readonly services: Map<string, RPADomainService> = new Map();

  constructor(private readonly logger: Logger) {
    this.logger.info('RPA service registry initialized');
  }

  /**
   * Register a domain service with the registry
   * @param domain - The domain name (must be unique)
   * @param service - The domain service instance
   */
  register(domain: string, service: RPADomainService): void {
    if (this.services.has(domain)) {
      throw new RPAError(
        `Domain service already registered: ${domain}`,
        'DOMAIN_ALREADY_REGISTERED',
        { domain, existingDomains: Array.from(this.services.keys()) }
      );
    }

    if (service.getDomain() !== domain) {
      throw new RPAError(
        `Domain mismatch: expected ${domain}, got ${service.getDomain()}`,
        'DOMAIN_MISMATCH',
        { expectedDomain: domain, actualDomain: service.getDomain() }
      );
    }

    this.services.set(domain, service);
    this.logger.info('Registered RPA domain service', {
      domain,
      workflowCount: service.getAvailableWorkflows().length
    });
  }

  /**
   * Unregister a domain service from the registry
   * @param domain - The domain name to unregister
   */
  async unregister(domain: string): Promise<void> {
    const service = this.services.get(domain);
    if (!service) {
      throw new RPAError(
        `Cannot unregister domain service: ${domain} not found`,
        'DOMAIN_NOT_FOUND',
        { domain, availableDomains: Array.from(this.services.keys()) }
      );
    }

    // Cleanup the service before unregistering
    await service.cleanup();
    this.services.delete(domain);
    
    this.logger.info('Unregistered RPA domain service', { domain });
  }

  /**
   * Get a domain service by name
   * @param domain - The domain name
   * @returns The domain service or undefined if not found
   */
  getService(domain: string): RPADomainService | undefined {
    return this.services.get(domain);
  }

  /**
   * Check if a domain service is registered
   * @param domain - The domain name to check
   * @returns True if the domain service is registered
   */
  hasService(domain: string): boolean {
    return this.services.has(domain);
  }

  /**
   * Get all registered domain names
   * @returns Array of registered domain names
   */
  getRegisteredDomains(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get information about all workflows across all domains
   * @returns Array of workflow information
   */
  getAllWorkflows(): WorkflowInfo[] {
    const workflows: WorkflowInfo[] = [];
    for (const service of Array.from(this.services.values())) {
      workflows.push(...service.getAvailableWorkflows());
    }
    return workflows;
  }

  /**
   * Get workflows for a specific domain
   * @param domain - The domain name
   * @returns Array of workflow information for the domain
   */
  getWorkflowsForDomain(domain: string): WorkflowInfo[] {
    const service = this.getService(domain);
    if (!service) {
      throw new RPAError(
        `Domain service not found: ${domain}`,
        'DOMAIN_NOT_FOUND',
        { domain, availableDomains: this.getRegisteredDomains() }
      );
    }
    return service.getAvailableWorkflows();
  }

  /**
   * Find workflows by capability
   * @param capability - The required capability
   * @returns Array of workflows that have the specified capability
   */
  findWorkflowsByCapability(capability: string): WorkflowInfo[] {
    const matchingWorkflows: WorkflowInfo[] = [];
    
    for (const service of Array.from(this.services.values())) {
      const workflows = service.getAvailableWorkflows();
      const matching = workflows.filter(workflow => 
        workflow.capabilities.includes(capability)
      );
      matchingWorkflows.push(...matching);
    }
    
    return matchingWorkflows;
  }

  /**
   * Execute a workflow by domain and workflow ID
   * @param domain - The domain name
   * @param workflowId - The workflow ID
   * @param params - Parameters for the workflow
   * @param options - Execution options
   * @returns The workflow execution result
   */
  async executeWorkflow<T>(
    domain: string,
    workflowId: string,
    params: Record<string, unknown>,
    options?: import('../types/RPATypes').RPAExecutionOptions
  ): Promise<T> {
    const service = this.getService(domain);
    if (!service) {
      throw new RPAError(
        `Domain service not found: ${domain}`,
        'DOMAIN_NOT_FOUND',
        { domain, workflowId, availableDomains: this.getRegisteredDomains() }
      );
    }

    this.logger.info('Executing workflow via registry', {
      domain,
      workflowId,
      params: this.sanitizeParams(params)
    });

    return await service.executeWorkflow<T>(workflowId, params, options);
  }

  /**
   * Get health status of all registered services
   * @returns Health status of all services
   */
  async getServicesHealth(): Promise<Record<string, { status: string; workflowCount: number; issues: string[] }>> {
    const health: Record<string, { status: string; workflowCount: number; issues: string[] }> = {};
    
    for (const service of Array.from(this.services.values())) {
      try {
        const workflowHealths = await service.getWorkflowHealthStatuses();
        const issues = workflowHealths
          .filter(wh => wh.health.status !== 'healthy')
          .flatMap(wh => wh.health.issues);
        
        health[service.getDomain()] = {
          status: issues.length > 0 ? 'degraded' : 'healthy',
          workflowCount: service.getAvailableWorkflows().length,
          issues
        };
      } catch (error) {
        health[service.getDomain()] = {
          status: 'unhealthy',
          workflowCount: 0,
          issues: [`Health check failed: ${error instanceof Error ? error.message : String(error)}`]
        };
      }
    }
    
    return health;
  }

  /**
   * Get execution statistics for all services
   * @returns Execution statistics
   */
  getExecutionStatistics(): Record<string, { totalExecutions: number; runningExecutions: number; completedExecutions: number; failedExecutions: number }> {
    const stats: Record<string, { totalExecutions: number; runningExecutions: number; completedExecutions: number; failedExecutions: number }> = {};
    
    for (const service of Array.from(this.services.values())) {
      // Get stats from the service's workflow manager
      // Note: This would need to be exposed by the domain service
      stats[service.getDomain()] = {
        totalExecutions: 0,
        runningExecutions: 0,
        completedExecutions: 0,
        failedExecutions: 0
      };
    }
    
    return stats;
  }

  /**
   * Get registry statistics
   * @returns Registry statistics
   */
  getStats(): {
    totalDomains: number;
    totalWorkflows: number;
    workflowsByDomain: Record<string, number>;
  } {
    const workflowsByDomain: Record<string, number> = {};
    let totalWorkflows = 0;

    for (const [domain, service] of Array.from(this.services.entries())) {
      const workflowCount = service.getAvailableWorkflows().length;
      workflowsByDomain[domain] = workflowCount;
      totalWorkflows += workflowCount;
    }

    return {
      totalDomains: this.services.size,
      totalWorkflows,
      workflowsByDomain
    };
  }

  /**
   * Cleanup all registered services
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up RPA service registry');
    
    const cleanupPromises = Array.from(this.services.values()).map(async service => {
      try {
        await service.cleanup();
      } catch (error) {
        this.logger.error('Failed to cleanup domain service', {
          domain: service.getDomain(),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    await Promise.all(cleanupPromises);
    this.services.clear();
    
    this.logger.info('RPA service registry cleanup completed');
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
}

// Global registry instance - singleton pattern
let globalRegistry: RPAServiceRegistry | null = null;

/**
 * Get or create the global RPA service registry
 * @param logger - Logger instance (required for first initialization)
 * @returns The global registry instance
 */
export function getRPARegistry(logger?: Logger): RPAServiceRegistry {
  if (!globalRegistry) {
    if (!logger) {
      throw new RPAError(
        'Logger is required for first initialization of RPA registry',
        'LOGGER_REQUIRED',
        {}
      );
    }
    globalRegistry = new RPAServiceRegistry(logger);
  }
  return globalRegistry;
}

/**
 * Reset the global registry (mainly for testing)
 */
export function resetRPARegistry(): void {
  globalRegistry = null;
} 