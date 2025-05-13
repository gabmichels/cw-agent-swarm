/**
 * Tests for DefaultPlanAdaptationSystem
 * 
 * This file contains tests for the DefaultPlanAdaptationSystem implementation.
 */

import {
  AdaptationTriggerType,
  AdaptationStrategyType,
  AdaptationScope
} from '../../interfaces/PlanAdaptation.interface';
import { DefaultPlanAdaptationSystem } from '../DefaultPlanAdaptationSystem';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';

// Create a simple mock strategy
const createMockStrategy = (id: string, triggerTypes: AdaptationTriggerType[]) => {
  return {
    config: {
      id,
      type: AdaptationStrategyType.SUBSTITUTION,
      name: `Mock Strategy ${id}`,
      description: 'A mock strategy for testing',
      triggerTypes,
      priority: 1,
      minConfidenceThreshold: 0.7,
      enabled: true
    },
    canHandleOpportunity: () => Promise.resolve({
      canHandle: true,
      confidence: 0.8,
      reason: 'Test reason'
    }),
    generateAdaptationActions: () => Promise.resolve([]),
    applyAdaptation: () => Promise.resolve({
      success: true,
      originalPlanId: 'plan-1',
      modifiedPlanId: 'plan-1',
      opportunity: { id: 'opp-1' } as any,
      action: { strategyType: AdaptationStrategyType.SUBSTITUTION } as any,
      timestamp: new Date(),
      durationMs: 100,
      modifiedSteps: [],
      logs: []
    })
  };
};

describe('DefaultPlanAdaptationSystem', () => {
  let adaptationSystem: DefaultPlanAdaptationSystem;
  
  beforeEach(async () => {
    adaptationSystem = new DefaultPlanAdaptationSystem();
    await adaptationSystem.initialize();
    
    // Add a test plan to the internal cache
    (adaptationSystem as any).planCache.set('plan-1', {
      id: 'plan-1',
      name: 'Test Plan',
      steps: []
    });
  });
  
  afterEach(async () => {
    await adaptationSystem.shutdown();
  });
  
  test('should initialize successfully', async () => {
    const newSystem = new DefaultPlanAdaptationSystem();
    const result = await newSystem.initialize();
    expect(result).toBe(true);
    await newSystem.shutdown();
  });
  
  test('should register and retrieve strategies', async () => {
    const mockStrategy1 = createMockStrategy('strategy-1', [AdaptationTriggerType.EFFICIENCY_OPTIMIZATION]);
    const mockStrategy2 = createMockStrategy('strategy-2', [AdaptationTriggerType.ERROR_RECOVERY]);
    
    await adaptationSystem.registerStrategy(mockStrategy1 as any);
    await adaptationSystem.registerStrategy(mockStrategy2 as any);
    
    const strategies = await adaptationSystem.getRegisteredStrategies();
    
    expect(strategies.length).toBe(2);
    expect(strategies.map(s => s.config.id).sort()).toEqual(['strategy-1', 'strategy-2']);
  });
  
  test('should enable and disable strategies', async () => {
    const mockStrategy = createMockStrategy('strategy-3', [AdaptationTriggerType.RESOURCE_CONSTRAINT]);
    mockStrategy.config.enabled = false;
    
    await adaptationSystem.registerStrategy(mockStrategy as any);
    
    // Enable the strategy
    const enableResult = await adaptationSystem.enableStrategy('strategy-3');
    expect(enableResult).toBe(true);
    
    let strategies = await adaptationSystem.getRegisteredStrategies();
    let strategy = strategies.find(s => s.config.id === 'strategy-3');
    expect(strategy?.config.enabled).toBe(true);
    
    // Disable the strategy
    const disableResult = await adaptationSystem.disableStrategy('strategy-3');
    expect(disableResult).toBe(true);
    
    strategies = await adaptationSystem.getRegisteredStrategies();
    strategy = strategies.find(s => s.config.id === 'strategy-3');
    expect(strategy?.config.enabled).toBe(false);
  });
  
  test('should unregister strategies', async () => {
    const mockStrategy = createMockStrategy('strategy-4', [AdaptationTriggerType.PERIODIC]);
    
    await adaptationSystem.registerStrategy(mockStrategy as any);
    
    let strategies = await adaptationSystem.getRegisteredStrategies();
    expect(strategies.some(s => s.config.id === 'strategy-4')).toBe(true);
    
    const unregisterResult = await adaptationSystem.unregisterStrategy('strategy-4');
    expect(unregisterResult).toBe(true);
    
    strategies = await adaptationSystem.getRegisteredStrategies();
    expect(strategies.some(s => s.config.id === 'strategy-4')).toBe(false);
  });
  
  test('should detect opportunities based on trigger', async () => {
    const opportunities = await adaptationSystem.detectOpportunities(
      'plan-1',
      {
        type: AdaptationTriggerType.EFFICIENCY_OPTIMIZATION,
        source: 'test',
        description: 'Test trigger'
      }
    );
    
    expect(opportunities.length).toBe(1);
    expect(opportunities[0].planId).toBe('plan-1');
    expect(opportunities[0].trigger.type).toBe(AdaptationTriggerType.EFFICIENCY_OPTIMIZATION);
    expect(opportunities[0].trigger.source).toBe('test');
    expect(opportunities[0].trigger.description).toBe('Test trigger');
    expect(opportunities[0].priorityScore).toBeGreaterThan(0);
    expect(opportunities[0].applicableStrategies.length).toBeGreaterThan(0);
  });
  
  test('should detect opportunities automatically', async () => {
    const opportunities = await adaptationSystem.detectOpportunities('plan-1');
    
    expect(opportunities.length).toBeGreaterThan(0);
    expect(opportunities[0].planId).toBe('plan-1');
    expect(opportunities[0].trigger.type).toBeDefined();
    expect(opportunities[0].priorityScore).toBeGreaterThan(0);
  });
  
  test('should throw error for non-existent plan', async () => {
    await expect(
      adaptationSystem.detectOpportunities('non-existent-plan')
    ).rejects.toThrow('Plan non-existent-plan not found');
  });
}); 