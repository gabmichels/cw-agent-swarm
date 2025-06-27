'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Plus, X } from 'lucide-react';
import { SocialMediaSettingsModal } from './SocialMediaSettingsModal';
import { AgentSocialMediaPermissionManager, AgentSocialMediaPermissionConfig } from './AgentSocialMediaPermissionManager';

interface SocialMediaPermissionEditorProps {
  agentId: string;
  initialPermissions?: AgentSocialMediaPermissionConfig[];
  onPermissionsChange?: (permissions: AgentSocialMediaPermissionConfig[]) => void;
  className?: string;
}

export const SocialMediaPermissionEditor: React.FC<SocialMediaPermissionEditorProps> = ({
  agentId,
  initialPermissions = [],
  onPermissionsChange,
  className = ''
}) => {
  const [permissions, setPermissions] = useState<AgentSocialMediaPermissionConfig[]>(initialPermissions);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current permissions on mount
  useEffect(() => {
    loadPermissions();
  }, [agentId]);

  const loadPermissions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/agents/${agentId}/social-media-permissions`);
      const data = await response.json();

      if (data.success) {
        setPermissions(data.permissions || []);
      } else {
        setError(data.error || 'Failed to load permissions');
      }
    } catch (err) {
      setError('Failed to load social media permissions');
      console.error('Error loading social media permissions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionsChange = (newPermissions: AgentSocialMediaPermissionConfig[]) => {
    setPermissions(newPermissions);
    onPermissionsChange?.(newPermissions);
  };

  const savePermissions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/agents/${agentId}/social-media-permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permissions: permissions,
          grantedBy: 'user' // TODO: Replace with actual user ID
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save permissions');
      }

      // Reload permissions to get the latest state
      await loadPermissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save permissions');
      console.error('Error saving social media permissions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getPermissionSummary = () => {
    const totalConnections = permissions.length;
    const totalPermissions = permissions.reduce((sum, config) => {
      return sum + Object.values(config.permissions).filter((p): p is { enabled: boolean; accessLevel: any; restrictions?: Record<string, unknown> } => {
        return p && typeof p === 'object' && 'enabled' in p && typeof (p as any).enabled === 'boolean' && (p as any).enabled;
      }).length;
    }, 0);

    return { totalConnections, totalPermissions };
  };

  const { totalConnections, totalPermissions } = getPermissionSummary();

  if (isLoading && permissions.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center py-8`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-400">Loading social media permissions...</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-white flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              Social Media Permissions
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {totalConnections > 0 
                ? `${totalPermissions} permissions across ${totalConnections} connection${totalConnections !== 1 ? 's' : ''}`
                : 'No social media permissions configured'
              }
            </p>
          </div>
          
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Manage Connections
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <AgentSocialMediaPermissionManager
          agentId={agentId}
          initialPermissions={permissions}
          onChange={handlePermissionsChange}
          className="mb-4"
        />

        <div className="flex justify-end space-x-3">
          <button
            onClick={loadPermissions}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
          
          <button
            onClick={savePermissions}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Social Media Settings Modal */}
      <SocialMediaSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        userId="user_001" // TODO: Replace with actual user ID
      />
    </div>
  );
}; 