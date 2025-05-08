import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWebSocket } from '../useWebSocket';
import { ClientEvent, ServerEvent } from '../../server/websocket/types';

// Mock Socket.io
vi.mock('socket.io-client', () => {
  const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
  
  return {
    io: vi.fn(() => mockSocket)
  };
});

describe('useWebSocket', () => {
  let mockSocket: any;
  
  beforeEach(() => {
    // Get the mocked socket from the io function
    mockSocket = require('socket.io-client').io();
    
    // Clear all mocks
    vi.clearAllMocks();
  });
  
  test('should initialize socket connection', () => {
    renderHook(() => useWebSocket());
    
    // Check that io was called with the correct options
    expect(require('socket.io-client').io).toHaveBeenCalledWith({
      path: '/api/ws',
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });
    
    // Check that event listeners were registered
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
  });
  
  test('should handle connect event', () => {
    // Spy on console.log
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const { result } = renderHook(() => useWebSocket());
    
    // Initially not connected
    expect(result.current.isConnected).toBe(false);
    
    // Simulate connect event
    const connectCallback = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'connect'
    )[1];
    
    // Act
    connectCallback();
    
    // Should be connected now
    expect(result.current.isConnected).toBe(true);
    
    // Should emit CLIENT_READY event
    expect(mockSocket.emit).toHaveBeenCalledWith(ClientEvent.CLIENT_READY);
    
    // Should log connection
    expect(consoleSpy).toHaveBeenCalledWith('WebSocket connected!');
    
    // Restore the spy
    consoleSpy.mockRestore();
  });
  
  test('should handle disconnect event', () => {
    // Spy on console.log
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const { result } = renderHook(() => useWebSocket());
    
    // Simulate connect event first
    const connectCallback = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'connect'
    )[1];
    
    connectCallback();
    
    // Should be connected
    expect(result.current.isConnected).toBe(true);
    
    // Simulate disconnect event
    const disconnectCallback = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'disconnect'
    )[1];
    
    disconnectCallback();
    
    // Should be disconnected now
    expect(result.current.isConnected).toBe(false);
    
    // Should log disconnection
    expect(consoleSpy).toHaveBeenCalledWith('WebSocket disconnected!');
    
    // Restore the spy
    consoleSpy.mockRestore();
  });
  
  test('should handle connection error', () => {
    // Spy on console.error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const { result } = renderHook(() => useWebSocket());
    
    // Simulate connect_error event
    const errorCallback = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'connect_error'
    )[1];
    
    const error = new Error('Connection failed');
    
    errorCallback(error);
    
    // Should be disconnected
    expect(result.current.isConnected).toBe(false);
    
    // Should log error
    expect(consoleSpy).toHaveBeenCalledWith('WebSocket connection error:', error);
    
    // Restore the spy
    consoleSpy.mockRestore();
  });
  
  test('should subscribe to events', () => {
    const { result } = renderHook(() => useWebSocket());
    
    // Create a mock callback
    const mockCallback = vi.fn();
    
    // Subscribe to an event
    result.current.subscribeToEvent(ServerEvent.AGENT_CREATED, mockCallback);
    
    // Check that socket.on was called with the event and a function
    expect(mockSocket.on).toHaveBeenCalledWith(ServerEvent.AGENT_CREATED, expect.any(Function));
    
    // Simulate receiving the event
    const eventCallback = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === ServerEvent.AGENT_CREATED
    )[1];
    
    const payload = { agentId: 'agent-1', timestamp: Date.now() };
    
    eventCallback(payload);
    
    // Callback should have been called with the payload
    expect(mockCallback).toHaveBeenCalledWith(payload);
  });
  
  test('should subscribe to agent', () => {
    const { result } = renderHook(() => useWebSocket());
    
    // Subscribe to an agent
    result.current.subscribeToAgent('agent-1');
    
    // Check that socket.emit was called with the correct event and agent ID
    expect(mockSocket.emit).toHaveBeenCalledWith(ClientEvent.SUBSCRIBE_AGENT, 'agent-1');
  });
  
  test('should unsubscribe from agent', () => {
    const { result } = renderHook(() => useWebSocket());
    
    // Unsubscribe from an agent
    result.current.unsubscribeFromAgent('agent-1');
    
    // Check that socket.emit was called with the correct event and agent ID
    expect(mockSocket.emit).toHaveBeenCalledWith(ClientEvent.UNSUBSCRIBE_AGENT, 'agent-1');
  });
  
  test('should subscribe to chat', () => {
    const { result } = renderHook(() => useWebSocket());
    
    // Subscribe to a chat
    result.current.subscribeToChat('chat-1');
    
    // Check that socket.emit was called with the correct event and chat ID
    expect(mockSocket.emit).toHaveBeenCalledWith(ClientEvent.SUBSCRIBE_CHAT, 'chat-1');
  });
  
  test('should unsubscribe from chat', () => {
    const { result } = renderHook(() => useWebSocket());
    
    // Unsubscribe from a chat
    result.current.unsubscribeFromChat('chat-1');
    
    // Check that socket.emit was called with the correct event and chat ID
    expect(mockSocket.emit).toHaveBeenCalledWith(ClientEvent.UNSUBSCRIBE_CHAT, 'chat-1');
  });
  
  test('should acknowledge message received', () => {
    const { result } = renderHook(() => useWebSocket());
    
    // Acknowledge message received
    result.current.acknowledgeMessageReceived('message-1');
    
    // Check that socket.emit was called with the correct event and message ID
    expect(mockSocket.emit).toHaveBeenCalledWith(ClientEvent.MESSAGE_RECEIVED, { messageId: 'message-1' });
  });
  
  test('should acknowledge message read', () => {
    const { result } = renderHook(() => useWebSocket());
    
    // Acknowledge message read
    result.current.acknowledgeMessageRead('message-1');
    
    // Check that socket.emit was called with the correct event and message ID
    expect(mockSocket.emit).toHaveBeenCalledWith(ClientEvent.MESSAGE_READ, { messageId: 'message-1' });
  });
  
  test('should disconnect on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket());
    
    // Unmount the hook
    unmount();
    
    // Check that socket.disconnect was called
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
}); 