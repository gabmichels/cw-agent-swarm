'use client';

import React, { useState, useEffect } from 'react';
import { Edit, Save, X, AlertCircle, CheckCircle, Share2, Clock } from 'lucide-react';
import { AgentProfile } from '@/lib/multi-agent/types/agent';
import { 
  SocialMediaConnection, 
  SocialMediaCapability, 
  SocialMediaProvider,
  AgentSocialMediaPermission,
  AccessLevel 
} from '../../services/social-media/database/ISocialMediaDatabase';

export interface AgentSocialMediaPermissionEditorProps {
  agent: AgentProfile;
  isEditing: boolean;
  onEditingChange: (editing: boolean) => void;
}

interface ConnectionPermissionState {
  connectionId: string;
  connection: SocialMediaConnection;
  permission: AgentSocialMediaPermission | null;
  capabilities: SocialMediaCapability[];
  accessLevel: AccessLevel;
  isActive: boolean;
}

export const AgentSocialMediaPermissionEditor: React.FC<AgentSocialMediaPermissionEditorProps> = ({
  agent,
  isEditing,
  onEditingChange
}) => {
  const [connections, setConnections] = useState<SocialMediaConnection[]>([]);
  const [permissions, setPermissions] = useState<ConnectionPermissionState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load connections and permissions
  useEffect(() => {
    loadConnectionsAndPermissions();
  }, [agent.id]);

  const loadConnectionsAndPermissions = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load all social media connections
      const connectionsResponse = await fetch('/api/social-media/connections');
      const connectionsData = await connectionsResponse.json();

      if (!connectionsData.success) {
        throw new Error(connectionsData.error || 'Failed to load connections');
      }

      // Load agent permissions
      const permissionsResponse = await fetch(`/api/social-media/permissions?agentId=${agent.id}`);
      const permissionsData = await permissionsResponse.json();

      if (!permissionsData.success) {
        throw new Error(permissionsData.error || 'Failed to load permissions');
      }

      setConnections(connectionsData.connections);

      // Create permission state for each connection
      const permissionStates: ConnectionPermissionState[] = connectionsData.connections.map((connection: SocialMediaConnection) => {
        const existingPermission = permissionsData.permissions.find(
          (p: AgentSocialMediaPermission) => p.connectionId === connection.id
        );

        return {
          connectionId: connection.id,
          connection,
          permission: existingPermission || null,
          capabilities: existingPermission?.capabilities || [],
          accessLevel: existingPermission?.accessLevel || AccessLevel.NONE,
          isActive: existingPermission?.isActive || false
        };
      });

      setPermissions(permissionStates);
    } catch (err) {
      console.error('Error loading social media data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Save each permission
      for (const permissionState of permissions) {
        if (permissionState.isActive && permissionState.capabilities.length > 0) {
          // Grant or update permission
          const response = await fetch('/api/social-media/permissions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              agentId: agent.id,
              connectionId: permissionState.connectionId,
              capabilities: permissionState.capabilities,
              accessLevel: permissionState.accessLevel,
              grantedBy: 'user_gab', // TODO: Get from auth context
              isActive: true
            }),
          });

          const data = await response.json();
          if (!data.success) {
            throw new Error(data.error || 'Failed to save permission');
          }
        } else if (permissionState.permission && !permissionState.isActive) {
          // Revoke permission
          const response = await fetch(`/api/social-media/permissions/${permissionState.permission.id}`, {
            method: 'DELETE',
          });

          const data = await response.json();
          if (!data.success) {
            throw new Error(data.error || 'Failed to revoke permission');
          }
        }
      }

      // Reload permissions to get updated state
      await loadConnectionsAndPermissions();
      onEditingChange(false);
    } catch (err) {
      console.error('Error saving permissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reload to reset any changes
    loadConnectionsAndPermissions();
    onEditingChange(false);
    setError(null);
  };

  const updatePermissionState = (connectionId: string, updates: Partial<ConnectionPermissionState>) => {
    setPermissions(prev => prev.map(p => 
      p.connectionId === connectionId ? { ...p, ...updates } : p
    ));
  };

  const toggleCapability = (connectionId: string, capability: SocialMediaCapability) => {
    const permissionState = permissions.find(p => p.connectionId === connectionId);
    if (!permissionState) return;

    const newCapabilities = permissionState.capabilities.includes(capability)
      ? permissionState.capabilities.filter(c => c !== capability)
      : [...permissionState.capabilities, capability];

    updatePermissionState(connectionId, { 
      capabilities: newCapabilities,
      isActive: newCapabilities.length > 0
    });
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

  const getCapabilityDisplayName = (capability: SocialMediaCapability): string => {
    return capability.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const getCapabilityDescription = (capability: SocialMediaCapability): string => {
    const descriptions: Partial<Record<SocialMediaCapability, string>> = {
      [SocialMediaCapability.POST_CREATE]: 'Create and publish posts',
      [SocialMediaCapability.POST_READ]: 'Read and view posts',
      [SocialMediaCapability.POST_EDIT]: 'Edit existing posts',
      [SocialMediaCapability.POST_DELETE]: 'Delete posts',
      [SocialMediaCapability.POST_SCHEDULE]: 'Schedule posts for later',
      [SocialMediaCapability.DRAFT_READ]: 'Read draft posts',
      [SocialMediaCapability.DRAFT_PUBLISH]: 'Publish draft posts',
      [SocialMediaCapability.DRAFT_SCHEDULE]: 'Schedule draft posts',
      [SocialMediaCapability.STORY_CREATE]: 'Create stories',
      [SocialMediaCapability.STORY_READ]: 'View stories',
      [SocialMediaCapability.VIDEO_UPLOAD]: 'Upload videos',
      [SocialMediaCapability.IMAGE_UPLOAD]: 'Upload images',
      [SocialMediaCapability.COMMENT_READ]: 'Read comments',
      [SocialMediaCapability.COMMENT_CREATE]: 'Reply to comments',
      [SocialMediaCapability.COMMENT_MODERATE]: 'Moderate comments',
      [SocialMediaCapability.LIKE_CREATE]: 'Like posts',
      [SocialMediaCapability.SHARE_CREATE]: 'Share/repost content',
      [SocialMediaCapability.ANALYTICS_READ]: 'View analytics',
      [SocialMediaCapability.INSIGHTS_READ]: 'View insights',
      [SocialMediaCapability.METRICS_READ]: 'View metrics',
      [SocialMediaCapability.DM_READ]: 'Read direct messages',
      [SocialMediaCapability.DM_SEND]: 'Send direct messages',
      [SocialMediaCapability.TIKTOK_VIDEO_CREATE]: 'Create TikTok videos',
      [SocialMediaCapability.TIKTOK_LIVE_CREATE]: 'Create TikTok live streams',
      [SocialMediaCapability.TIKTOK_ANALYTICS_READ]: 'View TikTok analytics',
      [SocialMediaCapability.ACCOUNT_READ]: 'Read account information',
      [SocialMediaCapability.PROFILE_EDIT]: 'Edit profile information'
    };
    return descriptions[capability] || capability;
  };

  const commonCapabilities = [
    SocialMediaCapability.POST_CREATE,
    SocialMediaCapability.POST_READ,
    SocialMediaCapability.ANALYTICS_READ,
    SocialMediaCapability.COMMENT_READ,
    SocialMediaCapability.COMMENT_CREATE
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center">
          <Share2 className="mr-2 h-5 w-5" />
          Social Media Permissions
        </h2>
        {!isEditing ? (
          <button
            onClick={() => onEditingChange(true)}
            className="flex items-center text-blue-500 hover:text-blue-400"
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </button>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={handleCancel}
              className="flex items-center text-gray-400 hover:text-gray-300"
              disabled={saving}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center text-green-500 hover:text-green-400"
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center p-4 bg-red-900/20 border border-red-500 rounded-lg mb-4">
          <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Clock className="h-6 w-6 text-blue-400 animate-spin mr-2" />
          <span className="text-gray-400">Loading social media connections...</span>
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Share2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No social media connections found.</p>
          <p className="text-sm">Connect social media accounts in Settings to grant permissions.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {permissions.map((permissionState) => (
            <div key={permissionState.connectionId} className="border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">
                    {getProviderIcon(permissionState.connection.provider)}
                  </span>
                  <div>
                    <h3 className="text-white font-medium">
                      {permissionState.connection.accountDisplayName}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      @{permissionState.connection.accountUsername} • {permissionState.connection.provider}
                    </p>
                  </div>
                </div>
                
                {!isEditing && (
                  <div className="flex items-center">
                    {permissionState.isActive ? (
                      <div className="flex items-center text-green-400">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        <span className="text-sm">
                          {permissionState.capabilities.length} permissions
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">No access</span>
                    )}
                  </div>
                )}
              </div>

              {isEditing && (
                <div>
                  <div className="mb-3">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissionState.isActive}
                        onChange={(e) => updatePermissionState(permissionState.connectionId, {
                          isActive: e.target.checked,
                          capabilities: e.target.checked ? commonCapabilities : []
                        })}
                        className="mr-2"
                      />
                      <span className="text-white">Enable access to this account</span>
                    </label>
                  </div>

                  {permissionState.isActive && (
                    <div>
                      <h4 className="text-white font-medium mb-2">Capabilities</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {Object.values(SocialMediaCapability).map((capability) => (
                          <label key={capability} className="flex items-start cursor-pointer p-2 rounded hover:bg-gray-700/50">
                            <input
                              type="checkbox"
                              checked={permissionState.capabilities.includes(capability)}
                              onChange={() => toggleCapability(permissionState.connectionId, capability)}
                              className="mr-2 mt-1"
                            />
                            <div>
                              <div className="text-white text-sm">
                                {getCapabilityDisplayName(capability)}
                              </div>
                              <div className="text-gray-400 text-xs">
                                {getCapabilityDescription(capability)}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!isEditing && permissionState.isActive && (
                <div className="mt-3">
                  <h4 className="text-white font-medium mb-2">Granted Capabilities</h4>
                  <div className="flex flex-wrap gap-2">
                    {permissionState.capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="px-2 py-1 bg-blue-900/50 text-blue-300 text-xs rounded"
                      >
                        {getCapabilityDisplayName(capability)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 