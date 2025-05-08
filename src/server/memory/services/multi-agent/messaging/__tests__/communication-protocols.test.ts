/**
 * Communication Protocols Tests
 * 
 * These tests verify the functionality of the inter-agent communication
 * protocols, message creation utilities, and protocol-specific behaviors.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MessageFormat,
  MessagePriority,
  CommunicationProtocol,
  DeliveryStatus,
  MessageProtocolUtils,
  BaseMessage,
  RequestMessage,
  ResponseMessage,
  NotificationMessage,
  BroadcastMessage
} from '../communication-protocols';

describe('Communication Protocols', () => {
  beforeEach(() => {
    // Setup any mocks needed
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => 'mock-uuid');
    vi.spyOn(Date, 'now').mockImplementation(() => 1234567890);
  });
  
  afterEach(() => {
    // Clean up mocks
    vi.restoreAllMocks();
  });
  
  describe('MessageProtocolUtils', () => {
    test('createRequest should create a valid request message', () => {
      const message = MessageProtocolUtils.createRequest(
        'agent-1',
        'agent-2',
        'conv-123',
        { query: 'What is the analysis of this data?', data: [1, 2, 3] },
        'data_analysis',
        {
          contentFormat: MessageFormat.JSON,
          priority: MessagePriority.HIGH,
          responseFormat: MessageFormat.MARKDOWN,
          timeoutMs: 30000,
          metadata: { originalUser: 'user-1' }
        }
      );
      
      expect(message.id).toBe('mock-uuid');
      expect(message.senderId).toBe('agent-1');
      expect(message.recipientId).toBe('agent-2');
      expect(message.conversationId).toBe('conv-123');
      expect(message.content).toEqual({ query: 'What is the analysis of this data?', data: [1, 2, 3] });
      expect(message.contentFormat).toBe(MessageFormat.JSON);
      expect(message.protocol).toBe(CommunicationProtocol.REQUEST_RESPONSE);
      expect(message.priority).toBe(MessagePriority.HIGH);
      expect(message.deliveryStatus).toBe(DeliveryStatus.PENDING);
      expect(message.requiresResponse).toBe(true);
      expect(message.requestType).toBe('data_analysis');
      expect(message.responseFormat).toBe(MessageFormat.MARKDOWN);
      expect(message.timeoutMs).toBe(30000);
      expect(message.metadata).toEqual({ originalUser: 'user-1' });
    });
    
    test('createResponse should create a valid response message', () => {
      // Create a request message first
      const request = MessageProtocolUtils.createRequest(
        'agent-1',
        'agent-2',
        'conv-123',
        { query: 'Analyze this data', data: [1, 2, 3] },
        'data_analysis'
      );
      
      // Create response to the request
      const response = MessageProtocolUtils.createResponse(
        request,
        { result: 'The data shows an upward trend', confidence: 0.9 },
        true,
        {
          contentFormat: MessageFormat.JSON,
          metadata: { processingTime: 1500 }
        }
      );
      
      expect(response.id).toBe('mock-uuid');
      expect(response.senderId).toBe('agent-2'); // Swapped from request
      expect(response.recipientId).toBe('agent-1'); // Swapped from request
      expect(response.conversationId).toBe('conv-123');
      expect(response.content).toEqual({ result: 'The data shows an upward trend', confidence: 0.9 });
      expect(response.contentFormat).toBe(MessageFormat.JSON);
      expect(response.protocol).toBe(CommunicationProtocol.REQUEST_RESPONSE);
      expect(response.requiresResponse).toBe(false);
      expect(response.responseToId).toBe(request.id);
      expect(response.isSuccessful).toBe(true);
      expect(response.metadata).toEqual({ processingTime: 1500 });
    });
    
    test('createNotification should create a valid notification message', () => {
      const notification = MessageProtocolUtils.createNotification(
        'agent-1',
        'agent-2',
        'conv-123',
        'Your task has been completed successfully',
        'task_completion',
        {
          contentFormat: MessageFormat.TEXT,
          priority: MessagePriority.NORMAL,
          expirationTime: Date.now() + 3600000,
          metadata: { taskId: 'task-123' }
        }
      );
      
      expect(notification.id).toBe('mock-uuid');
      expect(notification.senderId).toBe('agent-1');
      expect(notification.recipientId).toBe('agent-2');
      expect(notification.conversationId).toBe('conv-123');
      expect(notification.content).toBe('Your task has been completed successfully');
      expect(notification.contentFormat).toBe(MessageFormat.TEXT);
      expect(notification.protocol).toBe(CommunicationProtocol.NOTIFICATION);
      expect(notification.priority).toBe(MessagePriority.NORMAL);
      expect(notification.requiresResponse).toBe(false);
      expect(notification.notificationType).toBe('task_completion');
      expect(notification.expirationTime).toBe(Date.now() + 3600000);
      expect(notification.metadata).toEqual({ taskId: 'task-123' });
    });
    
    test('createBroadcast should create a valid broadcast message', () => {
      const recipients = ['agent-2', 'agent-3', 'agent-4'];
      
      const broadcast = MessageProtocolUtils.createBroadcast(
        'agent-1',
        recipients,
        'conv-123',
        'Important announcement for all agents',
        'system_announcement',
        {
          contentFormat: MessageFormat.TEXT,
          priority: MessagePriority.HIGH,
          requiresResponse: true,
          acknowledgmentRequired: true,
          metadata: { urgent: true }
        }
      );
      
      expect(broadcast.id).toBe('mock-uuid');
      expect(broadcast.senderId).toBe('agent-1');
      expect(broadcast.recipients).toEqual(recipients);
      expect(broadcast.conversationId).toBe('conv-123');
      expect(broadcast.content).toBe('Important announcement for all agents');
      expect(broadcast.contentFormat).toBe(MessageFormat.TEXT);
      expect(broadcast.protocol).toBe(CommunicationProtocol.BROADCAST);
      expect(broadcast.priority).toBe(MessagePriority.HIGH);
      expect(broadcast.requiresResponse).toBe(true);
      expect(broadcast.broadcastType).toBe('system_announcement');
      expect(broadcast.acknowledgmentRequired).toBe(true);
      expect(broadcast.metadata).toEqual({ urgent: true });
    });
    
    test('requiresResponse should correctly identify messages requiring response', () => {
      const requestMessage: RequestMessage = {
        id: '1',
        conversationId: 'conv-1',
        senderId: 'agent-1',
        recipientId: 'agent-2',
        content: 'Request data',
        contentFormat: MessageFormat.TEXT,
        timestamp: Date.now(),
        protocol: CommunicationProtocol.REQUEST_RESPONSE,
        priority: MessagePriority.NORMAL,
        deliveryStatus: DeliveryStatus.PENDING,
        requiresResponse: true,
        requestType: 'data_request'
      };
      
      const notificationMessage: NotificationMessage = {
        id: '2',
        conversationId: 'conv-1',
        senderId: 'agent-1',
        recipientId: 'agent-2',
        content: 'Notification',
        contentFormat: MessageFormat.TEXT,
        timestamp: Date.now(),
        protocol: CommunicationProtocol.NOTIFICATION,
        priority: MessagePriority.NORMAL,
        deliveryStatus: DeliveryStatus.PENDING,
        requiresResponse: false,
        notificationType: 'info'
      };
      
      expect(MessageProtocolUtils.requiresResponse(requestMessage)).toBe(true);
      expect(MessageProtocolUtils.requiresResponse(notificationMessage)).toBe(false);
    });
    
    test('isExpired should correctly identify expired messages', () => {
      const currentTime = Date.now();
      
      const activeMessage: BaseMessage = {
        id: '1',
        conversationId: 'conv-1',
        senderId: 'agent-1',
        content: 'Active message',
        contentFormat: MessageFormat.TEXT,
        timestamp: currentTime - 1000, // 1 second ago
        protocol: CommunicationProtocol.NOTIFICATION,
        priority: MessagePriority.NORMAL,
        deliveryStatus: DeliveryStatus.PENDING,
        requiresResponse: false,
        responseDeadline: currentTime + 60000 // Expires in 1 minute
      };
      
      const expiredMessage: BaseMessage = {
        id: '2',
        conversationId: 'conv-1',
        senderId: 'agent-1',
        content: 'Expired message',
        contentFormat: MessageFormat.TEXT,
        timestamp: currentTime - 120000, // 2 minutes ago
        protocol: CommunicationProtocol.NOTIFICATION,
        priority: MessagePriority.NORMAL,
        deliveryStatus: DeliveryStatus.PENDING,
        requiresResponse: false,
        responseDeadline: currentTime - 60000 // Expired 1 minute ago
      };
      
      const messageWithoutDeadline: BaseMessage = {
        id: '3',
        conversationId: 'conv-1',
        senderId: 'agent-1',
        content: 'No deadline',
        contentFormat: MessageFormat.TEXT,
        timestamp: currentTime - 3600000, // 1 hour ago
        protocol: CommunicationProtocol.NOTIFICATION,
        priority: MessagePriority.NORMAL,
        deliveryStatus: DeliveryStatus.PENDING,
        requiresResponse: false
      };
      
      expect(MessageProtocolUtils.isExpired(activeMessage)).toBe(false);
      expect(MessageProtocolUtils.isExpired(expiredMessage)).toBe(true);
      expect(MessageProtocolUtils.isExpired(messageWithoutDeadline)).toBe(false);
    });
    
    test('message status utility functions should update status correctly', () => {
      const message: BaseMessage = {
        id: '1',
        conversationId: 'conv-1',
        senderId: 'agent-1',
        content: 'Test message',
        contentFormat: MessageFormat.TEXT,
        timestamp: Date.now(),
        protocol: CommunicationProtocol.NOTIFICATION,
        priority: MessagePriority.NORMAL,
        deliveryStatus: DeliveryStatus.PENDING,
        requiresResponse: false
      };
      
      const deliveredMessage = MessageProtocolUtils.markAsDelivered(message);
      expect(deliveredMessage.deliveryStatus).toBe(DeliveryStatus.DELIVERED);
      
      const readMessage = MessageProtocolUtils.markAsRead(deliveredMessage);
      expect(readMessage.deliveryStatus).toBe(DeliveryStatus.READ);
      
      const processedMessage = MessageProtocolUtils.markAsProcessed(readMessage);
      expect(processedMessage.deliveryStatus).toBe(DeliveryStatus.PROCESSED);
      
      const respondedMessage = MessageProtocolUtils.markAsResponded(processedMessage);
      expect(respondedMessage.deliveryStatus).toBe(DeliveryStatus.RESPONDED);
    });
  });
  
  describe('Protocol Message Typing', () => {
    test('RequestMessage should enforce protocol and requiresResponse', () => {
      const request: RequestMessage = {
        id: '1',
        conversationId: 'conv-1',
        senderId: 'agent-1',
        recipientId: 'agent-2',
        content: 'Request',
        contentFormat: MessageFormat.TEXT,
        timestamp: Date.now(),
        protocol: CommunicationProtocol.REQUEST_RESPONSE,
        priority: MessagePriority.NORMAL,
        deliveryStatus: DeliveryStatus.PENDING,
        requiresResponse: true,
        requestType: 'data'
      };
      
      // Just testing that the type is properly enforced
      expect(request.protocol).toBe(CommunicationProtocol.REQUEST_RESPONSE);
      expect(request.requiresResponse).toBe(true);
    });
    
    test('ResponseMessage should enforce protocol and requiresResponse', () => {
      const response: ResponseMessage = {
        id: '1',
        conversationId: 'conv-1',
        senderId: 'agent-2',
        recipientId: 'agent-1',
        content: 'Response',
        contentFormat: MessageFormat.TEXT,
        timestamp: Date.now(),
        protocol: CommunicationProtocol.REQUEST_RESPONSE,
        priority: MessagePriority.NORMAL,
        deliveryStatus: DeliveryStatus.PENDING,
        requiresResponse: false,
        responseToId: 'request-1',
        isSuccessful: true
      };
      
      // Just testing that the type is properly enforced
      expect(response.protocol).toBe(CommunicationProtocol.REQUEST_RESPONSE);
      expect(response.requiresResponse).toBe(false);
      expect(response.responseToId).toBeDefined();
    });
  });
}); 