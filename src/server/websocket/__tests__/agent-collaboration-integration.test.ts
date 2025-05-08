import { describe, test, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';
import { createServer, Server } from 'http';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { SocketIOWebSocketServer } from '../websocket-server';
import { ClientEvent, ServerEvent } from '../types';
import { WebSocketNotificationService } from '../notification-service';
import { AgentMemoryEntity } from '../../memory/schema/agent';
import { ChatMemoryEntity } from '../../memory/schema/chat';

// Mock factory functions
const createMockAgent = (id: string, name: string, capabilities: string[] = []): AgentMemoryEntity => ({
  id: { toString: () => id },
  name,
  description: `Test agent ${name}`,
  createdAt: new Date(),
  updatedAt: new Date(),
  status: 'available',
  capabilities: capabilities.map(capability => ({
    id: `cap_${capability}`,
    name: capability,
    description: `${capability} capability`,
    version: '1.0'
  })),
  parameters: {
    model: 'test-model',
    temperature: 0.7,
    maxTokens: 1000,
    tools: []
  },
  metadata: {
    tags: ['test'],
    domain: capabilities,
    specialization: capabilities,
    performanceMetrics: {
      successRate: 0,
      averageResponseTime: 0,
      taskCompletionRate: 0
    },
    version: '1.0',
    isPublic: true
  }
}) as unknown as AgentMemoryEntity;

const createMockChat = (id: string, name: string, participants: string[] = []): ChatMemoryEntity => ({
  id: { toString: () => id },
  name,
  description: `Test chat ${name}`,
  createdAt: new Date(),
  updatedAt: new Date(),
  participants: participants.map(participantId => ({
    id: participantId,
    type: participantId.startsWith('agent_') ? 'agent' : 'user',
    role: 'member',
    joinedAt: new Date(),
    lastActiveAt: new Date(),
    permissions: ['read', 'write']
  })),
  settings: {
    visibility: 'public',
    allowAnonymousMessages: false,
    enableBranching: false,
    recordTranscript: true
  },
  status: 'active',
  lastMessageAt: new Date(),
  messageCount: 0,
  purpose: 'Testing collaboration',
  metadata: {
    tags: ['test', 'collaboration'],
    category: ['agent-collaboration'],
    priority: 'medium',
    sensitivity: 'public',
    language: ['en'],
    version: '1.0'
  }
}) as unknown as ChatMemoryEntity;

interface MockMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderType: 'user' | 'agent';
  content: {
    text: string;
    task?: {
      id: string;
      type: 'request' | 'response' | 'delegation' | 'status';
      assignedTo?: string;
    };
  };
  timestamp: number;
}

