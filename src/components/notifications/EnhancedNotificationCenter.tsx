import React, { useState, useEffect } from 'react';
import { NotificationSettingsPanel } from './NotificationSettingsPanel';
import { NotificationHistoryCenter, useNotificationHistory } from './NotificationHistoryCenter';
import { ConnectionStatusIndicator, useConnectionStatus } from './ConnectionStatusIndicator';
import { FileProcessingNotifications, useFileProcessingNotifications } from './FileProcessingNotifications';
import { useNotificationSettings } from '../../hooks/useNotificationSettings';
import { useNotificationToast } from './NotificationToastProvider';

interface EnhancedNotificationCenterProps {
  /** Whether to show the settings panel */
  showSettings?: boolean;
  /** Whether to show the history panel */
  showHistory?: boolean;
  /** Whether to show connection status */
  showConnectionStatus?: boolean;
  /** Whether to show file processing notifications */
  showFileProcessing?: boolean;
  /** Custom CSS classes */
  className?: string;
  /** Callback when panel is closed */
  onClose?: () => void;
}

/**
 * Enhanced notification center that integrates all Phase 3 features
 */
export function EnhancedNotificationCenter({
  showSettings = true,
  showHistory = true,
  showConnectionStatus = true,
  showFileProcessing = true,
  className = '',
  onClose
}: EnhancedNotificationCenterProps) {
  const [activePanel, setActivePanel] = useState<'history' | 'settings' | 'status'>('history');
  const [isMinimized, setIsMinimized] = useState(false);

  // Hooks for all notification features
  const { settings, shouldShowNotification } = useNotificationSettings();
  const { notifications, unreadCount, addNotification, markAsRead } = useNotificationHistory();
  const { status, details, updateStatus } = useConnectionStatus();
  const { processingFiles } = useFileProcessingNotifications();
  const { showToast } = useNotificationToast();

  // Update connection status based on SSE state (would be connected to actual SSE)
  useEffect(() => {
    // Simulate connection status updates
    const interval = setInterval(() => {
      const now = Date.now();
      const latency = Math.floor(Math.random() * 200) + 50; // 50-250ms
      
      updateStatus('connected', { latency });
    }, 5000);

    return () => clearInterval(interval);
  }, [updateStatus]);

  // Handle notification from toast system
  const handleNewNotification = (type: string, title: string, message: string, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal') => {
    // Check if notification should be shown based on settings
    if (shouldShowNotification(type as any, priority)) {
      // Add to history
      const notificationId = addNotification({
        type,
        title,
        message,
        timestamp: new Date(),
        priority
      });

      // Show toast notification
      showToast({
        type: type as any,
        title,
        message,
        priority
      });

      return notificationId;
    }
    return null;
  };

  // Get panel title
  const getPanelTitle = () => {
    switch (activePanel) {
      case 'history':
        return `Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`;
      case 'settings':
        return 'Notification Settings';
      case 'status':
        return 'Connection Status';
      default:
        return 'Notifications';
    }
  };

  // Get panel icon
  const getPanelIcon = () => {
    switch (activePanel) {
      case 'history':
        return '🔔';
      case 'settings':
        return '⚙️';
      case 'status':
        return '🔗';
      default:
        return '🔔';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-xl border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <span className="text-lg">{getPanelIcon()}</span>
          <h2 className="font-semibold text-gray-900">{getPanelTitle()}</h2>
          
          {/* Connection Status */}
          {showConnectionStatus && (
            <ConnectionStatusIndicator
              status={status}
              details={details}
              showText={false}
              className="ml-2"
              onClick={() => setActivePanel('status')}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Panel Navigation */}
          <div className="flex bg-gray-200 rounded-lg p-1">
            {showHistory && (
              <button
                onClick={() => setActivePanel('history')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  activePanel === 'history'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                History
                {unreadCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}
            
            {showSettings && (
              <button
                onClick={() => setActivePanel('settings')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  activePanel === 'settings'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Settings
              </button>
            )}
            
            {showConnectionStatus && (
              <button
                onClick={() => setActivePanel('status')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  activePanel === 'status'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Status
              </button>
            )}
          </div>

          {/* Minimize/Maximize */}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            {isMinimized ? '⬆️' : '⬇️'}
          </button>

          {/* Close */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="max-h-96 overflow-hidden">
          {/* History Panel */}
          {activePanel === 'history' && showHistory && (
            <NotificationHistoryCenter
              className="border-0 shadow-none rounded-none"
              onNotificationClick={(notification) => {
                markAsRead(notification.id);
              }}
            />
          )}

          {/* Settings Panel */}
          {activePanel === 'settings' && showSettings && (
            <NotificationSettingsPanel
              className="border-0 shadow-none rounded-none"
            />
          )}

          {/* Status Panel */}
          {activePanel === 'status' && showConnectionStatus && (
            <div className="p-4">
              <div className="space-y-4">
                {/* Connection Details */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Connection Status</span>
                  <ConnectionStatusIndicator
                    status={status}
                    details={details}
                    showText={true}
                  />
                </div>

                {/* Detailed Information */}
                {details && (
                  <div className="space-y-2 text-sm">
                    {details.lastConnected && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Last Connected:</span>
                        <span>{details.lastConnected.toLocaleString()}</span>
                      </div>
                    )}
                    
                    {details.uptime && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Uptime:</span>
                        <span>{Math.floor(details.uptime / 1000)}s</span>
                      </div>
                    )}
                    
                    {details.latency && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Latency:</span>
                        <span className={details.latency < 100 ? 'text-green-600' : details.latency < 500 ? 'text-yellow-600' : 'text-red-600'}>
                          {details.latency}ms
                        </span>
                      </div>
                    )}
                    
                    {details.totalConnections !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total Connections:</span>
                        <span>{details.totalConnections}</span>
                      </div>
                    )}
                    
                    {details.reconnectAttempts !== undefined && details.reconnectAttempts > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Reconnect Attempts:</span>
                        <span className="text-yellow-600">{details.reconnectAttempts}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Actions */}
                <div className="pt-2 border-t">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Actions</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleNewNotification('TEST', 'Test Notification', 'This is a test notification to verify the system is working.')}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Test Notification
                    </button>
                    <button
                      onClick={() => updateStatus('connecting')}
                      className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    >
                      Simulate Reconnect
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* File Processing Notifications (Always Visible) */}
      {showFileProcessing && processingFiles.length > 0 && (
        <FileProcessingNotifications
          processingFiles={processingFiles}
          className="fixed bottom-4 right-4"
        />
      )}

      {/* Global Status Bar */}
      <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500 flex justify-between items-center">
        <div className="flex items-center gap-4">
          {/* Notification Settings Summary */}
          <span>
            Notifications: {settings.globalEnabled ? 'On' : 'Off'}
          </span>
          
          {settings.doNotDisturb.enabled && (
            <span className="text-red-600">
              DND: {settings.doNotDisturb.enabledUntil 
                ? `Until ${new Date(settings.doNotDisturb.enabledUntil).toLocaleTimeString()}`
                : 'On'
              }
            </span>
          )}
          
          {settings.quietHours.enabled && (
            <span className="text-yellow-600">
              Quiet: {settings.quietHours.startTime}-{settings.quietHours.endTime}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Connection Status */}
          {showConnectionStatus && (
            <ConnectionStatusIndicator
              status={status}
              details={details}
              showText={false}
              showTooltip={false}
              className="scale-75"
            />
          )}
          
          {/* Processing Files Count */}
          {showFileProcessing && processingFiles.length > 0 && (
            <span className="text-blue-600">
              {processingFiles.length} file{processingFiles.length !== 1 ? 's' : ''} processing
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage the enhanced notification center
 */
export function useEnhancedNotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFeatures, setActiveFeatures] = useState({
    settings: true,
    history: true,
    connectionStatus: true,
    fileProcessing: true
  });

  const openCenter = () => setIsOpen(true);
  const closeCenter = () => setIsOpen(false);
  const toggleCenter = () => setIsOpen(prev => !prev);

  const enableFeature = (feature: keyof typeof activeFeatures) => {
    setActiveFeatures(prev => ({ ...prev, [feature]: true }));
  };

  const disableFeature = (feature: keyof typeof activeFeatures) => {
    setActiveFeatures(prev => ({ ...prev, [feature]: false }));
  };

  return {
    isOpen,
    activeFeatures,
    openCenter,
    closeCenter,
    toggleCenter,
    enableFeature,
    disableFeature
  };
} 