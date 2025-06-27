import { AlertCircle, BarChart3, Calendar, CheckCircle, FileText, Mail, Settings, Shield, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { WorkspaceCapabilityType, WorkspaceConnection } from '../../services/database/types';

export interface AgentWorkspacePermissionConfig {
  connectionId: string;
  connectionName: string;
  provider: string;
  permissions: {
    [key in WorkspaceCapabilityType]?: {
      enabled: boolean;
      restrictions?: Record<string, any>;
      needsApproval?: boolean;
    };
  };
}

export interface AgentWorkspacePermissionManagerProps {
  agentId?: string; // Optional for new agents
  initialPermissions?: AgentWorkspacePermissionConfig[];
  onChange: (permissions: AgentWorkspacePermissionConfig[], approvalSettings?: Record<string, boolean>) => void;
  className?: string;
}

interface WorkspaceConnectionsState {
  connections: WorkspaceConnection[];
  loading: boolean;
  error: string | null;
}

const CAPABILITY_GROUPS = {
  EMAIL: {
    title: 'Email Management',
    icon: Mail,
    color: 'blue',
    capabilities: [
      WorkspaceCapabilityType.EMAIL_READ,
      WorkspaceCapabilityType.EMAIL_SEND
    ]
  },
  CALENDAR: {
    title: 'Calendar Management',
    icon: Calendar,
    color: 'green',
    capabilities: [
      WorkspaceCapabilityType.CALENDAR_READ,
      WorkspaceCapabilityType.CALENDAR_CREATE,
      WorkspaceCapabilityType.CALENDAR_EDIT,
      WorkspaceCapabilityType.CALENDAR_DELETE
    ]
  },
  DOCUMENTS: {
    title: 'Document Management',
    icon: FileText,
    color: 'purple',
    capabilities: [
      WorkspaceCapabilityType.DOCUMENT_READ,
      WorkspaceCapabilityType.DOCUMENT_CREATE,
      WorkspaceCapabilityType.DOCUMENT_EDIT
    ]
  },
  DRIVE: {
    title: 'Drive Management',
    icon: BarChart3,
    color: 'orange',
    capabilities: [
      WorkspaceCapabilityType.DRIVE_READ,
      WorkspaceCapabilityType.DRIVE_UPLOAD,
      WorkspaceCapabilityType.DRIVE_MANAGE
    ]
  },
  SPREADSHEETS: {
    title: 'Spreadsheet Management',
    icon: BarChart3,
    color: 'green',
    capabilities: [
      WorkspaceCapabilityType.SPREADSHEET_READ,
      WorkspaceCapabilityType.SPREADSHEET_CREATE,
      WorkspaceCapabilityType.SPREADSHEET_EDIT,
      WorkspaceCapabilityType.SPREADSHEET_DELETE
    ]
  },
  CONTACTS: {
    title: 'Contact Management',
    icon: Users,
    color: 'blue',
    capabilities: [
      WorkspaceCapabilityType.CONTACTS_READ,
      WorkspaceCapabilityType.CONTACTS_MANAGE
    ]
  }
};

const CAPABILITY_DESCRIPTIONS: Partial<Record<WorkspaceCapabilityType, string>> = {
  [WorkspaceCapabilityType.EMAIL_READ]: 'Read and access email messages',
  [WorkspaceCapabilityType.EMAIL_SEND]: 'Send new email messages',
  [WorkspaceCapabilityType.DOCUMENT_READ]: 'Read and access documents',
  [WorkspaceCapabilityType.DOCUMENT_CREATE]: 'Create new documents',
  [WorkspaceCapabilityType.DOCUMENT_EDIT]: 'Edit existing documents',
  [WorkspaceCapabilityType.CALENDAR_READ]: 'View calendar events and schedules',
  [WorkspaceCapabilityType.CALENDAR_CREATE]: 'Create new calendar events',
  [WorkspaceCapabilityType.CALENDAR_EDIT]: 'Modify existing calendar events',
  [WorkspaceCapabilityType.CALENDAR_DELETE]: 'Delete calendar events',
  [WorkspaceCapabilityType.DRIVE_READ]: 'Access and read files from drive',
  [WorkspaceCapabilityType.DRIVE_UPLOAD]: 'Upload files to drive',
  [WorkspaceCapabilityType.DRIVE_MANAGE]: 'Manage files and folders in drive',
  [WorkspaceCapabilityType.SPREADSHEET_READ]: 'Read spreadsheet data',
  [WorkspaceCapabilityType.SPREADSHEET_CREATE]: 'Create new spreadsheets',
  [WorkspaceCapabilityType.SPREADSHEET_EDIT]: 'Edit spreadsheet content',
  [WorkspaceCapabilityType.SPREADSHEET_DELETE]: 'Delete spreadsheets',
  [WorkspaceCapabilityType.CONTACTS_READ]: 'Read contact information',
  [WorkspaceCapabilityType.CONTACTS_MANAGE]: 'Manage contacts and contact lists'
};

export const AgentWorkspacePermissionManager: React.FC<AgentWorkspacePermissionManagerProps> = ({
  agentId,
  initialPermissions = [],
  onChange,
  className = ''
}) => {
  const [connectionsState, setConnectionsState] = useState<WorkspaceConnectionsState>({
    connections: [],
    loading: true,
    error: null
  });
  
  const [permissions, setPermissions] = useState<AgentWorkspacePermissionConfig[]>(initialPermissions);
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());
  const [approvalSettings, setApprovalSettings] = useState<Record<string, boolean>>({});
  const [editedApprovalSettings, setEditedApprovalSettings] = useState<Record<string, boolean>>({});

  // Load connections on mount and when needed
  useEffect(() => {
    loadConnections();
  }, []);

  // Sync permissions with initialPermissions prop changes
  useEffect(() => {
    setPermissions(initialPermissions);
  }, [initialPermissions]);

  // Load approval settings when agentId changes
  useEffect(() => {
    if (agentId) {
      loadApprovalSettings();
    }
  }, [agentId]);

  // Sync edited approval settings with loaded settings
  useEffect(() => {
    setEditedApprovalSettings(approvalSettings);
  }, [approvalSettings]);

  // Add a refresh function that can be called externally
  useEffect(() => {
    const handleWorkspaceConnectionUpdate = () => {
      loadConnections();
    };

    // Listen for custom events that indicate workspace connections have changed
    window.addEventListener('workspaceConnectionsUpdated', handleWorkspaceConnectionUpdate);
    
    return () => {
      window.removeEventListener('workspaceConnectionsUpdated', handleWorkspaceConnectionUpdate);
    };
  }, []);

  const loadConnections = async () => {
    try {
      const response = await fetch('/api/workspace/connections');
      const data = await response.json();

      if (data.success) {
        setConnectionsState({
          connections: data.connections.filter((conn: WorkspaceConnection) => conn.status === 'ACTIVE'),
          loading: false,
          error: null
        });
      } else {
        throw new Error(data.error || 'Failed to load connections');
      }
    } catch (error) {
      console.error('Error loading workspace connections:', error);
      setConnectionsState({
        connections: [],
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load connections'
      });
    }
  };

  const loadApprovalSettings = async () => {
    if (!agentId) return;
    
    try {
      const response = await fetch(`/api/agent/workspace-approval?agentId=${agentId}`);
      const data = await response.json();
      
      if (data.settings) {
        const approvalMap: Record<string, boolean> = {};
        data.settings.forEach((setting: any) => {
          approvalMap[setting.toolName] = setting.needsApproval;
        });
        setApprovalSettings(approvalMap);
      }
    } catch (error) {
      console.error('Error loading approval settings:', error);
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

  const updateApprovalSetting = (toolName: string, needsApproval: boolean) => {
    const updatedSettings = {
      ...editedApprovalSettings,
      [toolName]: needsApproval
    };
    setEditedApprovalSettings(updatedSettings);
    
    // Notify parent of approval changes
    setTimeout(() => onChange(permissions, updatedSettings), 0);
  };

  const getToolNameFromCapability = (capability: WorkspaceCapabilityType): string => {
    // Map capabilities to tool names
    const capabilityToToolMap: Record<WorkspaceCapabilityType, string> = {
      [WorkspaceCapabilityType.EMAIL_SEND]: 'send_email',
      [WorkspaceCapabilityType.EMAIL_READ]: 'read_specific_email',
      [WorkspaceCapabilityType.CALENDAR_CREATE]: 'schedule_event',
      [WorkspaceCapabilityType.CALENDAR_EDIT]: 'edit_event',
      [WorkspaceCapabilityType.CALENDAR_DELETE]: 'delete_event',
      [WorkspaceCapabilityType.CALENDAR_READ]: 'read_calendar',
      [WorkspaceCapabilityType.DOCUMENT_CREATE]: 'create_document',
      [WorkspaceCapabilityType.DOCUMENT_EDIT]: 'edit_document',
      [WorkspaceCapabilityType.DOCUMENT_READ]: 'read_document',
      [WorkspaceCapabilityType.DRIVE_UPLOAD]: 'upload_file',
      [WorkspaceCapabilityType.DRIVE_MANAGE]: 'share_file',
      [WorkspaceCapabilityType.DRIVE_READ]: 'search_files',
      [WorkspaceCapabilityType.SPREADSHEET_CREATE]: 'create_spreadsheet',
      [WorkspaceCapabilityType.SPREADSHEET_EDIT]: 'update_spreadsheet',
      [WorkspaceCapabilityType.SPREADSHEET_READ]: 'read_spreadsheet',
      [WorkspaceCapabilityType.SPREADSHEET_DELETE]: 'delete_spreadsheet',
      [WorkspaceCapabilityType.CONTACTS_READ]: 'read_contacts',
      [WorkspaceCapabilityType.CONTACTS_MANAGE]: 'manage_contacts',
      [WorkspaceCapabilityType.WORKFLOW_EXECUTE]: 'execute_workflow',
      [WorkspaceCapabilityType.WORKFLOW_READ]: 'read_workflow',
      [WorkspaceCapabilityType.WORKFLOW_CREATE]: 'create_workflow',
      [WorkspaceCapabilityType.WORKFLOW_EDIT]: 'edit_workflow',
      [WorkspaceCapabilityType.WORKFLOW_DELETE]: 'delete_workflow'
    };
    
    return capabilityToToolMap[capability] || capability.toLowerCase();
  };

  const updatePermission = (
    connectionId: string,
    capability: WorkspaceCapabilityType,
    enabled: boolean
  ) => {
    setPermissions(prev => {
      const updated = [...prev];
      let connectionConfig = updated.find(p => p.connectionId === connectionId);
      
      if (!connectionConfig) {
        const connection = connectionsState.connections.find(c => c.id === connectionId);
        if (!connection) return prev;
        
        connectionConfig = {
          connectionId,
          connectionName: `${connection.displayName} (${connection.email})`,
          provider: connection.provider,
          permissions: {}
        };
        updated.push(connectionConfig);
      }

      if (enabled) {
        connectionConfig.permissions[capability] = {
          enabled: true,
          restrictions: {}
        };
      } else {
        delete connectionConfig.permissions[capability];
        
        // Remove connection config if no permissions are enabled
        if (Object.keys(connectionConfig.permissions).length === 0) {
          const index = updated.findIndex(p => p.connectionId === connectionId);
          if (index > -1) {
            updated.splice(index, 1);
          }
        }
      }

      // Use setTimeout to defer the onChange call to avoid setState during render
      setTimeout(() => onChange(updated, editedApprovalSettings), 0);
      return updated;
    });
  };

  const isCapabilityEnabled = (connectionId: string, capability: WorkspaceCapabilityType): boolean => {
    const connectionConfig = permissions.find(p => p.connectionId === connectionId);
    return connectionConfig?.permissions[capability]?.enabled || false;
  };

  const toggleAllCapabilities = (connectionId: string, selectAll: boolean) => {
    setPermissions(prev => {
      const updated = [...prev];
      let connectionConfig = updated.find(p => p.connectionId === connectionId);
      
      const allCapabilities = Object.values(WorkspaceCapabilityType);
      
      if (!connectionConfig && selectAll) {
        const connection = connectionsState.connections.find(c => c.id === connectionId);
        if (!connection) return prev;
        
        connectionConfig = {
          connectionId,
          connectionName: `${connection.displayName} (${connection.email})`,
          provider: connection.provider,
          permissions: {}
        };
        updated.push(connectionConfig);
      }

      if (selectAll && connectionConfig) {
        // Enable all capabilities
        allCapabilities.forEach(capability => {
          connectionConfig!.permissions[capability] = {
            enabled: true,
            restrictions: {}
          };
        });
      } else if (connectionConfig) {
        // Disable all capabilities
        connectionConfig.permissions = {};
        // Remove connection config if no permissions are enabled
        const index = updated.findIndex(p => p.connectionId === connectionId);
        if (index > -1) {
          updated.splice(index, 1);
        }
      }

      // Use setTimeout to defer the onChange call to avoid setState during render
      setTimeout(() => onChange(updated, editedApprovalSettings), 0);
      return updated;
    });
  };

  const isAllCapabilitiesSelected = (connectionId: string): boolean => {
    const connectionConfig = permissions.find(p => p.connectionId === connectionId);
    if (!connectionConfig) return false;
    
    const allCapabilities = Object.values(WorkspaceCapabilityType);
    return allCapabilities.every(cap => connectionConfig.permissions[cap]?.enabled || false);
  };

  const isSomeCapabilitiesSelected = (connectionId: string): boolean => {
    const connectionConfig = permissions.find(p => p.connectionId === connectionId);
    if (!connectionConfig) return false;
    
    const enabledCount = Object.values(connectionConfig.permissions).filter(p => p.enabled).length;
    const totalCount = Object.values(WorkspaceCapabilityType).length;
    
    return enabledCount > 0 && enabledCount < totalCount;
  };

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: 'border-blue-500 bg-blue-500/10 text-blue-400',
      green: 'border-green-500 bg-green-500/10 text-green-400',
      purple: 'border-purple-500 bg-purple-500/10 text-purple-400',
      orange: 'border-orange-500 bg-orange-500/10 text-orange-400'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  if (connectionsState.loading) {
    return (
      <div className={`workspace-permission-manager ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-400">Loading workspace connections...</span>
        </div>
      </div>
    );
  }

  if (connectionsState.error) {
    return (
      <div className={`workspace-permission-manager ${className}`}>
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-400">Error loading workspace connections: {connectionsState.error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (connectionsState.connections.length === 0) {
    return (
      <div className={`workspace-permission-manager ${className}`}>
        <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-6 text-center">
          <Settings className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-yellow-400 mb-2">No Workspace Connections</h3>
          <p className="text-gray-400 mb-4">
            You need to connect at least one workspace (Google Workspace, Microsoft 365, or Zoho) 
            before you can configure agent permissions.
          </p>
          <button
            onClick={() => window.open('/settings/workspace', '_blank')}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Connect Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`workspace-permission-manager ${className}`}>
      <div className="space-y-6">
        <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-4">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-blue-400">Workspace Integration</h3>
              <p className="text-xs text-gray-300 mt-1">
                Configure which workspace capabilities this agent can access. Permissions are granted per connection 
                and can be fine-tuned with access levels and restrictions.
              </p>
            </div>
          </div>
        </div>

        {connectionsState.connections.map(connection => {
          const isExpanded = expandedConnections.has(connection.id);
          const connectionPermissions = permissions.find(p => p.connectionId === connection.id);
          const enabledCount = connectionPermissions ? 
            Object.values(connectionPermissions.permissions).filter(p => p.enabled).length : 0;

          return (
            <div key={connection.id} className="bg-gray-800 border border-gray-700 rounded-lg">
              <div 
                className="p-4 cursor-pointer hover:bg-gray-750 transition-colors"
                onClick={() => toggleConnection(connection.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-lg">
                        {connection.provider === 'GOOGLE_WORKSPACE' ? '🔵' : 
                         connection.provider === 'MICROSOFT_365' ? '🟦' : '🟠'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{connection.displayName}</h3>
                      <p className="text-sm text-gray-400">{connection.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {enabledCount > 0 && (
                      <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full mr-3">
                        {enabledCount} permission{enabledCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-700 p-4">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-700">
                    <h3 className="text-lg font-medium text-white">Workspace Capabilities</h3>
                    <label className="flex items-center cursor-pointer text-sm text-gray-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={isAllCapabilitiesSelected(connection.id)}
                        ref={(input) => {
                          if (input) {
                            input.indeterminate = isSomeCapabilitiesSelected(connection.id);
                          }
                        }}
                        onChange={(e) => toggleAllCapabilities(connection.id, e.target.checked)}
                        className="mr-2 h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                      />
                      Select All
                    </label>
                  </div>
                  <div className="space-y-6">
                    {Object.entries(CAPABILITY_GROUPS).map(([groupKey, group]) => {
                      const IconComponent = group.icon;
                      const groupColorClasses = getColorClasses(group.color);

                      return (
                        <div key={groupKey} className="space-y-3">
                          <div className={`flex items-center p-3 rounded-lg border ${groupColorClasses}`}>
                            <IconComponent className="h-5 w-5 mr-2" />
                            <h4 className="font-medium">{group.title}</h4>
                          </div>

                          <div className="grid grid-cols-1 gap-3 ml-4">
                            {group.capabilities.map(capability => {
                              const isEnabled = isCapabilityEnabled(connection.id, capability);
                              const toolName = getToolNameFromCapability(capability);
                              const needsApproval = editedApprovalSettings[toolName] || false;

                              return (
                                <div key={capability} className="p-3 bg-gray-750 rounded-lg">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={isEnabled}
                                        onChange={(e) => updatePermission(
                                          connection.id,
                                          capability,
                                          e.target.checked
                                        )}
                                        className="h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                      />
                                      <div className="ml-3">
                                        <label className="text-sm font-medium text-white">
                                          {capability.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                        </label>
                                        <p className="text-xs text-gray-400">
                                          {CAPABILITY_DESCRIPTIONS[capability] || 'Workspace capability'}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    {/* Approval Checkbox - only show for enabled capabilities */}
                                    {isEnabled && agentId && (
                                      <div className="flex items-center space-x-2">
                                        <Shield className="h-4 w-4 text-orange-400" />
                                        <label className="flex items-center cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={needsApproval}
                                            onChange={(e) => updateApprovalSetting(toolName, e.target.checked)}
                                            className="h-3 w-3 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500"
                                          />
                                          <span className="ml-1 text-xs text-orange-400">Needs Approval</span>
                                        </label>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {permissions.length > 0 && (
          <div className="bg-green-900/30 border border-green-800 rounded-lg p-4">
            <div className="flex items-start">
              <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-green-400">Permissions Summary</h3>
                <div className="text-xs text-gray-300 mt-1 space-y-1">
                  {permissions.map(config => {
                    const enabledCount = Object.values(config.permissions).filter(p => p.enabled).length;
                    const approvalCount = Object.keys(editedApprovalSettings).filter(toolName => editedApprovalSettings[toolName]).length;
                    return (
                      <div key={config.connectionId}>
                        <strong>{config.connectionName}:</strong> {enabledCount} permission{enabledCount !== 1 ? 's' : ''} enabled
                        {approvalCount > 0 && (
                          <span className="text-orange-400 ml-2">({approvalCount} require{approvalCount !== 1 ? '' : 's'} approval)</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};