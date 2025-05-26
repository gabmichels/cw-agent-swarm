/**
 * DefaultPlanAdaptationSystem Tests
 * 
 * Comprehensive tests for the plan adaptation system implementation
 * covering all adaptation methods and scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultPlanAdaptationSystem } from './DefaultPlanAdaptationSystem';
import { 
  AdaptationTriggerType, 
  AdaptationStrategyType, 
  AdaptationScope,
  PlanAdaptationStrategy,
  AdaptationStrategyConfig
} from '../interfaces/PlanAdaptation.interface';

// Mock strategy for testing
const createMockStrategy = (
  id: string, 
  type: AdaptationStrategyType, 
  enabled = true
): PlanAdaptationStrategy => ({
  config: {
    id,
    type,
    name: `${type} Strategy`,
    description: `Test strategy for ${type}`,
    triggerTypes: [AdaptationTriggerType.EFFICIENCY_OPTIMIZATION],
    priority: 1,
    minConfidenceThreshold: 0.5,
    enabled
  },
  async canHandleOpportunity() {
    return { canHandle: true, confidence: 0.8, reason: 'Test strategy' };
  },
  async generateAdaptationActions() {
    return [];
  },
  async applyAdaptation() {
    return {
      success: true,
      originalPlanId: 'test',
      modifiedPlanId: 'test-modified',
      opportunity: {} as any,
      action: {} as any,
      timestamp: new Date(),
      durationMs: 100,
      modifiedSteps: [],
      logs: []
    };
  }
});

describe('DefaultPlanAdaptationSystem', () => {
  let adaptationSystem: DefaultPlanAdaptationSystem;

  beforeEach(async () => {
    adaptationSystem = new DefaultPlanAdaptationSystem();
    await adaptationSystem.initialize();
  });

  describe('Initialization and Strategy Management', () => {
    it('should initialize successfully', async () => {
      const system = new DefaultPlanAdaptationSystem();
      const result = await system.initialize();
      expect(result).toBe(true);
    });

    it('should register and retrieve strategies', async () => {
      const strategy = createMockStrategy('test-strategy', AdaptationStrategyType.ELIMINATION);
      
      const registered = await adaptationSystem.registerStrategy(strategy);
      expect(registered).toBe(true);

      const strategies = await adaptationSystem.getRegisteredStrategies();
      expect(strategies).toHaveLength(1);
      expect(strategies[0].config.id).toBe('test-strategy');
    });

    it('should enable and disable strategies', async () => {
      const strategy = createMockStrategy('test-strategy', AdaptationStrategyType.CONSOLIDATION);
      await adaptationSystem.registerStrategy(strategy);

      // Disable strategy
      const disabled = await adaptationSystem.disableStrategy('test-strategy');
      expect(disabled).toBe(true);

      const strategies = await adaptationSystem.getRegisteredStrategies();
      expect(strategies[0].config.enabled).toBe(false);

      // Enable strategy
      const enabled = await adaptationSystem.enableStrategy('test-strategy');
      expect(enabled).toBe(true);
      
      const enabledStrategies = await adaptationSystem.getRegisteredStrategies();
      expect(enabledStrategies[0].config.enabled).toBe(true);
    });

    it('should unregister strategies', async () => {
      const strategy = createMockStrategy('test-strategy', AdaptationStrategyType.SUBSTITUTION);
      await adaptationSystem.registerStrategy(strategy);

      const unregistered = await adaptationSystem.unregisterStrategy('test-strategy');
      expect(unregistered).toBe(true);

      const strategies = await adaptationSystem.getRegisteredStrategies();
      expect(strategies).toHaveLength(0);
    });
  });

  describe('Opportunity Detection', () => {
    it('should detect opportunities for a plan', async () => {
      const opportunities = await adaptationSystem.detectOpportunities('test-plan', {
        type: AdaptationTriggerType.EFFICIENCY_OPTIMIZATION,
        source: 'test',
        description: 'Test optimization opportunity'
      });

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].planId).toBe('test-plan');
      expect(opportunities[0].trigger.type).toBe(AdaptationTriggerType.EFFICIENCY_OPTIMIZATION);
      expect(opportunities[0].priorityScore).toBeGreaterThan(0);
    });

    it('should detect opportunities without specific trigger', async () => {
      const opportunities = await adaptationSystem.detectOpportunities('test-plan');
      expect(Array.isArray(opportunities)).toBe(true);
    });
  });

  describe('Action Generation', () => {
    it('should generate actions for an opportunity', async () => {
      // Register test strategies
      await adaptationSystem.registerStrategy(
        createMockStrategy('elimination-strategy', AdaptationStrategyType.ELIMINATION)
      );
      await adaptationSystem.registerStrategy(
        createMockStrategy('consolidation-strategy', AdaptationStrategyType.CONSOLIDATION)
      );

      // Detect opportunities
      const opportunities = await adaptationSystem.detectOpportunities('test-plan', {
        type: AdaptationTriggerType.EFFICIENCY_OPTIMIZATION,
        source: 'test',
        description: 'Test optimization'
      });

      expect(opportunities).toHaveLength(1);

      // Generate actions
      const actions = await adaptationSystem.generateActions(opportunities[0].id);
      expect(actions.length).toBeGreaterThan(0);
      
      // Check action structure
      const action = actions[0];
      expect(action.strategyType).toBeDefined();
      expect(action.description).toBeDefined();
      expect(action.targetSteps).toBeDefined();
      expect(action.details).toBeDefined();
      expect(action.expectedImpact).toBeDefined();
      expect(action.expectedImpact.overallBenefitScore).toBeGreaterThan(0);
    });

    it('should handle non-existent opportunity', async () => {
      await expect(adaptationSystem.generateActions('non-existent'))
        .rejects.toThrow('Opportunity not found');
    });
  });

  describe('Action Evaluation', () => {
    it('should evaluate an adaptation action', async () => {
      // Register strategy and create opportunity
      await adaptationSystem.registerStrategy(
        createMockStrategy('test-strategy', AdaptationStrategyType.PARALLELIZATION)
      );

      const opportunities = await adaptationSystem.detectOpportunities('test-plan', {
        type: AdaptationTriggerType.EFFICIENCY_OPTIMIZATION,
        source: 'test',
        description: 'Test evaluation'
      });

      const actions = await adaptationSystem.generateActions(opportunities[0].id);
      const action = actions[0];

      // Evaluate the action
      const impact = await adaptationSystem.evaluateAction(action, 'test-plan');
      
      expect(impact.timeImpactPercent).toBeDefined();
      expect(impact.resourceImpactPercent).toBeDefined();
      expect(impact.reliabilityImpactPercent).toBeDefined();
      expect(impact.qualityImpactPercent).toBeDefined();
      expect(impact.overallBenefitScore).toBeDefined();
      expect(impact.affectedSteps).toBeDefined();
    });
  });

  describe('Adaptation Application', () => {
    it('should apply an adaptation successfully', async () => {
      // Setup
      await adaptationSystem.registerStrategy(
        createMockStrategy('test-strategy', AdaptationStrategyType.ELIMINATION)
      );

      const opportunities = await adaptationSystem.detectOpportunities('test-plan', {
        type: AdaptationTriggerType.EFFICIENCY_OPTIMIZATION,
        source: 'test',
        description: 'Test application'
      });

      const actions = await adaptationSystem.generateActions(opportunities[0].id);
      const action = actions[0];

      // Apply adaptation
      const result = await adaptationSystem.applyAdaptation(opportunities[0].id, action);
      
      expect(result.success).toBe(true);
      expect(result.originalPlanId).toBe('test-plan');
      expect(result.modifiedPlanId).toBeDefined();
      expect(result.opportunity).toEqual(opportunities[0]);
      expect(result.action).toEqual(action);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.logs).toHaveLength(4); // Start, execute strategy, complete, and strategy-specific log
      expect(result.measuredImpact).toBeDefined();
    });

    it('should handle application errors gracefully', async () => {
      const result = await adaptationSystem.applyAdaptation('non-existent', {} as any);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.logs.some(log => log.level === 'error')).toBe(true);
    });
  });

  describe('Adaptation History', () => {
    it('should retrieve adaptation history for a plan', async () => {
      // Apply some adaptations first
      await adaptationSystem.registerStrategy(
        createMockStrategy('test-strategy', AdaptationStrategyType.SUBSTITUTION)
      );

      const opportunities = await adaptationSystem.detectOpportunities('test-plan', {
        type: AdaptationTriggerType.EFFICIENCY_OPTIMIZATION,
        source: 'test',
        description: 'Test history'
      });

      const actions = await adaptationSystem.generateActions(opportunities[0].id);
      await adaptationSystem.applyAdaptation(opportunities[0].id, actions[0]);

      // Get history
      const history = await adaptationSystem.getAdaptationHistory('test-plan');
      
      expect(history).toHaveLength(1);
      expect(history[0].originalPlanId).toBe('test-plan');
    });

    it('should return empty history for non-existent plan', async () => {
      const history = await adaptationSystem.getAdaptationHistory('non-existent-plan');
      expect(history).toHaveLength(0);
    });

    it('should validate plan ID', async () => {
      await expect(adaptationSystem.getAdaptationHistory(''))
        .rejects.toThrow('Plan ID is required');
    });
  });

  describe('Trigger Adaptation', () => {
    it('should trigger complete adaptation process', async () => {
      // Setup
      await adaptationSystem.registerStrategy(
        createMockStrategy('test-strategy', AdaptationStrategyType.ELIMINATION)
      );

      // Trigger adaptation
      const result = await adaptationSystem.triggerAdaptation('test-plan', {
        type: AdaptationTriggerType.EFFICIENCY_OPTIMIZATION,
        source: 'test',
        description: 'Complete process test'
      });

      expect(result.opportunities).toHaveLength(1);
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.appliedAdaptation).toBeUndefined(); // No auto-apply
    });

    it('should auto-apply best adaptation when requested', async () => {
      // Setup
      await adaptationSystem.registerStrategy(
        createMockStrategy('test-strategy', AdaptationStrategyType.CONSOLIDATION)
      );

      // Trigger with auto-apply
      const result = await adaptationSystem.triggerAdaptation('test-plan', {
        type: AdaptationTriggerType.EFFICIENCY_OPTIMIZATION,
        source: 'test',
        description: 'Auto-apply test'
      }, {
        autoApply: true
      });

      expect(result.opportunities).toHaveLength(1);
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.appliedAdaptation).toBeDefined();
      expect(result.appliedAdaptation!.success).toBe(true);
    });

    it('should filter by preferred strategies', async () => {
      // Setup multiple strategies
      await adaptationSystem.registerStrategy(
        createMockStrategy('elimination-strategy', AdaptationStrategyType.ELIMINATION)
      );
      await adaptationSystem.registerStrategy(
        createMockStrategy('insertion-strategy', AdaptationStrategyType.INSERTION)
      );

      // Trigger with preferred strategies
      const result = await adaptationSystem.triggerAdaptation('test-plan', {
        type: AdaptationTriggerType.EFFICIENCY_OPTIMIZATION,
        source: 'test',
        description: 'Filtered strategies test'
      }, {
        preferredStrategies: [AdaptationStrategyType.ELIMINATION]
      });

      expect(result.actions.every(action => 
        action.strategyType === AdaptationStrategyType.ELIMINATION
      )).toBe(true);
    });
  });

  describe('Adaptation Statistics', () => {
    it('should provide comprehensive statistics', async () => {
      // Setup and apply some adaptations
      await adaptationSystem.registerStrategy(
        createMockStrategy('test-strategy', AdaptationStrategyType.PARALLELIZATION)
      );

      const opportunities = await adaptationSystem.detectOpportunities('test-plan', {
        type: AdaptationTriggerType.EFFICIENCY_OPTIMIZATION,
        source: 'test',
        description: 'Statistics test'
      });

      const actions = await adaptationSystem.generateActions(opportunities[0].id);
      await adaptationSystem.applyAdaptation(opportunities[0].id, actions[0]);

      // Get statistics
      const stats = await adaptationSystem.getAdaptationStatistics();
      
      expect(stats.totalOpportunities).toBeGreaterThan(0);
      expect(stats.totalActions).toBeGreaterThan(0);
      expect(stats.totalApplications).toBeGreaterThan(0);
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.opportunitiesByTrigger).toBeDefined();
      expect(stats.actionsByStrategy).toBeDefined();
      expect(stats.averageImpact).toBeDefined();
      expect(stats.mostEffectiveStrategies).toBeDefined();
    });

    it('should filter statistics by time range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      const stats = await adaptationSystem.getAdaptationStatistics({
        start: oneHourAgo,
        end: oneHourFromNow
      });

      expect(stats).toBeDefined();
      expect(typeof stats.totalOpportunities).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it('should handle uninitialized system', async () => {
      const uninitializedSystem = new DefaultPlanAdaptationSystem();
      
      await expect(uninitializedSystem.registerStrategy({} as any))
        .rejects.toThrow('not initialized');
      
      await expect(uninitializedSystem.detectOpportunities('test'))
        .rejects.toThrow('not initialized');
    });

    it('should validate input parameters', async () => {
      await expect(adaptationSystem.detectOpportunities(''))
        .rejects.toThrow('Plan ID is required');
      
      await expect(adaptationSystem.triggerAdaptation('', {} as any))
        .rejects.toThrow('Plan ID is required');
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', async () => {
      const result = await adaptationSystem.shutdown();
      expect(result).toBe(true);
      
      // Should be able to shutdown multiple times
      const result2 = await adaptationSystem.shutdown();
      expect(result2).toBe(true);
    });
  });
}); 