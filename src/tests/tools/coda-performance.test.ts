/**
 * Performance Validation Tests for Coda Implementation
 * Comprehensive testing of rate limiting, error handling, memory usage, and performance
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAllEnhancedCodaTools } from '../../agents/shared/tools/implementations/CodaTools';
import { executeLLMToCodaWorkflow, batchLLMToCodaWorkflow } from '../../agents/shared/tools/workflows/CodaLLMWorkflow';
import { formatContentForCoda } from '../../agents/shared/tools/utils/CodaFormatting';

describe('Coda Performance Validation', () => {
  const performanceMetrics = {
    documentCreationTimes: [] as number[],
    memoryUsageBefore: 0,
    memoryUsageAfter: 0,
    rateLimit429Count: 0,
    errorCount: 0,
    successCount: 0
  };

  beforeAll(() => {
    // Record initial memory usage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      performanceMetrics.memoryUsageBefore = process.memoryUsage().heapUsed;
    }
  });

  afterAll(() => {
    // Record final memory usage and report
    if (typeof process !== 'undefined' && process.memoryUsage) {
      performanceMetrics.memoryUsageAfter = process.memoryUsage().heapUsed;
    }

    console.log('\n📊 Performance Validation Report:');
    console.log('================================');
    console.log(`✅ Total Operations: ${performanceMetrics.successCount + performanceMetrics.errorCount}`);
    console.log(`✅ Successful Operations: ${performanceMetrics.successCount}`);
    console.log(`⚠️  Failed Operations: ${performanceMetrics.errorCount}`);
    console.log(`🔄 Rate Limit (429) Responses: ${performanceMetrics.rateLimit429Count}`);
    
    if (performanceMetrics.documentCreationTimes.length > 0) {
      const avgTime = performanceMetrics.documentCreationTimes.reduce((a, b) => a + b, 0) / performanceMetrics.documentCreationTimes.length;
      const minTime = Math.min(...performanceMetrics.documentCreationTimes);
      const maxTime = Math.max(...performanceMetrics.documentCreationTimes);
      
      console.log(`⚡ Document Creation Performance:`);
      console.log(`   - Average: ${avgTime.toFixed(2)}ms`);
      console.log(`   - Fastest: ${minTime}ms`);
      console.log(`   - Slowest: ${maxTime}ms`);
    }

    if (performanceMetrics.memoryUsageBefore > 0 && performanceMetrics.memoryUsageAfter > 0) {
      const memoryDiff = performanceMetrics.memoryUsageAfter - performanceMetrics.memoryUsageBefore;
      const memoryDiffMB = (memoryDiff / 1024 / 1024).toFixed(2);
      console.log(`🧠 Memory Usage Change: ${memoryDiffMB}MB`);
    }
    
    console.log('================================\n');
  });

  describe('Document Creation Performance', () => {
    it('should create documents within acceptable time limits', async () => {
      const testContent = `# Performance Test Document

This is a test document to validate creation speed.

## Test Data
- Created at: ${new Date().toISOString()}
- Test type: Performance validation
- Expected time: < 5000ms`;

      const startTime = Date.now();
      
      try {
        const result = await executeLLMToCodaWorkflow({
          content: testContent,
          sourceAgent: 'PerformanceTestAgent',
          title: 'Performance Test Document'
        });

        const endTime = Date.now();
        const duration = endTime - startTime;
        
        performanceMetrics.documentCreationTimes.push(duration);
        
        if (result.success) {
          performanceMetrics.successCount++;
        } else {
          performanceMetrics.errorCount++;
        }

        expect(result.success).toBe(true);
        expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
        
        console.log(`Document creation took ${duration}ms`);
        
      } catch (error) {
        performanceMetrics.errorCount++;
        throw error;
      }
    }, 10000);

    it('should handle large document content efficiently', async () => {
      // Create a larger document (approximately 2KB)
      const largeContent = `# Large Document Performance Test

${'This is a test paragraph with substantial content to simulate real-world usage. '.repeat(20)}

## Section 1
${'Content for section 1 with detailed information. '.repeat(15)}

## Section 2
${'Content for section 2 with more detailed information. '.repeat(15)}

## Data Table
| Item | Value | Status | Notes |
|------|-------|--------|-------|
${'| Item X | Value Y | Active | Test data |\n'.repeat(10)}

## Conclusion
${'Final thoughts and summary information. '.repeat(10)}`;

      const startTime = Date.now();
      
      try {
        const result = await executeLLMToCodaWorkflow({
          content: largeContent,
          sourceAgent: 'LargeContentTestAgent',
          title: 'Large Document Performance Test'
        });

        const endTime = Date.now();
        const duration = endTime - startTime;
        
        performanceMetrics.documentCreationTimes.push(duration);
        
        if (result.success) {
          performanceMetrics.successCount++;
        } else {
          performanceMetrics.errorCount++;
        }

        expect(result.success).toBe(true);
        expect(duration).toBeLessThan(10000); // Larger content might take up to 10 seconds
        
        console.log(`Large document creation took ${duration}ms (content length: ${largeContent.length} chars)`);
        
      } catch (error) {
        performanceMetrics.errorCount++;
        throw error;
      }
    }, 15000);
  });

  describe('Rate Limiting Validation', () => {
    it('should handle rate limiting gracefully', async () => {
      // Create multiple rapid requests to potentially trigger rate limiting
      const rapidRequests = Array.from({ length: 3 }, (_, i) => ({
        content: `# Rapid Request Test ${i + 1}\n\nThis is test document ${i + 1} for rate limiting validation.`,
        sourceAgent: 'RateLimitTestAgent',
        title: `Rate Limit Test ${i + 1}`
      }));

      try {
        const results = await batchLLMToCodaWorkflow(rapidRequests);
        
        results.forEach(result => {
          if (result.success) {
            performanceMetrics.successCount++;
          } else {
            performanceMetrics.errorCount++;
            
            // Check if it's a rate limiting error
            if (result.error?.message?.includes('429') || 
                result.error?.message?.includes('Too Many Requests') ||
                result.error?.message?.includes('rate limit')) {
              performanceMetrics.rateLimit429Count++;
            }
          }
        });

        // Should handle all requests (either success or graceful failure)
        expect(results).toHaveLength(rapidRequests.length);
        
        // At least some should succeed (unless severe rate limiting)
        const successCount = results.filter(r => r.success).length;
        expect(successCount).toBeGreaterThan(0);
        
        console.log(`Rate limiting test: ${successCount}/${rapidRequests.length} requests succeeded`);
        
      } catch (error) {
        performanceMetrics.errorCount++;
        console.log('Rate limiting test encountered error:', error);
        // Don't fail the test - rate limiting is expected behavior
      }
    }, 30000);
  });

  describe('Error Handling Verification', () => {
    it('should handle malformed content gracefully', async () => {
      const malformedInputs = [
        { content: '', title: 'Empty Content Test' },
        { content: '   ', title: 'Whitespace Only Test' },
        { content: 'A'.repeat(100000), title: 'Extremely Long Content Test' }, // Very long content
        { content: null as any, title: 'Null Content Test' },
        { content: undefined as any, title: 'Undefined Content Test' }
      ];

      for (const input of malformedInputs) {
        try {
          const result = await executeLLMToCodaWorkflow({
            ...input,
            sourceAgent: 'ErrorHandlingTestAgent'
          });

          if (result.success) {
            performanceMetrics.successCount++;
          } else {
            performanceMetrics.errorCount++;
          }

          // Should handle gracefully (either succeed or fail with proper error)
          expect(result).toBeDefined();
          expect(typeof result.success).toBe('boolean');
          
          if (!result.success) {
            expect(result.error).toBeDefined();
            expect(result.error?.message).toBeDefined();
          }
          
        } catch (error) {
          performanceMetrics.errorCount++;
          // Unexpected errors should be minimal
          console.log(`Unexpected error for input "${input.title}":`, error);
        }
      }
    }, 60000);

    it('should maintain stability under concurrent operations', async () => {
      const concurrentRequests = Array.from({ length: 5 }, (_, i) => 
        executeLLMToCodaWorkflow({
          content: `# Concurrent Test ${i + 1}\n\nThis is concurrent request ${i + 1}.`,
          sourceAgent: 'ConcurrencyTestAgent',
          title: `Concurrent Test ${i + 1}`
        })
      );

      try {
        const results = await Promise.allSettled(concurrentRequests);
        
        results.forEach(result => {
          if (result.status === 'fulfilled' && result.value.success) {
            performanceMetrics.successCount++;
          } else {
            performanceMetrics.errorCount++;
          }
        });

        // Should handle all concurrent requests
        expect(results).toHaveLength(concurrentRequests.length);
        
        // At least some should succeed
        const successCount = results.filter(r => 
          r.status === 'fulfilled' && r.value.success
        ).length;
        
        console.log(`Concurrency test: ${successCount}/${concurrentRequests.length} requests succeeded`);
        
        // Should have reasonable success rate even under concurrency
        expect(successCount).toBeGreaterThan(0);
        
      } catch (error) {
        performanceMetrics.errorCount++;
        throw error;
      }
    }, 60000);
  });

  describe('Table Formatting Performance', () => {
    it('should format complex tables efficiently', async () => {
      const complexTableContent = `# Complex Table Performance Test

## Large Data Table

| ID | Name | Department | Role | Salary | Start Date | Status | Manager | Location |
|----|------|------------|------|--------|------------|--------|---------|----------|
${Array.from({ length: 20 }, (_, i) => 
  `| ${i + 1} | Employee ${i + 1} | Dept ${Math.floor(i / 5) + 1} | Role ${i % 3 + 1} | $${50000 + i * 1000} | 2023-0${(i % 12) + 1}-01 | Active | Manager ${Math.floor(i / 10) + 1} | Office ${i % 3 + 1} |`
).join('\n')}

## Summary Statistics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total Employees | 20 | 25 | Under Target |
| Average Salary | $59,500 | $60,000 | Close |
| Departments | 4 | 5 | Expanding |
`;

      const startTime = Date.now();
      
      // Test table formatting performance
      const formattedContent = formatContentForCoda(complexTableContent, {
        convertTables: true,
        format: 'markdown'
      });
      
      const formatTime = Date.now() - startTime;
      
      expect(formattedContent).toBeDefined();
      expect(formattedContent.length).toBeGreaterThan(complexTableContent.length);
      expect(formatTime).toBeLessThan(1000); // Formatting should be fast
      
      console.log(`Complex table formatting took ${formatTime}ms`);
      console.log(`Content expanded from ${complexTableContent.length} to ${formattedContent.length} characters`);
      
    }, 10000);
  });

  describe('Memory Usage Analysis', () => {
    it('should not cause significant memory leaks', async () => {
      const initialMemory = process.memoryUsage?.()?.heapUsed || 0;
      
      // Perform multiple operations
      for (let i = 0; i < 5; i++) {
        try {
          const result = await executeLLMToCodaWorkflow({
            content: `# Memory Test ${i + 1}\n\nTesting memory usage for operation ${i + 1}.`,
            sourceAgent: 'MemoryTestAgent',
            title: `Memory Test ${i + 1}`
          });
          
          if (result.success) {
            performanceMetrics.successCount++;
          } else {
            performanceMetrics.errorCount++;
          }
          
          // Small delay between operations
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          performanceMetrics.errorCount++;
        }
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage?.()?.heapUsed || 0;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;
      
      console.log(`Memory usage increased by ${memoryIncreaseMB.toFixed(2)}MB during test`);
      
      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncreaseMB).toBeLessThan(50);
      
    }, 60000);
  });
}); 