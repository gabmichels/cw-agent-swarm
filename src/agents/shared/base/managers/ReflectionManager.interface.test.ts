/**
 * ReflectionManager.interface.test.ts
 * 
 * Tests to validate the ReflectionManager interface contract
 * and ensure proper implementation by concrete classes.
 */

import { expect, describe, it, beforeEach, vi } from 'vitest';
import { ReflectionManager, ReflectionManagerConfig, ReflectionTrigger, 
         Reflection, ReflectionInsight, ReflectionResult, ImprovementAction,
         ReflectionStrategy, KnowledgeGap, PerformanceMetrics } from './ReflectionManager.interface';
import { ManagerType } from './ManagerType';
import { BaseManager } from './BaseManager';

// Mock implementation of the ReflectionManager interface for testing
// @ts-ignore - Intentionally not implementing all BaseManager properties for testing
class MockReflectionManager implements ReflectionManager {
  id: string;
  managerId: string;
  managerType: ManagerType;
  private _isEnabled: boolean;
  config: ReflectionManagerConfig;
  initialized: boolean;

  constructor() {
    this.id = 'mock-reflection-manager';
    this.managerId = 'mock-reflection-manager-123';
    this.managerType = ManagerType.REFLECTION;
    this._isEnabled = true;
    this.config = {
      enabled: true,
      reflectionDepth: 'standard',
      adaptiveBehavior: true,
      adaptationRate: 0.5,
      reflectionFrequency: {
        minIntervalMs: 60000,
        interval: 3600000,
        afterEachInteraction: false,
        afterErrors: true
      },
      persistReflections: true,
      maxHistoryItems: 100
    };
    this.initialized = false;
  }

  async initialize(): Promise<boolean> {
    this.initialized = true;
    return true;
  }

  isEnabled(): boolean {
    return this._isEnabled;
  }
  
  setEnabled(enabled: boolean): boolean {
    this._isEnabled = enabled;
    return enabled;
  }

  getId(): string {
    return this.managerId;
  }

  getType(): ManagerType {
    return this.managerType;
  }

