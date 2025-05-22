/**
 * Mock implementations for testing
 */

import { MemoryService } from '../../services/memory/memory-service';
import { SearchService } from '../../services/search/search-service';

/**
 * Creates a mock user interface for testing
 */
export function createMockUserInterface() {
  return {
    renderMessage: (message: string) => console.log(`[MOCK UI]: ${message}`),
    showNotification: (title: string, message: string) => console.log(`[NOTIFICATION]: ${title} - ${message}`),
    updateStatus: (status: string) => console.log(`[STATUS]: ${status}`),
    promptUser: async (question: string) => 'mock user response',
    render: (content: any) => {}
  };
}

/**
 * Creates a mock tool service for testing
 */
export function createToolService() {
  return {
    registerTool: async (tool: any) => ({ ...tool, id: `tool-${Date.now()}` }),
    executeTool: async (toolId: string, params: any) => ({ success: true, result: 'mock tool result' }),
    listTools: async () => [],
    getTool: async (id: string) => null
  };
}

/**
 * Creates a mock scheduler for testing
 */
export function createScheduler(memoryService: MemoryService) {
  return {
    scheduleTask: async (task: any) => ({ ...task, id: `task-${Date.now()}` }),
    getScheduledTasks: async () => [],
    cancelTask: async (id: string) => true,
    rescheduleTask: async (id: string, newTime: Date) => true,
    executeScheduledTasks: async () => ({ executed: 0, failed: 0 })
  };
}

/**
 * Creates a mock task executor for testing
 */
export function createTaskExecutor() {
  return {
    executeTask: async (task: any) => ({ success: true, output: 'mock task result' }),
    getTaskStatus: async (id: string) => 'completed',
    abortTask: async (id: string) => true
  };
}

/**
 * Creates a mock reflection service for testing
 */
export function createReflectionService() {
  return {
    reflect: async (context: any) => ({ insights: ['mock insight'], status: 'completed' }),
    scheduleReflection: async (schedule: string, options: any) => true,
    getReflectionHistory: async () => []
  };
}

/**
 * Creates a mock strategy service for testing
 */
export function createStrategyService() {
  return {
    createStrategy: async (options: any) => ({ id: `strategy-${Date.now()}`, ...options }),
    evaluateStrategy: async (id: string) => ({ score: 0.8, metrics: {} }),
    listStrategies: async () => []
  };
}

/**
 * Creates a mock knowledge graph for testing
 */
export function createKnowledgeGraph() {
  return {
    addNode: async (node: any) => ({ ...node, id: `node-${Date.now()}` }),
    addEdge: async (source: string, target: string, type: string) => ({ id: `edge-${Date.now()}`, source, target, type }),
    query: async (query: string) => ({ nodes: [], edges: [] }),
    findConnections: async (nodeId: string) => []
  };
}

/**
 * Creates a mock agent manager for testing
 */
export function createAgentManager() {
  return {
    registerAgent: async (agent: any) => ({ ...agent, id: `agent-${Date.now()}` }),
    getAgent: async (id: string) => null,
    listAgents: async () => [],
    updateAgentStatus: async (id: string, status: string) => true
  };
}

/**
 * Creates a mock agent for testing
 */
export function createAgent({ 
  type, 
  services 
}: { 
  type: string, 
  services: {
    memory: MemoryService,
    search: SearchService,
    scheduler: any,
    taskExecutor: any,
    reflection: any,
    strategy: any,
    knowledgeGraph: any,
    tools: any
  }
}) {
  return {
    id: `agent-${Date.now()}`,
    type,
    name: `Test ${type} Agent`,
    services,
    
    // Basic agent operations
    process: async (input: string) => ({ response: 'mock agent response', thoughts: [] }),
    learn: async (content: string) => true,
    remember: async (query: string) => ['mock memory'],
    execute: async (task: any) => ({ success: true, result: 'mock execution result' }),
    
    // Specialized operations based on type
    ...(type === 'assistant' ? {
      chat: async (message: string) => 'mock chat response',
      generateContent: async (prompt: string) => 'mock generated content'
    } : {}),
    
    ...(type === 'researcher' ? {
      research: async (topic: string) => 'mock research results',
      summarize: async (content: string) => 'mock summary'
    } : {})
  };
} 