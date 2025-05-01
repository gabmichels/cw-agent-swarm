/**
 * MessagingExample.ts - Example of inter-agent messaging
 * 
 * This file demonstrates how agents can communicate directly
 * using the MessageRouter system with various message types.
 */

import { AgentMonitor } from '../monitoring/AgentMonitor';
import { MessageRouter, AgentMessage } from './MessageRouter';

/**
 * Simple mock agent implementation for demo purposes
 */
class MockAgent {
  id: string;
  messages: AgentMessage[] = [];
  
  constructor(id: string) {
    this.id = id;
    this.registerMessageHandler();
  }
  
  registerMessageHandler() {
    MessageRouter.registerHandler(this.id, async (message: AgentMessage) => {
      console.log(`[${this.id}] Received message: ${message.type} from ${message.fromAgentId}`);
      this.messages.push(message);
      
      // Automatically respond to 'ask' messages
      if (message.type === 'ask') {
        await this.respondToQuestion(message);
      }
    });
  }
  
  async respondToQuestion(message: AgentMessage) {
    const { question } = message.payload;
    console.log(`[${this.id}] Answering question: ${question}`);
    
    // Generate a mock response
    const answer = `Answer from ${this.id}: ${question.split('').reverse().join('')}`;
    
    // Send the response
    await MessageRouter.sendResponse(message, {
      answer,
      confidence: 0.9,
      timestamp: Date.now()
    });
  }
  
  async sendMessage(toAgentId: string, type: 'update' | 'handoff' | 'ask' | 'log' | 'result', payload: any) {
    await MessageRouter.sendMessage({
      fromAgentId: this.id,
      toAgentId,
      type,
      payload,
      timestamp: Date.now()
    });
  }
}

/**
 * Run a demonstration of inter-agent messaging
 */
async function runMessagingExample() {
  // Clear any existing state
  AgentMonitor.clear();
  MessageRouter.clearHandlers();
  MessageRouter.clearMessageLog();
  
  console.log('Starting inter-agent messaging example...');
  
  // Create mock agents
  const researcher = new MockAgent('researcher');
  const analyst = new MockAgent('analyst');
  const publisher = new MockAgent('publisher');
  
  // Create delegation context for tracking related messages
  const delegationContextId = `delegation_${Date.now()}`;
  
  // Example 1: Simple update message
  console.log('\nExample 1: Sending update message');
  await researcher.sendMessage('analyst', 'update', {
    topic: 'New research paper',
    content: 'Breakthrough in quantum computing achieved',
    url: 'https://example.com/research/quantum'
  });
  
  // Example 2: Task handoff with context
  console.log('\nExample 2: Task handoff message');
  await researcher.sendMessage('analyst', 'handoff', {
    taskId: 'analyze-quantum-paper',
    goal: 'Analyze the implications of the quantum computing breakthrough',
    context: {
      originalData: 'Raw research data...',
      sourceUrl: 'https://example.com/research/quantum',
      priority: 'high'
    },
    delegationContextId
  });
  
  // Example 3: Asking a question and getting a response
  console.log('\nExample 3: Ask question and get response');
  await publisher.sendMessage('researcher', 'ask', {
    question: 'What is the most significant finding in the quantum paper?',
    context: {
      purpose: 'Preparing press release'
    }
  });
  
  // Wait a bit for async processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Example 4: Broadcast message to multiple agents
  console.log('\nExample 4: Broadcasting message to multiple agents');
  await MessageRouter.broadcastMessage(
    'publisher',
    ['researcher', 'analyst'],
    'log',
    {
      announcement: 'Press release about quantum computing will be published tomorrow',
      releaseTime: '2023-04-15T10:00:00Z'
    },
    {
      delegationContextId
    }
  );
  
  // Wait for async processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check message counts
  console.log('\nMessage counts:');
  console.log(`- Researcher: ${researcher.messages.length} messages`);
  console.log(`- Analyst: ${analyst.messages.length} messages`);
  console.log(`- Publisher: ${publisher.messages.length} messages`);
  
  // Get a specific message thread
  if (researcher.messages.length > 0) {
    const sampleMessage = researcher.messages[0];
    const thread = MessageRouter.getMessageThread(sampleMessage.correlationId || '');
    console.log(`\nMessage thread for correlationId ${sampleMessage.correlationId}:`);
    console.log(thread.map(m => `${m.fromAgentId} -> ${m.toAgentId}: ${m.type}`));
  }
  
  // Show agent monitor logs
  const messageLogs = AgentMonitor.getLogs({ eventType: 'message' });
  console.log(`\nAgent monitor captured ${messageLogs.length} message events`);
  
  console.log('\nMessaging example completed');
}

// Run the example if this file is executed directly
if (require.main === module) {
  runMessagingExample().catch(console.error);
}

export { runMessagingExample }; 