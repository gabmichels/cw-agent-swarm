import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  SSEEvent, 
  TaskCompletedEvent, 
  AgentStatusChangedEvent, 
  SystemNotificationEvent, 
  FileProcessedEvent,
  ChatEventType 
} from '../lib/events/ChatEventEmitter';
import { 
  useNotificationToast, 
  NotificationType 
} from '../components/notifications/NotificationToastProvider';

// Connection state interface
interface MultiChannelConnectionState {
  readonly isConnected: boolean;
  readonly isReconnecting: boolean;
  readonly lastConnected: Date | null;
  readonly connectionAttempts: number;
  readonly error: string | null;
}

// Hook options interface
interface UseMultiChannelSSEOptions {
  readonly autoReconnect?: boolean;
  readonly maxReconnectAttempts?: number;
  readonly reconnectDelay?: number;
  readonly enableTaskNotifications?: boolean;
  readonly enableAgentStatusNotifications?: boolean;
  readonly enableSystemNotifications?: boolean;
  readonly enableFileNotifications?: boolean;
}

// Hook return interface
interface UseMultiChannelSSEReturn {
  readonly connectionState: MultiChannelConnectionState;
  readonly reconnect: () => void;
  readonly disconnect: () => void;
}

/**
 * React hook for multi-channel SSE notifications
 * Handles user-specific notifications from various sources
 */
export const useMultiChannelSSE = (
  userId: string,
  options: UseMultiChannelSSEOptions = {}
): UseMultiChannelSSEReturn => {
  const {
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 1000,
    enableTaskNotifications = true,
    enableAgentStatusNotifications = true,
    enableSystemNotifications = true,
    enableFileNotifications = true
  } = options;

  // Dependencies
  const router = useRouter();
  const { showToast } = useNotificationToast();

  // State management
  const [connectionState, setConnectionState] = useState<MultiChannelConnectionState>({
    isConnected: false,
    isReconnecting: false,
    lastConnected: null,
    connectionAttempts: 0,
    error: null
  });

  // Refs for cleanup and state management
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Pure function to create SSE URL for user notifications
   */
  const createNotificationSSEUrl = useCallback((userId: string): string => {
    return `/api/notifications/${userId}/stream`;
  }, []);

  /**
   * Pure function to handle task completion events
   */
  const handleTaskCompleted = useCallback((event: TaskCompletedEvent) => {
    if (!enableTaskNotifications) return;

    const isSuccess = event.task.status === 'completed';
    const notificationType = isSuccess ? NotificationType.TASK_COMPLETE : NotificationType.ERROR;

    showToast({
      type: notificationType,
      title: isSuccess ? 'Task Completed' : 'Task Failed',
      message: isSuccess 
        ? `${event.task.name} finished successfully`
        : `${event.task.name} failed: ${event.task.error || 'Unknown error'}`,
      action: {
        label: 'View Results',
        onClick: () => router.push(`/tasks/${event.task.id}`)
      },
      sound: true,
      priority: isSuccess ? 'normal' : 'high'
    });
  }, [enableTaskNotifications, showToast, router]);

  /**
   * Pure function to handle agent status change events
   */
  const handleAgentStatusChanged = useCallback((event: AgentStatusChangedEvent) => {
    if (!enableAgentStatusNotifications) return;

    // Only show notifications for agents coming online
    if (event.agent.status === 'online') {
      showToast({
        type: NotificationType.AGENT_STATUS,
        title: 'Agent Online',
        message: `${event.agent.name} is now available`,
        avatar: event.agent.avatar,
        duration: 3000,
        sound: false, // Less intrusive for status changes
        priority: 'low'
      });
    }
  }, [enableAgentStatusNotifications, showToast]);

  /**
   * Pure function to handle system notification events
   */
  const handleSystemNotification = useCallback((event: SystemNotificationEvent) => {
    if (!enableSystemNotifications) return;

    const notificationTypeMap: Record<string, NotificationType> = {
      'info': NotificationType.INFO,
      'warning': NotificationType.WARNING,
      'error': NotificationType.ERROR,
      'success': NotificationType.SUCCESS
    };

    const notificationType = notificationTypeMap[event.notification.level] || NotificationType.SYSTEM_ALERT;

    showToast({
      type: notificationType,
      title: event.notification.title,
      message: event.notification.message,
      action: event.notification.action ? {
        label: event.notification.action.label,
        onClick: () => router.push(event.notification.action!.url)
      } : undefined,
      sound: event.notification.level === 'error' || event.notification.level === 'warning',
      priority: event.notification.level === 'error' ? 'high' : 'normal',
      duration: event.notification.level === 'error' ? 10000 : undefined
    });
  }, [enableSystemNotifications, showToast, router]);

  /**
   * Pure function to handle file processing events
   */
  const handleFileProcessed = useCallback((event: FileProcessedEvent) => {
    if (!enableFileNotifications) return;

    const isSuccess = event.file.status === 'processed';
    const notificationType = isSuccess ? NotificationType.FILE_PROCESSED : NotificationType.ERROR;

    showToast({
      type: notificationType,
      title: isSuccess ? 'File Processed' : 'File Processing Failed',
      message: isSuccess
        ? `${event.file.name} has been processed successfully`
        : `Failed to process ${event.file.name}: ${event.file.error || 'Unknown error'}`,
      action: isSuccess && event.file.url ? {
        label: 'View File',
        onClick: () => window.open(event.file.url, '_blank')
      } : undefined,
      sound: true,
      priority: isSuccess ? 'normal' : 'high'
    });
  }, [enableFileNotifications, showToast]);

  /**
   * Pure function to handle SSE events
   */
  const handleSSEEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case ChatEventType.TASK_COMPLETED:
        handleTaskCompleted(event as TaskCompletedEvent);
        break;

      case ChatEventType.AGENT_STATUS_CHANGED:
        handleAgentStatusChanged(event as AgentStatusChangedEvent);
        break;

      case ChatEventType.SYSTEM_NOTIFICATION:
        handleSystemNotification(event as SystemNotificationEvent);
        break;

      case ChatEventType.FILE_PROCESSED:
        handleFileProcessed(event as FileProcessedEvent);
        break;

      default:
        console.log('Unhandled multi-channel SSE event:', event);
    }
  }, [handleTaskCompleted, handleAgentStatusChanged, handleSystemNotification, handleFileProcessed]);

  /**
   * Connect to multi-channel SSE stream
   */
  const connect = useCallback(() => {
    if (!userId) return;

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
      const url = createNotificationSSEUrl(userId);
      const eventSource = new EventSource(url, {
        withCredentials: true,
      });

      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('Multi-channel SSE connection opened for user:', userId);
        setConnectionState({
          isConnected: true,
          isReconnecting: false,
          lastConnected: new Date(),
          connectionAttempts: 0,
          error: null
        });
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as SSEEvent;
          handleSSEEvent(data);
        } catch (error) {
          console.error('Error parsing multi-channel SSE event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Multi-channel SSE connection error:', error);
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
      console.error('Failed to create multi-channel SSE connection:', error);
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        isReconnecting: false,
        error: 'Failed to connect'
      }));
    }
  }, [
    userId, 
    createNotificationSSEUrl, 
    handleSSEEvent, 
    autoReconnect, 
    maxReconnectAttempts, 
    reconnectDelay, 
    connectionState.connectionAttempts
  ]);

  /**
   * Disconnect from multi-channel SSE stream
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

  // Connect on mount and userId change
  useEffect(() => {
    if (userId) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [userId, connect, disconnect]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    connectionState,
    reconnect,
    disconnect
  };
}; 