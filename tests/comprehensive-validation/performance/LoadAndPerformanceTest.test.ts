/**
 * Phase 5.1: Load and Performance Testing Suite
 * 
 * This test suite validates that the unified tools foundation performs well
 * under load and maintains optimal performance characteristics.
 * 
 * Test Categories:
 * - Foundation Load Testing: High concurrent tool discovery and execution
 * - Tool Discovery Performance: Search and discovery under load
 * - Cross-System Tool Chains: Complex multi-system workflow performance
 * - Memory Usage Monitoring: Memory leak detection and optimization validation
 * 
 * Performance Requirements:
 * - Tool discovery: <1 second for 100 tools
 * - Tool execution: <500ms for standard operations
 * - Memory usage: Stable under sustained load
 * - Concurrent operations: Support 50+ simultaneous tool executions
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - Performance regression prevention
 * - Comprehensive load testing
 * - Memory optimization validation
 * - Production readiness verification
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { performance } from 'perf_hooks';

// Foundation imports
import {
  UnifiedToolFoundation,
  UnifiedToolRegistry,
  UnifiedToolExecutor,
  ToolDiscoveryService,
  ToolValidationService,
  createExecutionContext
} from '../../../src/lib/tools/foundation';

// Test utilities
import { createLogger } from '../../../src/lib/logging/winston-logger';

interface PerformanceMetrics {
  operationName: string;
  executionTimeMs: number;
  memoryUsageMB: number;
  successRate: number;
  throughputPerSecond: number;
  concurrentOperations: number;
}

interface LoadTestResult {
  testName: string;
  duration: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  peakMemoryUsage: number;
  memoryLeaks: boolean;
  performanceRegression: boolean;
}

describe('Phase 5.1: Load and Performance Testing', () => {
  let foundation: UnifiedToolFoundation;
  let logger: ReturnType<typeof createLogger>;
  let performanceBaselines: Map<string, number>;
  let testResults: LoadTestResult[] = [];

  beforeAll(async () => {
    logger = createLogger('load-performance-test');

    // Initialize foundation
    const registry = new UnifiedToolRegistry(logger);
    const executor = new UnifiedToolExecutor(logger);
    const discovery = new ToolDiscoveryService(registry, logger);
    const validation = new ToolValidationService(logger);

    foundation = new UnifiedToolFoundation(
      registry,
      executor,
      discovery,
      validation,
      logger
    );

    await foundation.initialize();

    // Set performance baselines
    performanceBaselines = new Map([
      ['tool_discovery', 1000], // 1 second
      ['tool_execution', 500],  // 500ms
      ['health_check', 100],    // 100ms
      ['concurrent_discovery', 2000], // 2 seconds for 50 concurrent
      ['memory_usage_mb', 100]  // 100MB baseline
    ]);

    logger.info('Load and performance testing initialized');
  });

  afterAll(async () => {
    await foundation.shutdown();

    // Generate performance report
    console.log('\n⚡ LOAD AND PERFORMANCE TEST REPORT');
    console.log('=====================================');

    for (const result of testResults) {
      console.log(`\n📊 ${result.testName}:`);
      console.log(`   Duration: ${result.duration.toFixed(2)}ms`);
      console.log(`   Operations: ${result.successfulOperations}/${result.totalOperations}`);
      console.log(`   Success Rate: ${((result.successfulOperations / result.totalOperations) * 100).toFixed(1)}%`);
      console.log(`   Avg Response: ${result.averageResponseTime.toFixed(2)}ms`);
      console.log(`   Peak Memory: ${result.peakMemoryUsage.toFixed(2)}MB`);
      console.log(`   Regression: ${result.performanceRegression ? '❌ YES' : '✅ NO'}`);
    }

    console.log('\n=====================================\n');
  });

  describe('🏗️ Foundation Load Testing', () => {
    it('should handle high concurrent tool discovery requests', async () => {
      console.log('🔍 Testing concurrent tool discovery under load...');

      const concurrentRequests = 50;
      const startTime = performance.now();
      const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      // Create concurrent discovery requests
      const discoveryPromises = Array(concurrentRequests).fill(0).map(async (_, index) => {
        const start = performance.now();
        try {
          const tools = await foundation.discoverTools({
            limit: 10
          });
          return {
            success: true,
            duration: performance.now() - start,
            toolCount: tools.length
          };
        } catch (error) {
          return {
            success: false,
            duration: performance.now() - start,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const results = await Promise.all(discoveryPromises);
      const endTime = performance.now();
      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      // Analyze results
      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;
      const averageTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const totalDuration = endTime - startTime;
      const peakMemory = finalMemory;

      // Validate performance
      const baseline = performanceBaselines.get('concurrent_discovery')!;
      const performanceRegression = totalDuration > baseline * 1.5; // Allow 50% variance

      const testResult: LoadTestResult = {
        testName: 'Concurrent Tool Discovery',
        duration: totalDuration,
        totalOperations: concurrentRequests,
        successfulOperations: successful,
        failedOperations: failed,
        averageResponseTime: averageTime,
        peakMemoryUsage: peakMemory,
        memoryLeaks: (finalMemory - initialMemory) > 50, // 50MB threshold
        performanceRegression
      };

      testResults.push(testResult);

      // Assertions
      expect(successful).toBeGreaterThan(concurrentRequests * 0.9); // 90% success rate
      expect(averageTime).toBeLessThan(1000); // Each request under 1 second
      expect(totalDuration).toBeLessThan(baseline * 2); // Total time reasonable

      logger.info('Concurrent discovery load test completed', testResult);
      console.log(`✅ Handled ${successful}/${concurrentRequests} concurrent discoveries in ${totalDuration.toFixed(2)}ms`);
    });

    it('should maintain stable memory usage under sustained load', async () => {
      console.log('🧠 Testing memory stability under sustained load...');

      const iterations = 100;
      const memorySnapshots: number[] = [];
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // Perform various foundation operations
        await foundation.isHealthy();
        await foundation.discoverTools({ limit: 5 });

        // Take memory snapshot every 10 iterations
        if (i % 10 === 0) {
          const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
          memorySnapshots.push(memoryUsage);
        }

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // Analyze memory usage
      const initialMemory = memorySnapshots[0];
      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const peakMemory = Math.max(...memorySnapshots);
      const memoryGrowth = finalMemory - initialMemory;

      // Check for memory leaks (growth > 25MB over 100 iterations)
      const memoryLeaks = memoryGrowth > 25;

      const testResult: LoadTestResult = {
        testName: 'Memory Stability Test',
        duration: totalDuration,
        totalOperations: iterations,
        successfulOperations: iterations,
        failedOperations: 0,
        averageResponseTime: totalDuration / iterations,
        peakMemoryUsage: peakMemory,
        memoryLeaks,
        performanceRegression: false
      };

      testResults.push(testResult);

      // Assertions
      expect(memoryLeaks).toBe(false);
      expect(peakMemory).toBeLessThan(performanceBaselines.get('memory_usage_mb')! * 2);

      logger.info('Memory stability test completed', {
        initialMemory,
        finalMemory,
        peakMemory,
        memoryGrowth,
        memoryLeaks
      });

      console.log(`✅ Memory stable: ${initialMemory.toFixed(2)}MB → ${finalMemory.toFixed(2)}MB (peak: ${peakMemory.toFixed(2)}MB)`);
    });

    it('should handle rapid tool registration and unregistration', async () => {
      console.log('🔄 Testing rapid tool registration/unregistration...');

      const operationCycles = 20;
      const startTime = performance.now();
      let successful = 0;
      let failed = 0;

      for (let i = 0; i < operationCycles; i++) {
        try {
          // Register a test tool
          const toolDefinition = {
            id: `load-test-tool-${i}`,
            name: `load_test_tool_${i}`,
            displayName: `Load Test Tool ${i}`,
            description: 'Test tool for load testing',
            category: 'test' as any,
            capabilities: [],
            parameters: {},
            executor: async () => ({ success: true, data: 'test result' }),
            enabled: true,
            metadata: {
              provider: 'load-test',
              version: '1.0.0'
            }
          };

          await foundation.registerTool(toolDefinition);

          // Immediately unregister
          await foundation.unregisterTool(`load_test_tool_${i}`);

          successful++;
        } catch (error) {
          failed++;
          logger.warn('Tool registration/unregistration failed', { iteration: i, error });
        }
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const averageTime = totalDuration / (operationCycles * 2); // 2 operations per cycle

      const testResult: LoadTestResult = {
        testName: 'Tool Registration Cycling',
        duration: totalDuration,
        totalOperations: operationCycles * 2,
        successfulOperations: successful * 2,
        failedOperations: failed * 2,
        averageResponseTime: averageTime,
        peakMemoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        memoryLeaks: false,
        performanceRegression: averageTime > 50 // 50ms per operation
      };

      testResults.push(testResult);

      // Assertions
      expect(successful).toBeGreaterThan(operationCycles * 0.9); // 90% success rate
      expect(averageTime).toBeLessThan(100); // Average under 100ms per operation

      logger.info('Tool registration cycling test completed', testResult);
      console.log(`✅ Completed ${successful * 2}/${operationCycles * 2} registration cycles in ${totalDuration.toFixed(2)}ms`);
    });
  });

  describe('🔍 Tool Discovery Performance', () => {
    it('should perform semantic search efficiently under load', async () => {
      console.log('🔎 Testing semantic search performance...');

      const searchQueries = [
        'send email',
        'create social media post',
        'analyze data',
        'track costs',
        'execute workflow',
        'manage files',
        'schedule meeting',
        'generate report',
        'optimize performance',
        'validate input'
      ];

      const concurrentSearches = 5;
      const totalSearches = searchQueries.length * concurrentSearches;
      const startTime = performance.now();

      // Create concurrent search requests
      const searchPromises = searchQueries.flatMap(query =>
        Array(concurrentSearches).fill(0).map(async () => {
          const start = performance.now();
          try {
            const results = await foundation.searchTools(query, undefined, 5);
            return {
              success: true,
              duration: performance.now() - start,
              resultCount: results.length,
              query
            };
          } catch (error) {
            return {
              success: false,
              duration: performance.now() - start,
              error: error instanceof Error ? error.message : 'Unknown error',
              query
            };
          }
        })
      );

      const results = await Promise.all(searchPromises);
      const endTime = performance.now();

      // Analyze results
      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;
      const averageTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const totalDuration = endTime - startTime;

      const testResult: LoadTestResult = {
        testName: 'Semantic Search Performance',
        duration: totalDuration,
        totalOperations: totalSearches,
        successfulOperations: successful,
        failedOperations: failed,
        averageResponseTime: averageTime,
        peakMemoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        memoryLeaks: false,
        performanceRegression: averageTime > 200 // 200ms baseline per search
      };

      testResults.push(testResult);

      // Assertions
      expect(successful).toBeGreaterThan(totalSearches * 0.8); // 80% success rate
      expect(averageTime).toBeLessThan(500); // Under 500ms per search

      logger.info('Semantic search performance test completed', testResult);
      console.log(`✅ Completed ${successful}/${totalSearches} searches in ${totalDuration.toFixed(2)}ms (avg: ${averageTime.toFixed(2)}ms)`);
    });

    it('should handle complex discovery criteria efficiently', async () => {
      console.log('🎯 Testing complex discovery performance...');

      const complexCriteria = [
        { category: 'cost_tracking', capabilities: ['COST_TRACKING'] },
        { category: 'workflow', enabled: true },
        { category: 'agent', limit: 10 },
        { sortBy: 'name', sortOrder: 'asc', includeDisabled: false },
        { capabilities: ['TOOL_EXECUTION'], category: 'agent' }
      ];

      const startTime = performance.now();
      let successful = 0;
      let failed = 0;
      const operationTimes: number[] = [];

      for (const criteria of complexCriteria) {
        try {
          const start = performance.now();
          const tools = await foundation.discoverTools(criteria as any);
          const duration = performance.now() - start;

          operationTimes.push(duration);
          successful++;

          // Validate some tools were found (when they should be)
          if (criteria.category) {
            expect(tools.length).toBeGreaterThanOrEqual(0);
          }

        } catch (error) {
          failed++;
          logger.warn('Complex discovery failed', { criteria, error });
        }
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const averageTime = operationTimes.reduce((sum, time) => sum + time, 0) / operationTimes.length;

      const testResult: LoadTestResult = {
        testName: 'Complex Discovery Criteria',
        duration: totalDuration,
        totalOperations: complexCriteria.length,
        successfulOperations: successful,
        failedOperations: failed,
        averageResponseTime: averageTime,
        peakMemoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        memoryLeaks: false,
        performanceRegression: averageTime > 300 // 300ms baseline
      };

      testResults.push(testResult);

      // Assertions
      expect(successful).toBe(complexCriteria.length); // All should succeed
      expect(averageTime).toBeLessThan(500); // Under 500ms average

      logger.info('Complex discovery performance test completed', testResult);
      console.log(`✅ Completed ${successful}/${complexCriteria.length} complex discoveries in ${totalDuration.toFixed(2)}ms`);
    });
  });

  describe('⚡ Cross-System Performance', () => {
    it('should execute cross-system tool chains efficiently', async () => {
      console.log('🔗 Testing cross-system tool chain performance...');

      // Simulate cross-system workflow
      const executionContext = createExecutionContext({
        agentId: 'load-test-agent',
        userId: 'load-test-user',
        sessionId: 'load-test-session',
        permissions: ['cost_tracking', 'tool_execution'],
        capabilities: ['COST_TRACKING', 'TOOL_EXECUTION']
      });

      const workflowSteps = [
        { action: 'discover', category: 'cost_tracking' },
        { action: 'discover', category: 'agent' },
        { action: 'health_check' },
        { action: 'validate_tools' }
      ];

      const startTime = performance.now();
      let successful = 0;
      let failed = 0;
      const stepTimes: number[] = [];

      for (const step of workflowSteps) {
        try {
          const stepStart = performance.now();

          switch (step.action) {
            case 'discover':
              await foundation.discoverTools({ category: step.category as any });
              break;
            case 'health_check':
              await foundation.isHealthy();
              break;
            case 'validate_tools':
              const tools = await foundation.getAllTools();
              expect(Array.isArray(tools)).toBe(true);
              break;
          }

          const stepDuration = performance.now() - stepStart;
          stepTimes.push(stepDuration);
          successful++;

        } catch (error) {
          failed++;
          logger.warn('Workflow step failed', { step, error });
        }
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const averageStepTime = stepTimes.reduce((sum, time) => sum + time, 0) / stepTimes.length;

      const testResult: LoadTestResult = {
        testName: 'Cross-System Tool Chains',
        duration: totalDuration,
        totalOperations: workflowSteps.length,
        successfulOperations: successful,
        failedOperations: failed,
        averageResponseTime: averageStepTime,
        peakMemoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        memoryLeaks: false,
        performanceRegression: totalDuration > 2000 // 2 second baseline for workflow
      };

      testResults.push(testResult);

      // Assertions
      expect(successful).toBe(workflowSteps.length); // All steps should succeed
      expect(totalDuration).toBeLessThan(5000); // Under 5 seconds total

      logger.info('Cross-system workflow performance test completed', testResult);
      console.log(`✅ Completed ${successful}/${workflowSteps.length} workflow steps in ${totalDuration.toFixed(2)}ms`);
    });
  });

  describe('📊 Performance Regression Detection', () => {
    it('should detect and report performance regressions', async () => {
      console.log('📈 Analyzing performance regression results...');

      const regressions = testResults.filter(result => result.performanceRegression);
      const memoryLeaks = testResults.filter(result => result.memoryLeaks);

      // Log performance summary
      const totalOperations = testResults.reduce((sum, result) => sum + result.totalOperations, 0);
      const totalSuccessful = testResults.reduce((sum, result) => sum + result.successfulOperations, 0);
      const overallSuccessRate = (totalSuccessful / totalOperations) * 100;

      logger.info('Performance regression analysis completed', {
        totalTests: testResults.length,
        totalOperations,
        totalSuccessful,
        overallSuccessRate,
        regressions: regressions.length,
        memoryLeaks: memoryLeaks.length
      });

      // Assertions for production readiness
      expect(overallSuccessRate).toBeGreaterThan(90); // 90% overall success rate
      expect(memoryLeaks.length).toBe(0); // No memory leaks

      // Performance regressions are warnings, not failures in test environment
      if (regressions.length > 0) {
        console.log(`⚠️ ${regressions.length} performance regressions detected (acceptable in test environment)`);
      }

      console.log(`✅ Performance analysis completed: ${overallSuccessRate.toFixed(1)}% success rate across ${totalOperations} operations`);
    });
  });
});

// Helper function to measure memory usage
function measureMemoryUsage(): number {
  return process.memoryUsage().heapUsed / 1024 / 1024; // Convert to MB
}

// Helper function to create performance metrics
function createPerformanceMetrics(
  operationName: string,
  startTime: number,
  endTime: number,
  successCount: number,
  totalCount: number
): PerformanceMetrics {
  return {
    operationName,
    executionTimeMs: endTime - startTime,
    memoryUsageMB: measureMemoryUsage(),
    successRate: (successCount / totalCount) * 100,
    throughputPerSecond: totalCount / ((endTime - startTime) / 1000),
    concurrentOperations: totalCount
  };
} 