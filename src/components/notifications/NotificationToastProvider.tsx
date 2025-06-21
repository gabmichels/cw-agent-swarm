import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ulid } from 'ulid';

// Notification types with strict typing
export enum NotificationType {
  AGENT_MESSAGE = 'agent_message',
  TASK_COMPLETE = 'task_complete',
  SYSTEM_ALERT = 'system_alert',
  AGENT_STATUS = 'agent_status',
  FILE_PROCESSED = 'file_processed',
  ERROR = 'error',
  SUCCESS = 'success',
  INFO = 'info',
  WARNING = 'warning'
}

export interface NotificationAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface NotificationToast {
  readonly type: NotificationType;
  readonly title: string;
  readonly message: string;
  readonly avatar?: string;
  readonly action?: NotificationAction;
  readonly sound?: boolean;
  readonly duration?: number;
  readonly priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface NotificationToastWithId extends NotificationToast {
  readonly id: string;
  readonly timestamp: Date;
  readonly dismissed: boolean;
}

// Context interface for dependency injection
interface NotificationContextValue {
  readonly toasts: readonly NotificationToastWithId[];
  readonly showToast: (toast: NotificationToast) => string;
  readonly dismissToast: (id: string) => void;
  readonly clearAllToasts: () => void;
  readonly isSupported: boolean;
  readonly hasPermission: boolean;
  readonly requestPermission: () => Promise<boolean>;
}

// Create context with proper typing
const NotificationContext = createContext<NotificationContextValue | null>(null);

// Hook for consuming notification context
export const useNotificationToast = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationToast must be used within a NotificationToastProvider');
  }
  return context;
};

// Sound configuration for different notification types
const NOTIFICATION_SOUNDS: Record<NotificationType, string> = {
  [NotificationType.AGENT_MESSAGE]: '/sounds/message.mp3',
  [NotificationType.TASK_COMPLETE]: '/sounds/success.mp3',
  [NotificationType.SYSTEM_ALERT]: '/sounds/alert.mp3',
  [NotificationType.AGENT_STATUS]: '/sounds/status.mp3',
  [NotificationType.FILE_PROCESSED]: '/sounds/upload.mp3',
  [NotificationType.ERROR]: '/sounds/error.mp3',
  [NotificationType.SUCCESS]: '/sounds/success.mp3',
  [NotificationType.INFO]: '/sounds/info.mp3',
  [NotificationType.WARNING]: '/sounds/warning.mp3'
};

// Default durations for different notification types
const DEFAULT_DURATIONS: Record<NotificationType, number> = {
  [NotificationType.AGENT_MESSAGE]: 5000,
  [NotificationType.TASK_COMPLETE]: 7000,
  [NotificationType.SYSTEM_ALERT]: 10000,
  [NotificationType.AGENT_STATUS]: 3000,
  [NotificationType.FILE_PROCESSED]: 5000,
  [NotificationType.ERROR]: 8000,
  [NotificationType.SUCCESS]: 4000,
  [NotificationType.INFO]: 5000,
  [NotificationType.WARNING]: 6000
};

interface NotificationToastProviderProps {
  readonly children: React.ReactNode;
  readonly maxToasts?: number;
  readonly enableSounds?: boolean;
  readonly enableBrowserNotifications?: boolean;
}

/**
 * Provider component for toast notifications
 * Manages notification state, browser notifications, and sound playback
 */
