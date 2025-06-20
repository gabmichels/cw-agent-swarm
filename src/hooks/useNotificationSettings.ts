import { useState, useEffect, useCallback } from 'react';
import { ulid } from 'ulid';

/**
 * Notification setting types that users can control
 */
export type NotificationSettingType = 
  | 'AGENT_MESSAGE'
  | 'TASK_COMPLETE' 
  | 'SYSTEM_ALERT'
  | 'AGENT_STATUS'
  | 'FILE_PROCESSED'
  | 'ERROR'
  | 'SUCCESS'
  | 'INFO'
  | 'WARNING';

/**
 * Notification delivery methods
 */
export interface NotificationDeliverySettings {
  toast: boolean;
  browser: boolean;
  sound: boolean;
}

/**
 * Individual notification type settings
 */
export interface NotificationTypeSettings extends NotificationDeliverySettings {
  enabled: boolean;
  soundFile?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

/**
 * Quiet hours configuration
 */
export interface QuietHoursSettings {
  enabled: boolean;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  timezone: string;  // IANA timezone identifier
  allowCritical: boolean; // Allow urgent/critical notifications during quiet hours
}

/**
 * Do Not Disturb mode settings
 */
export interface DoNotDisturbSettings {
  enabled: boolean;
  enabledUntil?: number; // Unix timestamp, undefined means indefinite
  allowCritical: boolean;
}

/**
 * Complete notification settings configuration
 */
export interface NotificationSettings {
  id: string; // ULID for settings version tracking
  version: number;
  lastUpdated: number;
  
  // Global settings
  globalEnabled: boolean;
  masterVolume: number; // 0-100
  maxToastsVisible: number;
  toastDuration: number; // milliseconds
  
  // Per-type settings
  types: Record<NotificationSettingType, NotificationTypeSettings>;
  
  // Advanced features
  quietHours: QuietHoursSettings;
  doNotDisturb: DoNotDisturbSettings;
  
  // Batching settings
  batchingEnabled: boolean;
  batchingInterval: number; // milliseconds
  maxBatchSize: number;
}

/**
 * Default notification settings
 */
const DEFAULT_SETTINGS: NotificationSettings = Object.freeze({
  id: ulid(),
  version: 1,
  lastUpdated: Date.now(),
  
  globalEnabled: true,
  masterVolume: 80,
  maxToastsVisible: 5,
  toastDuration: 5000,
  
  types: {
    AGENT_MESSAGE: {
      enabled: true,
      toast: true,
      browser: true,
      sound: true,
      soundFile: '/sounds/message.mp3',
      priority: 'normal' as const
    },
    TASK_COMPLETE: {
      enabled: true,
      toast: true,
      browser: true,
      sound: true,
      soundFile: '/sounds/success.mp3',
      priority: 'high' as const
    },
    SYSTEM_ALERT: {
      enabled: true,
      toast: true,
      browser: true,
      sound: true,
      soundFile: '/sounds/alert.mp3',
      priority: 'urgent' as const
    },
    AGENT_STATUS: {
      enabled: true,
      toast: true,
      browser: false,
      sound: false,
      soundFile: '/sounds/info.mp3',
      priority: 'low' as const
    },
    FILE_PROCESSED: {
      enabled: true,
      toast: true,
      browser: true,
      sound: true,
      soundFile: '/sounds/success.mp3',
      priority: 'normal' as const
    },
    ERROR: {
      enabled: true,
      toast: true,
      browser: true,
      sound: true,
      soundFile: '/sounds/error.mp3',
      priority: 'urgent' as const
    },
    SUCCESS: {
      enabled: true,
      toast: true,
      browser: false,
      sound: true,
      soundFile: '/sounds/success.mp3',
      priority: 'normal' as const
    },
    INFO: {
      enabled: true,
      toast: true,
      browser: false,
      sound: false,
      soundFile: '/sounds/info.mp3',
      priority: 'low' as const
    },
    WARNING: {
      enabled: true,
      toast: true,
      browser: true,
      sound: true,
      soundFile: '/sounds/warning.mp3',
      priority: 'high' as const
    }
  },
  
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    allowCritical: true
  },
  
  doNotDisturb: {
    enabled: false,
    allowCritical: true
  },
  
  batchingEnabled: true,
  batchingInterval: 2000, // 2 seconds
  maxBatchSize: 5
});

const STORAGE_KEY = 'notification-settings';
const STORAGE_EVENT_KEY = 'notification-settings-sync';

/**
 * Hook for managing notification settings with localStorage persistence and cross-tab sync
 */
