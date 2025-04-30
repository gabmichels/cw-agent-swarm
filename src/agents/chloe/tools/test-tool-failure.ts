#!/usr/bin/env node
/**
 * Test script for tool failure handling and adaptation
 * 
 * This script simulates different tool failure scenarios and demonstrates
 * how Chloe handles them with retries, fallbacks, and user interaction
 */

import { ChloeMemory } from '../memory';
import { ToolManager, ToolResult } from './toolManager';
import { BaseTool } from '../../../lib/shared/types/agentTypes';
import { z } from 'zod';

/**
 * A simple test tool that always succeeds
 */
class WorkingTool implements BaseTool {
  name = 'workingTool';
  description = 'A tool that always works';
  schema = z.object({
    test: z.string().optional().describe('Test parameter')
  });
  
  async execute(params: Record<string, any>): Promise<any> {
    return {
      success: true,
      response: `Successfully executed with params: ${JSON.stringify(params)}`,
      data: { result: 'success', timestamp: new Date() }
    };
  }
}

/**
 * A broken tool that always fails
 */
class BrokenTool implements BaseTool {
  name = 'brokenTool';
  description = 'A tool that always fails';
  schema = z.object({
    test: z.string().optional().describe('Test parameter')
  });
  
  async execute(params: Record<string, any>): Promise<any> {
    throw new Error('This tool is intentionally broken for testing');
  }
}

/**
 * A tool that fails based on a condition but can be retried
 */
class RetryableTool implements BaseTool {
  name = 'retryableTool';
  description = 'A tool that fails on first try but succeeds on retry';
  schema = z.object({
    test: z.string().optional().describe('Test parameter')
  });
  private attemptCount = 0;
  
  async execute(params: Record<string, any>): Promise<any> {
    this.attemptCount++;
    
    if (this.attemptCount === 1) {
      return {
        success: false,
        error: 'First attempt failed, please retry'
      };
    }
    
    return {
      success: true,
      response: `Successfully executed on attempt #${this.attemptCount} with params: ${JSON.stringify(params)}`,
      data: { result: 'success after retry', attempts: this.attemptCount }
    };
  }
  
  reset(): void {
    this.attemptCount = 0;
  }
}

/**
 * Test the tool manager and failure handling
 */
async function testToolFailureHandling() {
  console.log('🧪 Testing Tool Failure Handling & Adaptation\n');
  
  // Create memory and tool manager
  const memory = new ChloeMemory();
  const toolManager = new ToolManager(memory);
  
  // Register test tools
  const workingTool = new WorkingTool();
  const brokenTool = new BrokenTool();
  const retryableTool = new RetryableTool();
  
  toolManager.registerTool(workingTool);
  toolManager.registerTool(brokenTool);
  toolManager.registerTool(retryableTool);
  
  console.log('📋 Registered test tools for simulation\n');
  
  // Test 1: Working tool
  console.log('🔍 Test 1: Working Tool');
  const workingResult = await toolManager.executeTool('workingTool', { test: 'parameter' });
  console.log(`Result: ${workingResult.success ? '✅ Success' : '❌ Failed'}`);
  console.log(`Output: ${JSON.stringify(workingResult.output)}\n`);
  
  // Test 2: Broken tool
  console.log('🔍 Test 2: Broken Tool');
  const brokenResult = await toolManager.executeTool('brokenTool', { test: 'parameter' });
  console.log(`Result: ${brokenResult.success ? '✅ Success' : '❌ Failed'}`);
  console.log(`Error: ${brokenResult.error}`);
  console.log(`Retry count: ${brokenResult.retryCount}`);
  console.log(`Execution time: ${brokenResult.executionTime}ms\n`);
  
  // Test 3: Broken tool with fallback
  console.log('🔍 Test 3: Broken Tool with Fallback');
  const fallbackResult = await toolManager.executeTool('brokenTool', 
    { test: 'parameter' },
    { fallbackTools: ['workingTool'] }
  );
  console.log(`Primary tool result: ${fallbackResult.success ? '✅ Success' : '❌ Failed'}`);
  console.log(`Fallback used: ${fallbackResult.fallbackUsed ? '✅ Yes' : '❌ No'}`);
  if (fallbackResult.fallbackUsed) {
    console.log(`Fallback tool: ${fallbackResult.fallbackToolName}`);
  }
  console.log(`Output: ${JSON.stringify(fallbackResult.output)}\n`);
  
  // Test 4: Retryable tool
  console.log('🔍 Test 4: Retryable Tool');
  (retryableTool as RetryableTool).reset();
  const retryResult = await toolManager.executeTool('retryableTool', 
    { test: 'parameter' },
    { allowRetry: true, maxRetries: 1 }
  );
  console.log(`Result: ${retryResult.success ? '✅ Success' : '❌ Failed'}`);
  console.log(`Retry count: ${retryResult.retryCount}`);
  console.log(`Output: ${JSON.stringify(retryResult.output)}\n`);
  
  // Test 5: Retryable tool with insufficient retries
  console.log('🔍 Test 5: Retryable Tool with Insufficient Retries');
  (retryableTool as RetryableTool).reset();
  const insufficientRetryResult = await toolManager.executeTool('retryableTool', 
    { test: 'parameter' },
    { allowRetry: false }
  );
  console.log(`Result: ${insufficientRetryResult.success ? '✅ Success' : '❌ Failed'}`);
  console.log(`Retry count: ${insufficientRetryResult.retryCount}`);
  console.log(`Error: ${insufficientRetryResult.error}`);
  console.log(`Fallback used: ${insufficientRetryResult.fallbackUsed ? '✅ Yes' : '❌ No'}\n`);
  
  // Check memory for logged failures
  console.log('🧠 Checking Memory for Logged Tool Failures');
  const failures = await memory.getRelevantMemories('tool_failure', 10);
  console.log(`Found ${failures.length} tool failure records in memory:`);
  failures.forEach((failure, index) => {
    console.log(`\n--- Failure ${index + 1} ---`);
    console.log(failure.content);
  });
  
  console.log('\n🎉 Testing completed!');
}

// Run the test
testToolFailureHandling().catch(error => {
  console.error('❌ Error during testing:', error);
  process.exit(1);
}); 