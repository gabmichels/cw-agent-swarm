import { useState, useEffect, useCallback, useRef } from 'react';
import { useChatSSE } from './useChatSSE';
import { SSEHealthMonitor } from '../lib/monitoring/SSEHealthMonitor';

/**
 * Connection mode for the chat system
 */
export type ConnectionMode = 'sse' | 'polling' | 'offline';

/**
 * Connection state with detailed status
 */
export interface ConnectionState {
  mode: ConnectionMode;
  status: 'connecting' | 'connected' | 'reconnecting' | 'error' | 'offline';
  lastConnected?: number;
  errorCount: number;
  retryCount: number;
  nextRetryAt?: number;
  latency?: number;
  fallbackReason?: string;
}

/**
 * Fallback configuration
 */
export interface FallbackConfig {
  maxSSERetries: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  pollingIntervalMs: number;
  sseRestoreAttemptIntervalMs: number;
  offlineDetectionTimeoutMs: number;
  healthCheckIntervalMs: number;
}

/**
 * Message with metadata for deduplication and ordering
 */
export interface MessageWithMetadata {
  id: string;
  content: string;
  timestamp: number;
  source: 'sse' | 'polling';
  agentId?: string;
  userId?: string;
}

/**
 * Default fallback configuration
 */
const DEFAULT_CONFIG: FallbackConfig = {
  maxSSERetries: 5,
  retryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  pollingIntervalMs: 5000, // 5 seconds for fallback polling
  sseRestoreAttemptIntervalMs: 60000, // Try to restore SSE every minute
  offlineDetectionTimeoutMs: 10000, // 10 seconds to detect offline
  healthCheckIntervalMs: 30000 // Health check every 30 seconds
};

/**
 * Hook that provides automatic fallback from SSE to polling with intelligent retry logic
 */