describe('Agent Collaboration Integration Tests', () => {
  let httpServer: Server;
  let webSocketServer: SocketIOWebSocketServer;
  let clientSockets: ClientSocket[] = [];
  const PORT = 3002;
  const URL = `http://localhost:${PORT}`;
  
  // Create specialized agents
  const researchAgent = createMockAgent('agent_research', 'Research Agent', ['research', 'information_retrieval']);
  const analysisAgent = createMockAgent('agent_analysis', 'Analysis Agent', ['data_analysis', 'critical_thinking']);
  const summaryAgent = createMockAgent('agent_summary', 'Summary Agent', ['summarization', 'writing']);
  
  // Create collaborative chat
  const collaborativeChat = createMockChat(
    'chat_collab', 
    'Collaborative Research Project',
    ['agent_research', 'agent_analysis', 'agent_summary', 'user_admin']
  );
  
  beforeAll(async () => {
    // Create HTTP server
    httpServer = createServer();
    
    // Initialize WebSocket server
    webSocketServer = new SocketIOWebSocketServer();
    webSocketServer.initialize(httpServer);
    
    // Start server with Promise
    await new Promise<void>(resolve => {
      httpServer.listen(PORT, () => {
        console.log(`Test server started on port ${PORT}`);
        resolve();
      });
    });
  });
  
  afterEach(() => {
    // Close all client connections
    clientSockets.forEach(socket => {
      socket.disconnect();
    });
    clientSockets = [];
    
    // Clear mocks
    vi.clearAllMocks();
  });
  
  afterAll(() => {
    // Close server
    httpServer.close();
  });
  
  const createClient = (agentId?: string): Promise<ClientSocket> => {
    return new Promise((resolve) => {
      const socket = ioc(URL, {
        path: '/api/ws',
        transports: ['websocket'],
        autoConnect: true,
        query: agentId ? { agentId } : undefined
      });
      
      socket.on('connect', () => {
        clientSockets.push(socket);
        resolve(socket);
      });
    });
  };
  
  const simulateMessage = (message: MockMessage): void => {
    // Create payload for the message
    const payload = {
      chatId: message.chatId,
      messageId: message.id,
      timestamp: Date.now()
    };
    
    // Directly emit the event through our webSocketServer instance
    webSocketServer.emitChatEvent(ServerEvent.MESSAGE_CREATED, payload);
    
    // We don't actually store the message in this test, but in a real implementation
    // the message would be stored in the memory service
  }
  
  test('Task delegation flow between multiple specialized agents', async () => {
    // Create agent clients
    const researchAgentClient = await createClient(researchAgent.id.toString());
    const analysisAgentClient = await createClient(analysisAgent.id.toString());
    const summaryAgentClient = await createClient(summaryAgent.id.toString());
    
    // Create user client
    const userClient = await createClient('user_admin');
    
    // Subscribe all agents and user to the collaborative chat
    researchAgentClient.emit(ClientEvent.SUBSCRIBE_CHAT, collaborativeChat.id.toString());
    analysisAgentClient.emit(ClientEvent.SUBSCRIBE_CHAT, collaborativeChat.id.toString());
    summaryAgentClient.emit(ClientEvent.SUBSCRIBE_CHAT, collaborativeChat.id.toString());
    userClient.emit(ClientEvent.SUBSCRIBE_CHAT, collaborativeChat.id.toString());
    
    // Wait for subscriptions to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Set up message handlers for each agent
    const messageHandlers = {
      research: vi.fn(),
      analysis: vi.fn(),
      summary: vi.fn(),
      user: vi.fn()
    };
    
    researchAgentClient.on(ServerEvent.MESSAGE_CREATED, messageHandlers.research);
    analysisAgentClient.on(ServerEvent.MESSAGE_CREATED, messageHandlers.analysis);
    summaryAgentClient.on(ServerEvent.MESSAGE_CREATED, messageHandlers.summary);
    userClient.on(ServerEvent.MESSAGE_CREATED, messageHandlers.user);
    
    // Step 1: User assigns initial task to Research Agent
    const taskId = 'task_research_topic';
    const initialMessage: MockMessage = {
      id: 'msg_1',
      chatId: collaborativeChat.id.toString(),
      senderId: 'user_admin',
      senderType: 'user',
      content: {
        text: 'Please research the latest developments in multi-agent systems.',
        task: {
          id: taskId,
          type: 'request',
          assignedTo: researchAgent.id.toString()
        }
      },
      timestamp: Date.now()
    };
    
    simulateMessage(initialMessage);
    
    // Wait for message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify all participants received the message
    expect(messageHandlers.research).toHaveBeenCalledTimes(1);
    expect(messageHandlers.analysis).toHaveBeenCalledTimes(1);
    expect(messageHandlers.summary).toHaveBeenCalledTimes(1);
    expect(messageHandlers.user).toHaveBeenCalledTimes(1);
    
    // Reset mocks for next step
    vi.resetAllMocks();
    
    // Step 2: Research Agent completes task and delegates to Analysis Agent
    const researchCompleteMessage: MockMessage = {
      id: 'msg_2',
      chatId: collaborativeChat.id.toString(),
      senderId: researchAgent.id.toString(),
      senderType: 'agent',
      content: {
        text: 'I have completed the research on multi-agent systems. @Analysis Agent can you analyze these findings?',
        task: {
          id: 'task_analyze_research',
          type: 'delegation',
          assignedTo: analysisAgent.id.toString()
        }
      },
      timestamp: Date.now()
    };
    
    simulateMessage(researchCompleteMessage);
    
    // Wait for message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify all participants received the message
    expect(messageHandlers.research).toHaveBeenCalledTimes(1);
    expect(messageHandlers.analysis).toHaveBeenCalledTimes(1);
    expect(messageHandlers.summary).toHaveBeenCalledTimes(1);
    expect(messageHandlers.user).toHaveBeenCalledTimes(1);
    
    // Reset mocks for next step
    vi.resetAllMocks();
    
    // Step 3: Analysis Agent works on task and updates status
    const analysisStatusMessage: MockMessage = {
      id: 'msg_3',
      chatId: collaborativeChat.id.toString(),
      senderId: analysisAgent.id.toString(),
      senderType: 'agent',
      content: {
        text: 'I am analyzing the research data. Will complete shortly.',
        task: {
          id: 'task_analyze_research',
          type: 'status'
        }
      },
      timestamp: Date.now()
    };
    
    simulateMessage(analysisStatusMessage);
    
    // Wait for message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify all participants received the status update
    expect(messageHandlers.research).toHaveBeenCalledTimes(1);
    expect(messageHandlers.analysis).toHaveBeenCalledTimes(1);
    expect(messageHandlers.summary).toHaveBeenCalledTimes(1);
    expect(messageHandlers.user).toHaveBeenCalledTimes(1);
    
    // Reset mocks for next step
    vi.resetAllMocks();
    
    // Step 4: Analysis Agent completes analysis and delegates to Summary Agent
    const analysisCompleteMessage: MockMessage = {
      id: 'msg_4',
      chatId: collaborativeChat.id.toString(),
      senderId: analysisAgent.id.toString(),
      senderType: 'agent',
      content: {
        text: 'Analysis complete. Key findings: multi-agent systems show improved efficiency for complex tasks. @Summary Agent please create a summary report.',
        task: {
          id: 'task_summarize_findings',
          type: 'delegation',
          assignedTo: summaryAgent.id.toString()
        }
      },
      timestamp: Date.now()
    };
    
    simulateMessage(analysisCompleteMessage);
    
    // Wait for message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify all participants received the message
    expect(messageHandlers.research).toHaveBeenCalledTimes(1);
    expect(messageHandlers.analysis).toHaveBeenCalledTimes(1);
    expect(messageHandlers.summary).toHaveBeenCalledTimes(1);
    expect(messageHandlers.user).toHaveBeenCalledTimes(1);
    
    // Reset mocks for next step
    vi.resetAllMocks();
    
    // Step 5: Summary Agent delivers final report to user
    const finalReportMessage: MockMessage = {
      id: 'msg_5',
      chatId: collaborativeChat.id.toString(),
      senderId: summaryAgent.id.toString(),
      senderType: 'agent',
      content: {
        text: 'Here is the summary report on multi-agent systems: Recent developments show increased adoption in enterprise applications, with improved coordination mechanisms and adaptive learning capabilities.',
        task: {
          id: 'task_summarize_findings',
          type: 'response'
        }
      },
      timestamp: Date.now()
    };
    
    simulateMessage(finalReportMessage);
    
    // Wait for message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify all participants received the final report
    expect(messageHandlers.research).toHaveBeenCalledTimes(1);
    expect(messageHandlers.analysis).toHaveBeenCalledTimes(1);
    expect(messageHandlers.summary).toHaveBeenCalledTimes(1);
    expect(messageHandlers.user).toHaveBeenCalledTimes(1);
  });
  
  test('Agent disconnection and reconnection should maintain chat continuity', async () => {
    // Create agent clients
    const researchAgentClient = await createClient(researchAgent.id.toString());
    const analysisAgentClient = await createClient(analysisAgent.id.toString());
    
    // Subscribe agents to the collaborative chat
    researchAgentClient.emit(ClientEvent.SUBSCRIBE_CHAT, collaborativeChat.id.toString());
    analysisAgentClient.emit(ClientEvent.SUBSCRIBE_CHAT, collaborativeChat.id.toString());
    
    // Wait for subscriptions to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Set up message handlers
    const messageHandlerResearch = vi.fn();
    const messageHandlerAnalysis = vi.fn();
    
    researchAgentClient.on(ServerEvent.MESSAGE_CREATED, messageHandlerResearch);
    analysisAgentClient.on(ServerEvent.MESSAGE_CREATED, messageHandlerAnalysis);
    
    // Send a message to the chat
    const initialMessage: MockMessage = {
      id: 'msg_reconnect_1',
      chatId: collaborativeChat.id.toString(),
      senderId: 'user_admin',
      senderType: 'user',
      content: {
        text: 'Initial message to all agents'
      },
      timestamp: Date.now()
    };
    
    simulateMessage(initialMessage);
    
    // Wait for message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify both agents received the message
    expect(messageHandlerResearch).toHaveBeenCalledTimes(1);
    expect(messageHandlerAnalysis).toHaveBeenCalledTimes(1);
    
    // Disconnect Research Agent
    researchAgentClient.disconnect();
    
    // Reset mocks
    vi.resetAllMocks();
    
    // Send another message while Research Agent is disconnected
    const midMessage: MockMessage = {
      id: 'msg_reconnect_2',
      chatId: collaborativeChat.id.toString(),
      senderId: analysisAgent.id.toString(),
      senderType: 'agent',
      content: {
        text: 'Message while Research Agent is disconnected'
      },
      timestamp: Date.now()
    };
    
    simulateMessage(midMessage);
    
    // Wait for message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify only Analysis Agent received the message
    expect(messageHandlerResearch).not.toHaveBeenCalled();
    expect(messageHandlerAnalysis).toHaveBeenCalledTimes(1);
    
    // Reset mocks
    vi.resetAllMocks();
    
    // Reconnect Research Agent
    const newResearchAgentClient = await createClient(researchAgent.id.toString());
    const newMessageHandlerResearch = vi.fn();
    newResearchAgentClient.on(ServerEvent.MESSAGE_CREATED, newMessageHandlerResearch);
    
    // Re-subscribe to the chat
    newResearchAgentClient.emit(ClientEvent.SUBSCRIBE_CHAT, collaborativeChat.id.toString());
    
    // Wait for subscription to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Send a final message after reconnection
    const finalMessage: MockMessage = {
      id: 'msg_reconnect_3',
      chatId: collaborativeChat.id.toString(),
      senderId: 'user_admin',
      senderType: 'user',
      content: {
        text: 'Final message after Research Agent reconnected'
      },
      timestamp: Date.now()
    };
    
    simulateMessage(finalMessage);
    
    // Wait for message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify both agents received the message
    expect(newMessageHandlerResearch).toHaveBeenCalledTimes(1);
    expect(messageHandlerAnalysis).toHaveBeenCalledTimes(1);
  });
  
  test('Concurrent task execution by multiple agents should maintain message order', async () => {
    // Create agent clients
    const researchAgentClient = await createClient(researchAgent.id.toString());
    const analysisAgentClient = await createClient(analysisAgent.id.toString());
    const summaryAgentClient = await createClient(summaryAgent.id.toString());
    
    // Subscribe all agents to the collaborative chat
    researchAgentClient.emit(ClientEvent.SUBSCRIBE_CHAT, collaborativeChat.id.toString());
    analysisAgentClient.emit(ClientEvent.SUBSCRIBE_CHAT, collaborativeChat.id.toString());
    summaryAgentClient.emit(ClientEvent.SUBSCRIBE_CHAT, collaborativeChat.id.toString());
    
    // Wait for subscriptions to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Set up message tracker to verify order
    const messageSequence: { agent: string; msgId: string }[] = [];
    
    // Message handlers that track sequence
    const trackMessage = (agentName: string) => (data: { messageId: string }) => {
      messageSequence.push({ agent: agentName, msgId: data.messageId });
    };
    
    researchAgentClient.on(ServerEvent.MESSAGE_CREATED, trackMessage('research'));
    analysisAgentClient.on(ServerEvent.MESSAGE_CREATED, trackMessage('analysis'));
    summaryAgentClient.on(ServerEvent.MESSAGE_CREATED, trackMessage('summary'));
    
    // Define a sequence of messages with short delays to simulate concurrent work
    const messages: MockMessage[] = [
      {
        id: 'concurrent_msg_1',
        chatId: collaborativeChat.id.toString(),
        senderId: researchAgent.id.toString(),
        senderType: 'agent',
        content: { text: 'Starting research task' },
        timestamp: Date.now()
      },
      {
        id: 'concurrent_msg_2',
        chatId: collaborativeChat.id.toString(),
        senderId: analysisAgent.id.toString(),
        senderType: 'agent',
        content: { text: 'Beginning preliminary analysis' },
        timestamp: Date.now() + 10
      },
      {
        id: 'concurrent_msg_3',
        chatId: collaborativeChat.id.toString(),
        senderId: summaryAgent.id.toString(),
        senderType: 'agent',
        content: { text: 'Preparing summary template' },
        timestamp: Date.now() + 20
      },
      {
        id: 'concurrent_msg_4',
        chatId: collaborativeChat.id.toString(),
        senderId: researchAgent.id.toString(),
        senderType: 'agent',
        content: { text: 'Research findings ready' },
        timestamp: Date.now() + 30
      },
      {
        id: 'concurrent_msg_5',
        chatId: collaborativeChat.id.toString(),
        senderId: analysisAgent.id.toString(),
        senderType: 'agent',
        content: { text: 'Analysis complete' },
        timestamp: Date.now() + 40
      }
    ];
    
    // Send messages in quick succession
    for (const message of messages) {
      simulateMessage(message);
      await new Promise(resolve => setTimeout(resolve, 20)); // Small delay between messages
    }
    
    // Wait for all messages to be processed
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Verify each agent received all messages
    const researchMessages = messageSequence.filter(m => m.agent === 'research');
    const analysisMessages = messageSequence.filter(m => m.agent === 'analysis');
    const summaryMessages = messageSequence.filter(m => m.agent === 'summary');
    
    expect(researchMessages.length).toBe(5);
    expect(analysisMessages.length).toBe(5);
    expect(summaryMessages.length).toBe(5);
    
    // Verify message order is maintained for each agent
    const expectedOrder = [
      'concurrent_msg_1',
      'concurrent_msg_2',
      'concurrent_msg_3',
      'concurrent_msg_4',
      'concurrent_msg_5'
    ];
    
    expect(researchMessages.map(m => m.msgId)).toEqual(expectedOrder);
    expect(analysisMessages.map(m => m.msgId)).toEqual(expectedOrder);
    expect(summaryMessages.map(m => m.msgId)).toEqual(expectedOrder);
  });
}); 