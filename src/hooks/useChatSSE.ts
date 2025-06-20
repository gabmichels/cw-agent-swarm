import { useState, useEffect, useCallback, useRef } from 'react';
import { SSEEvent, NewMessageEvent, TypingEvent, ChatEventType } from '../lib/events/ChatEventEmitter';
import { useNotificationToast, NotificationType } from '../components/notifications/NotificationToastProvider';

// Types for the hook
interface Message {
  readonly id: string;
  readonly content: string;
  readonly sender: {
    readonly id: string;
    readonly name: string;
    readonly role: 'user' | 'assistant' | 'system';
    readonly avatar?: string;
  };
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

interface ConnectionState {
  readonly isConnected: boolean;
  readonly isReconnecting: boolean;
  readonly lastConnected: Date | null;
  readonly connectionAttempts: number;
  readonly error: string | null;
}

interface TypingState {
  readonly isTyping: boolean;
  readonly typingUsers: readonly string[];
}

interface UseChatSSEOptions {
  readonly userId?: string;
  readonly autoReconnect?: boolean;
  readonly maxReconnectAttempts?: number;
  readonly reconnectDelay?: number;
}

interface UseChatSSEReturn {
  // Data
  readonly messages: readonly Message[];
  readonly typingState: TypingState;
  readonly connectionState: ConnectionState;
  
  // Actions
  readonly addMessage: (message: Message) => void;
  readonly clearMessages: () => void;
  readonly startTyping: () => void;
  readonly stopTyping: () => void;
  readonly reconnect: () => void;
  readonly disconnect: () => void;
}

/**
 * React hook for SSE-based chat functionality
 * Provides real-time message updates and typing indicators
 */
export const useChatSSE = (
  chatId: string,
  options: UseChatSSEOptions = {}
): UseChatSSEReturn => {
  const {
    userId = 'current-user',
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 1000
  } = options;

  // Get notification toast functionality
  const { showToast } = useNotificationToast();

  // State management
  const [messages, setMessages] = useState<readonly Message[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isReconnecting: false,
    lastConnected: null,
    connectionAttempts: 0,
    error: null
  });
  const [typingState, setTypingState] = useState<TypingState>({
    isTyping: false,
    typingUsers: []
  });

  // Refs for cleanup and state management
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Pure function to create EventSource URL
   */
  const createSSEUrl = useCallback((chatId: string): string => {
    return `/api/chat/${chatId}/stream`;
  }, []);

  /**
   * Pure function to handle SSE events
   */
  const handleSSEEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case ChatEventType.NEW_MESSAGE:
        const messageEvent = event as NewMessageEvent;
        setMessages(prev => [...prev, messageEvent.message]);
        
        // Show notification for agent messages (not user messages)
        if (messageEvent.message.sender.role === 'assistant' && messageEvent.message.sender.id !== userId) {
          showToast({
            type: NotificationType.AGENT_MESSAGE,
            title: messageEvent.message.sender.name || 'Agent',
            message: messageEvent.message.content.substring(0, 100) + (messageEvent.message.content.length > 100 ? '...' : ''),
            avatar: messageEvent.message.sender.avatar,
            action: {
              label: 'View Message',
              onClick: () => {
                // Focus the chat window
                window.focus();
                // Scroll to the message if needed
                const messageElement = document.getElementById(`message-${messageEvent.message.id}`);
                if (messageElement) {
                  messageElement.scrollIntoView({ behavior: 'smooth' });
                }
              }
            },
            sound: true,
            priority: 'normal'
          });
        }
        break;

      case ChatEventType.TYPING_START:
        const typingStartEvent = event as TypingEvent;
        if (typingStartEvent.userId !== userId) {
          setTypingState(prev => ({
            isTyping: true,
            typingUsers: [...prev.typingUsers.filter(u => u !== typingStartEvent.userName), typingStartEvent.userName]
          }));
        }
        break;

      case ChatEventType.TYPING_STOP:
        const typingStopEvent = event as TypingEvent;
        if (typingStopEvent.userId !== userId) {
          setTypingState(prev => ({
            isTyping: prev.typingUsers.length > 1,
            typingUsers: prev.typingUsers.filter(u => u !== typingStopEvent.userName)
          }));
        }
        break;

      case ChatEventType.SYSTEM_NOTIFICATION:
        // Handle system notifications (could show toast notifications)
        console.log('System notification:', event);
        break;

      default:
        console.log('Unhandled SSE event:', event);
    }
  }, [userId, showToast]);

  /**
   * Connect to SSE stream
   */
  const connect = useCallback(() => {
    if (!chatId) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionState(prev => ({
      ...prev,
      isReconnecting: true,
      error: null
    }));

    try {
      const url = createSSEUrl(chatId);
      const eventSource = new EventSource(url, {
        withCredentials: true,
      });

      // Set headers for user identification
      // Note: EventSource doesn't support custom headers, so we'll need to pass via URL params
      const urlWithParams = `${url}?userId=${encodeURIComponent(userId)}`;
      const eventSourceWithParams = new EventSource(urlWithParams);

      eventSourceRef.current = eventSourceWithParams;

      eventSourceWithParams.onopen = () => {
        console.log('SSE connection opened for chat:', chatId);
        setConnectionState(prev => ({
          isConnected: true,
          isReconnecting: false,
          lastConnected: new Date(),
          connectionAttempts: 0,
          error: null
        }));
      };

      eventSourceWithParams.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as SSEEvent;
          handleSSEEvent(data);
        } catch (error) {
          console.error('Error parsing SSE event:', error);
        }
      };

      eventSourceWithParams.onerror = (error) => {
        console.error('SSE connection error:', error);
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
          isReconnecting: autoReconnect && prev.connectionAttempts < maxReconnectAttempts,
          connectionAttempts: prev.connectionAttempts + 1,
          error: 'Connection failed'
        }));

        // Auto-reconnect logic
        if (autoReconnect && connectionState.connectionAttempts < maxReconnectAttempts) {
          const delay = reconnectDelay * Math.pow(2, connectionState.connectionAttempts); // Exponential backoff
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        isReconnecting: false,
        error: 'Failed to connect'
      }));
    }
  }, [chatId, userId, createSSEUrl, handleSSEEvent, autoReconnect, maxReconnectAttempts, reconnectDelay, connectionState.connectionAttempts]);

  /**
   * Disconnect from SSE stream
   */
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionState(prev => ({
      ...prev,
      isConnected: false,
      isReconnecting: false
    }));
  }, []);

  /**
   * Manually reconnect
   */
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(connect, 100); // Small delay to ensure cleanup
  }, [disconnect, connect]);

  /**
   * Add message to local state (for optimistic updates)
   */
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  /**
   * Start typing indicator
   */
  const startTyping = useCallback(() => {
    // This would typically send an API call to emit typing event
    // For now, just update local state
    setTypingState(prev => ({
      ...prev,
      isTyping: true
    }));

    // Auto-stop typing after 3 seconds
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, []);

  /**
   * Stop typing indicator
   */
  const stopTyping = useCallback(() => {
    setTypingState(prev => ({
      ...prev,
      isTyping: false
    }));

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  // Connect on mount and chatId change
  useEffect(() => {
    if (chatId) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [chatId, connect, disconnect]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    messages,
    typingState,
    connectionState,
    addMessage,
    clearMessages,
    startTyping,
    stopTyping,
    reconnect,
    disconnect
  };
}; 