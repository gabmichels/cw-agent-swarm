import React, { useState, useEffect } from 'react';

/**
 * Connection status types
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

/**
 * Connection details for tooltip display
 */
export interface ConnectionDetails {
  status: ConnectionStatus;
  lastConnected?: Date;
  reconnectAttempts?: number;
  latency?: number;
  totalConnections?: number;
  uptime?: number;
  errorMessage?: string;
}

interface ConnectionStatusIndicatorProps {
  /** Current connection status */
  status: ConnectionStatus;
  /** Detailed connection information */
  details?: ConnectionDetails;
  /** Whether to show the status text */
  showText?: boolean;
  /** Whether to show detailed tooltip */
  showTooltip?: boolean;
  /** Custom CSS classes */
  className?: string;
  /** Click handler for status indicator */
  onClick?: () => void;
}

/**
 * Real-time connection status indicator component
 */
export function ConnectionStatusIndicator({
  status,
  details,
  showText = true,
  showTooltip = true,
  className = '',
  onClick
}: ConnectionStatusIndicatorProps) {
  const [showTooltipState, setShowTooltipState] = useState(false);
  const [animationClass, setAnimationClass] = useState('');

  // Update animation when status changes
  useEffect(() => {
    setAnimationClass('animate-pulse');
    const timer = setTimeout(() => setAnimationClass(''), 1000);
    return () => clearTimeout(timer);
  }, [status]);

  // Get status configuration
  const getStatusConfig = (status: ConnectionStatus) => {
    const configs = {
      connected: {
        color: 'bg-green-500',
        textColor: 'text-green-700',
        icon: '🟢',
        text: 'Connected',
        description: 'Real-time connection active'
      },
      connecting: {
        color: 'bg-yellow-500',
        textColor: 'text-yellow-700',
        icon: '🟡',
        text: 'Connecting',
        description: 'Establishing connection...'
      },
      disconnected: {
        color: 'bg-gray-500',
        textColor: 'text-gray-700',
        icon: '⚪',
        text: 'Disconnected',
        description: 'No active connection'
      },
      error: {
        color: 'bg-red-500',
        textColor: 'text-red-700',
        icon: '🔴',
        text: 'Error',
        description: 'Connection error occurred'
      }
    };
    return configs[status];
  };

  const config = getStatusConfig(status);

  // Format uptime for display
  const formatUptime = (uptime?: number): string => {
    if (!uptime) return 'Unknown';
    
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Format latency for display
  const formatLatency = (latency?: number): string => {
    if (!latency) return 'Unknown';
    return `${latency}ms`;
  };

  // Format last connected time
  const formatLastConnected = (lastConnected?: Date): string => {
    if (!lastConnected) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - lastConnected.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      {/* Status Indicator */}
      <div
        className={`relative ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
        onMouseEnter={() => showTooltip && setShowTooltipState(true)}
        onMouseLeave={() => setShowTooltipState(false)}
      >
        {/* Colored dot indicator */}
        <div
          className={`w-3 h-3 rounded-full ${config.color} ${animationClass} ${
            status === 'connecting' ? 'animate-pulse' : ''
          }`}
        />
        
        {/* Pulse animation for active connection */}
        {status === 'connected' && (
          <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping opacity-20" />
        )}
      </div>

      {/* Status Text */}
      {showText && (
        <span className={`text-sm font-medium ${config.textColor}`}>
          {config.text}
        </span>
      )}

      {/* Tooltip */}
      {showTooltip && showTooltipState && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
          <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg min-w-64">
            {/* Arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
            
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{config.icon}</span>
              <span className="font-semibold">{config.text}</span>
            </div>
            
            {/* Description */}
            <p className="text-gray-300 mb-3">{config.description}</p>
            
            {/* Connection Details */}
            {details && (
              <div className="space-y-1 text-xs">
                {/* Last Connected */}
                {details.lastConnected && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Last Connected:</span>
                    <span>{formatLastConnected(details.lastConnected)}</span>
                  </div>
                )}
                
                {/* Uptime */}
                {details.uptime && status === 'connected' && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Uptime:</span>
                    <span>{formatUptime(details.uptime)}</span>
                  </div>
                )}
                
                {/* Latency */}
                {details.latency && status === 'connected' && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Latency:</span>
                    <span className={details.latency < 100 ? 'text-green-400' : details.latency < 500 ? 'text-yellow-400' : 'text-red-400'}>
                      {formatLatency(details.latency)}
                    </span>
                  </div>
                )}
                
                {/* Reconnect Attempts */}
                {details.reconnectAttempts !== undefined && details.reconnectAttempts > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Reconnect Attempts:</span>
                    <span className="text-yellow-400">{details.reconnectAttempts}</span>
                  </div>
                )}
                
                {/* Total Connections */}
                {details.totalConnections !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Connections:</span>
                    <span>{details.totalConnections}</span>
                  </div>
                )}
                
                {/* Error Message */}
                {details.errorMessage && status === 'error' && (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <span className="text-gray-400">Error:</span>
                    <p className="text-red-400 mt-1 break-words">{details.errorMessage}</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Actions */}
            {onClick && (
              <div className="mt-3 pt-2 border-t border-gray-700">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                    setShowTooltipState(false);
                  }}
                  className="text-blue-400 hover:text-blue-300 text-xs"
                >
                  Click for details →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to manage connection status with automatic updates
 */
export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [details, setDetails] = useState<ConnectionDetails>({
    status: 'disconnected',
    totalConnections: 0,
    reconnectAttempts: 0
  });
  const [startTime, setStartTime] = useState<number | null>(null);

  // Update connection status
  const updateStatus = (newStatus: ConnectionStatus, additionalDetails?: Partial<ConnectionDetails>) => {
    setStatus(newStatus);
    
    const now = new Date();
    const currentTime = now.getTime();
    
    setDetails(prev => {
      const updated: ConnectionDetails = {
        ...prev,
        status: newStatus,
        ...additionalDetails
      };
      
      // Handle status-specific updates
      switch (newStatus) {
        case 'connected':
          if (prev.status !== 'connected') {
            updated.lastConnected = now;
            updated.totalConnections = (prev.totalConnections || 0) + 1;
            updated.reconnectAttempts = 0;
            setStartTime(currentTime);
          }
          // Update uptime if connected
          if (startTime) {
            updated.uptime = currentTime - startTime;
          }
          break;
          
        case 'connecting':
          // Don't reset uptime when reconnecting
          break;
          
        case 'disconnected':
        case 'error':
          setStartTime(null);
          updated.uptime = undefined;
          if (newStatus === 'error') {
            updated.reconnectAttempts = (prev.reconnectAttempts || 0) + 1;
          }
          break;
      }
      
      return updated;
    });
  };

  // Update uptime periodically when connected
  useEffect(() => {
    if (status === 'connected' && startTime) {
      const interval = setInterval(() => {
        setDetails(prev => ({
          ...prev,
          uptime: Date.now() - startTime
        }));
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [status, startTime]);

  return {
    status,
    details,
    updateStatus
  };
} 