export const NotificationToastProvider: React.FC<NotificationToastProviderProps> = ({
  children,
  maxToasts = 5,
  enableSounds = true,
  enableBrowserNotifications = true
}) => {
  // State management with immutable patterns
  const [toasts, setToasts] = useState<readonly NotificationToastWithId[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(false);

  // Refs for cleanup and audio management
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Initialize browser notification support and permissions
  useEffect(() => {
    const checkNotificationSupport = () => {
      const supported = 'Notification' in window;
      setIsSupported(supported);
      
      if (supported) {
        setHasPermission(Notification.permission === 'granted');
      }
    };

    checkNotificationSupport();
  }, []);

  // Preload audio files for better performance
  useEffect(() => {
    if (!enableSounds) return;

    const preloadAudio = async () => {
      for (const [type, soundPath] of Object.entries(NOTIFICATION_SOUNDS)) {
        try {
          // Check if the sound file exists before creating Audio object
          const response = await fetch(soundPath, { method: 'HEAD' });
          if (response.ok) {
            const audio = new Audio(soundPath);
            audio.preload = 'auto';
            audio.volume = 0.7; // Default volume
            
            // Handle audio loading errors gracefully
            audio.addEventListener('error', () => {
              console.warn(`Sound file not available for ${type}: ${soundPath}`);
              audioCache.current.delete(type);
            });
            
            audioCache.current.set(type, audio);
          } else {
            console.warn(`Sound file not found for ${type}: ${soundPath}`);
          }
        } catch (error) {
          console.warn(`Failed to check/preload audio for ${type}: ${soundPath}`, error);
        }
      }
    };

    preloadAudio();

    // Cleanup audio on unmount
    return () => {
      audioCache.current.forEach(audio => {
        audio.pause();
        audio.src = '';
      });
      audioCache.current.clear();
    };
  }, [enableSounds]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current.clear();
    };
  }, []);

  /**
   * Pure function to create notification ID
   */
  const createNotificationId = useCallback((): string => {
    return ulid();
  }, []);

  /**
   * Pure function to play notification sound
   */
  const playNotificationSound = useCallback((type: NotificationType): void => {
    if (!enableSounds) return;

    try {
      const audio = audioCache.current.get(type);
      if (audio) {
        // Reset audio to beginning and play
        audio.currentTime = 0;
        audio.play().catch(error => {
          console.warn(`Failed to play notification sound for ${type}:`, error);
        });
      }
    } catch (error) {
      console.warn(`Error playing notification sound for ${type}:`, error);
    }
  }, [enableSounds]);

  /**
   * Pure function to show browser notification
   */
  const showBrowserNotification = useCallback((toast: NotificationToastWithId): void => {
    if (!enableBrowserNotifications || !isSupported || !hasPermission) return;

    try {
      const notification = new Notification(toast.title, {
        body: toast.message,
        icon: toast.avatar || '/favicon.ico',
        tag: toast.id, // Prevent duplicate notifications
        requireInteraction: toast.priority === 'urgent',
        silent: false
      });

      // Handle notification click
      notification.onclick = () => {
        window.focus();
        if (toast.action) {
          toast.action.onClick();
        }
        notification.close();
      };

      // Auto-close after duration
      setTimeout(() => {
        notification.close();
      }, toast.duration || DEFAULT_DURATIONS[toast.type]);

    } catch (error) {
      console.warn('Failed to show browser notification:', error);
    }
  }, [enableBrowserNotifications, isSupported, hasPermission]);

  /**
   * Request browser notification permission
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setHasPermission(granted);
      return granted;
    } catch (error) {
      console.warn('Failed to request notification permission:', error);
      return false;
    }
  }, [isSupported]);

  /**
   * Show a new toast notification
   */
  const showToast = useCallback((toast: NotificationToast): string => {
    const id = createNotificationId();
    const timestamp = new Date();
    const duration = toast.duration || DEFAULT_DURATIONS[toast.type];

    const toastWithId: NotificationToastWithId = Object.freeze({
      ...toast,
      id,
      timestamp,
      dismissed: false
    });

    // Add toast to state
    setToasts(prev => {
      // Remove oldest toasts if we exceed maxToasts
      const newToasts = [...prev, toastWithId];
      if (newToasts.length > maxToasts) {
        const excess = newToasts.length - maxToasts;
        // Clear timeouts for removed toasts
        newToasts.slice(0, excess).forEach(removedToast => {
          const timeoutRef = timeoutRefs.current.get(removedToast.id);
          if (timeoutRef) {
            clearTimeout(timeoutRef);
            timeoutRefs.current.delete(removedToast.id);
          }
        });
        return Object.freeze(newToasts.slice(excess));
      }
      return Object.freeze(newToasts);
    });

    // Play notification sound
    if (toast.sound !== false) {
      playNotificationSound(toast.type);
    }

    // Show browser notification
    showBrowserNotification(toastWithId);

    // Set auto-dismiss timeout
    const timeoutRef = setTimeout(() => {
      dismissToast(id);
    }, duration);
    timeoutRefs.current.set(id, timeoutRef);

    return id;
  }, [createNotificationId, maxToasts, playNotificationSound, showBrowserNotification]);

  /**
   * Dismiss a specific toast
   */
  const dismissToast = useCallback((id: string): void => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    
    // Clear timeout
    const timeoutRef = timeoutRefs.current.get(id);
    if (timeoutRef) {
      clearTimeout(timeoutRef);
      timeoutRefs.current.delete(id);
    }
  }, []);

  /**
   * Clear all toasts
   */
  const clearAllToasts = useCallback((): void => {
    setToasts([]);
    
    // Clear all timeouts
    timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
    timeoutRefs.current.clear();
  }, []);

  // Context value with immutable data
  const contextValue: NotificationContextValue = {
    toasts,
    showToast,
    dismissToast,
    clearAllToasts,
    isSupported,
    hasPermission,
    requestPermission
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <ToastContainer 
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </NotificationContext.Provider>
  );
};

