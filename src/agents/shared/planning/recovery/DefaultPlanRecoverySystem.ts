/**
 * DefaultPlanRecoverySystem
 * 
 * Implementation of the PlanRecoverySystem interface that provides
 * robust error recovery capabilities for planning.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PlanRecoverySystem,
  PlanFailureCategory,
  PlanFailureSeverity,
  PlanRecoveryActionType,
  PlanFailureInfo,
  PlanRecoveryAction,
  RecoveryExecutionResult,
  StandardErrorResponse,
  RecoveryStrategy,
  PlanRecoveryPolicy
} from '../interfaces/PlanRecovery.interface';

/**
 * Error class for plan recovery system
 */
class PlanRecoveryError extends Error {
  constructor(message: string, public readonly code: string = 'RECOVERY_ERROR') {
    super(message);
    this.name = 'PlanRecoveryError';
  }
}

/**
 * Default implementation of the PlanRecoverySystem interface
 */
export class DefaultPlanRecoverySystem implements PlanRecoverySystem {
  private initialized = false;
  private strategies = new Map<string, RecoveryStrategy>();
  private policies = new Map<string, PlanRecoveryPolicy>();
  private failures = new Map<string, PlanFailureInfo>();
  private recoveryActions = new Map<string, PlanRecoveryAction[]>();
  private recoveryResults = new Map<string, RecoveryExecutionResult[]>();

  /**
   * Initialize the recovery system
   */
  async initialize(options?: Record<string, unknown>): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    // Register default strategies if needed
    if (options?.registerDefaultStrategies) {
      await this.registerDefaultStrategies();
    }

