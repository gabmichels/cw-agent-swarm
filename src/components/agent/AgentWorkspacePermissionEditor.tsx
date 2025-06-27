import React, { useState, useEffect } from 'react';
import { AgentProfile } from '@/lib/multi-agent/types/agent';
import { AgentWorkspacePermissionManager, AgentWorkspacePermissionConfig } from './AgentWorkspacePermissionManager';
import { Edit, Save, X, AlertCircle, CheckCircle } from 'lucide-react';

export interface AgentWorkspacePermissionEditorProps {
  agent: AgentProfile;
  onPermissionsUpdate?: (updatedPermissions: AgentWorkspacePermissionConfig[]) => void;
  isEditing: boolean;
  onEditingChange: (editing: boolean) => void;
}

interface PermissionsState {
  permissions: AgentWorkspacePermissionConfig[];
  loading: boolean;
  error: string | null;
}

export const AgentWorkspacePermissionEditor: React.FC<AgentWorkspacePermissionEditorProps> = ({
  agent,
  onPermissionsUpdate,
  isEditing,
  onEditingChange
}) => {
  const [permissionsState, setPermissionsState] = useState<PermissionsState>({
    permissions: [],
    loading: true,
    error: null
  });
  
  const [editedPermissions, setEditedPermissions] = useState<AgentWorkspacePermissionConfig[]>([]);
  const [editedApprovalSettings, setEditedApprovalSettings] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load current workspace permissions
  useEffect(() => {
    loadPermissions();
  }, [agent.id]);

  const loadPermissions = async () => {
    try {
      setPermissionsState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await fetch(`/api/agents/workspace-permissions?agentId=${agent.id}`);
      const data = await response.json();

      if (data.success) {
        // Convert capabilities to permission config format
        const permissionConfigs: AgentWorkspacePermissionConfig[] = [];
        const capabilitiesByConnection = new Map<string, any[]>();

        // Group capabilities by connection
        data.capabilities.forEach((cap: any) => {
          if (!capabilitiesByConnection.has(cap.connectionId)) {
            capabilitiesByConnection.set(cap.connectionId, []);
          }
          capabilitiesByConnection.get(cap.connectionId)!.push(cap);
        });

        // Convert to permission config format
        capabilitiesByConnection.forEach((capabilities, connectionId) => {
          const firstCap = capabilities[0];
          const permissions: any = {};
          
          capabilities.forEach(cap => {
            permissions[cap.capability] = {
              enabled: true,
              restrictions: cap.restrictions || {}
            };
          });

          permissionConfigs.push({
            connectionId,
            connectionName: firstCap.connectionName,
            provider: firstCap.provider,
            permissions
          });
        });

        setPermissionsState({
          permissions: permissionConfigs,
          loading: false,
          error: null
        });
      } else {
        throw new Error(data.error || 'Failed to load permissions');
      }
    } catch (error) {
      console.error('Error loading workspace permissions:', error);
      setPermissionsState({
        permissions: [],
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load permissions'
      });
    }
  };

  const handleStartEditing = () => {
    setEditedPermissions([...permissionsState.permissions]);
    setEditedApprovalSettings({});
    setSaveError(null);
    setSaveSuccess(false);
    onEditingChange(true);
  };

  const handleCancelEditing = () => {
    setEditedPermissions([]);
    setEditedApprovalSettings({});
    setSaveError(null);
    setSaveSuccess(false);
    onEditingChange(false);
  };

  const handlePermissionsChange = (permissions: AgentWorkspacePermissionConfig[], approvalSettings?: Record<string, boolean>) => {
    setEditedPermissions(permissions);
    if (approvalSettings) {
      setEditedApprovalSettings(approvalSettings);
    }
  };

  const handleSavePermissions = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // First, revoke all existing permissions
      const existingPermissions = await fetch(`/api/agents/workspace-permissions?agentId=${agent.id}`);
      const existingData = await existingPermissions.json();
      
      if (existingData.success && existingData.capabilities.length > 0) {
        // Revoke existing permissions (simplified - in production you'd want more granular control)
        for (const capability of existingData.capabilities) {
          try {
            await fetch('/api/agents/workspace-permissions', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                permissionId: capability.id, // Assuming capability has an ID
                revokedBy: 'user' // TODO: Replace with actual user ID
              })
            });
          } catch (error) {
            console.warn('Failed to revoke permission:', error);
          }
        }
      }

      // Grant new permissions
      if (editedPermissions.length > 0) {
        const response = await fetch('/api/agents/workspace-permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: agent.id,
            permissions: editedPermissions,
            grantedBy: 'user' // TODO: Replace with actual user ID
          })
        });

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to save permissions');
        }
      }

      // Save approval settings
      if (Object.keys(editedApprovalSettings).length > 0) {
        for (const [toolName, needsApproval] of Object.entries(editedApprovalSettings)) {
          try {
            await fetch('/api/agent/workspace-approval', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                agentId: agent.id,
                toolName,
                needsApproval,
                grantedBy: 'user'
              })
            });
          } catch (error) {
            console.warn(`Failed to save approval setting for ${toolName}:`, error);
          }
        }
      }

      // Reload permissions to get the latest state
      await loadPermissions();
      
      setSaveSuccess(true);
      onEditingChange(false);
      
      if (onPermissionsUpdate) {
        onPermissionsUpdate(editedPermissions);
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);

    } catch (error) {
      console.error('Error saving workspace permissions:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  if (permissionsState.loading) {
    return (
      <div className="bg-gray-700 p-4 rounded">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-400">Loading workspace permissions...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Workspace Permissions</h2>
        {!isEditing ? (
          <button
            onClick={handleStartEditing}
            className="flex items-center text-blue-500 hover:text-blue-400"
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </button>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={handleCancelEditing}
              className="flex items-center text-gray-400 hover:text-gray-300"
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </button>
            <button
              onClick={handleSavePermissions}
              className="flex items-center text-green-500 hover:text-green-400"
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {saveError && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-4">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-red-400 mr-2" />
            <span className="text-red-400 text-sm">{saveError}</span>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="bg-green-900/30 border border-green-800 rounded-lg p-3 mb-4">
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 text-green-400 mr-2" />
            <span className="text-green-400 text-sm">Workspace permissions updated successfully!</span>
          </div>
        </div>
      )}

      {permissionsState.error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-4">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-red-400 mr-2" />
            <span className="text-red-400 text-sm">{permissionsState.error}</span>
          </div>
        </div>
      )}

      <div className="bg-gray-700 p-4 rounded">
        {!isEditing ? (
          <div>
            {permissionsState.permissions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">No workspace permissions configured</div>
                <p className="text-sm text-gray-500">
                  Click "Edit" to configure workspace access for this agent
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {permissionsState.permissions.map(config => {
                  const enabledCount = Object.values(config.permissions).filter(p => p.enabled).length;
                  return (
                    <div key={config.connectionId} className="bg-gray-600 p-3 rounded">
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
        ) : (
          <AgentWorkspacePermissionManager
            agentId={agent.id}
            initialPermissions={editedPermissions}
            onChange={handlePermissionsChange}
            className="workspace-editor"
          />
        )}
      </div>
    </div>
  );
};