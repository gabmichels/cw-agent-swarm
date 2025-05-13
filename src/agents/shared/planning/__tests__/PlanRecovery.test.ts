/**
 * Plan Recovery Interface Tests
 * 
 * Tests to verify the PlanRecovery interface contract.
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
  RecoveryStrategy
} from '../interfaces/PlanRecovery.interface';

/**
 * Mock implementation of RecoveryStrategy for testing
 */
class MockRecoveryStrategy implements RecoveryStrategy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly handleCategories: PlanFailureCategory[];
  readonly handlePlanTypes?: string[];
  
  constructor(
    id: string,
    name: string,
    categories: PlanFailureCategory[],
    planTypes?: string[]
  ) {
    this.id = id;
    this.name = name;
    this.description = `Mock strategy for ${categories.join(', ')}`;
    this.handleCategories = categories;
    this.handlePlanTypes = planTypes;
  }
  
  async canHandle(failure: PlanFailureInfo): Promise<{
    canHandle: boolean;
    confidence: number;
    reason: string;
  }> {
    const categoryMatches = this.handleCategories.includes(failure.category);
    
    return {
      canHandle: categoryMatches,
      confidence: categoryMatches ? 0.8 : 0,
      reason: categoryMatches 
        ? `Strategy handles ${failure.category} failures`
        : `Strategy does not handle ${failure.category} failures`
    };
  }
  
  async generateRecoveryActions(
    failure: PlanFailureInfo,
    context?: Record<string, unknown>
  ): Promise<PlanRecoveryAction[]> {
    // Generate a simple retry action
    const retryAction: PlanRecoveryAction = {
      type: PlanRecoveryActionType.RETRY,
      description: `Retry failed step after ${failure.recoveryAttempts} attempts`,
      confidence: 0.7,
      successProbability: 0.6,
      estimatedEffort: 2,
      parameters: {
        delayMs: 1000 * (failure.recoveryAttempts + 1),
        maxRetries: 3
      }
    };
    
    // For resource unavailable errors, also suggest skip
    if (failure.category === PlanFailureCategory.RESOURCE_UNAVAILABLE) {
      const skipAction: PlanRecoveryAction = {
        type: PlanRecoveryActionType.SKIP,
        description: 'Skip the step as resource is unavailable',
        confidence: 0.5,
        successProbability: 0.9,
        estimatedEffort: 1
      };
      
      return [retryAction, skipAction];
    }
    
    // For permission denied errors, also suggest skip
    if (failure.category === PlanFailureCategory.PERMISSION_DENIED) {
      const skipAction: PlanRecoveryAction = {
        type: PlanRecoveryActionType.SKIP,
        description: 'Skip the step as permission is denied',
        confidence: 0.6,
        successProbability: 0.85,
        estimatedEffort: 1
      };
      
      return [retryAction, skipAction];
    }
    
    return [retryAction];
  }
  
  async executeRecoveryAction(
    failure: PlanFailureInfo,
    action: PlanRecoveryAction
  ): Promise<RecoveryExecutionResult> {
    const startTime = Date.now();
    
    // Simulate execution time
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // For testing, succeed for RETRY if attempts < 3, otherwise fail
    const success = action.type === PlanRecoveryActionType.RETRY
      ? failure.recoveryAttempts < 3
      : true;
    
    return {
      success,
      action,
      message: success 
        ? `Successfully executed ${action.type} recovery`
        : `Failed to execute ${action.type} recovery`,
      durationMs: Date.now() - startTime,
      newState: success ? 'resumed' : undefined,
      error: success ? undefined : 'Simulated recovery failure'
    };
  }
}

/**
 * Mock implementation of PlanRecoverySystem for testing
 */
class MockPlanRecoverySystem implements PlanRecoverySystem {
  private initialized = false;
  private strategies = new Map<string, RecoveryStrategy>();
  private failures = new Map<string, PlanFailureInfo>();
  private recoveryActions = new Map<string, PlanRecoveryAction[]>();
  private recoveryResults = new Map<string, RecoveryExecutionResult[]>();
  
  async initialize(options?: Record<string, unknown>): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    // Register default strategies
    const defaultStrategies = [
      new MockRecoveryStrategy(
        'retry-strategy',
        'Retry Strategy',
        [
          PlanFailureCategory.TIMEOUT,
          PlanFailureCategory.EXTERNAL_API_ERROR,
          PlanFailureCategory.RESOURCE_UNAVAILABLE
        ]
      ),
      new MockRecoveryStrategy(
        'skip-strategy',
        'Skip Strategy',
        [
          PlanFailureCategory.INVALID_STATE,
          PlanFailureCategory.PERMISSION_DENIED
        ]
      )
    ];
    
    for (const strategy of defaultStrategies) {
      await this.registerRecoveryStrategy(strategy);
    }
    
