/**
 * ReflectionManager.interface.test.ts
 * 
 * Tests to validate the ReflectionManager interface contract
 * and ensure proper implementation by concrete classes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ReflectionManager, 
  ReflectionManagerConfig,
  ReflectionTrigger,
  Reflection,
  ReflectionInsight,
  ReflectionResult,
  ImprovementAction,
  ReflectionStrategy,
  KnowledgeGap
} from './ReflectionManager.interface';
import { ManagerType } from './ManagerType';
import { BaseManager, AbstractBaseManager } from './BaseManager';
import { ManagerHealth } from './ManagerHealth';
import { AgentBase } from '../AgentBase.interface';

describe('ReflectionManager Interface', () => {
  // Mock implementation of the ReflectionManager interface for testing
  class MockReflectionManager extends AbstractBaseManager implements ReflectionManager {
    constructor() {
      super('mock-reflection-manager', ManagerType.REFLECTION, {} as AgentBase, { enabled: true });
    }

    async initialize(): Promise<boolean> {
      this._initialized = true;
      return true;
    }

    async shutdown(): Promise<void> {
      this._initialized = false;
    }

    async getHealth(): Promise<ManagerHealth> {
      return {
        status: 'healthy',
        details: {
          lastCheck: new Date(),
          issues: [],
          metrics: {
            totalReflections: 0,
            activeReflections: 0
          }
        }
      };
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

    async getReflectionStrategies(): Promise<ReflectionStrategy[]> {
      return [];
    }

    async identifyKnowledgeGaps(options?: {
      fromRecentInteractions?: boolean;
      fromReflectionIds?: string[];
      maxGaps?: number;
      minImpactLevel?: number;
    }): Promise<KnowledgeGap[]> {
      return [{
        id: 'gap-123',
        description: 'Test gap',
        identifiedAt: new Date(),
        priority: 'medium',
        impactLevel: 0.7,
        status: 'identified',
        domain: 'planning'
      }];
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
      return ['goal1', 'goal2'];
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

    async getPerformanceMetrics(options?: {
      fromDate?: Date;
      toDate?: Date;
      compareToPrevious?: boolean;
      include?: string[];
    }): Promise<{
      period: {
        start: Date;
        end: Date;
      };
      metrics: {
        successRate: number;
        averageResponseTime: number;
      };
    }> {
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
  }

  let reflectionManager: ReflectionManager;

  beforeEach(() => {
    reflectionManager = new MockReflectionManager();
  });

  it('should implement BaseManager interface', () => {
    // Type check that ReflectionManager extends BaseManager
    const manager: BaseManager = reflectionManager;
    expect(manager).toBeDefined();
  });

  it('should have the correct manager type', () => {
    expect(reflectionManager.managerType).toBe(ManagerType.REFLECTION);
  });

  it('should initialize successfully', async () => {
    const result = await reflectionManager.initialize();
    expect(result).toBe(true);
  });

  it('should get health status', async () => {
    const health = await reflectionManager.getHealth();
    expect(health.status).toBe('healthy');
    expect(health.details.issues).toHaveLength(0);
  });

  it('should reflect and return a valid result', async () => {
    const result = await reflectionManager.reflect(ReflectionTrigger.MANUAL);
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('insights');
    expect(result).toHaveProperty('message');
  });

  it('should create and retrieve a reflection', async () => {
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

  it('should get performance metrics', async () => {
    const metrics = await reflectionManager.getPerformanceMetrics();
    expect(metrics).toHaveProperty('period');
    expect(metrics.period).toHaveProperty('start');
    expect(metrics.period).toHaveProperty('end');
    expect(metrics.metrics).toHaveProperty('successRate');
    expect(metrics.metrics).toHaveProperty('averageResponseTime');
  });
}); 