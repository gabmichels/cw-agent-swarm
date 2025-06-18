'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, ChevronDown, ChevronRight, Settings, AlertCircle } from 'lucide-react';
import { 
  SocialMediaProvider, 
  SocialMediaConnection, 
  SocialMediaCapability, 
  AccessLevel 
} from '../../services/social-media/database/ISocialMediaDatabase';

export interface AgentSocialMediaPermissionConfig {
  connectionId: string;
  connectionName: string;
  provider: SocialMediaProvider;
  permissions: {
    [capability in SocialMediaCapability]?: {
      enabled: boolean;
      accessLevel: AccessLevel;
      restrictions?: Record<string, unknown>;
    };
  };
}

interface AgentSocialMediaPermissionManagerProps {
  initialPermissions?: AgentSocialMediaPermissionConfig[];
  onChange: (permissions: AgentSocialMediaPermissionConfig[]) => void;
  className?: string;
}

export const AgentSocialMediaPermissionManager: React.FC<AgentSocialMediaPermissionManagerProps> = ({
  initialPermissions = [],
  onChange,
  className = ''
}) => {
  const [connections, setConnections] = useState<SocialMediaConnection[]>([]);
  const [permissions, setPermissions] = useState<AgentSocialMediaPermissionConfig[]>(initialPermissions);
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load available social media connections
  useEffect(() => {
    loadConnections();
  }, []);

  // Update parent when permissions change
  useEffect(() => {
    onChange(permissions);
  }, [permissions, onChange]);

  const loadConnections = async () => {
    try {
      setLoading(true);
              const response = await fetch('/api/social-media/connections');
      const data = await response.json();

      if (data.success) {
        setConnections(data.connections || []);
        
        // Initialize permissions for any new connections
        const newPermissions = [...permissions];
        data.connections?.forEach((connection: SocialMediaConnection) => {
          if (!newPermissions.find(p => p.connectionId === connection.id)) {
            newPermissions.push({
              connectionId: connection.id,
              connectionName: connection.accountDisplayName,
              provider: connection.provider,
              permissions: {}
            });
          }
        });
        setPermissions(newPermissions);
      } else {
        setError(data.error || 'Failed to load connections');
      }
    } catch (err) {
      setError('Failed to load social media connections');
      console.error('Error loading connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleConnection = (connectionId: string) => {
    setExpandedConnections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(connectionId)) {
        newSet.delete(connectionId);
      } else {
        newSet.add(connectionId);
      }
      return newSet;
    });
  };

  const updatePermission = (
    connectionId: string, 
    capability: SocialMediaCapability, 
    enabled: boolean, 
    accessLevel: AccessLevel = AccessLevel.READ
  ) => {
    setPermissions(prev => prev.map(config => {
      if (config.connectionId === connectionId) {
        const newPermissions = { ...config.permissions };
        if (enabled) {
          newPermissions[capability] = {
            enabled: true,
            accessLevel,
            restrictions: {}
          };
        } else {
          delete newPermissions[capability];
        }
        return { ...config, permissions: newPermissions };
      }
      return config;
    }));
  };

  const updateAccessLevel = (
    connectionId: string, 
    capability: SocialMediaCapability, 
    accessLevel: AccessLevel
  ) => {
    setPermissions(prev => prev.map(config => {
      if (config.connectionId === connectionId && config.permissions[capability]) {
        return {
          ...config,
          permissions: {
            ...config.permissions,
            [capability]: {
              ...config.permissions[capability]!,
              accessLevel
            }
          }
        };
      }
      return config;
    }));
  };

  const getProviderIcon = (provider: SocialMediaProvider): string => {
    switch (provider) {
      case SocialMediaProvider.TWITTER: return '🐦';
      case SocialMediaProvider.LINKEDIN: return '💼';
      case SocialMediaProvider.FACEBOOK: return '📘';
      case SocialMediaProvider.INSTAGRAM: return '📸';
      case SocialMediaProvider.REDDIT: return '🤖';
      case SocialMediaProvider.TIKTOK: return '🎵';
      default: return '📱';
    }
  };

  const getProviderName = (provider: SocialMediaProvider): string => {
    switch (provider) {
      case SocialMediaProvider.TWITTER: return 'Twitter / X';
      case SocialMediaProvider.LINKEDIN: return 'LinkedIn';
      case SocialMediaProvider.FACEBOOK: return 'Facebook';
      case SocialMediaProvider.INSTAGRAM: return 'Instagram';
      case SocialMediaProvider.REDDIT: return 'Reddit';
      case SocialMediaProvider.TIKTOK: return 'TikTok';
      default: return provider;
    }
  };

  const getCapabilityGroups = () => {
    return {
      'Content Management': [
        SocialMediaCapability.POST_CREATE,
        SocialMediaCapability.POST_READ,
        SocialMediaCapability.POST_EDIT,
        SocialMediaCapability.POST_DELETE,
        SocialMediaCapability.POST_SCHEDULE
      ],
      'Media & Stories': [
        SocialMediaCapability.STORY_CREATE,
        SocialMediaCapability.STORY_READ,
        SocialMediaCapability.VIDEO_UPLOAD,
        SocialMediaCapability.IMAGE_UPLOAD
      ],
      'Engagement': [
        SocialMediaCapability.COMMENT_READ,
        SocialMediaCapability.COMMENT_CREATE,
        SocialMediaCapability.COMMENT_MODERATE,
        SocialMediaCapability.LIKE_CREATE,
        SocialMediaCapability.SHARE_CREATE
      ],
      'Analytics': [
        SocialMediaCapability.ANALYTICS_READ,
        SocialMediaCapability.INSIGHTS_READ,
        SocialMediaCapability.METRICS_READ
      ],
      'Messaging': [
        SocialMediaCapability.DM_READ,
        SocialMediaCapability.DM_SEND
      ],
      'TikTok Features': [
        SocialMediaCapability.TIKTOK_VIDEO_CREATE,
        SocialMediaCapability.TIKTOK_LIVE_CREATE,
        SocialMediaCapability.TIKTOK_ANALYTICS_READ
      ],
      'Account Management': [
        SocialMediaCapability.ACCOUNT_READ,
        SocialMediaCapability.PROFILE_EDIT
      ]
    };
  };

  const getCapabilityDisplayName = (capability: SocialMediaCapability): string => {
    const names: Partial<Record<SocialMediaCapability, string>> = {
      [SocialMediaCapability.POST_CREATE]: 'Create Posts',
      [SocialMediaCapability.POST_READ]: 'Read Posts',
      [SocialMediaCapability.POST_EDIT]: 'Edit Posts',
      [SocialMediaCapability.POST_DELETE]: 'Delete Posts',
      [SocialMediaCapability.POST_SCHEDULE]: 'Schedule Posts',
      [SocialMediaCapability.STORY_CREATE]: 'Create Stories',
      [SocialMediaCapability.STORY_READ]: 'Read Stories',
      [SocialMediaCapability.VIDEO_UPLOAD]: 'Upload Videos',
      [SocialMediaCapability.IMAGE_UPLOAD]: 'Upload Images',
      [SocialMediaCapability.COMMENT_READ]: 'Read Comments',
      [SocialMediaCapability.COMMENT_CREATE]: 'Create Comments',
      [SocialMediaCapability.COMMENT_MODERATE]: 'Moderate Comments',
      [SocialMediaCapability.LIKE_CREATE]: 'Like/React to Posts',
      [SocialMediaCapability.SHARE_CREATE]: 'Share/Repost Content',
      [SocialMediaCapability.ANALYTICS_READ]: 'Read Analytics',
      [SocialMediaCapability.INSIGHTS_READ]: 'Read Insights',
      [SocialMediaCapability.METRICS_READ]: 'Read Metrics',
      [SocialMediaCapability.DM_READ]: 'Read Direct Messages',
      [SocialMediaCapability.DM_SEND]: 'Send Direct Messages',
      [SocialMediaCapability.TIKTOK_VIDEO_CREATE]: 'Create TikTok Videos',
      [SocialMediaCapability.TIKTOK_LIVE_CREATE]: 'Create TikTok Live Streams',
      [SocialMediaCapability.TIKTOK_ANALYTICS_READ]: 'Read TikTok Analytics',
      [SocialMediaCapability.ACCOUNT_READ]: 'Read Account Info',
      [SocialMediaCapability.PROFILE_EDIT]: 'Edit Profile'
    };
    return names[capability] || capability;
  };

  const getPermissionCount = (connectionId: string): number => {
    const config = permissions.find(p => p.connectionId === connectionId);
    return Object.values(config?.permissions || {}).filter(p => p.enabled).length;
  };

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center py-8`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-400">Loading social media connections...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} p-4 bg-red-900/20 border border-red-500 rounded-lg`}>
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
          <span className="text-red-400">{error}</span>
        </div>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className={`${className} text-center py-8 text-gray-400`}>
        <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No social media connections available.</p>
        <p className="text-sm">Connect your social media accounts first to assign permissions to agents.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        {connections.map((connection) => {
          const isExpanded = expandedConnections.has(connection.id);
          const permissionCount = getPermissionCount(connection.id);
          const capabilityGroups = getCapabilityGroups();
          
          return (
            <div key={connection.id} className="border border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleConnection(connection.id)}
                className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xl">{getProviderIcon(connection.provider)}</span>
                  <div className="text-left">
                    <div className="text-white font-medium">
                      {connection.accountDisplayName}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {getProviderName(connection.provider)} • @{connection.accountUsername}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">
                    {permissionCount} permission{permissionCount !== 1 ? 's' : ''}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="p-4 bg-gray-800">
                  {Object.entries(capabilityGroups).map(([groupName, capabilities]) => (
                    <div key={groupName} className="mb-6 last:mb-0">
                      <h4 className="text-sm font-medium text-gray-300 mb-3 border-b border-gray-600 pb-1">
                        {groupName}
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {capabilities.map((capability) => {
                          const config = permissions.find(p => p.connectionId === connection.id);
                          const permission = config?.permissions[capability];
                          const isEnabled = permission?.enabled || false;
                          
                          return (
                            <div key={capability} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                              <div className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={(e) => updatePermission(
                                    connection.id, 
                                    capability, 
                                    e.target.checked,
                                    AccessLevel.READ
                                  )}
                                  className="rounded border-gray-500 text-blue-600 focus:ring-blue-500"
                                />
                                <label className="text-sm text-gray-300">
                                  {getCapabilityDisplayName(capability)}
                                </label>
                              </div>
                              
                              {isEnabled && (
                                <select
                                  value={permission?.accessLevel || AccessLevel.READ}
                                  onChange={(e) => updateAccessLevel(
                                    connection.id, 
                                    capability, 
                                    e.target.value as AccessLevel
                                  )}
                                  className="text-xs bg-gray-600 border border-gray-500 rounded px-2 py-1 text-gray-300"
                                >
                                  <option value={AccessLevel.READ}>Read</option>
                                  <option value={AccessLevel.LIMITED}>Limited</option>
                                  <option value={AccessLevel.FULL}>Full</option>
                                </select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}; 