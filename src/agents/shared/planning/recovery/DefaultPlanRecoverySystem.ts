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
    if (!this.initialized) {
      throw new PlanRecoveryError('Recovery system not initialized', 'NOT_INITIALIZED');
    }

    // Get the failure
    const failure = this.failures.get(failureId);
    if (!failure) {
      throw new PlanRecoveryError(`Failure with ID ${failureId} not found`, 'FAILURE_NOT_FOUND');
    }
    
    // Get recovery actions for this failure
    const actions = await this.getRecoveryActions(failureId);
    
    // Find the requested action type
    const matchingActions = actions.filter(action => action.type === actionType);
    if (matchingActions.length === 0) {
      throw new PlanRecoveryError(
        `No ${actionType} action available for failure ${failureId}`,
        'ACTION_NOT_AVAILABLE'
      );
    }
    
    // Use the highest confidence matching action
    const selectedAction = matchingActions.sort((a, b) => b.confidence - a.confidence)[0];
    
    // Start timing
    const startTime = Date.now();
    
    try {
      // Find strategies that can handle this action
      const strategiesArray = Array.from(this.strategies.values());
      const capableStrategies = strategiesArray.filter(async (strategy) => {
        const assessment = await strategy.canHandle(failure);
        return assessment.canHandle;
      });
      
      if (capableStrategies.length === 0) {
        throw new PlanRecoveryError(
          `No strategy capable of executing ${actionType} action for failure ${failureId}`,
          'NO_CAPABLE_STRATEGY'
        );
      }
      
      // Use the first capable strategy for simplicity
      // In a more robust implementation, we would select the best strategy
      const strategy = capableStrategies[0];
      
      // Execute the action
      const result = await strategy.executeRecoveryAction(failure, selectedAction, parameters);
      
      // Update failure record
      failure.recoveryAttempts += 1;
      if (!failure.previousRecoveryActions) {
        failure.previousRecoveryActions = [];
      }
      failure.previousRecoveryActions.push(selectedAction);
      this.failures.set(failureId, failure);
      
      // Store result
      if (!this.recoveryResults.has(failureId)) {
        this.recoveryResults.set(failureId, []);
      }
      this.recoveryResults.get(failureId)!.push(result);
      
      return {
        ...result,
        durationMs: Date.now() - startTime
      };
    } catch (error) {
      // Create failed result
      const failedResult: RecoveryExecutionResult = {
        success: false,
        action: selectedAction,
        message: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime
      };
      
      // Update failure record
      failure.recoveryAttempts += 1;
      if (!failure.previousRecoveryActions) {
        failure.previousRecoveryActions = [];
      }
      failure.previousRecoveryActions.push(selectedAction);
      this.failures.set(failureId, failure);
      
      // Store result
      if (!this.recoveryResults.has(failureId)) {
        this.recoveryResults.set(failureId, []);
      }
      this.recoveryResults.get(failureId)!.push(failedResult);
      
      return failedResult;
    }
  }

  /**
   * Execute automatic recovery
   */
  async executeAutomaticRecovery(
    failureId: string,
    policyId?: string
  ): Promise<RecoveryExecutionResult> {
    if (!this.initialized) {
      throw new PlanRecoveryError('Recovery system not initialized', 'NOT_INITIALIZED');
    }

    // Get the failure
    const failure = this.failures.get(failureId);
    if (!failure) {
      throw new PlanRecoveryError(`Failure with ID ${failureId} not found`, 'FAILURE_NOT_FOUND');
    }
    
    // If a specific policy is specified, use it
    if (policyId) {
      const policy = await this.getRecoveryPolicy(policyId);
      if (!policy) {
        throw new PlanRecoveryError(`Policy with ID ${policyId} not found`, 'POLICY_NOT_FOUND');
      }
      
      // Check if the policy applies to this failure category
      if (policy.targetCategories && !policy.targetCategories.includes(failure.category)) {
        throw new PlanRecoveryError(
          `Policy ${policyId} does not apply to failures of category ${failure.category}`,
          'POLICY_NOT_APPLICABLE'
        );
      }
      
      // Check if we've exceeded maximum recovery attempts
      if (policy.maxRecoveryAttempts && failure.recoveryAttempts >= policy.maxRecoveryAttempts) {
        if (policy.escalateAfterMaxAttempts) {
          // Use fallback action if specified
          if (policy.fallbackAction) {
            return this.executeRecovery(failureId, policy.fallbackAction);
          }
        }
        
        throw new PlanRecoveryError(
          `Maximum recovery attempts (${policy.maxRecoveryAttempts}) exceeded for failure ${failureId}`,
          'MAX_ATTEMPTS_EXCEEDED'
        );
      }
      
      // Find the appropriate action based on attempt number
      const currentAttempt = failure.recoveryAttempts + 1;
      const actionSpec = policy.actionSequence.find(
        action => action.applyWhen?.attemptNumber === currentAttempt
      );
      
      if (actionSpec) {
        return this.executeRecovery(failureId, actionSpec.type, actionSpec.parameters);
      }
    }
    
    // If no policy is specified or no action found in policy, use default approach
    // Get recovery actions for this failure
    const actions = await this.getRecoveryActions(failureId);
    
    if (actions.length === 0) {
      throw new PlanRecoveryError(
        `No recovery actions available for failure ${failureId}`,
        'NO_ACTIONS_AVAILABLE'
      );
    }
    
    // Take the highest confidence action
    const bestAction = actions[0];
    
    // Execute it
    return this.executeRecovery(failureId, bestAction.type, bestAction.parameters);
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
    if (!this.initialized) {
      throw new PlanRecoveryError('Recovery system not initialized', 'NOT_INITIALIZED');
    }

    // Find all failures for this plan
    const planFailures = Array.from(this.failures.values())
      .filter(failure => failure.planId === planId);
    
    // Build recovery history for each failure
    const history = [];
    
    for (const failure of planFailures) {
      // Get results for this failure
      const results = this.recoveryResults.get(failure.id) || [];
      
      // Create recovery action records by combining actions with results
      const recoveryActions = failure.previousRecoveryActions?.map((action, index) => ({
        action,
        result: results[index] || {
          success: false,
          action,
          message: 'No result recorded',
          durationMs: 0
        },
        timestamp: new Date(failure.timestamp.getTime() + (index * 60000)) // Approximate timestamps
      })) || [];
      
      // Add to history
      history.push({
        failure,
        recoveryActions
      });
    }
    
    return history;
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
    if (!this.initialized) {
      throw new PlanRecoveryError('Recovery system not initialized', 'NOT_INITIALIZED');
    }

    // Get all failures, filtered by time range if specified
    let failures = Array.from(this.failures.values());
    
    if (timeRange) {
      failures = failures.filter(failure => 
        failure.timestamp >= timeRange.start && 
        failure.timestamp <= timeRange.end
      );
    }
    
    const totalFailures = failures.length;
    
    if (totalFailures === 0) {
      // Return empty statistics
      return {
        totalFailures: 0,
        failuresByCategory: {} as Record<PlanFailureCategory, number>,
        failuresBySeverity: {} as Record<PlanFailureSeverity, number>,
        recoverySuccessRate: 0,
        averageRecoveryAttempts: 0,
        mostCommonFailures: [],
        mostEffectiveRecoveryActions: []
      };
    }
    
    // Initialize category and severity counters
    const failuresByCategory: Record<string, number> = {};
    const failuresBySeverity: Record<string, number> = {};
    
    // Initialize category success tracking
    const categorySuccessCount: Record<string, number> = {};
    const categoryTotalCount: Record<string, number> = {};
    
    // Initialize action type tracking
    const actionTypeSuccessCount: Record<string, number> = {};
    const actionTypeTotalCount: Record<string, number> = {};
    
    // Track total recovery attempts and successes
    let totalRecoveryAttempts = 0;
    let totalRecoverySuccesses = 0;
    
    // Process each failure
    for (const failure of failures) {
      // Count by category
      const category = failure.category;
      failuresByCategory[category] = (failuresByCategory[category] || 0) + 1;
      categoryTotalCount[category] = (categoryTotalCount[category] || 0) + 1;
      
      // Count by severity
      const severity = failure.severity;
      failuresBySeverity[severity] = (failuresBySeverity[severity] || 0) + 1;
      
      // Count recovery attempts
      totalRecoveryAttempts += failure.recoveryAttempts;
      
      // Get results for this failure
      const results = this.recoveryResults.get(failure.id) || [];
      const successfulResults = results.filter(result => result.success);
      
      // Count successful recoveries
      if (successfulResults.length > 0) {
        totalRecoverySuccesses += 1;
        categorySuccessCount[category] = (categorySuccessCount[category] || 0) + 1;
      }
      
      // Track action types
      for (const result of results) {
        const actionType = result.action.type;
        actionTypeTotalCount[actionType] = (actionTypeTotalCount[actionType] || 0) + 1;
        
        if (result.success) {
          actionTypeSuccessCount[actionType] = (actionTypeSuccessCount[actionType] || 0) + 1;
        }
      }
    }
    
    // Calculate recovery success rate
    const recoverySuccessRate = totalFailures > 0 
      ? totalRecoverySuccesses / totalFailures 
      : 0;
    
    // Calculate average recovery attempts
    const averageRecoveryAttempts = totalFailures > 0 
      ? totalRecoveryAttempts / totalFailures 
      : 0;
    
    // Calculate most common failures
    const mostCommonFailures = Object.entries(categoryTotalCount)
      .map(([category, count]) => ({
        category: category as PlanFailureCategory,
        count,
        recoverySuccessRate: count > 0 
          ? (categorySuccessCount[category] || 0) / count
          : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // Calculate most effective recovery actions
    const mostEffectiveRecoveryActions = Object.entries(actionTypeTotalCount)
      .map(([actionType, usageCount]) => ({
        actionType: actionType as PlanRecoveryActionType,
        successRate: usageCount > 0
          ? (actionTypeSuccessCount[actionType] || 0) / usageCount 
          : 0,
        usageCount
      }))
      .sort((a, b) => b.successRate - a.successRate || b.usageCount - a.usageCount)
      .slice(0, 5);
    
    return {
      totalFailures,
      failuresByCategory: failuresByCategory as Record<PlanFailureCategory, number>,
      failuresBySeverity: failuresBySeverity as Record<PlanFailureSeverity, number>,
      recoverySuccessRate,
      averageRecoveryAttempts,
      mostCommonFailures,
      mostEffectiveRecoveryActions
    };
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