import React, { useState, useRef } from 'react';
import { 
  useNotificationSettings, 
  NotificationSettingType, 
  NotificationSettings 
} from '../../hooks/useNotificationSettings';

interface NotificationSettingsPanelProps {
  className?: string;
  onClose?: () => void;
}

/**
 * Comprehensive notification settings panel component
 */
export function NotificationSettingsPanel({ className = '', onClose }: NotificationSettingsPanelProps) {
  const {
    settings,
    updateGlobalSettings,
    updateTypeSettings,
    updateQuietHours,
    updateDoNotDisturb,
    setDoNotDisturb,
    resetToDefaults,
    exportSettings,
    importSettings
  } = useNotificationSettings();

  const [activeTab, setActiveTab] = useState<'general' | 'types' | 'schedule' | 'advanced'>('general');
  const [showImportExport, setShowImportExport] = useState(false);
  const [importText, setImportText] = useState('');
  const [soundPreview, setSoundPreview] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Play sound preview
  const playSound = async (soundFile: string) => {
    if (audioRef.current) {
      try {
        audioRef.current.src = soundFile;
        audioRef.current.volume = settings.masterVolume / 100;
        await audioRef.current.play();
        setSoundPreview(soundFile);
        setTimeout(() => setSoundPreview(null), 1000);
      } catch (error) {
        console.warn('Failed to play sound preview:', error);
      }
    }
  };

  // Handle Do Not Disturb quick actions
  const handleDNDQuickAction = (duration?: number) => {
    if (settings.doNotDisturb.enabled) {
      setDoNotDisturb(false);
    } else {
      setDoNotDisturb(true, duration);
    }
  };

  // Format time for display
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Get notification type display name
  const getTypeDisplayName = (type: NotificationSettingType): string => {
    const names: Record<NotificationSettingType, string> = {
      AGENT_MESSAGE: 'Agent Messages',
      TASK_COMPLETE: 'Task Completions',
      SYSTEM_ALERT: 'System Alerts',
      AGENT_STATUS: 'Agent Status',
      FILE_PROCESSED: 'File Processing',
      ERROR: 'Errors',
      SUCCESS: 'Success Messages',
      INFO: 'Information',
      WARNING: 'Warnings'
    };
    return names[type];
  };

  // Get priority color
  const getPriorityColor = (priority: string): string => {
    const colors: Record<string, string> = {
      low: 'text-gray-500',
      normal: 'text-blue-500',
      high: 'text-orange-500',
      urgent: 'text-red-500'
    };
    return colors[priority] || 'text-gray-500';
  };

  // Handle settings import
  const handleImport = () => {
    try {
      importSettings(importText);
      setImportText('');
      setShowImportExport(false);
      alert('Settings imported successfully!');
    } catch (error) {
      alert('Failed to import settings: ' + (error as Error).message);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Notification Settings</h2>
        <div className="flex items-center gap-2">
          {/* Do Not Disturb Quick Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDNDQuickAction()}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                settings.doNotDisturb.enabled
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {settings.doNotDisturb.enabled ? '🔕 DND On' : '🔔 DND Off'}
            </button>
            
            {!settings.doNotDisturb.enabled && (
              <div className="relative group">
                <button className="p-1 text-gray-400 hover:text-gray-600">
                  ⏱️
                </button>
                <div className="absolute right-0 top-8 bg-white border rounded-lg shadow-lg p-2 hidden group-hover:block z-10">
                  <div className="flex flex-col gap-1 text-sm">
                    <button 
                      onClick={() => handleDNDQuickAction(30 * 60 * 1000)}
                      className="px-2 py-1 hover:bg-gray-100 rounded text-left"
                    >
                      30 minutes
                    </button>
                    <button 
                      onClick={() => handleDNDQuickAction(60 * 60 * 1000)}
                      className="px-2 py-1 hover:bg-gray-100 rounded text-left"
                    >
                      1 hour
                    </button>
                    <button 
                      onClick={() => handleDNDQuickAction(4 * 60 * 60 * 1000)}
                      className="px-2 py-1 hover:bg-gray-100 rounded text-left"
                    >
                      4 hours
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
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

      {/* Tabs */}
      <div className="flex border-b">
        {[
          { id: 'general', label: 'General', icon: '⚙️' },
          { id: 'types', label: 'Types', icon: '🔔' },
          { id: 'schedule', label: 'Schedule', icon: '⏰' },
          { id: 'advanced', label: 'Advanced', icon: '🔧' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Global Enable/Disable */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Enable Notifications</h3>
                <p className="text-sm text-gray-500">Turn all notifications on or off</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.globalEnabled}
                  onChange={(e) => updateGlobalSettings({ globalEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Master Volume */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">Master Volume</h3>
                <span className="text-sm text-gray-500">{settings.masterVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.masterVolume}
                onChange={(e) => updateGlobalSettings({ masterVolume: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Toast Settings */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Toast Notifications</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Visible Toasts
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.maxToastsVisible}
                    onChange={(e) => updateGlobalSettings({ maxToastsVisible: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (seconds)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={settings.toastDuration / 1000}
                    onChange={(e) => updateGlobalSettings({ toastDuration: parseInt(e.target.value) * 1000 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notification Types Tab */}
        {activeTab === 'types' && (
          <div className="space-y-4">
            {Object.entries(settings.types).map(([type, typeSettings]) => (
              <div key={type} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-gray-900">
                      {getTypeDisplayName(type as NotificationSettingType)}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded-full bg-gray-100 ${getPriorityColor(typeSettings.priority)}`}>
                      {typeSettings.priority}
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={typeSettings.enabled}
                      onChange={(e) => updateTypeSettings(type as NotificationSettingType, { enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {typeSettings.enabled && (
                  <div className="grid grid-cols-3 gap-4">
                    {/* Toast */}
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={typeSettings.toast}
                        onChange={(e) => updateTypeSettings(type as NotificationSettingType, { toast: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Toast</span>
                    </label>

                    {/* Browser */}
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={typeSettings.browser}
                        onChange={(e) => updateTypeSettings(type as NotificationSettingType, { browser: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Browser</span>
                    </label>

                    {/* Sound */}
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={typeSettings.sound}
                          onChange={(e) => updateTypeSettings(type as NotificationSettingType, { sound: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Sound</span>
                      </label>
                      {typeSettings.sound && typeSettings.soundFile && (
                        <button
                          onClick={() => playSound(typeSettings.soundFile!)}
                          className={`p-1 text-xs rounded ${
                            soundPreview === typeSettings.soundFile
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          🔊
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            {/* Do Not Disturb */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium text-gray-900">Do Not Disturb</h3>
                  <p className="text-sm text-gray-500">
                    {settings.doNotDisturb.enabled 
                      ? settings.doNotDisturb.enabledUntil 
                        ? `Active until ${new Date(settings.doNotDisturb.enabledUntil).toLocaleTimeString()}`
                        : 'Active indefinitely'
                      : 'Disabled'
                    }
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.doNotDisturb.enabled}
                    onChange={(e) => updateDoNotDisturb({ enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.doNotDisturb.allowCritical}
                  onChange={(e) => updateDoNotDisturb({ allowCritical: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Allow critical notifications</span>
              </label>
            </div>

            {/* Quiet Hours */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium text-gray-900">Quiet Hours</h3>
                  <p className="text-sm text-gray-500">
                    {settings.quietHours.enabled 
                      ? `${formatTime(settings.quietHours.startTime)} - ${formatTime(settings.quietHours.endTime)}`
                      : 'Disabled'
                    }
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.quietHours.enabled}
                    onChange={(e) => updateQuietHours({ enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {settings.quietHours.enabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={settings.quietHours.startTime}
                        onChange={(e) => updateQuietHours({ startTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                      <input
                        type="time"
                        value={settings.quietHours.endTime}
                        onChange={(e) => updateQuietHours({ endTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                    <select
                      value={settings.quietHours.timezone}
                      onChange={(e) => updateQuietHours({ timezone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Intl.supportedValuesOf('timeZone').map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.quietHours.allowCritical}
                      onChange={(e) => updateQuietHours({ allowCritical: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Allow critical notifications during quiet hours</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Advanced Tab */}
        {activeTab === 'advanced' && (
          <div className="space-y-6">
            {/* Batching Settings */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium text-gray-900">Notification Batching</h3>
                  <p className="text-sm text-gray-500">Group similar notifications to reduce spam</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.batchingEnabled}
                    onChange={(e) => updateGlobalSettings({ batchingEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {settings.batchingEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Batch Interval (seconds)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={settings.batchingInterval / 1000}
                      onChange={(e) => updateGlobalSettings({ batchingInterval: parseInt(e.target.value) * 1000 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Batch Size
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={settings.maxBatchSize}
                      onChange={(e) => updateGlobalSettings({ maxBatchSize: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Import/Export */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-4">Import/Export Settings</h3>
              
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    const exported = exportSettings();
                    navigator.clipboard.writeText(exported);
                    alert('Settings copied to clipboard!');
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Export Settings
                </button>
                <button
                  onClick={() => setShowImportExport(!showImportExport)}
                  className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Import Settings
                </button>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to reset all settings to defaults?')) {
                      resetToDefaults();
                    }
                  }}
                  className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Reset to Defaults
                </button>
              </div>

              {showImportExport && (
                <div className="space-y-2">
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Paste exported settings here..."
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleImport}
                      disabled={!importText.trim()}
                      className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Import
                    </button>
                    <button
                      onClick={() => {
                        setImportText('');
                        setShowImportExport(false);
                      }}
                      className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hidden audio element for sound previews */}
      <audio ref={audioRef} preload="none" />
    </div>
  );
} 