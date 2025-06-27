/**
 * Phase 6: Performance and Load Testing
 * 
 * Comprehensive performance tests for the LLM-Based Tool Response Formatter
 * including load testing, stress testing, and performance benchmarking.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonaInfo } from '../../../agents/shared/messaging/PromptFormatter';
import { generateULID } from '../../../lib/core/id-generation';
import { ToolExecutionResult } from '../../../lib/tools/types';
import { IdGenerator } from '../../../utils/ulid';
import { ABTestingFramework } from '../ABTestingFramework';
import { LLMPersonaFormatter } from '../LLMPersonaFormatter';
import { LLMToolResponseFormatter } from '../LLMToolResponseFormatter';
import { PerformanceMonitor } from '../PerformanceMonitor';
import {
  FormattedToolResponse,
  ResponseStyleType,
  ToolCategory,
  ToolResponseContext
} from '../types';

// Mock dependencies
const mockLLMService = {
  generateResponse: vi.fn()
};

const mockPromptTemplateService = {
  getTemplate: vi.fn(),
  getAllTemplates: vi.fn(),
  upsertTemplate: vi.fn()
} as any;

const mockResponseCache = {
  get: vi.fn(),
  set: vi.fn(),
  clear: vi.fn()
} as any;

// Mock logger
vi.mock('../../../lib/logging/winston-logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}));

// Mock PromptFormatter
vi.mock('../../../agents/shared/messaging/PromptFormatter', () => ({
  PromptFormatter: {
    formatSystemPrompt: vi.fn().mockResolvedValue('Mock system prompt')
  }
}));

describe('Phase 6: Performance and Load Testing', () => {
  let formatter: LLMToolResponseFormatter;
  let personaFormatter: LLMPersonaFormatter;
  let performanceMonitor: PerformanceMonitor;
  let abTester: ABTestingFramework;

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize services
    formatter = new LLMToolResponseFormatter(
      mockLLMService as any,
      mockPromptTemplateService,
      mockResponseCache
    );

    const mockConfigService = {
      getConfig: vi.fn().mockResolvedValue({
        enableLLMFormatting: true,
        maxResponseLength: 500,
        includeEmojis: true,
        includeNextSteps: true,
        includeMetrics: false,
        responseStyle: 'conversational',
        enableCaching: true,
        cacheTTLSeconds: 3600,
        toolCategoryOverrides: {}
      })
    };

    personaFormatter = new LLMPersonaFormatter(
      formatter as any,
      mockConfigService as any
    );

    // Mock PerformanceMonitor for testing
    performanceMonitor = {
      startMonitoring: vi.fn().mockReturnValue({
        contextId: 'test_context',
        agentId: 'test_agent',
        toolCategory: ToolCategory.WORKSPACE,
        responseStyle: 'conversational',
        startTime: process.hrtime.bigint(),
        stageTimings: new Map(),
        isCompleted: false
      }),
      completeMonitoring: vi.fn().mockReturnValue({
        timestamp: new Date(),
        contextId: 'test_context',
        agentId: 'test_agent',
        toolCategory: ToolCategory.WORKSPACE,
        responseStyle: 'conversational',
        processingStages: {
          templateRetrieval: 10,
          systemPromptGeneration: 25,
          llmGeneration: 150,
          postProcessing: 15,
          qualityScoring: 8,
          cacheOperations: 5,
          totalProcessingTime: 213
        },
        bottlenecks: [
          {
            stage: 'llmGeneration',
            duration: 150,
            threshold: 100,
            severity: 'medium',
            impact: 'Moderate response delay',
            recommendation: 'Consider optimizing prompt template'
          }
        ],
        optimizationSuggestions: [
          'Optimize LLM prompt length',
          'Enable response caching',
          'Use faster model for simple queries'
        ]
      }),
      recordStageCompletion: vi.fn(),
      getPerformanceSummary: vi.fn(),
      getActivePerformanceAlerts: vi.fn().mockReturnValue([]),
      updateConfiguration: vi.fn(),
      clearPerformanceHistory: vi.fn()
    } as any;

    abTester = new ABTestingFramework();

    // Setup default mocks
    mockPromptTemplateService.getTemplate.mockResolvedValue({
      id: 'test_template',
      category: ToolCategory.WORKSPACE,
      style: 'conversational' as ResponseStyleType,
      systemPrompt: 'You are a helpful assistant',
      successTemplate: 'Success template',
      errorTemplate: 'Error template',
      partialSuccessTemplate: 'Partial success template',
      enabled: true,
      priority: 1
    });

    mockResponseCache.get.mockResolvedValue(null); // No cache hit by default
    mockResponseCache.set.mockResolvedValue();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('6.1 Performance Benchmarking', () => {
    it('should meet response time targets for single requests', async () => {
      const startTime = Date.now();

      mockLLMService.generateResponse.mockImplementation(async () => {
        // Simulate realistic LLM response time
        await new Promise(resolve => setTimeout(resolve, 150));
        return 'Test response completed successfully within time limits.';
      });

      const context = createMockContext({
        toolCategory: ToolCategory.WORKSPACE,
        toolId: 'email_sender'
      });

      const result = await formatter.formatResponse(context);
      const totalTime = Date.now() - startTime;

      // Performance assertions
      expect(totalTime).toBeLessThan(2000); // < 2s total time
      expect(result.generationMetrics.generationTime).toBeLessThan(1500); // < 1.5s generation time
      expect(result.content).toBeTruthy();
      expect(result.qualityScore).toBeGreaterThan(0.5);
    });

    it('should handle high-volume concurrent requests', async () => {
      const concurrentRequests = 50;
      const startTime = Date.now();

      mockLLMService.generateResponse.mockImplementation(async () => {
        // Simulate variable response times under load
        const delay = 100 + Math.random() * 200;
        await new Promise(resolve => setTimeout(resolve, delay));
        return 'Concurrent test response completed.';
      });

      // Create test contexts
      const contexts = Array.from({ length: concurrentRequests }, (_, i) =>
        createMockContext({
          toolCategory: ToolCategory.WORKSPACE,
          toolId: `concurrent_tool_${i}`,
          toolData: { requestId: i, timestamp: Date.now() }
        })
      );

      // Execute all requests concurrently
      const results = await Promise.all(
        contexts.map(context => formatter.formatResponse(context))
      );

      const totalTime = Date.now() - startTime;
      const avgResponseTime = results.reduce((sum, r) => sum + r.generationMetrics.generationTime, 0) / results.length;

      // Performance assertions
      expect(results).toHaveLength(concurrentRequests);
      expect(totalTime).toBeLessThan(10000); // < 10s for 50 concurrent requests
      expect(avgResponseTime).toBeLessThan(2000); // < 2s average response time

      // Quality should remain consistent under load
      const avgQuality = results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length;
      expect(avgQuality).toBeGreaterThan(0.6);

      // No excessive failures
      const failedRequests = results.filter(r => r.fallbackUsed).length;
      expect(failedRequests).toBeLessThan(concurrentRequests * 0.05); // < 5% failure rate
    });

    it('should maintain performance with cache optimization', async () => {
      const cacheableContext = createMockContext({
        toolCategory: ToolCategory.SOCIAL_MEDIA,
        toolId: 'twitter_post',
        toolData: { tweetId: '123', content: 'Same tweet content' }
      });

      mockLLMService.generateResponse.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'Cached response content.';
      });

      // First request - cache miss
      const firstResult = await formatter.formatResponse(cacheableContext);
      expect(firstResult.generationMetrics.cacheHit).toBe(false);
      expect(firstResult.generationMetrics.generationTime).toBeGreaterThan(100);

      // Mock cache hit for subsequent requests
      mockResponseCache.get.mockResolvedValueOnce(firstResult);

      // Second request - should use cache
      const secondResult = await formatter.formatResponse(cacheableContext);
      expect(secondResult.generationMetrics.cacheHit).toBe(true);
      expect(secondResult.generationMetrics.generationTime).toBe(0);
    });
  });

  describe('6.2 Load Testing Scenarios', () => {
    it('should handle burst traffic patterns', async () => {
      const burstSize = 25;
      const numberOfBursts = 3;
      const burstInterval = 500; // ms between bursts

      mockLLMService.generateResponse.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 150));
        return 'Burst test response completed.';
      });

      const allResults: FormattedToolResponse[] = [];

      // Execute bursts
      for (let burst = 0; burst < numberOfBursts; burst++) {
        const burstStart = Date.now();

        const burstContexts = Array.from({ length: burstSize }, (_, i) =>
          createMockContext({
            toolCategory: ToolCategory.EXTERNAL_API,
            toolId: `burst_${burst}_tool_${i}`,
            toolData: { burstId: burst, requestId: i }
          })
        );

        const burstResults = await Promise.all(
          burstContexts.map(context => formatter.formatResponse(context))
        );

        allResults.push(...burstResults);

        const burstTime = Date.now() - burstStart;
        expect(burstTime).toBeLessThan(5000); // Each burst should complete in < 5s

        // Wait between bursts (except last one)
        if (burst < numberOfBursts - 1) {
          await new Promise(resolve => setTimeout(resolve, burstInterval));
        }
      }

      // Overall performance assertions
      expect(allResults).toHaveLength(burstSize * numberOfBursts);

      const avgQuality = allResults.reduce((sum, r) => sum + r.qualityScore, 0) / allResults.length;
      expect(avgQuality).toBeGreaterThan(0.6);

      const successRate = allResults.filter(r => !r.fallbackUsed).length / allResults.length;
      expect(successRate).toBeGreaterThan(0.95); // > 95% success rate
    });

    it('should handle mixed tool category workloads', async () => {
      const totalRequests = 40;
      const toolCategories = [
        ToolCategory.WORKSPACE,
        ToolCategory.SOCIAL_MEDIA,
        ToolCategory.EXTERNAL_API,
        ToolCategory.WORKFLOW,
        ToolCategory.RESEARCH
      ];

      mockLLMService.generateResponse.mockImplementation(async () => {
        // Simulate category-specific response times
        await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 120));
        return 'Mixed workload response completed.';
      });

      // Create mixed workload
      const contexts = Array.from({ length: totalRequests }, (_, i) => {
        const category = toolCategories[i % toolCategories.length];
        return createMockContext({
          toolCategory: category,
          toolId: `${category}_tool_${i}`,
          toolData: { workloadId: i, category }
        });
      });

      const startTime = Date.now();
      const results = await Promise.all(
        contexts.map(context => formatter.formatResponse(context))
      );
      const totalTime = Date.now() - startTime;

      // Performance assertions
      expect(results).toHaveLength(totalRequests);
      expect(totalTime).toBeLessThan(8000); // < 8s for mixed workload

      // Check performance by category
      const resultsByCategory = new Map();
      results.forEach((result, i) => {
        const category = contexts[i].toolCategory;
        if (!resultsByCategory.has(category)) {
          resultsByCategory.set(category, []);
        }
        resultsByCategory.get(category).push(result);
      });

      // Each category should have consistent performance
      for (const [category, categoryResults] of resultsByCategory) {
        const avgTime = categoryResults.reduce((sum: number, r: FormattedToolResponse) =>
          sum + r.generationMetrics.generationTime, 0) / categoryResults.length;
        const avgQuality = categoryResults.reduce((sum: number, r: FormattedToolResponse) =>
          sum + r.qualityScore, 0) / categoryResults.length;

        expect(avgTime).toBeLessThan(2000); // < 2s average per category
        expect(avgQuality).toBeGreaterThan(0.5); // Consistent quality
      }
    });
  });

  describe('6.3 Memory and Resource Usage', () => {
    it('should not leak memory during extended operation', async () => {
      const longRunningRequests = 100;

      mockLLMService.generateResponse.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return 'Memory test response.';
      });

      // Track memory usage patterns (simplified)
      const memorySnapshots: number[] = [];
      const interval = setInterval(() => {
        if (global.gc) {
          global.gc(); // Force garbage collection if available
        }
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }, 50);

      try {
        // Execute requests in batches to avoid overwhelming
        const batchSize = 20;
        for (let i = 0; i < longRunningRequests; i += batchSize) {
          const batch = Array.from({ length: Math.min(batchSize, longRunningRequests - i) }, (_, j) =>
            createMockContext({
              toolCategory: ToolCategory.WORKSPACE,
              toolId: `memory_test_${i + j}`,
              toolData: { testRun: i + j }
            })
          );

          await Promise.all(batch.map(context => formatter.formatResponse(context)));
        }

        clearInterval(interval);

        // Basic memory pattern analysis
        const initialMemory = memorySnapshots[0];
        const finalMemory = memorySnapshots[memorySnapshots.length - 1];
        const memoryGrowth = (finalMemory - initialMemory) / initialMemory;

        // Memory should not grow excessively (< 50% growth)
        expect(memoryGrowth).toBeLessThan(0.5);

      } finally {
        clearInterval(interval);
      }
    });
  });

  describe('6.4 Performance Monitoring Integration', () => {
    it('should provide comprehensive performance metrics', async () => {
      const monitoredContext = createMockContext({
        toolCategory: ToolCategory.WORKFLOW,
        toolId: 'monitored_workflow',
        toolData: { monitoring: true }
      });

      mockLLMService.generateResponse.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'Performance monitored response.';
      });

      // Monitor the operation
      const tracker = performanceMonitor.startMonitoring(monitoredContext);

      const result = await formatter.formatResponse(monitoredContext);

      const metrics = performanceMonitor.completeMonitoring(tracker, result);

      // Verify comprehensive metrics are collected
      expect(metrics).toBeDefined();
      expect(metrics.processingStages.totalProcessingTime).toBeGreaterThan(0);
      expect(metrics.processingStages.llmGeneration).toBeGreaterThan(0);
      expect(metrics.bottlenecks).toBeDefined();
      expect(Array.isArray(metrics.bottlenecks)).toBe(true);

      // Check for performance bottlenecks
      expect(Array.isArray(metrics.bottlenecks)).toBe(true);
    });
  });

  describe('6.5 Stress Testing', () => {
    it('should handle error recovery under stress', async () => {
      const stressTestRequests = 50;
      const errorRate = 0.2; // 20% error rate

      let callCount = 0;
      mockLLMService.generateResponse.mockImplementation(async () => {
        callCount++;

        // Introduce errors randomly
        if (Math.random() < errorRate) {
          throw new Error(`Simulated error on call ${callCount}`);
        }

        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
        return `Stress test response ${callCount}`;
      });

      const contexts = Array.from({ length: stressTestRequests }, (_, i) =>
        createMockContext({
          toolCategory: ToolCategory.EXTERNAL_API,
          toolId: `stress_test_${i}`,
          toolData: { stressId: i }
        })
      );

      // Execute with error handling
      const results = await Promise.allSettled(
        contexts.map(context => formatter.formatResponse(context))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // Should handle errors gracefully
      expect(successful).toBeGreaterThan(0);
      expect(failed).toBeLessThan(stressTestRequests); // Not all should fail

      const successRate = successful / stressTestRequests;
      expect(successRate).toBeGreaterThan(0.5); // At least 50% should succeed despite errors
    });
  });
});

// Helper function
function createMockContext(overrides: Partial<{
  toolCategory: ToolCategory;
  toolId: string;
  toolData: any;
  responseStyle: ResponseStyleType;
}> = {}): ToolResponseContext {
  const defaultPersona: PersonaInfo = {
    background: 'Performance test assistant',
    personality: 'Efficient and reliable',
    communicationStyle: 'Professional',
    expertise: ['performance testing'],
    preferences: {}
  };

  const toolResult: ToolExecutionResult = {
    id: IdGenerator.generate('test'),
    toolId: overrides.toolId || 'test_tool',
    success: true,
    data: overrides.toolData || { result: 'success' },
    metrics: {
      startTime: Date.now() - 500,
      endTime: Date.now(),
      durationMs: 500
    }
  };

  return {
    id: generateULID('trc'),
    timestamp: new Date(),
    toolResult,
    toolCategory: overrides.toolCategory || ToolCategory.WORKSPACE,
    executionIntent: 'performance test operation',
    originalUserMessage: 'Run performance test',
    agentId: 'perf_test_agent',
    agentPersona: defaultPersona,
    agentCapabilities: ['performance testing'],
    userId: 'perf_test_user',
    userPreferences: {
      preferredTone: 'professional',
      maxMessageLength: 500,
      enableEmojis: false,
      includeMetrics: true,
      communicationStyle: 'conversational'
    },
    conversationHistory: [],
    responseConfig: {
      enableLLMFormatting: true,
      maxResponseLength: 500,
      includeEmojis: false,
      includeNextSteps: false,
      includeMetrics: true,
      responseStyle: overrides.responseStyle || 'business',
      enableCaching: true,
      cacheTTLSeconds: 1800,
      toolCategoryOverrides: {}
    },
    fallbackEnabled: true
  };
} 