export function useChatWithFallback(
  chatId: string,
  config: Partial<FallbackConfig> = {}
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const healthMonitor = SSEHealthMonitor.getInstance();
  
  // State management
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    mode: 'sse',
    status: 'connecting',
    errorCount: 0,
    retryCount: 0
  });
  
  const [messages, setMessages] = useState<MessageWithMetadata[]>([]);
  const [isTyping, setIsTyping] = useState<Record<string, boolean>>({});
  
  // Refs for intervals and timeouts
  const pollingIntervalRef = useRef<NodeJS.Timeout>();
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const sseRestoreTimeoutRef = useRef<NodeJS.Timeout>();
  const healthCheckIntervalRef = useRef<NodeJS.Timeout>();
  const offlineTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Message deduplication
  const seenMessageIds = useRef<Set<string>>(new Set());
  const lastPollingFetch = useRef<number>(0);
  
  /**
   * Add message with deduplication
   */
  const addMessage = useCallback((message: MessageWithMetadata) => {
    if (seenMessageIds.current.has(message.id)) {
      return; // Duplicate message
    }
    
    seenMessageIds.current.add(message.id);
    setMessages(prev => {
      // Insert message in chronological order
      const newMessages = [...prev, message];
      return newMessages.sort((a, b) => a.timestamp - b.timestamp);
    });
    
    // Clean up old message IDs to prevent memory leak
    if (seenMessageIds.current.size > 1000) {
      const oldestMessages = messages.slice(0, 100);
      oldestMessages.forEach(msg => seenMessageIds.current.delete(msg.id));
    }
  }, [messages]);

  // SSE hook (conditionally used)
  const sseHook = useChatSSE(chatId, {
    userId: 'current-user',
    autoReconnect: true,
    maxReconnectAttempts: finalConfig.maxSSERetries,
    reconnectDelay: finalConfig.retryDelayMs
  });

  // Monitor SSE connection state
  useEffect(() => {
    if (connectionState.mode !== 'sse') return;

    const { connectionState: sseConnectionState, messages: sseMessages } = sseHook;

    // Update connection state based on SSE status
    if (sseConnectionState.isConnected) {
      setConnectionState(prev => ({
        ...prev,
        status: 'connected',
        lastConnected: Date.now(),
        errorCount: 0,
        retryCount: 0,
        fallbackReason: undefined
      }));
      healthMonitor.recordReconnection(chatId);
    } else if (sseConnectionState.error) {
      setConnectionState(prev => ({
        ...prev,
        errorCount: prev.errorCount + 1
      }));
      healthMonitor.recordError(chatId, 'connection', sseConnectionState.error);
      handleSSEFailure(new Error(sseConnectionState.error));
    }

    // Add SSE messages
    sseMessages.forEach((message: any) => {
      addMessage({
        id: message.id,
        content: message.content,
        timestamp: message.timestamp.getTime(),
        source: 'sse',
        agentId: message.sender?.id,
        userId: message.sender?.id
      });
      healthMonitor.recordEventDelivery(chatId, 'message');
    });
  }, [sseHook, connectionState.mode, addMessage, chatId, healthMonitor]);

  /**
   * Handle SSE connection failure
   */
  const handleSSEFailure = useCallback((error: Error) => {
    const shouldFallback = connectionState.errorCount >= finalConfig.maxSSERetries;
    
    if (shouldFallback) {
      setConnectionState(prev => ({
        ...prev,
        mode: 'polling',
        status: 'connected',
        fallbackReason: `SSE failed after ${prev.errorCount} attempts: ${error.message}`
      }));
      startPolling();
      scheduleSSERestoreAttempt();
    } else {
      // Retry SSE with exponential backoff
      const delay = Math.min(
        finalConfig.retryDelayMs * Math.pow(2, connectionState.retryCount),
        finalConfig.maxRetryDelayMs
      );
      
      setConnectionState(prev => ({
        ...prev,
        status: 'reconnecting',
        retryCount: prev.retryCount + 1,
        nextRetryAt: Date.now() + delay
      }));
      
      retryTimeoutRef.current = setTimeout(() => {
        setConnectionState(prev => ({
          ...prev,
          status: 'connecting'
        }));
      }, delay);
    }
  }, [connectionState.errorCount, connectionState.retryCount, finalConfig]);

  /**
   * Start polling mode
   */
  const startPolling = useCallback(async () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    const pollMessages = async () => {
      try {
        const since = lastPollingFetch.current || Date.now() - 60000; // Last minute
        const response = await fetch(`/api/multi-agent/chats/${chatId}/messages?since=${since}`);
        
        if (!response.ok) {
          throw new Error(`Polling failed: ${response.status}`);
        }
        
        const data = await response.json();
        lastPollingFetch.current = Date.now();
        
        // Add messages from polling
        data.messages?.forEach((message: any) => {
          addMessage({
            id: message.id,
            content: message.content,
            timestamp: message.timestamp,
            source: 'polling',
            agentId: message.agentId,
            userId: message.userId
          });
        });
        
        // Update connection state
        setConnectionState(prev => ({
          ...prev,
          status: 'connected',
          lastConnected: Date.now(),
          errorCount: 0
        }));
        
      } catch (error) {
        console.error('Polling error:', error);
        setConnectionState(prev => ({
          ...prev,
          errorCount: prev.errorCount + 1
        }));
        
        healthMonitor.recordError(chatId, 'network', (error as Error).message);
        
        // Check if we should go offline
        if (connectionState.errorCount >= 3) {
          handleOfflineMode();
        }
      }
    };
    
    // Initial poll
    await pollMessages();
    
    // Set up polling interval
    pollingIntervalRef.current = setInterval(pollMessages, finalConfig.pollingIntervalMs);
  }, [chatId, addMessage, connectionState.errorCount, finalConfig.pollingIntervalMs]);

  /**
   * Handle offline mode
   */
  const handleOfflineMode = useCallback(() => {
    setConnectionState(prev => ({
      ...prev,
      mode: 'offline',
      status: 'offline',
      fallbackReason: 'Network appears to be offline'
    }));
    
    // Clear all intervals
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    if (sseRestoreTimeoutRef.current) {
      clearTimeout(sseRestoreTimeoutRef.current);
    }
    
    // Set up offline detection
    offlineTimeoutRef.current = setTimeout(() => {
      checkOnlineStatus();
    }, finalConfig.offlineDetectionTimeoutMs);
  }, [finalConfig.offlineDetectionTimeoutMs]);

  /**
   * Check if we're back online
   */
  const checkOnlineStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        // We're back online, attempt to restore SSE
        setConnectionState(prev => ({
          ...prev,
          mode: 'sse',
          status: 'connecting',
          errorCount: 0,
          retryCount: 0,
          fallbackReason: undefined
        }));
      } else {
        // Still offline, check again later
        offlineTimeoutRef.current = setTimeout(
          checkOnlineStatus, 
          finalConfig.offlineDetectionTimeoutMs
        );
      }
    } catch (error) {
      // Still offline
      offlineTimeoutRef.current = setTimeout(
        checkOnlineStatus, 
        finalConfig.offlineDetectionTimeoutMs
      );
    }
  }, [finalConfig.offlineDetectionTimeoutMs]);

  /**
   * Schedule an attempt to restore SSE from polling mode
   */
  const scheduleSSERestoreAttempt = useCallback(() => {
    sseRestoreTimeoutRef.current = setTimeout(() => {
      // Only attempt restore if we're still in polling mode
      if (connectionState.mode === 'polling') {
        setConnectionState(prev => ({
          ...prev,
          mode: 'sse',
          status: 'connecting',
          errorCount: 0,
          retryCount: 0
        }));
        
        // Stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      }
    }, finalConfig.sseRestoreAttemptIntervalMs);
  }, [connectionState.mode, finalConfig.sseRestoreAttemptIntervalMs]);

  /**
   * Send a message
   */
  const sendMessage = useCallback(async (content: string, agentId?: string) => {
    try {
      const response = await fetch(`/api/multi-agent/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          agentId,
          timestamp: Date.now()
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }

      const message = await response.json();
      
      // In polling mode, the message will be picked up by the next poll
      // In SSE mode, it will come through the SSE connection
      return message;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }, [chatId]);

  /**
   * Send typing indicator
   */
  const sendTyping = useCallback(async (isTyping: boolean, agentId?: string) => {
    try {
      await fetch(`/api/multi-agent/chats/${chatId}/typing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isTyping,
          agentId,
          timestamp: Date.now()
        }),
      });
    } catch (error) {
      console.error('Failed to send typing indicator:', error);
    }
  }, [chatId]);

  /**
   * Manually trigger connection mode change
   */
  const switchMode = useCallback((mode: ConnectionMode) => {
    if (mode === connectionState.mode) return;
    
    // Clear existing intervals/timeouts
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (sseRestoreTimeoutRef.current) clearTimeout(sseRestoreTimeoutRef.current);
    if (offlineTimeoutRef.current) clearTimeout(offlineTimeoutRef.current);
    
    setConnectionState(prev => ({
      ...prev,
      mode,
      status: mode === 'offline' ? 'offline' : 'connecting',
      errorCount: 0,
      retryCount: 0,
      fallbackReason: mode !== 'sse' ? `Manually switched to ${mode}` : undefined
    }));
    
    if (mode === 'polling') {
      startPolling();
    }
  }, [connectionState.mode, startPolling]);

  /**
   * Get connection health metrics
   */
  const getHealthMetrics = useCallback(() => {
    return healthMonitor.getConnectionDetails(chatId);
  }, [chatId]);

  // Set up health monitoring
  useEffect(() => {
    healthCheckIntervalRef.current = setInterval(() => {
      const health = healthMonitor.performHealthCheck();
      
      // If system is unhealthy and we're on SSE, consider fallback
      if (health.status === 'unhealthy' && connectionState.mode === 'sse') {
        setConnectionState(prev => ({
          ...prev,
          mode: 'polling',
          fallbackReason: 'System health check failed'
        }));
        startPolling();
      }
    }, finalConfig.healthCheckIntervalMs);
    
    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [connectionState.mode, startPolling, finalConfig.healthCheckIntervalMs]);

  // Browser online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      if (connectionState.mode === 'offline') {
        setConnectionState(prev => ({
          ...prev,
          mode: 'sse',
          status: 'connecting',
          errorCount: 0,
          retryCount: 0,
          fallbackReason: undefined
        }));
      }
    };

    const handleOffline = () => {
      handleOfflineMode();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connectionState.mode, handleOfflineMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (sseRestoreTimeoutRef.current) clearTimeout(sseRestoreTimeoutRef.current);
      if (healthCheckIntervalRef.current) clearInterval(healthCheckIntervalRef.current);
      if (offlineTimeoutRef.current) clearTimeout(offlineTimeoutRef.current);
    };
  }, []);

  return {
    // Connection state
    connectionState,
    
    // Data
    messages,
    isTyping,
    
    // Actions
    sendMessage,
    sendTyping,
    switchMode,
    
    // Utilities
    getHealthMetrics,
    
    // Legacy compatibility
    isConnected: connectionState.status === 'connected',
    connectionStatus: connectionState.status
  };
} 