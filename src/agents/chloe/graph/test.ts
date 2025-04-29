/**
 * Simple test script for ChloeGraph implementation
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChloeMemory } from '../memory';
import { TaskLogger } from '../task-logger';
import { ChloeGraph } from './graph';
import { ChloePlanningGraph, createChloeGraph } from './index';

async function testChloeGraph() {
  console.log('Creating test dependencies...');
  
  // Create test dependencies
  const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4o',
    temperature: 0.7,
  });
  
  const memory = new ChloeMemory({ 
    agentId: 'test-agent'
  });
  
  const taskLogger = new TaskLogger();
  await taskLogger.initialize();
  
  console.log('Testing original ChloeGraph implementation...');
  
  // Create dummy tool functions
  const toolFunctions = {
    search_memory: async (input: string) => `Memory search result for: ${input}`,
    summarize_recent_activity: async (input: string) => `Summary of recent activity: ${input}`,
    propose_content_ideas: async (input: string) => `Content ideas for: ${input}`,
  };
  
  // Test original ChloeGraph
  const originalGraph = new ChloeGraph(
    model,
    memory,
    taskLogger,
    toolFunctions
  );
  
  try {
    console.log('Executing original graph...');
    const originalResult = await originalGraph.execute('Create a content plan for social media');
    console.log('Original Graph Result:', JSON.stringify(originalResult, null, 2));
  } catch (error) {
    console.error('Error testing original graph:', error);
  }
  
  console.log('Testing new ChloePlanningGraph implementation...');
  
  // Test new ChloePlanningGraph
  try {
    const newGraph = createChloeGraph(model, memory, taskLogger);
    console.log('Executing new graph...');
    const newResult = await newGraph.execute('Create a content plan for social media');
    console.log('New Graph Result:', JSON.stringify(newResult, null, 2));
  } catch (error) {
    console.error('Error testing new graph:', error);
  }
  
  console.log('Tests completed!');
}

// Only run if executed directly
if (require.main === module) {
  console.log('Starting ChloeGraph tests...');
  testChloeGraph()
    .then(() => console.log('Tests finished'))
    .catch(err => console.error('Test error:', err));
}

export { testChloeGraph }; 