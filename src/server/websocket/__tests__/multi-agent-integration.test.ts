import { describe, test, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';
import { createServer, Server } from 'http';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { SocketIOWebSocketServer } from '../websocket-server';
import { ClientEvent, ServerEvent } from '../types';
import { WebSocketNotificationService } from '../notification-service';
import { AgentMemoryEntity, AgentStatus } from '../../memory/schema/agent';
import { ChatMemoryEntity } from '../../memory/schema/chat';

// Mock agent and chat factory functions
const createMockAgent = (id: string, name: string): AgentMemoryEntity => ({
  id: { toString: () => id },
  name,
  description: `Test agent ${name}`,
  createdAt: new Date(),
  updatedAt: new Date(),
  status: 'available',
  capabilities: [],
  parameters: {
    model: 'test-model',
    temperature: 0.7,
    maxTokens: 1000,
    tools: []
  },
  metadata: {
    tags: ['test'],
    domain: [],
    specialization: [],
    performanceMetrics: {
      successRate: 0,
      averageResponseTime: 0,
      taskCompletionRate: 0
    },
    version: '1.0',
    isPublic: true
  }
}) as unknown as AgentMemoryEntity;

const createMockChat = (id: string, name: string): ChatMemoryEntity => ({
  id: { toString: () => id },
  name,
  description: `Test chat ${name}`,
  createdAt: new Date(),
  updatedAt: new Date(),
  participants: [],
  settings: {
    visibility: 'public',
    allowAnonymousMessages: false,
    enableBranching: false,
    recordTranscript: true
  },
  status: 'active',
  lastMessageAt: new Date(),
  messageCount: 0,
  purpose: 'Testing',
  metadata: {
    tags: ['test'],
    category: [],
    priority: 'medium',
    sensitivity: 'public',
    language: ['en'],
    version: '1.0'
  }
}) as unknown as ChatMemoryEntity;

describe('Multi-Agent WebSocket Integration Tests', () => {
  let httpServer: Server;
  let webSocketServer: SocketIOWebSocketServer;
  let clientSockets: ClientSocket[] = [];
  const PORT = 3001;
  const URL = `http://localhost:${PORT}`;
  
  // Create mock agents and chats
  const agentA = createMockAgent('agent_1', 'Agent A');
  const agentB = createMockAgent('agent_2', 'Agent B');
  const chat = createMockChat('chat_1', 'Test Chat');
  
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
  
  const createClient = (): Promise<ClientSocket> => {
    return new Promise((resolve) => {
      const socket = ioc(URL, {
        path: '/api/ws',
        transports: ['websocket'],
        autoConnect: true
      });
      
      socket.on('connect', () => {
        clientSockets.push(socket);
        resolve(socket);
      });
    });
  };

  test('Agent creation notification should be received by subscribers', async () => {
    // Create clients
    const clientA = await createClient();
    
    // Mock event handler
    const agentCreatedHandler = vi.fn();
    clientA.on(ServerEvent.AGENT_CREATED, agentCreatedHandler);
    
    // Subscribe to agent
    clientA.emit(ClientEvent.SUBSCRIBE_AGENT, agentA.id.toString());
    
    // Wait for subscription to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Create payload
    const payload = {
      agentId: agentA.id.toString(),
      agent: agentA,
      timestamp: Date.now()
    };
    
    // Directly emit the event through our webSocketServer instance
    webSocketServer.emitAgentEvent(ServerEvent.AGENT_CREATED, payload);
    
    // Wait for notification to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify client received notification
    expect(agentCreatedHandler).toHaveBeenCalledTimes(1);
    expect(agentCreatedHandler).toHaveBeenCalledWith(expect.objectContaining({
      agentId: agentA.id.toString(),
      agent: expect.objectContaining({
        name: agentA.name
      })
    }));
  });
  
  test('Chat message notifications should be received by chat subscribers', async () => {
    // Create clients
    const clientA = await createClient();
    const clientB = await createClient();
    
    // Mock event handlers
    const messageCreatedHandlerA = vi.fn();
    const messageCreatedHandlerB = vi.fn();
    
    clientA.on(ServerEvent.MESSAGE_CREATED, messageCreatedHandlerA);
    clientB.on(ServerEvent.MESSAGE_CREATED, messageCreatedHandlerB);
    
    // Client A subscribes to chat
    clientA.emit(ClientEvent.SUBSCRIBE_CHAT, chat.id.toString());
    
    // Client B does not subscribe to the chat
    
    // Wait for subscription to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Create payload
    const messageId = 'msg_1';
    const payload = {
      chatId: chat.id.toString(),
      messageId,
      timestamp: Date.now()
    };
    
    // Directly emit the event through our webSocketServer instance
    webSocketServer.emitChatEvent(ServerEvent.MESSAGE_CREATED, payload);
    
    // Wait for notification to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify only subscribed client received notification
    expect(messageCreatedHandlerA).toHaveBeenCalledTimes(1);
    expect(messageCreatedHandlerA).toHaveBeenCalledWith(expect.objectContaining({
      chatId: chat.id.toString(),
      messageId
    }));
    
    expect(messageCreatedHandlerB).not.toHaveBeenCalled();
  });
  
  test('Multiple agents should be able to communicate via chat', async () => {
    // Create clients for two agents
    const clientAgentA = await createClient();
    const clientAgentB = await createClient();
    
    // Mock event handlers
    const messageCreatedHandlerA = vi.fn();
    const messageCreatedHandlerB = vi.fn();
    
    clientAgentA.on(ServerEvent.MESSAGE_CREATED, messageCreatedHandlerA);
    clientAgentB.on(ServerEvent.MESSAGE_CREATED, messageCreatedHandlerB);
    
    // Both agents subscribe to the same chat
    clientAgentA.emit(ClientEvent.SUBSCRIBE_CHAT, chat.id.toString());
    clientAgentB.emit(ClientEvent.SUBSCRIBE_CHAT, chat.id.toString());
    
    // Wait for subscriptions to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Create payload
    const messageId = 'msg_agent_a';
    const payload = {
      chatId: chat.id.toString(),
      messageId,
      timestamp: Date.now()
    };
    
    // Directly emit the event through our webSocketServer instance
    webSocketServer.emitChatEvent(ServerEvent.MESSAGE_CREATED, payload);
    
    // Wait for notifications to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify both agents received the message notification
    expect(messageCreatedHandlerA).toHaveBeenCalledTimes(1);
    expect(messageCreatedHandlerB).toHaveBeenCalledTimes(1);
    
    // Verify message details
    expect(messageCreatedHandlerA).toHaveBeenCalledWith(expect.objectContaining({
      chatId: chat.id.toString(),
      messageId
    }));
    
    expect(messageCreatedHandlerB).toHaveBeenCalledWith(expect.objectContaining({
      chatId: chat.id.toString(),
      messageId
    }));
  });
  
  test('Agents should receive notifications about other agents joining a chat', async () => {
    // Create clients for two agents
    const clientAgentA = await createClient();
    const clientAgentB = await createClient();
    
    // Mock event handlers
    const participantJoinedHandlerA = vi.fn();
    const participantJoinedHandlerB = vi.fn();
    
    clientAgentA.on(ServerEvent.PARTICIPANT_JOINED, participantJoinedHandlerA);
    clientAgentB.on(ServerEvent.PARTICIPANT_JOINED, participantJoinedHandlerB);
    
    // Agent A subscribes to the chat
    clientAgentA.emit(ClientEvent.SUBSCRIBE_CHAT, chat.id.toString());
    
    // Wait for subscription to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Create payload
    const payload = {
      chatId: chat.id.toString(),
      participantId: agentB.id.toString(),
      timestamp: Date.now()
    };
    
    // Directly emit the event through our webSocketServer instance
    webSocketServer.emitChatEvent(ServerEvent.PARTICIPANT_JOINED, payload);
    
    // Wait for notification to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify Agent A received notification that Agent B joined
    expect(participantJoinedHandlerA).toHaveBeenCalledTimes(1);
    expect(participantJoinedHandlerA).toHaveBeenCalledWith(expect.objectContaining({
      chatId: chat.id.toString(),
      participantId: agentB.id.toString()
    }));
    
    // Agent B was not subscribed, so should not have received notification
    expect(participantJoinedHandlerB).not.toHaveBeenCalled();
    
    // Now Agent B subscribes to the chat
    clientAgentB.emit(ClientEvent.SUBSCRIBE_CHAT, chat.id.toString());
    
    // Wait for subscription to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Reset mock to clear previous calls
    participantJoinedHandlerA.mockReset();
    
    // Create payload for second notification
    const secondPayload = {
      chatId: chat.id.toString(),
      participantId: agentA.id.toString(),
      timestamp: Date.now()
    };
    
    // Directly emit the event through our webSocketServer instance
    webSocketServer.emitChatEvent(ServerEvent.PARTICIPANT_JOINED, secondPayload);
    
    // Wait for notification to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Now both agents should receive the notification
    expect(participantJoinedHandlerA).toHaveBeenCalledTimes(1);
    expect(participantJoinedHandlerB).toHaveBeenCalledTimes(1);
  });
  
  test('Agents should be notified when their status changes', async () => {
    // Create client for agent
    const clientAgentA = await createClient();
    
    // Mock event handler
    const statusChangedHandler = vi.fn();
    clientAgentA.on(ServerEvent.AGENT_STATUS_CHANGED, statusChangedHandler);
    
    // Subscribe to agent
    clientAgentA.emit(ClientEvent.SUBSCRIBE_AGENT, agentA.id.toString());
    
    // Wait for subscription to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Update agent status
    const updatedAgent = {
      ...agentA,
      status: AgentStatus.BUSY
    };
    
    // Create payload
    const payload = {
      agentId: agentA.id.toString(),
      agent: updatedAgent,
      timestamp: Date.now()
    };
    
    // Directly emit the event through our webSocketServer instance
    webSocketServer.emitAgentEvent(ServerEvent.AGENT_STATUS_CHANGED, payload);
    
    // Wait for notification to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify client received notification
    expect(statusChangedHandler).toHaveBeenCalledTimes(1);
    expect(statusChangedHandler).toHaveBeenCalledWith(expect.objectContaining({
      agentId: agentA.id.toString(),
      agent: expect.objectContaining({
        status: 'busy'
      })
    }));
  });
  
  test('System notifications should be received by all connected clients', async () => {
    // Create multiple clients
    const clientA = await createClient();
    const clientB = await createClient();
    const clientC = await createClient();
    
    // Mock event handlers
    const systemNotificationHandlerA = vi.fn();
    const systemNotificationHandlerB = vi.fn();
    const systemNotificationHandlerC = vi.fn();
    
    clientA.on(ServerEvent.SYSTEM_NOTIFICATION, systemNotificationHandlerA);
    clientB.on(ServerEvent.SYSTEM_NOTIFICATION, systemNotificationHandlerB);
    clientC.on(ServerEvent.SYSTEM_NOTIFICATION, systemNotificationHandlerC);
    
    // Create payload
    const notificationMessage = 'System maintenance scheduled';
    const payload = {
      type: 'info' as const,
      message: notificationMessage,
      timestamp: Date.now()
    };
    
    // Directly emit the event through our webSocketServer instance
    webSocketServer.emitSystemNotification(payload);
    
    // Wait for notification to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify all clients received the notification
    expect(systemNotificationHandlerA).toHaveBeenCalledTimes(1);
    expect(systemNotificationHandlerB).toHaveBeenCalledTimes(1);
    expect(systemNotificationHandlerC).toHaveBeenCalledTimes(1);
    
    // Verify notification content
    expect(systemNotificationHandlerA).toHaveBeenCalledWith(expect.objectContaining({
      type: 'info',
      message: notificationMessage
    }));
  });
}); 