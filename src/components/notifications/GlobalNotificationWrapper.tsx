import React from 'react';
import { NotificationToastProvider } from './NotificationToastProvider';
import { useMultiChannelSSE } from '../../hooks/useMultiChannelSSE';

interface GlobalNotificationWrapperProps {
  readonly children: React.ReactNode;
  readonly userId: string;
  readonly enableSounds?: boolean;
  readonly enableBrowserNotifications?: boolean;
  readonly maxToasts?: number;
  readonly enableTaskNotifications?: boolean;
  readonly enableAgentStatusNotifications?: boolean;
  readonly enableSystemNotifications?: boolean;
  readonly enableFileNotifications?: boolean;
}

/**
 * Global notification wrapper that provides toast notifications and multi-channel SSE
 * Use this component to wrap pages that need global notification functionality
 */
export const GlobalNotificationWrapper: React.FC<GlobalNotificationWrapperProps> = ({
  children,
  userId,
  enableSounds = true,
  enableBrowserNotifications = true,
  maxToasts = 5,
  enableTaskNotifications = true,
  enableAgentStatusNotifications = true,
  enableSystemNotifications = true,
  enableFileNotifications = true
}) => {
  return (
    <NotificationToastProvider
      enableSounds={enableSounds}
      enableBrowserNotifications={enableBrowserNotifications}
      maxToasts={maxToasts}
    >
      <NotificationSSEHandler
        userId={userId}
        enableTaskNotifications={enableTaskNotifications}
        enableAgentStatusNotifications={enableAgentStatusNotifications}
        enableSystemNotifications={enableSystemNotifications}
        enableFileNotifications={enableFileNotifications}
      />
      {children}
    </NotificationToastProvider>
  );
};

/**
 * Internal component that handles SSE connection for notifications
 * Separated to ensure it runs inside the NotificationToastProvider context
 */
interface NotificationSSEHandlerProps {
  readonly userId: string;
  readonly enableTaskNotifications: boolean;
  readonly enableAgentStatusNotifications: boolean;
  readonly enableSystemNotifications: boolean;
  readonly enableFileNotifications: boolean;
}

const NotificationSSEHandler: React.FC<NotificationSSEHandlerProps> = ({
  userId,
  enableTaskNotifications,
  enableAgentStatusNotifications,
  enableSystemNotifications,
  enableFileNotifications
}) => {
  // Initialize multi-channel SSE for global notifications
  const notificationSSE = useMultiChannelSSE(userId, {
    enableTaskNotifications,
    enableAgentStatusNotifications,
    enableSystemNotifications,
    enableFileNotifications,
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000
  });

  // This component doesn't render anything visible
  // It just manages the SSE connection for notifications
  return null;
}; 