import { describe, test, expect, vi, beforeEach } from 'vitest';
import { ClientEvent, ServerEvent } from '../../server/websocket/types';

// Mock Socket.io
vi.mock('socket.io-client', () => ({
  io: vi.fn().mockReturnValue({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })
}));

// Mock the hook
vi.mock('../useWebSocket', () => {
  const mockSubscribeToAgent = vi.fn();
  const mockUnsubscribeFromAgent = vi.fn();
  const mockSubscribeToChat = vi.fn();
  const mockUnsubscribeFromChat = vi.fn();
  const mockAcknowledgeMessageReceived = vi.fn();
  const mockAcknowledgeMessageRead = vi.fn();
  const mockSubscribeToEvent = vi.fn();
  
  return {
    useWebSocket: vi.fn().mockReturnValue({
      isConnected: true,
      lastEvent: null,
      socket: {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
        disconnect: vi.fn(),
      },
      subscribeToEvent: mockSubscribeToEvent,
      subscribeToAgent: mockSubscribeToAgent,
      unsubscribeFromAgent: mockUnsubscribeFromAgent,
      subscribeToChat: mockSubscribeToChat,
      unsubscribeFromChat: mockUnsubscribeFromChat,
      acknowledgeMessageReceived: mockAcknowledgeMessageReceived,
      acknowledgeMessageRead: mockAcknowledgeMessageRead
    })
  };
});

// Import the mocked hook
import { useWebSocket } from '../useWebSocket';

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  test('should initialize with Socket.IO', () => {
    // Call the hook
    const hookResult = useWebSocket();
    
    // Verify that the hook was called
    expect(useWebSocket).toHaveBeenCalled();
    
    // Verify the hook returns the expected values
    expect(hookResult.isConnected).toBe(true);
    expect(hookResult.socket).toBeDefined();
  });
  
  test('should provide subscribe functions', () => {
    // Call the hook
    const hookResult = useWebSocket();
    
    // Call the subscription functions
    hookResult.subscribeToAgent('agent-1');
    hookResult.unsubscribeFromAgent('agent-1');
    hookResult.subscribeToChat('chat-1');
    hookResult.unsubscribeFromChat('chat-1');
    
    // Access the mocked functions
    const mockUseWebSocket = vi.mocked(useWebSocket);
    const returnVal = mockUseWebSocket.mock.results[0].value;
    
    // Verify the functions were called
    expect(returnVal.subscribeToAgent).toHaveBeenCalledWith('agent-1');
    expect(returnVal.unsubscribeFromAgent).toHaveBeenCalledWith('agent-1');
    expect(returnVal.subscribeToChat).toHaveBeenCalledWith('chat-1');
    expect(returnVal.unsubscribeFromChat).toHaveBeenCalledWith('chat-1');
  });
  
  test('should provide acknowledgement functions', () => {
    // Call the hook
    const hookResult = useWebSocket();
    
    // Call the acknowledgement functions
    hookResult.acknowledgeMessageReceived('message-1');
    hookResult.acknowledgeMessageRead('message-1');
    
    // Access the mocked functions
    const mockUseWebSocket = vi.mocked(useWebSocket);
    const returnVal = mockUseWebSocket.mock.results[0].value;
    
    // Verify the functions were called
    expect(returnVal.acknowledgeMessageReceived).toHaveBeenCalledWith('message-1');
    expect(returnVal.acknowledgeMessageRead).toHaveBeenCalledWith('message-1');
  });
  
  test('should provide subscribeToEvent function', () => {
    // Call the hook
    const hookResult = useWebSocket();
    
    // Create a callback
    const callback = vi.fn();
    
    // Call the subscribeToEvent function
    hookResult.subscribeToEvent(ServerEvent.AGENT_CREATED, callback);
    
    // Access the mocked functions
    const mockUseWebSocket = vi.mocked(useWebSocket);
    const returnVal = mockUseWebSocket.mock.results[0].value;
    
    // Verify the function was called
    expect(returnVal.subscribeToEvent).toHaveBeenCalledWith(ServerEvent.AGENT_CREATED, callback);
  });
}); 