// Toast container component props
interface ToastContainerProps {
  readonly toasts: readonly NotificationToastWithId[];
  readonly onDismiss: (id: string) => void;
}

/**
 * Container component for rendering toast notifications
 */
const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  );
};

// Individual toast component props
interface ToastProps {
  readonly toast: NotificationToastWithId;
  readonly onDismiss: () => void;
}

/**
 * Individual toast notification component
 */
const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Get styling based on notification type
  const getToastStyles = (type: NotificationType): string => {
    const baseStyles = "transform transition-all duration-300 ease-in-out rounded-lg shadow-lg p-4 max-w-sm border-l-4";
    
    if (!isVisible) {
      return `${baseStyles} translate-x-full opacity-0`;
    }

    const typeStyles = {
      [NotificationType.AGENT_MESSAGE]: "bg-blue-50 border-blue-400 text-blue-800",
      [NotificationType.TASK_COMPLETE]: "bg-green-50 border-green-400 text-green-800",
      [NotificationType.SYSTEM_ALERT]: "bg-yellow-50 border-yellow-400 text-yellow-800",
      [NotificationType.AGENT_STATUS]: "bg-purple-50 border-purple-400 text-purple-800",
      [NotificationType.FILE_PROCESSED]: "bg-indigo-50 border-indigo-400 text-indigo-800",
      [NotificationType.ERROR]: "bg-red-50 border-red-400 text-red-800",
      [NotificationType.SUCCESS]: "bg-green-50 border-green-400 text-green-800",
      [NotificationType.INFO]: "bg-blue-50 border-blue-400 text-blue-800",
      [NotificationType.WARNING]: "bg-yellow-50 border-yellow-400 text-yellow-800"
    };

    return `${baseStyles} translate-x-0 opacity-100 ${typeStyles[type]}`;
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300); // Wait for animation
  };

  return (
    <div className={getToastStyles(toast.type)}>
      <div className="flex items-start space-x-3">
        {toast.avatar && (
          <img
            src={toast.avatar}
            alt=""
            className="w-8 h-8 rounded-full flex-shrink-0"
          />
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-sm">{toast.title}</h4>
              <p className="text-sm opacity-90 mt-1">{toast.message}</p>
            </div>
            
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Dismiss notification"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="mt-2 text-sm font-medium underline hover:no-underline transition-all"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 