  getAgent(): any {
    return null;
  }

  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    metrics?: Record<string, unknown>;
  }> {
    return {
      status: 'healthy',
      message: 'Reflection manager is healthy'
    };
  }

  async shutdown(): Promise<void> {
    // Shutdown implementation
  }

  async reset(): Promise<boolean> {
    return true;
  }

  getConfig<T extends ReflectionManagerConfig>(): T {
    return this.config as T;
  }

  updateConfig<T extends ReflectionManagerConfig>(config: Partial<T>): T {
    this.config = { ...this.config, ...config };
    return this.config as T;
  }

  async reflect(trigger: ReflectionTrigger, context?: Record<string, unknown>): Promise<ReflectionResult> {
    return {
      success: true,
      id: 'reflection-123',
      insights: [],
      message: 'Reflection completed'
    };
  }

  async getReflection(id: string): Promise<Reflection | null> {
    return {
      id,
      timestamp: new Date(),
      trigger: ReflectionTrigger.MANUAL,
      context: {},
      depth: 'standard',
      insights: [],
      metrics: {}
    };
  }

  async getReflections(options?: {
    limit?: number;
    offset?: number;
    sortBy?: 'timestamp' | 'trigger';
    sortDirection?: 'asc' | 'desc';
  }): Promise<Reflection[]> {
    return [];
  }

  async createReflection(reflection: Omit<Reflection, 'id' | 'timestamp'>): Promise<Reflection> {
    return {
      ...reflection,
      id: 'new-reflection-123',
      timestamp: new Date()
    };
  }

  async listReflections(options?: {
    trigger?: ReflectionTrigger[];
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    sortBy?: 'timestamp' | 'trigger';
    sortDirection?: 'asc' | 'desc';
  }): Promise<Reflection[]> {
    return [];
  }

  async getInsight(id: string): Promise<ReflectionInsight | null> {
    return {
      id,
      reflectionId: 'reflection-123',
      timestamp: new Date(),
      type: 'learning',
      content: 'Test insight',
      confidence: 0.8,
      metadata: {}
    };
  }

  async getInsights(options?: {
    reflectionId?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'timestamp' | 'confidence' | 'type';
    sortDirection?: 'asc' | 'desc';
  }): Promise<ReflectionInsight[]> {
    return [];
  }

  async getMetrics(): Promise<Record<string, number>> {
    return {
      successRate: 0.85,
      averageResponseTime: 1200
    };
  }

  async setImprovementGoals(goals: string[]): Promise<boolean> {
    return true;
  }

  async getImprovementGoals(): Promise<string[]> {
    return ['Improve response time', 'Enhance accuracy'];
  }

  async createImprovementAction(
    action: Omit<ImprovementAction, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ImprovementAction> {
    return {
      ...action,
      id: 'action-123',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async getImprovementAction(actionId: string): Promise<ImprovementAction | null> {
    return {
      id: actionId,
      title: 'Test Action',
      description: 'Test description',
      targetArea: 'planning',
      priority: 'high',
      expectedImpact: 0.8,
      difficulty: 0.5,
      status: 'suggested',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async updateImprovementAction(
    actionId: string,
    updates: Partial<Omit<ImprovementAction, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ImprovementAction> {
    return {
      id: actionId,
      title: updates.title || 'Test Action',
      description: updates.description || 'Test description',
      targetArea: updates.targetArea || 'planning',
      priority: updates.priority || 'high',
      expectedImpact: updates.expectedImpact || 0.8,
      difficulty: updates.difficulty || 0.5,
      status: updates.status || 'suggested',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async listImprovementActions(options?: {
    status?: ImprovementAction['status'][];
    targetArea?: ImprovementAction['targetArea'][];
    priority?: ImprovementAction['priority'][];
    minExpectedImpact?: number;
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'priority' | 'expectedImpact' | 'difficulty';
    sortDirection?: 'asc' | 'desc';
  }): Promise<ImprovementAction[]> {
    return [];
  }

  async registerReflectionStrategy(
    strategy: Omit<ReflectionStrategy, 'id'>
  ): Promise<ReflectionStrategy> {
    return {
      ...strategy,
      id: 'strategy-123'
    };
  }

  async getReflectionStrategy(strategyId: string): Promise<ReflectionStrategy | null> {
    return {
      id: strategyId,
      name: 'Test Strategy',
      description: 'Test description',
      triggers: [ReflectionTrigger.MANUAL, ReflectionTrigger.ERROR],
      enabled: true,
      priority: 0.8,
      queryTemplate: 'Test template',
      focusAreas: ['planning']
    };
  }

  async updateReflectionStrategy(
    strategyId: string,
    updates: Partial<Omit<ReflectionStrategy, 'id'>>
  ): Promise<ReflectionStrategy> {
    return {
      id: strategyId,
      name: updates.name || 'Test Strategy',
      description: updates.description || 'Test description',
      triggers: updates.triggers || [ReflectionTrigger.MANUAL, ReflectionTrigger.ERROR],
      enabled: updates.enabled !== undefined ? updates.enabled : true,
      priority: updates.priority || 0.8,
      queryTemplate: updates.queryTemplate || 'Test template',
      focusAreas: updates.focusAreas || ['planning']
    };
  }

  async listReflectionStrategies(options?: {
    trigger?: ReflectionTrigger[];
    enabled?: boolean;
    sortBy?: 'priority' | 'name';
    sortDirection?: 'asc' | 'desc';
  }): Promise<ReflectionStrategy[]> {
    return [];
  }

  async setReflectionStrategyEnabled(
    strategyId: string,
    enabled: boolean
  ): Promise<ReflectionStrategy> {
    return {
      id: strategyId,
      name: 'Test Strategy',
      description: 'Test description',
      triggers: [ReflectionTrigger.MANUAL, ReflectionTrigger.ERROR],
      enabled,
      priority: 0.8,
      queryTemplate: 'Test template',
      focusAreas: ['planning']
    };
  }

  async identifyKnowledgeGaps(options?: {
    fromRecentInteractions?: boolean;
    fromReflectionIds?: string[];
    maxGaps?: number;
    minImpactLevel?: number;
  }): Promise<KnowledgeGap[]> {
    return [];
  }

  async getKnowledgeGap(gapId: string): Promise<KnowledgeGap | null> {
    return {
      id: gapId,
      description: 'Test gap',
      identifiedAt: new Date(),
      priority: 'medium',
      impactLevel: 0.7,
      status: 'identified',
      domain: 'planning'
    };
  }

  async updateKnowledgeGap(
    gapId: string,
    updates: Partial<Omit<KnowledgeGap, 'id' | 'identifiedAt'>>
  ): Promise<KnowledgeGap> {
    return {
      id: gapId,
      description: updates.description || 'Test gap',
      identifiedAt: new Date(),
      priority: updates.priority || 'medium',
      impactLevel: updates.impactLevel || 0.7,
      status: updates.status || 'identified',
      domain: updates.domain || 'planning'
    };
  }

  async listKnowledgeGaps(options?: {
    status?: KnowledgeGap['status'][];
    priority?: KnowledgeGap['priority'][];
    minImpactLevel?: number;
    limit?: number;
    offset?: number;
    sortBy?: 'identifiedAt' | 'priority' | 'impactLevel';
    sortDirection?: 'asc' | 'desc';
  }): Promise<KnowledgeGap[]> {
    return [];
  }

  async getPerformanceMetrics(options?: {
    fromDate?: Date;
    toDate?: Date;
    compareToPrevious?: boolean;
    include?: string[];
  }): Promise<PerformanceMetrics> {
    return {
      period: {
        start: new Date(Date.now() - 86400000),
        end: new Date()
      },
      metrics: {
        successRate: 0.85,
        averageResponseTime: 1200
      }
    };
  }

  async adaptBehavior(): Promise<boolean> {
    return true;
  }

  async getStats(): Promise<Record<string, unknown>> {
    return {
      totalReflections: 10,
      totalInsights: 25,
      averageConfidence: 0.82
    };
  }
}

describe('ReflectionManager Interface', () => {
  let reflectionManager: ReflectionManager;

  beforeEach(() => {
    // @ts-ignore - Using mock implementation for testing
    reflectionManager = new MockReflectionManager();
  });

  it('should implement BaseManager interface', () => {
    // Type check that ReflectionManager extends BaseManager
    const manager: BaseManager = reflectionManager;
    expect(manager).toBeDefined();
  });

  it('should have the correct manager type', async () => {
    expect(reflectionManager.getType()).toBe(ManagerType.REFLECTION);
  });

  it('should initialize successfully', async () => {
    const result = await reflectionManager.initialize();
    expect(result).toBe(true);
  });

  it('should get health status', async () => {
    const health = await reflectionManager.getHealth();
    expect(health.status).toBe('healthy');
  });

  it('should reflect and return a valid result', async () => {
    const result = await reflectionManager.reflect(ReflectionTrigger.MANUAL);
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('insights');
    expect(result).toHaveProperty('message');
  });

  it('should create and return a reflection', async () => {
    const reflection = await reflectionManager.createReflection({
      trigger: ReflectionTrigger.MANUAL,
      context: { source: 'test' },
      depth: 'standard',
      insights: [],
      metrics: {}
    });
    
    expect(reflection).toHaveProperty('id');
    expect(reflection).toHaveProperty('timestamp');
    expect(reflection.trigger).toBe(ReflectionTrigger.MANUAL);
  });

  it('should retrieve a reflection by ID', async () => {
    const id = 'test-reflection-id';
    const reflection = await reflectionManager.getReflection(id);
    
    expect(reflection).not.toBeNull();
    expect(reflection?.id).toBe(id);
  });

  it('should create and retrieve improvement actions', async () => {
    const action = await reflectionManager.createImprovementAction({
      title: 'Test Action',
      description: 'Improve test coverage',
      targetArea: 'planning',
      priority: 'high',
      expectedImpact: 0.9,
      difficulty: 0.3,
      status: 'suggested'
    });
    
    expect(action).toHaveProperty('id');
    expect(action).toHaveProperty('createdAt');
    expect(action).toHaveProperty('updatedAt');
    
    const retrieved = await reflectionManager.getImprovementAction(action.id);
    expect(retrieved).not.toBeNull();
  });

  it('should register and retrieve reflection strategies', async () => {
    const strategy = await reflectionManager.registerReflectionStrategy({
      name: 'Error Analysis',
      description: 'Analyzes errors to improve response quality',
      triggers: [ReflectionTrigger.ERROR],
      enabled: true,
      priority: 0.9,
      queryTemplate: 'Analyze what went wrong with: {{context}}'
    });
    
    expect(strategy).toHaveProperty('id');
    
    const retrieved = await reflectionManager.getReflectionStrategy(strategy.id);
    expect(retrieved).not.toBeNull();
  });

  it('should identify and retrieve knowledge gaps', async () => {
    const gaps = await reflectionManager.identifyKnowledgeGaps({
      fromRecentInteractions: true,
      maxGaps: 5
    });
    
    expect(Array.isArray(gaps)).toBe(true);
    
    const gapId = 'test-gap-id';
    const gap = await reflectionManager.getKnowledgeGap(gapId);
    
    expect(gap).not.toBeNull();
    expect(gap?.id).toBe(gapId);
  });

  it('should retrieve performance metrics', async () => {
    const metrics = await reflectionManager.getPerformanceMetrics({
      compareToPrevious: true
    });
    
    expect(metrics).toHaveProperty('period');
    expect(metrics).toHaveProperty('metrics');
    expect(metrics.period).toHaveProperty('start');
    expect(metrics.period).toHaveProperty('end');
  });

  it('should adapt behavior based on reflections', async () => {
    const result = await reflectionManager.adaptBehavior();
    expect(typeof result).toBe('boolean');
  });

  it('should provide reflection statistics', async () => {
    const stats = await reflectionManager.getStats();
    expect(stats).toBeTypeOf('object');
  });
}); 