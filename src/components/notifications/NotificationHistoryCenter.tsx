import React, { useState, useEffect, useMemo } from 'react';
import { ulid } from 'ulid';

/**
 * Historical notification item
 */
export interface HistoricalNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, unknown>;
  actions?: Array<{
    label: string;
    action: () => void;
    primary?: boolean;
  }>;
}

/**
 * Filter options for notification history
 */
export interface NotificationFilter {
  types?: string[];
  priorities?: Array<'low' | 'normal' | 'high' | 'urgent'>;
  readStatus?: 'all' | 'read' | 'unread';
  timeRange?: 'today' | 'week' | 'month' | 'all';
}

interface NotificationHistoryCenterProps {
  /** Maximum number of notifications to store */
  maxNotifications?: number;
  /** Whether to show the clear all button */
  showClearAll?: boolean;
  /** Custom CSS classes */
  className?: string;
  /** Callback when notification is clicked */
  onNotificationClick?: (notification: HistoricalNotification) => void;
  /** Callback when notification is marked as read */
  onMarkAsRead?: (notificationId: string) => void;
  /** Callback when all notifications are cleared */
  onClearAll?: () => void;
}

/**
 * Notification history center component
 */
export function NotificationHistoryCenter({
  maxNotifications = 100,
  showClearAll = true,
  className = '',
  onNotificationClick,
  onMarkAsRead,
  onClearAll
}: NotificationHistoryCenterProps) {
  const [notifications, setNotifications] = useState<HistoricalNotification[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>({ readStatus: 'all', timeRange: 'all' });
  const [searchQuery, setSearchQuery] = useState('');

  // Load notifications from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('notification-history');
      if (stored) {
        const parsed = JSON.parse(stored) as HistoricalNotification[];
        // Convert timestamp strings back to Date objects
        const withDates = parsed.map(notif => ({
          ...notif,
          timestamp: new Date(notif.timestamp)
        }));
        setNotifications(withDates);
      }
    } catch (error) {
      console.warn('Failed to load notification history:', error);
    }
  }, []);

  // Save notifications to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('notification-history', JSON.stringify(notifications));
    } catch (error) {
      console.warn('Failed to save notification history:', error);
    }
  }, [notifications]);

  // Add a new notification to history
  const addNotification = (notification: Omit<HistoricalNotification, 'id' | 'read'>) => {
    const newNotification: HistoricalNotification = {
      ...notification,
      id: ulid(),
      read: false
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      // Limit the number of stored notifications
      return updated.slice(0, maxNotifications);
    });

    return newNotification.id;
  };

  // Mark notification as read
  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
    onMarkAsRead?.(notificationId);
  };

  // Mark all notifications as read
  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  // Clear all notifications
  const clearAll = () => {
    setNotifications([]);
    onClearAll?.();
  };

  // Filter notifications based on current filter settings
  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // Filter by read status
    if (filter.readStatus === 'read') {
      filtered = filtered.filter(notif => notif.read);
    } else if (filter.readStatus === 'unread') {
      filtered = filtered.filter(notif => !notif.read);
    }

    // Filter by type
    if (filter.types && filter.types.length > 0) {
      filtered = filtered.filter(notif => filter.types!.includes(notif.type));
    }

    // Filter by priority
    if (filter.priorities && filter.priorities.length > 0) {
      filtered = filtered.filter(notif => filter.priorities!.includes(notif.priority));
    }

    // Filter by time range
    if (filter.timeRange && filter.timeRange !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      
      switch (filter.timeRange) {
        case 'today':
          cutoff.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoff.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoff.setMonth(now.getMonth() - 1);
          break;
      }
      
      filtered = filtered.filter(notif => notif.timestamp >= cutoff);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(notif =>
        notif.title.toLowerCase().includes(query) ||
        notif.message.toLowerCase().includes(query) ||
        notif.type.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [notifications, filter, searchQuery]);

  // Get unread count
  const unreadCount = notifications.filter(notif => !notif.read).length;

  // Get priority icon
  const getPriorityIcon = (priority: string): string => {
    const icons = {
      low: '🔵',
      normal: '🟡',
      high: '🟠',
      urgent: '🔴'
    };
    return icons[priority as keyof typeof icons] || '⚪';
  };

  // Get priority color
  const getPriorityColor = (priority: string): string => {
    const colors = {
      low: 'text-blue-500',
      normal: 'text-yellow-500',
      high: 'text-orange-500',
      urgent: 'text-red-500'
    };
    return colors[priority as keyof typeof colors] || 'text-gray-500';
  };

  // Format relative time
  const formatRelativeTime = (timestamp: Date): string => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  // Get unique notification types for filter
  const availableTypes = useMemo(() => {
    const types = new Set(notifications.map(notif => notif.type));
    return Array.from(types).sort();
  }, [notifications]);

  return (
    <div className={`bg-white rounded-lg shadow-lg border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
          {unreadCount > 0 && (
            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
              {unreadCount} unread
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Mark all read
            </button>
          )}
          {showClearAll && notifications.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear all notifications?')) {
                  clearAll();
                }
              }}
              className="px-3 py-1 text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-4 border-b space-y-3">
        {/* Search */}
        <input
          type="text"
          placeholder="Search notifications..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Read Status Filter */}
          <select
            value={filter.readStatus || 'all'}
            onChange={(e) => setFilter(prev => ({ ...prev, readStatus: e.target.value as any }))}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>

          {/* Time Range Filter */}
          <select
            value={filter.timeRange || 'all'}
            onChange={(e) => setFilter(prev => ({ ...prev, timeRange: e.target.value as any }))}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>

          {/* Type Filter */}
          {availableTypes.length > 1 && (
            <select
              value={filter.types?.[0] || ''}
              onChange={(e) => setFilter(prev => ({ 
                ...prev, 
                types: e.target.value ? [e.target.value] : undefined 
              }))}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All types</option>
              {availableTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Notification List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredNotifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {notifications.length === 0 ? (
              <div>
                <div className="text-4xl mb-2">🔔</div>
                <p>No notifications yet</p>
              </div>
            ) : (
              <div>
                <div className="text-4xl mb-2">🔍</div>
                <p>No notifications match your filters</p>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  !notification.read ? 'bg-blue-50' : ''
                }`}
                onClick={() => {
                  if (!notification.read) {
                    markAsRead(notification.id);
                  }
                  onNotificationClick?.(notification);
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Priority Indicator */}
                  <div className="flex-shrink-0 mt-1">
                    <span className="text-lg">{getPriorityIcon(notification.priority)}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className={`font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </h3>
                        <p className={`text-sm mt-1 ${!notification.read ? 'text-gray-700' : 'text-gray-500'}`}>
                          {notification.message}
                        </p>
                      </div>
                      
                      {/* Unread indicator */}
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 ml-2 mt-2" />
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="capitalize">{notification.type}</span>
                        <span className={getPriorityColor(notification.priority)}>
                          {notification.priority}
                        </span>
                        <span>{formatRelativeTime(notification.timestamp)}</span>
                      </div>

                      {/* Actions */}
                      {notification.actions && notification.actions.length > 0 && (
                        <div className="flex gap-2">
                          {notification.actions.map((action, index) => (
                            <button
                              key={index}
                              onClick={(e) => {
                                e.stopPropagation();
                                action.action();
                              }}
                              className={`px-2 py-1 text-xs rounded ${
                                action.primary
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              } transition-colors`}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with stats */}
      {notifications.length > 0 && (
        <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 flex justify-between">
          <span>
            {filteredNotifications.length} of {notifications.length} notifications
          </span>
          <span>
            {unreadCount} unread
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to manage notification history
 */
export function useNotificationHistory(maxNotifications = 100) {
  const [notifications, setNotifications] = useState<HistoricalNotification[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('notification-history');
      if (stored) {
        const parsed = JSON.parse(stored) as HistoricalNotification[];
        const withDates = parsed.map(notif => ({
          ...notif,
          timestamp: new Date(notif.timestamp)
        }));
        setNotifications(withDates);
      }
    } catch (error) {
      console.warn('Failed to load notification history:', error);
    }
  }, []);

  // Save to localStorage when notifications change
  useEffect(() => {
    try {
      localStorage.setItem('notification-history', JSON.stringify(notifications));
    } catch (error) {
      console.warn('Failed to save notification history:', error);
    }
  }, [notifications]);

  // Add notification to history
  const addNotification = (notification: Omit<HistoricalNotification, 'id' | 'read'>) => {
    const newNotification: HistoricalNotification = {
      ...notification,
      id: ulid(),
      read: false
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      return updated.slice(0, maxNotifications);
    });

    return newNotification.id;
  };

  // Mark as read
  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
  };

  // Mark all as read
  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  // Clear all
  const clearAll = () => {
    setNotifications([]);
  };

  // Get unread count
  const unreadCount = notifications.filter(notif => !notif.read).length;

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll
  };
} 