import { describe, test, expect, vi, beforeEach } from 'vitest';
import { DefaultEventHandlerRegistry } from '../event-handler-registry';
import { ClientEvent, EventHandler } from '../types';
import { Socket } from 'socket.io';

describe('DefaultEventHandlerRegistry', () => {
  let registry: DefaultEventHandlerRegistry;
  let mockSocket: Socket;

  beforeEach(() => {
    registry = new DefaultEventHandlerRegistry();
    mockSocket = {
      id: 'socket-1'
    } as unknown as Socket;
  });

  describe('Handler Registration', () => {
    test('should register and retrieve a handler', () => {
      const mockHandler: EventHandler<string> = vi.fn();
      
      registry.registerHandler<string>(ClientEvent.SUBSCRIBE_AGENT, mockHandler);
      
      const retrievedHandler = registry.getHandler<string>(ClientEvent.SUBSCRIBE_AGENT);
      expect(retrievedHandler).toBe(mockHandler);
    });

    test('should overwrite an existing handler when registering for the same event', () => {
      const mockHandler1: EventHandler<string> = vi.fn();
      const mockHandler2: EventHandler<string> = vi.fn();
      
      registry.registerHandler<string>(ClientEvent.SUBSCRIBE_AGENT, mockHandler1);
      registry.registerHandler<string>(ClientEvent.SUBSCRIBE_AGENT, mockHandler2);
      
      const retrievedHandler = registry.getHandler<string>(ClientEvent.SUBSCRIBE_AGENT);
      expect(retrievedHandler).toBe(mockHandler2);
      expect(retrievedHandler).not.toBe(mockHandler1);
    });

    test('should return null for a non-registered event', () => {
      const handler = registry.getHandler(ClientEvent.SUBSCRIBE_AGENT);
      expect(handler).toBeNull();
    });
  });

  describe('Handler Removal', () => {
    test('should remove a registered handler', () => {
      const mockHandler: EventHandler<string> = vi.fn();
      
      registry.registerHandler<string>(ClientEvent.SUBSCRIBE_AGENT, mockHandler);
      registry.removeHandler(ClientEvent.SUBSCRIBE_AGENT);
      
      const handler = registry.getHandler(ClientEvent.SUBSCRIBE_AGENT);
      expect(handler).toBeNull();
    });

    test('should handle removing a non-existent handler', () => {
      // Should not throw an error
      expect(() => registry.removeHandler(ClientEvent.SUBSCRIBE_AGENT)).not.toThrow();
    });
  });

  describe('Default Handlers', () => {
    test('should register default handlers', () => {
      // Spy on console.log
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Register default handlers
      registry.registerDefaultHandlers(mockSocket);
      
      // Check that the handlers were registered
      expect(registry.getHandler(ClientEvent.CLIENT_DISCONNECT)).not.toBeNull();
      expect(registry.getHandler(ClientEvent.CLIENT_READY)).not.toBeNull();
      expect(registry.getHandler(ClientEvent.MESSAGE_RECEIVED)).not.toBeNull();
      expect(registry.getHandler(ClientEvent.MESSAGE_READ)).not.toBeNull();
      
      // Test that handlers work
      const disconnectHandler = registry.getHandler<void>(ClientEvent.CLIENT_DISCONNECT);
      disconnectHandler && disconnectHandler(undefined, mockSocket);
      
      const readyHandler = registry.getHandler<void>(ClientEvent.CLIENT_READY);
      readyHandler && readyHandler(undefined, mockSocket);
      
      const receivedHandler = registry.getHandler<{ messageId: string }>(ClientEvent.MESSAGE_RECEIVED);
      receivedHandler && receivedHandler({ messageId: 'msg-1' }, mockSocket);
      
      const readHandler = registry.getHandler<{ messageId: string }>(ClientEvent.MESSAGE_READ);
      readHandler && readHandler({ messageId: 'msg-1' }, mockSocket);
      
      // Expect console.log to have been called
      expect(consoleSpy).toHaveBeenCalledTimes(4);
      
      // Restore the spy
      consoleSpy.mockRestore();
    });

    test('should not overwrite existing handlers when registering defaults', () => {
      const customDisconnectHandler: EventHandler<void> = vi.fn();
      registry.registerHandler<void>(ClientEvent.CLIENT_DISCONNECT, customDisconnectHandler);
      
      registry.registerDefaultHandlers(mockSocket);
      
      // The custom handler should still be registered
      const handler = registry.getHandler<void>(ClientEvent.CLIENT_DISCONNECT);
      expect(handler).toBe(customDisconnectHandler);
    });
  });

  describe('Type Safety', () => {
    test('should maintain type safety when retrieving handlers', () => {
      // Register a handler with a specific payload type
      const mockHandler: EventHandler<{ messageId: string }> = (payload, socket) => {
        // TypeScript should know that payload has a messageId property
        const messageId = payload.messageId;
        expect(messageId).toBe('msg-1');
      };
      
      registry.registerHandler<{ messageId: string }>(ClientEvent.MESSAGE_RECEIVED, mockHandler);
      
      // Retrieve the handler and call it with the correct payload type
      const handler = registry.getHandler<{ messageId: string }>(ClientEvent.MESSAGE_RECEIVED);
      handler && handler({ messageId: 'msg-1' }, mockSocket);
    });
  });
}); 