// @ts-ignore - These imports would exist in actual implementation
import { AgentBase } from '../../src/agents/shared/interfaces/AgentBase.interface';
// @ts-ignore - These imports would exist in actual implementation
import { DefaultAgentFactory } from '../../src/agents/shared/factories/DefaultAgentFactory';
// @ts-ignore - These imports would exist in actual implementation
import { MemoryType } from '../../src/agents/shared/types/MemoryTypes';

describe('Agent Memory System E2E Tests', () => {
  let agent: AgentBase;
  let agentFactory: DefaultAgentFactory;
  
  // Setup before all tests
  beforeAll(async () => {
    // Create agent factory
    agentFactory = new DefaultAgentFactory();
    
    // Initialize agent with memory capabilities
    agent = await agentFactory.createAgent({
      agentId: 'test-agent-' + Date.now(),
      config: {
        enableMemoryManager: true,
        enableKnowledgeManager: true,
        memoryConfig: {
          enableVersionHistory: true,
          memoryDecayRate: 0.1,
          enableMemoryIsolation: true
        }
      }
    });
  });
  
  // Cleanup after all tests
  afterAll(async () => {
    if (agent) {
      await agent.shutdown();
    }
  });
  
  // Basic memory CRUD operations test
  test('Should create, retrieve, update and delete memory', async () => {
    // Create memory
    const memoryId = await agent.createMemory({
      type: MemoryType.THOUGHT,
      content: 'Initial thought for testing',
      metadata: { 
        importance: 'high',
        context: 'e2e-testing'
      }
    });
    
    // Verify memory was created
    expect(memoryId).toBeDefined();
    
    // Retrieve memory
    const memory = await agent.getMemory(memoryId);
    
    // Verify retrieved memory content
    expect(memory).toBeDefined();
    expect(memory.content).toBe('Initial thought for testing');
    expect(memory.metadata.importance).toBe('high');
    expect(memory.type).toBe(MemoryType.THOUGHT);
    
    // Update memory
    await agent.updateMemory(memoryId, {
      content: 'Updated thought for testing',
      metadata: {
        importance: 'critical',
        context: 'e2e-testing'
      }
    });
    
    // Retrieve updated memory
    const updatedMemory = await agent.getMemory(memoryId);
    
    // Verify memory was updated
    expect(updatedMemory.content).toBe('Updated thought for testing');
    expect(updatedMemory.metadata.importance).toBe('critical');
    
    // Delete memory
    await agent.deleteMemory(memoryId);
    
    // Attempt to retrieve deleted memory (should throw or return null)
    try {
      const deletedMemory = await agent.getMemory(memoryId);
      expect(deletedMemory).toBeNull();
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
  
  // Memory query test
  test('Should retrieve memories by query parameters', async () => {
    // Create several test memories
    const memoryIds = await Promise.all([
      agent.createMemory({
        type: MemoryType.FACT,
        content: 'The sky is blue',
        metadata: { category: 'nature', importance: 'low' }
      }),
      agent.createMemory({
        type: MemoryType.FACT,
        content: 'Water boils at 100°C',
        metadata: { category: 'science', importance: 'medium' }
      }),
      agent.createMemory({
        type: MemoryType.KNOWLEDGE,
        content: 'TypeScript extends JavaScript with types',
        metadata: { category: 'programming', importance: 'high' }
      })
    ]);
    
    // Query by type
    const factMemories = await agent.queryMemories({
      type: MemoryType.FACT
    });
    
    // Verify query results
    expect(factMemories.length).toBe(2);
    expect(factMemories.some(m => m.content.includes('sky'))).toBeTruthy();
    expect(factMemories.some(m => m.content.includes('boils'))).toBeTruthy();
    
    // Query by metadata
    const importantMemories = await agent.queryMemories({
      metadata: { importance: 'high' }
    });
    
    // Verify query results
    expect(importantMemories.length).toBe(1);
    expect(importantMemories[0].content).toContain('TypeScript');
    
    // Full-text search
    const waterMemories = await agent.queryMemories({
      searchText: 'water'
    });
    
    // Verify search results
    expect(waterMemories.length).toBe(1);
    expect(waterMemories[0].content).toContain('Water boils');
    
    // Clean up
    await Promise.all(memoryIds.map(id => agent.deleteMemory(id)));
  });
  
  // Memory version history test
  test('Should track memory version history', async () => {
    // Create memory
    const memoryId = await agent.createMemory({
      type: MemoryType.DOCUMENT,
      content: 'Version 1 of document',
      metadata: { version: 1 }
    });
    
    // Update memory multiple times
    await agent.updateMemory(memoryId, {
      content: 'Version 2 of document',
      metadata: { version: 2 }
    });
    
    await agent.updateMemory(memoryId, {
      content: 'Version 3 of document',
      metadata: { version: 3 }
    });
    
    // Get current memory
    const currentMemory = await agent.getMemory(memoryId);
    expect(currentMemory.content).toBe('Version 3 of document');
    
    // Get memory history
    const history = await agent.getMemoryHistory(memoryId);
    
    // Verify history
    expect(history.length).toBe(3);
    expect(history[0].content).toBe('Version 1 of document');
    expect(history[1].content).toBe('Version 2 of document');
    expect(history[2].content).toBe('Version 3 of document');
    
    // Clean up
    await agent.deleteMemory(memoryId);
  });
  
  // Memory isolation test
  test('Should enforce memory isolation between agents', async () => {
    // Create a second agent
    const agent2 = await agentFactory.createAgent({
      agentId: 'test-agent-2-' + Date.now(),
      config: {
        enableMemoryManager: true,
        memoryConfig: {
          enableMemoryIsolation: true
        }
      }
    });
    
    try {
      // Create private memory in first agent
      const privateMemoryId = await agent.createMemory({
        type: MemoryType.THOUGHT,
        content: 'Private thought',
        metadata: { isPrivate: true },
        accessControl: { isPrivate: true }
      });
      
      // Create shared memory in first agent
      const sharedMemoryId = await agent.createMemory({
        type: MemoryType.FACT,
        content: 'Shared fact',
        metadata: { isShared: true },
        accessControl: { 
          isShared: true,
          allowedAgents: [agent2.getAgentId()]
        }
      });
      
      // Try to access private memory from second agent
      try {
        await agent2.getMemory(privateMemoryId);
        fail('Should not be able to access private memory');
      } catch (error) {
        expect(error).toBeDefined();
      }
      
      // Access shared memory from second agent
      const sharedMemory = await agent2.getMemory(sharedMemoryId);
      expect(sharedMemory).toBeDefined();
      expect(sharedMemory.content).toBe('Shared fact');
      
      // Clean up
      await agent.deleteMemory(privateMemoryId);
      await agent.deleteMemory(sharedMemoryId);
    } finally {
      // Clean up second agent
      await agent2.shutdown();
    }
  });
}); 