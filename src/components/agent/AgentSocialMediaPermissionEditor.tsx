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
import { AgentSocialMediaPermissionManager, AgentSocialMediaPermissionConfig } from '../social-media/AgentSocialMediaPermissionManager';

export interface AgentSocialMediaPermissionEditorProps {
  agent: AgentProfile;
  isEditing: boolean;
  onEditingChange: (editing: boolean) => void;
}

export const AgentSocialMediaPermissionEditor: React.FC<AgentSocialMediaPermissionEditorProps> = ({
  agent,
  isEditing,
  onEditingChange
}) => {
  const [permissions, setPermissions] = useState<AgentSocialMediaPermissionConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [approvalSettings, setApprovalSettings] = useState<Record<string, boolean>>({});

  // Load permissions on mount
  useEffect(() => {
    loadPermissions();
  }, [agent.id]);

  const loadPermissions = async () => {
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
      const permissionsResponse = await fetch(`/api/agents/${agent.id}/social-media-permissions`);
      const permissionsData = await permissionsResponse.json();

      if (!permissionsData.success) {
        throw new Error(permissionsData.error || 'Failed to load permissions');
      }

      // Load approval settings
      const approvalResponse = await fetch(`/api/agent/social-media-approval?agentId=${agent.id}`);
      const approvalData = await approvalResponse.json();
      
      if (approvalData.success) {
        setApprovalSettings(approvalData.settings || {});
      }

      // Convert to manager component format
      const permissionConfigs: AgentSocialMediaPermissionConfig[] = connectionsData.connections.map((connection: SocialMediaConnection) => {
        // Find existing permission configuration for this connection
        const existingPermissionConfig = permissionsData.permissions.find(
          (p: any) => p.connectionId === connection.id
        );

        // The API now returns permissions in the UI format, so use them directly
        const permissions = existingPermissionConfig?.permissions || {};

        return {
          connectionId: connection.id,
          connectionName: connection.accountDisplayName || `${connection.provider} Account`,
          provider: connection.provider,
          permissions
        };
      });

      setPermissions(permissionConfigs);
    } catch (err) {
      console.error('Error loading social media permissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Save permissions using the same API as the manager component
      const response = await fetch(`/api/agents/${agent.id}/social-media-permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permissions: permissions,
          approvalSettings: approvalSettings,
          grantedBy: 'user'
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save permissions');
      }

      onEditingChange(false);
    } catch (err) {
      console.error('Error saving permissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    loadPermissions();
    onEditingChange(false);
    setError(null);
  };

  const handlePermissionsChange = (newPermissions: AgentSocialMediaPermissionConfig[], newApprovalSettings?: Record<string, boolean>) => {
    setPermissions(newPermissions);
    if (newApprovalSettings) {
      setApprovalSettings(newApprovalSettings);
    }
  };

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

      {isEditing ? (
        <AgentSocialMediaPermissionManager
          agentId={agent.id}
          initialPermissions={permissions}
          onChange={handlePermissionsChange}
        />
      ) : (
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-4">
            Configure which social media accounts this agent can access and what actions require approval.
          </p>
          {permissions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Share2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No social media permissions configured.</p>
              <p className="text-sm">Click Edit to configure permissions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {permissions.map((config) => {
                const enabledCount = Object.values(config.permissions).filter(p => p.enabled).length;
                return (
                  <div key={config.connectionId} className="bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-white">{config.connectionName}</h3>
                      <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">
                        {enabledCount} permission{enabledCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-sm text-gray-300">
                      <strong>Provider:</strong> {config.provider.replace('_', ' ')}
                    </div>
                    <div className="text-sm text-gray-300 mt-1">
                      <strong>Capabilities:</strong> {Object.keys(config.permissions).join(', ')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 