    this.initialized = true;
    return true;
  }
  
  async registerRecoveryStrategy(strategy: RecoveryStrategy): Promise<boolean> {
    this.strategies.set(strategy.id, strategy);
    return true;
  }
  
  async registerRecoveryPolicy(): Promise<boolean> {
    // Not implemented for testing
    return true;
  }
  
  async getRecoveryPolicy(): Promise<null> {
    // Not implemented for testing
    return null;
  }
  
  async getAllRecoveryPolicies(): Promise<[]> {
    // Not implemented for testing
    return [];
  }
  
  async updateRecoveryPolicy(): Promise<boolean> {
    // Not implemented for testing
    return true;
  }
  
  async deleteRecoveryPolicy(): Promise<boolean> {
    // Not implemented for testing
    return true;
  }
  
  async recordFailure(
    failure: Omit<PlanFailureInfo, 'id' | 'recoveryAttempts' | 'previousRecoveryActions'>
  ): Promise<string> {
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
  
  async classifyFailure(
    error: Error | string,
    context?: Record<string, unknown>
  ): Promise<{
    category: PlanFailureCategory;
    severity: PlanFailureSeverity;
    confidence: number;
    analysis: string;
  }> {
    const errorStr = typeof error === 'string' ? error : error.message;
    
    // Simple classification based on error message
    let category: PlanFailureCategory;
    let severity: PlanFailureSeverity;
    
    if (errorStr.includes('timeout')) {
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
      analysis: `Classified as ${category} with ${severity} severity`
    };
  }
  
  async generateStandardErrorResponse(
    error: Error | string,
    options?: {
      requestId?: string;
      resources?: string[];
      source?: string;
    }
  ): Promise<StandardErrorResponse> {
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
  
  async getRecoveryActions(
    failureId: string,
    context?: Record<string, unknown>
  ): Promise<PlanRecoveryAction[]> {
    const failure = this.failures.get(failureId);
    if (!failure) {
      throw new Error(`Failure with ID ${failureId} not found`);
    }
    
    // Check if we already have actions for this failure
    if (this.recoveryActions.has(failureId)) {
      return this.recoveryActions.get(failureId)!;
    }
    
    // Find strategies that can handle this failure
    const applicableStrategies: RecoveryStrategy[] = [];
    
    // Convert Map values to array before iterating
    for (const strategy of Array.from(this.strategies.values())) {
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
  
  async executeRecovery(
    failureId: string,
    actionType: PlanRecoveryActionType,
    parameters?: Record<string, unknown>
  ): Promise<RecoveryExecutionResult> {
    const failure = this.failures.get(failureId);
    if (!failure) {
      throw new Error(`Failure with ID ${failureId} not found`);
    }
    
    // Get recovery actions if not already generated
    if (!this.recoveryActions.has(failureId)) {
      await this.getRecoveryActions(failureId);
    }
    
    // Find the specified action
    const actions = this.recoveryActions.get(failureId)!;
    const action = actions.find(a => a.type === actionType);
    
    if (!action) {
      throw new Error(`Action type ${actionType} not found for failure ${failureId}`);
    }
    
    // Update with provided parameters
    const actionToExecute: PlanRecoveryAction = {
      ...action,
      parameters: {
        ...action.parameters,
        ...parameters
      }
    };
    
    // Find a strategy to execute the action
    // Convert Map values to array before iterating
    for (const strategy of Array.from(this.strategies.values())) {
      const assessment = await strategy.canHandle(failure);
      if (assessment.canHandle) {
        // Execute the action
        const result = await strategy.executeRecoveryAction(failure, actionToExecute);
        
        // Update failure recovery attempts
        this.failures.set(failureId, {
          ...failure,
          recoveryAttempts: failure.recoveryAttempts + 1,
          previousRecoveryActions: [
            ...(failure.previousRecoveryActions || []),
            actionToExecute
          ]
        });
        
        // Store the result
        const results = this.recoveryResults.get(failureId)!;
        results.push(result);
        
        return result;
      }
    }
    
    throw new Error(`No strategy found to execute action ${actionType}`);
  }
  
  async executeAutomaticRecovery(
    failureId: string
  ): Promise<RecoveryExecutionResult> {
    // Get recovery actions
    const actions = await this.getRecoveryActions(failureId);
    
    if (actions.length === 0) {
      throw new Error(`No recovery actions available for failure ${failureId}`);
    }
    
    // Take the highest confidence action
    const bestAction = actions[0];
    
    // Execute it
    return this.executeRecovery(failureId, bestAction.type, bestAction.parameters);
  }
  
  async getRecoveryHistory(planId: string): Promise<Array<{
    failure: PlanFailureInfo;
    recoveryActions: Array<{
      action: PlanRecoveryAction;
      result: RecoveryExecutionResult;
      timestamp: Date;
    }>;
  }>> {
    // Find failures for this plan
    const planFailures = Array.from(this.failures.values())
      .filter(failure => failure.planId === planId);
    
    // Build history
    const history = [];
    
    for (const failure of planFailures) {
      const results = this.recoveryResults.get(failure.id) || [];
      
      const recoveryActions = failure.previousRecoveryActions?.map((action, index) => ({
        action,
        result: results[index] || {
          success: false,
          action,
          message: 'No result recorded',
          durationMs: 0
        },
        timestamp: new Date() // Would use real timestamps in full implementation
      })) || [];
      
      history.push({
        failure,
        recoveryActions
      });
    }
    
    return history;
  }
  
  async getFailureStatistics(): Promise<{
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
    const failures = Array.from(this.failures.values());
    const results = Array.from(this.recoveryResults.values()).flat();
    
    // Count failures by category
    const failuresByCategory: Record<PlanFailureCategory, number> = Object.values(PlanFailureCategory)
      .reduce((acc, category) => {
        acc[category] = 0;
        return acc;
      }, {} as Record<PlanFailureCategory, number>);
    
    failures.forEach(failure => {
      failuresByCategory[failure.category]++;
    });
    
    // Count failures by severity
    const failuresBySeverity: Record<PlanFailureSeverity, number> = Object.values(PlanFailureSeverity)
      .reduce((acc, severity) => {
        acc[severity] = 0;
        return acc;
      }, {} as Record<PlanFailureSeverity, number>);
    
    failures.forEach(failure => {
      failuresBySeverity[failure.severity]++;
    });
    
    // Calculate recovery success rate
    const successfulRecoveries = results.filter(result => result.success).length;
    const recoverySuccessRate = results.length > 0 
      ? successfulRecoveries / results.length
      : 0;
    
    // Calculate average recovery attempts
    const totalAttempts = failures.reduce((sum, failure) => sum + failure.recoveryAttempts, 0);
    const averageRecoveryAttempts = failures.length > 0
      ? totalAttempts / failures.length
      : 0;
    
    // Get most common failures
    const categoryCounts = new Map<PlanFailureCategory, { count: number; successes: number; attempts: number }>();
    
    failures.forEach(failure => {
      const category = failure.category;
      const info = categoryCounts.get(category) || { count: 0, successes: 0, attempts: 0 };
      
      info.count++;
      info.attempts += failure.recoveryAttempts;
      
      const failureResults = this.recoveryResults.get(failure.id) || [];
      info.successes += failureResults.filter(result => result.success).length;
      
      categoryCounts.set(category, info);
    });
    
    const mostCommonFailures = Array.from(categoryCounts.entries())
      .map(([category, info]) => ({
        category,
        count: info.count,
        recoverySuccessRate: info.attempts > 0 ? info.successes / info.attempts : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    
    // Get most effective recovery actions
    const actionCounts = new Map<PlanRecoveryActionType, { successes: number; total: number }>();
    
    results.forEach(result => {
      const type = result.action.type;
      const info = actionCounts.get(type) || { successes: 0, total: 0 };
      
      info.total++;
      if (result.success) {
        info.successes++;
      }
      
      actionCounts.set(type, info);
    });
    
    const mostEffectiveRecoveryActions = Array.from(actionCounts.entries())
      .map(([actionType, info]) => ({
        actionType,
        successRate: info.total > 0 ? info.successes / info.total : 0,
        usageCount: info.total
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 3);
    
    return {
      totalFailures: failures.length,
      failuresByCategory,
      failuresBySeverity,
      recoverySuccessRate,
      averageRecoveryAttempts,
      mostCommonFailures,
      mostEffectiveRecoveryActions
    };
  }
  
  async shutdown(): Promise<boolean> {
    this.initialized = false;
    this.strategies.clear();
    this.failures.clear();
    this.recoveryActions.clear();
    this.recoveryResults.clear();
    return true;
  }
}

describe('PlanRecovery Interface', () => {
  let recoverySystem: PlanRecoverySystem;
  
  beforeEach(async () => {
    recoverySystem = new MockPlanRecoverySystem();
    await recoverySystem.initialize();
  });
  
  afterEach(async () => {
    await recoverySystem.shutdown();
  });
  
  test('should classify failure correctly', async () => {
    const classification = await recoverySystem.classifyFailure(
      'API request timeout after 30 seconds'
    );
    
    expect(classification.category).toBe(PlanFailureCategory.TIMEOUT);
    expect(classification.severity).toBe(PlanFailureSeverity.MEDIUM);
    expect(classification.confidence).toBeGreaterThan(0);
  });
  
  test('should generate standardized error response', async () => {
    const error = new Error('Resource database is currently unavailable');
    const response = await recoverySystem.generateStandardErrorResponse(error, {
      requestId: 'req-123',
      resources: ['database-1'],
      source: 'database-service'
    });
    
    expect(response.code).toBeDefined();
    expect(response.message).toBe(error.message);
    expect(response.category).toBe(PlanFailureCategory.RESOURCE_UNAVAILABLE);
    expect(response.requestId).toBe('req-123');
    expect(response.resources).toContain('database-1');
    expect(response.source).toBe('database-service');
    expect(response.suggestedActions).toContain(PlanRecoveryActionType.RETRY);
  });
  
  test('should record failure and get recovery actions', async () => {
    // Record a failure
    const failureId = await recoverySystem.recordFailure({
      planId: 'plan-123',
      stepId: 'step-456',
      message: 'API request failed: service unavailable',
      category: PlanFailureCategory.EXTERNAL_API_ERROR,
      severity: PlanFailureSeverity.HIGH,
      timestamp: new Date()
    });
    
    expect(failureId).toBeDefined();
    
    // Get recovery actions
    const actions = await recoverySystem.getRecoveryActions(failureId);
    
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].type).toBe(PlanRecoveryActionType.RETRY);
    expect(actions[0].confidence).toBeGreaterThan(0);
  });
  
  test('should execute recovery action', async () => {
    // Record a failure
    const failureId = await recoverySystem.recordFailure({
      planId: 'plan-123',
      stepId: 'step-456',
      message: 'API request failed: service unavailable',
      category: PlanFailureCategory.EXTERNAL_API_ERROR,
      severity: PlanFailureSeverity.HIGH,
      timestamp: new Date()
    });
    
    // Execute recovery action
    const result = await recoverySystem.executeRecovery(
      failureId,
      PlanRecoveryActionType.RETRY
    );
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('Successfully');
    expect(result.durationMs).toBeGreaterThan(0);
  });
  
  test('should execute automatic recovery', async () => {
    // Record a failure
    const failureId = await recoverySystem.recordFailure({
      planId: 'plan-123',
      stepId: 'step-456',
      message: 'API request failed: service unavailable',
      category: PlanFailureCategory.EXTERNAL_API_ERROR,
      severity: PlanFailureSeverity.HIGH,
      timestamp: new Date()
    });
    
    // Execute automatic recovery
    const result = await recoverySystem.executeAutomaticRecovery(failureId);
    
    expect(result).toBeDefined();
    expect(result.action).toBeDefined();
  });
  
  test('should get recovery history for a plan', async () => {
    // Record a failure
    const failureId = await recoverySystem.recordFailure({
      planId: 'plan-123',
      stepId: 'step-456',
      message: 'API request failed: service unavailable',
      category: PlanFailureCategory.EXTERNAL_API_ERROR,
      severity: PlanFailureSeverity.HIGH,
      timestamp: new Date()
    });
    
    // Execute recovery
    await recoverySystem.executeRecovery(
      failureId,
      PlanRecoveryActionType.RETRY
    );
    
    // Get history
    const history = await recoverySystem.getRecoveryHistory('plan-123');
    
    expect(history.length).toBe(1);
    expect(history[0].failure.planId).toBe('plan-123');
    expect(history[0].recoveryActions.length).toBe(1);
    expect(history[0].recoveryActions[0].action.type).toBe(PlanRecoveryActionType.RETRY);
  });
  
  test('should get failure statistics', async () => {
    // Record multiple failures
    const failureId1 = await recoverySystem.recordFailure({
      planId: 'plan-123',
      stepId: 'step-456',
      message: 'API request failed: service unavailable',
      category: PlanFailureCategory.EXTERNAL_API_ERROR,
      severity: PlanFailureSeverity.HIGH,
      timestamp: new Date()
    });
    
    const failureId2 = await recoverySystem.recordFailure({
      planId: 'plan-123',
      stepId: 'step-789',
      message: 'Permission denied: cannot access resource',
      category: PlanFailureCategory.PERMISSION_DENIED,
      severity: PlanFailureSeverity.MEDIUM,
      timestamp: new Date()
    });
    
    // Execute recoveries
    await recoverySystem.executeRecovery(
      failureId1,
      PlanRecoveryActionType.RETRY
    );
    
    await recoverySystem.executeRecovery(
      failureId2,
      PlanRecoveryActionType.SKIP
    );
    
    // Get statistics
    const stats = await recoverySystem.getFailureStatistics();
    
    expect(stats.totalFailures).toBe(2);
    expect(stats.failuresByCategory[PlanFailureCategory.EXTERNAL_API_ERROR]).toBe(1);
    expect(stats.failuresByCategory[PlanFailureCategory.PERMISSION_DENIED]).toBe(1);
    expect(stats.recoverySuccessRate).toBeGreaterThan(0);
    expect(stats.mostCommonFailures.length).toBeGreaterThan(0);
    expect(stats.mostEffectiveRecoveryActions.length).toBeGreaterThan(0);
  });
}); 