export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as NotificationSettings;
        // Validate and merge with defaults for new settings
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          types: {
            ...DEFAULT_SETTINGS.types,
            ...parsed.types
          },
          quietHours: {
            ...DEFAULT_SETTINGS.quietHours,
            ...parsed.quietHours
          },
          doNotDisturb: {
            ...DEFAULT_SETTINGS.doNotDisturb,
            ...parsed.doNotDisturb
          }
        };
      }
    } catch (error) {
      console.warn('Failed to load notification settings from localStorage:', error);
    }
    return DEFAULT_SETTINGS;
  });

  // Save settings to localStorage
  const saveSettings = useCallback((newSettings: NotificationSettings) => {
    try {
      const updatedSettings = {
        ...newSettings,
        lastUpdated: Date.now(),
        version: newSettings.version + 1
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSettings));
      setSettings(updatedSettings);
      
      // Broadcast change to other tabs
      window.dispatchEvent(new CustomEvent(STORAGE_EVENT_KEY, {
        detail: updatedSettings
      }));
      
      return updatedSettings;
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      return newSettings;
    }
  }, []);

  // Listen for cross-tab synchronization
  useEffect(() => {
    const handleStorageSync = (event: CustomEvent<NotificationSettings>) => {
      setSettings(event.detail);
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const newSettings = JSON.parse(event.newValue) as NotificationSettings;
          setSettings(newSettings);
        } catch (error) {
          console.warn('Failed to parse settings from storage event:', error);
        }
      }
    };

    window.addEventListener(STORAGE_EVENT_KEY as any, handleStorageSync);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(STORAGE_EVENT_KEY as any, handleStorageSync);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Update global settings
  const updateGlobalSettings = useCallback((updates: Partial<Pick<NotificationSettings, 
    'globalEnabled' | 'masterVolume' | 'maxToastsVisible' | 'toastDuration' | 'batchingEnabled' | 'batchingInterval' | 'maxBatchSize'>>) => {
    const newSettings = { ...settings, ...updates };
    return saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Update settings for a specific notification type
  const updateTypeSettings = useCallback((type: NotificationSettingType, updates: Partial<NotificationTypeSettings>) => {
    const newSettings = {
      ...settings,
      types: {
        ...settings.types,
        [type]: {
          ...settings.types[type],
          ...updates
        }
      }
    };
    return saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Update quiet hours settings
  const updateQuietHours = useCallback((updates: Partial<QuietHoursSettings>) => {
    const newSettings = {
      ...settings,
      quietHours: {
        ...settings.quietHours,
        ...updates
      }
    };
    return saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Update Do Not Disturb settings
  const updateDoNotDisturb = useCallback((updates: Partial<DoNotDisturbSettings>) => {
    const newSettings = {
      ...settings,
      doNotDisturb: {
        ...settings.doNotDisturb,
        ...updates
      }
    };
    return saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Enable/disable Do Not Disturb mode
  const setDoNotDisturb = useCallback((enabled: boolean, duration?: number) => {
    const enabledUntil = enabled && duration ? Date.now() + duration : undefined;
    return updateDoNotDisturb({ enabled, enabledUntil });
  }, [updateDoNotDisturb]);

  // Check if notifications should be shown based on current settings
  const shouldShowNotification = useCallback((type: NotificationSettingType, priority?: 'low' | 'normal' | 'high' | 'urgent') => {
    if (!settings.globalEnabled) return false;
    
    const typeSettings = settings.types[type];
    if (!typeSettings.enabled) return false;

    // Check Do Not Disturb mode
    if (settings.doNotDisturb.enabled) {
      // Check if DND has expired
      if (settings.doNotDisturb.enabledUntil && Date.now() > settings.doNotDisturb.enabledUntil) {
        // Auto-disable expired DND
        updateDoNotDisturb({ enabled: false, enabledUntil: undefined });
      } else {
        // DND is active, check if critical notifications are allowed
        const notificationPriority = priority || typeSettings.priority;
        if (!settings.doNotDisturb.allowCritical || notificationPriority !== 'urgent') {
          return false;
        }
      }
    }

    // Check quiet hours
    if (settings.quietHours.enabled) {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: settings.quietHours.timezone 
      });
      
      const { startTime, endTime } = settings.quietHours;
      const isInQuietHours = (startTime <= endTime) 
        ? (currentTime >= startTime && currentTime <= endTime)
        : (currentTime >= startTime || currentTime <= endTime);
      
      if (isInQuietHours) {
        const notificationPriority = priority || typeSettings.priority;
        if (!settings.quietHours.allowCritical || notificationPriority !== 'urgent') {
          return false;
        }
      }
    }

    return true;
  }, [settings, updateDoNotDisturb]);

  // Get notification delivery settings for a specific type
  const getDeliverySettings = useCallback((type: NotificationSettingType) => {
    const typeSettings = settings.types[type];
    return {
      toast: typeSettings.toast,
      browser: typeSettings.browser,
      sound: typeSettings.sound,
      soundFile: typeSettings.soundFile,
      priority: typeSettings.priority
    };
  }, [settings]);

  // Reset settings to defaults
  const resetToDefaults = useCallback(() => {
    return saveSettings({ ...DEFAULT_SETTINGS, id: ulid() });
  }, [saveSettings]);

  // Export settings for backup
  const exportSettings = useCallback(() => {
    return JSON.stringify(settings, null, 2);
  }, [settings]);

  // Import settings from backup
  const importSettings = useCallback((settingsJson: string) => {
    try {
      const importedSettings = JSON.parse(settingsJson) as NotificationSettings;
      // Validate and merge with current structure
      const mergedSettings = {
        ...DEFAULT_SETTINGS,
        ...importedSettings,
        id: ulid(), // New ID for imported settings
        version: 1,
        lastUpdated: Date.now()
      };
      return saveSettings(mergedSettings);
    } catch (error) {
      console.error('Failed to import settings:', error);
      throw new Error('Invalid settings format');
    }
  }, [saveSettings]);

  return {
    settings,
    updateGlobalSettings,
    updateTypeSettings,
    updateQuietHours,
    updateDoNotDisturb,
    setDoNotDisturb,
    shouldShowNotification,
    getDeliverySettings,
    resetToDefaults,
    exportSettings,
    importSettings
  };
} 