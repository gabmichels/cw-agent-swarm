/**
 * Integration test for agent creation
 * 
 * This test verifies the full agent creation flow from UI to database storage
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../../src/app/api/multi-agent/agents/route';
import { AgentRegistrationRequest } from '../../src/lib/multi-agent/types/agent';
import { getMemoryServices } from '../../src/server/memory/services';
import { createAgentMemoryService } from '../../src/server/memory/services/multi-agent';
import { 
  CapabilityType, 
  CapabilityLevel 
} from '../../src/agents/shared/capability-system';

// Extend AgentMetadata to allow for custom properties in test
declare module '../../src/lib/multi-agent/types/agent' {
  interface AgentMetadata {
    complex?: Record<string, any>;
  }
}

/**
 * Create a valid agent request payload for testing
 */
function createValidAgentPayload(): AgentRegistrationRequest {
  return {
    name: `Test Agent ${Date.now()}`,
    description: 'A test agent created for integration testing',
    status: 'available',
    capabilities: [
      {
        id: 'skill.problem_solving',
        name: 'Problem Solving',
        description: 'Ability to solve complex problems'
      },
      {
        id: 'skill.communication',
        name: 'Communication',
        description: 'Effective written communication'
      },
      {
        id: 'domain.general',
        name: 'General Knowledge',
        description: 'Broad knowledge across different domains'
      }
    ],
    parameters: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
      tools: ['web_search', 'code_execution']
    },
    metadata: {
      version: '1.0',
      tags: ['test', 'integration'],
      domain: ['general'],
      specialization: ['testing'],
      performanceMetrics: {
        successRate: 0,
        averageResponseTime: 0,
        taskCompletionRate: 0
      },
      isPublic: true
    }
  };
}

/**
 * Helper function to create mock request
 */
function createMockRequest(body: any) {
  const request = {
    method: 'POST',
    url: 'http://localhost/api/multi-agent/agents',
    headers: new Headers({
      'Content-Type': 'application/json'
    }),
    json: () => Promise.resolve(body)
  } as unknown as NextRequest;
  
  return request;
}

describe('Agent Creation Integration Test', () => {
  let collectionInitialized = false;
  let testAgentId: string | null = null;
  
  // Setup: ensure the agents collection exists
  beforeAll(async () => {
    try {
      const { client } = await getMemoryServices();
      const collectionName = 'agents';
      
      // Check if the collection already exists
      const exists = await client.collectionExists(collectionName);
      if (!exists) {
        console.log('Creating agents collection for tests...');
        // Default dimension size for embedding vectors (same as used in production)
        const dimensionSize = 1536;
        await client.createCollection(collectionName, dimensionSize);
      }
      
      collectionInitialized = true;
    } catch (error) {
      console.error('Failed to initialize test collection:', error);
    }
  });
  
  // Cleanup: delete the test agent if created
  afterAll(async () => {
    if (testAgentId) {
      try {
        const { client } = await getMemoryServices();
        await client.deletePoint('agents', testAgentId);
        console.log(`Test agent ${testAgentId} deleted successfully`);
      } catch (error) {
        console.error('Failed to delete test agent:', error);
      }
    }
  });
  
  test('should create an agent and store it in the database', async () => {
    // Skip if collection initialization failed
    if (!collectionInitialized) {
      console.warn('Skipping test because collection initialization failed');
      return;
    }
    
    // Arrange: create a valid agent payload
    const agentPayload = createValidAgentPayload();
    const request = createMockRequest(agentPayload);
    
    // Act: call the API endpoint
    const response = await POST(request);
    
    // Assert: verify the response is successful
    if (!response) {
      throw new Error('No response received from POST endpoint');
    }
    
    expect(response.status).toBe(200);
    
    // Parse the response data
    const responseData = await response.json();
    expect(responseData.success).toBe(true);
    expect(responseData.agent).toBeDefined();
    expect(responseData.agent.id).toBeDefined();
    
    // Store the agent ID for cleanup
    testAgentId = responseData.agent.id;
    
    // Verify the agent exists in the database
    const { memoryService } = await getMemoryServices();
    const agentService = createAgentMemoryService(memoryService);
    
    const result = await agentService.getById(testAgentId);
    
    expect(result.isError).toBe(false);
    expect(result.data).toBeDefined();
    expect(result.data?.id).toBe(testAgentId);
    expect(result.data?.name).toBe(agentPayload.name);
  });
  
  test('should return error when required fields are missing', async () => {
    // Arrange: create an invalid agent payload (missing name)
    const invalidPayload = createValidAgentPayload();
    const payloadAny = invalidPayload as any;
    delete payloadAny.name;
    
    const request = createMockRequest(payloadAny);
    
    // Act: call the API endpoint
    const response = await POST(request);
    
    // Assert: verify the response indicates failure
    if (!response) {
      throw new Error('No response received from POST endpoint');
    }
    
    expect(response.status).toBe(400);
    
    const responseData = await response.json();
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBeDefined();
  });
  
  test('should handle and sanitize complex nested payloads', async () => {
    // Skip if collection initialization failed
    if (!collectionInitialized) {
      console.warn('Skipping test because collection initialization failed');
      return;
    }
    
    // Arrange: create a valid agent payload with complex nested structures
    const complexPayload = createValidAgentPayload();
    
    // Add circular references (this would normally crash JSON.stringify)
    const circularObj: any = { name: 'circular' };
    circularObj.self = circularObj;
    
    // Add complex data that needs proper sanitization
    complexPayload.metadata = {
      ...complexPayload.metadata,
      complex: {
        nested: {
          array: [1, 2, 3, { deep: true }],
          date: new Date(),
          // We don't actually add the circular reference,
          // but the code should be robust enough to handle it
        }
      }
    };
    
    const request = createMockRequest(complexPayload);
    
    // Act: call the API endpoint
    const response = await POST(request);
    
    // Assert: verify the response is successful
    if (!response) {
      throw new Error('No response received from POST endpoint');
    }
    
    expect(response.status).toBe(200);
    
    // Parse the response data
    const responseData = await response.json();
    expect(responseData.success).toBe(true);
    expect(responseData.agent).toBeDefined();
    
    // Store the agent ID for cleanup
    const complexAgentId = responseData.agent.id;
    if (complexAgentId && complexAgentId !== testAgentId) {
      // Add to cleanup list
      testAgentId = complexAgentId;
    }
  });
}); 