    this.initialized = true;
    return true;
  }

  /**
   * Register default recovery strategies
   */
  private async registerDefaultStrategies(): Promise<void> {
    // Implementation will be added later
  }

  /**
   * Register a recovery strategy
   */
  async registerRecoveryStrategy(strategy: RecoveryStrategy): Promise<boolean> {
    if (!this.initialized) {
      throw new PlanRecoveryError('Recovery system not initialized', 'NOT_INITIALIZED');
    }

    this.strategies.set(strategy.id, strategy);
    return true;
  }

  /**
   * Register a recovery policy
   */
  async registerRecoveryPolicy(policy: PlanRecoveryPolicy): Promise<boolean> {
    if (!this.initialized) {
      throw new PlanRecoveryError('Recovery system not initialized', 'NOT_INITIALIZED');
    }

    this.policies.set(policy.id, policy);
    return true;
  }

  /**
   * Get a recovery policy by ID
   */
  async getRecoveryPolicy(policyId: string): Promise<PlanRecoveryPolicy | null> {
    if (!this.initialized) {
      throw new PlanRecoveryError('Recovery system not initialized', 'NOT_INITIALIZED');
    }

    return this.policies.get(policyId) || null;
  }

  /**
   * Get all recovery policies
   */
  async getAllRecoveryPolicies(): Promise<PlanRecoveryPolicy[]> {
    if (!this.initialized) {
      throw new PlanRecoveryError('Recovery system not initialized', 'NOT_INITIALIZED');
    }

    return Array.from(this.policies.values());
  }

  /**
   * Update a recovery policy
   */
  async updateRecoveryPolicy(
    policyId: string,
    updates: Partial<Omit<PlanRecoveryPolicy, 'id'>>
  ): Promise<boolean> {
    if (!this.initialized) {
      throw new PlanRecoveryError('Recovery system not initialized', 'NOT_INITIALIZED');
    }

    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    this.policies.set(policyId, { ...policy, ...updates });
    return true;
  }

  /**
   * Delete a recovery policy
   */
  async deleteRecoveryPolicy(policyId: string): Promise<boolean> {
    if (!this.initialized) {
      throw new PlanRecoveryError('Recovery system not initialized', 'NOT_INITIALIZED');
    }

    return this.policies.delete(policyId);
  }

  /**
   * Record a plan failure
   */
  async recordFailure(
    failure: Omit<PlanFailureInfo, 'id' | 'recoveryAttempts' | 'previousRecoveryActions'>
  ): Promise<string> {
    if (!this.initialized) {
      throw new PlanRecoveryError('Recovery system not initialized', 'NOT_INITIALIZED');
    }

    const id = uuidv4();
    
    const fullFailure: PlanFailureInfo = {
      ...failure,
      id,
      recoveryAttempts: 0,
      previousRecoveryActions: []
    };
    
    this.failures.set(id, fullFailure);
    this.recoveryResults.set(id, []);
    
    return id;
  }

  /**
   * Classify a failure
   */
  async classifyFailure(
    error: Error | string,
    context?: Record<string, unknown>
  ): Promise<{
    category: PlanFailureCategory;
    severity: PlanFailureSeverity;
    confidence: number;
    analysis: string;
  }> {
    if (!this.initialized) {
      throw new PlanRecoveryError('Recovery system not initialized', 'NOT_INITIALIZED');
    }

    const errorStr = typeof error === 'string' ? error : error.message;
    
    // Simple classification based on error message
    let category: PlanFailureCategory;
    let severity: PlanFailureSeverity;
    
    if (errorStr.includes('timeout') || errorStr.includes('timed out')) {
      category = PlanFailureCategory.TIMEOUT;
      severity = PlanFailureSeverity.MEDIUM;
    } else if (errorStr.includes('permission') || errorStr.includes('access')) {
      category = PlanFailureCategory.PERMISSION_DENIED;
      severity = PlanFailureSeverity.HIGH;
    } else if (errorStr.includes('resource') || errorStr.includes('unavailable')) {
      category = PlanFailureCategory.RESOURCE_UNAVAILABLE;
      severity = PlanFailureSeverity.HIGH;
    } else if (errorStr.includes('api') || errorStr.includes('service')) {
      category = PlanFailureCategory.EXTERNAL_API_ERROR;
      severity = PlanFailureSeverity.MEDIUM;
    } else {
      category = PlanFailureCategory.UNKNOWN;
      severity = PlanFailureSeverity.MEDIUM;
    }
    
    // If context includes tool information, assume tool failure
    if (context?.toolId) {
      category = PlanFailureCategory.TOOL_FAILURE;
    }
    
    return {
      category,
      severity,
      confidence: 0.7,
      analysis: `Classified as ${category} with ${severity} severity based on error message patterns.`
    };
  }

  /**
   * Generate a standardized error response
   */
  async generateStandardErrorResponse(
    error: Error | string,
    options?: {
      requestId?: string;
      resources?: string[];
      source?: string;
    }
  ): Promise<StandardErrorResponse> {
    if (!this.initialized) {
      throw new PlanRecoveryError('Recovery system not initialized', 'NOT_INITIALIZED');
    }

    const errorStr = typeof error === 'string' ? error : error.message;
    const classification = await this.classifyFailure(error);
    
    return {
      code: `ERR_${classification.category.toUpperCase()}`,
      message: errorStr,
      category: classification.category,
      severity: classification.severity,
      timestamp: new Date(),
      requestId: options?.requestId || uuidv4(),
      resources: options?.resources || [],
      source: options?.source || 'plan-recovery-system',
      suggestedActions: this.getSuggestedActions(classification.category)
    };
  }

  /**
   * Get suggested recovery actions for a failure category
   */
  private getSuggestedActions(category: PlanFailureCategory): PlanRecoveryActionType[] {
    switch (category) {
      case PlanFailureCategory.TIMEOUT:
        return [PlanRecoveryActionType.RETRY];
      case PlanFailureCategory.RESOURCE_UNAVAILABLE:
        return [PlanRecoveryActionType.RETRY, PlanRecoveryActionType.SKIP];
      case PlanFailureCategory.PERMISSION_DENIED:
        return [PlanRecoveryActionType.REQUEST_USER_INPUT, PlanRecoveryActionType.SKIP];
      case PlanFailureCategory.EXTERNAL_API_ERROR:
        return [PlanRecoveryActionType.RETRY, PlanRecoveryActionType.SUBSTITUTE];
      default:
        return [PlanRecoveryActionType.REQUEST_USER_INPUT];
    }
  }

  /**
   * Get recovery actions for a failure
   */
  async getRecoveryActions(
    failureId: string,
    context?: Record<string, unknown>
  ): Promise<PlanRecoveryAction[]> {
    if (!this.initialized) {
      throw new PlanRecoveryError('Recovery system not initialized', 'NOT_INITIALIZED');
    }

    const failure = this.failures.get(failureId);
    if (!failure) {
      throw new PlanRecoveryError(`Failure with ID ${failureId} not found`, 'FAILURE_NOT_FOUND');
    }
    
    // Check if we already have actions for this failure
    if (this.recoveryActions.has(failureId)) {
      return this.recoveryActions.get(failureId) || [];
    }
    
    // Find strategies that can handle this failure
    const applicableStrategies: RecoveryStrategy[] = [];
    
    // Convert Map values to array before iterating to avoid linter error
    const strategiesArray = Array.from(this.strategies.values());
    for (const strategy of strategiesArray) {
      const assessment = await strategy.canHandle(failure);
      if (assessment.canHandle) {
        applicableStrategies.push(strategy);
      }
    }
    
    // Generate actions from each applicable strategy
    const allActions: PlanRecoveryAction[] = [];
    
    for (const strategy of applicableStrategies) {
      const actions = await strategy.generateRecoveryActions(failure, context);
      allActions.push(...actions);
    }
    
    // Sort by confidence
    allActions.sort((a, b) => b.confidence - a.confidence);
    
    // Store the actions
    this.recoveryActions.set(failureId, allActions);
    
    return allActions;
  }

  /**
   * Execute a recovery action
   */
  async executeRecovery(
    failureId: string,
    actionType: PlanRecoveryActionType,
    parameters?: Record<string, unknown>
  ): Promise<RecoveryExecutionResult> {
    // Implementation will be added in subsequent sections
    throw new PlanRecoveryError('Method not implemented', 'NOT_IMPLEMENTED');
  }

  /**
   * Execute automatic recovery
   */
  async executeAutomaticRecovery(
    failureId: string,
    policyId?: string
  ): Promise<RecoveryExecutionResult> {
    // Implementation will be added in subsequent sections
    throw new PlanRecoveryError('Method not implemented', 'NOT_IMPLEMENTED');
  }

  /**
   * Get recovery history for a plan
   */
  async getRecoveryHistory(planId: string): Promise<Array<{
    failure: PlanFailureInfo;
    recoveryActions: Array<{
      action: PlanRecoveryAction;
      result: RecoveryExecutionResult;
      timestamp: Date;
    }>;
  }>> {
    // Implementation will be added in subsequent sections
    throw new PlanRecoveryError('Method not implemented', 'NOT_IMPLEMENTED');
  }

  /**
   * Get failure statistics
   */
  async getFailureStatistics(timeRange?: { start: Date; end: Date }): Promise<{
    totalFailures: number;
    failuresByCategory: Record<PlanFailureCategory, number>;
    failuresBySeverity: Record<PlanFailureSeverity, number>;
    recoverySuccessRate: number;
    averageRecoveryAttempts: number;
    mostCommonFailures: Array<{
      category: PlanFailureCategory;
      count: number;
      recoverySuccessRate: number;
    }>;
    mostEffectiveRecoveryActions: Array<{
      actionType: PlanRecoveryActionType;
      successRate: number;
      usageCount: number;
    }>;
  }> {
    // Implementation will be added in subsequent sections
    throw new PlanRecoveryError('Method not implemented', 'NOT_IMPLEMENTED');
  }

  /**
   * Shutdown the recovery system
   */
  async shutdown(): Promise<boolean> {
    if (!this.initialized) {
      return true;
    }

    this.initialized = false;
    this.strategies.clear();
    this.policies.clear();
    this.failures.clear();
    this.recoveryActions.clear();
    this.recoveryResults.clear();
    
    return true;
  }
} 