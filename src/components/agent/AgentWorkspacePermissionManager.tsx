import React, { useState, useEffect } from 'react';
import { WorkspaceConnection, WorkspaceCapabilityType, AccessLevel } from '../../services/database/types';
import { CheckCircle, AlertCircle, Settings, Mail, Calendar, FileText, BarChart3, Users, Clock } from 'lucide-react';

export interface AgentWorkspacePermissionConfig {
  connectionId: string;
  connectionName: string;
  provider: string;
  permissions: {
    [key in WorkspaceCapabilityType]?: {
      enabled: boolean;
      accessLevel: AccessLevel;
      restrictions?: Record<string, any>;
    };
  };
}

export interface AgentWorkspacePermissionManagerProps {
  agentId?: string; // Optional for new agents
  initialPermissions?: AgentWorkspacePermissionConfig[];
  onChange: (permissions: AgentWorkspacePermissionConfig[]) => void;
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

const ACCESS_LEVEL_DESCRIPTIONS: Record<AccessLevel, string> = {
  [AccessLevel.NONE]: 'No access',
  [AccessLevel.READ]: 'Read-only access',
  [AccessLevel.WRITE]: 'Read and write access',
  [AccessLevel.ADMIN]: 'Full administrative access'
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

  // Load connections on mount and when needed
  useEffect(() => {
    loadConnections();
  }, []);

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
    capability: WorkspaceCapabilityType,
    enabled: boolean,
    accessLevel: AccessLevel = AccessLevel.READ
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
          accessLevel,
          restrictions: {}
        };
      } else {
        delete connectionConfig.permissions[capability];
      }

      // Remove connection config if no permissions are enabled
      const hasEnabledPermissions = Object.values(connectionConfig.permissions).some(p => p.enabled);
      if (!hasEnabledPermissions) {
        const index = updated.findIndex(p => p.connectionId === connectionId);
        if (index > -1) {
          updated.splice(index, 1);
        }
      }

      onChange(updated);
      return updated;
    });
  };

  const updateAccessLevel = (
    connectionId: string,
    capability: WorkspaceCapabilityType,
    accessLevel: AccessLevel
  ) => {
    setPermissions(prev => {
      const updated = [...prev];
      const connectionConfig = updated.find(p => p.connectionId === connectionId);
      
      if (connectionConfig && connectionConfig.permissions[capability]) {
        connectionConfig.permissions[capability]!.accessLevel = accessLevel;
        onChange(updated);
      }
      
      return updated;
    });
  };

  const isCapabilityEnabled = (connectionId: string, capability: WorkspaceCapabilityType): boolean => {
    const connectionConfig = permissions.find(p => p.connectionId === connectionId);
    return connectionConfig?.permissions[capability]?.enabled || false;
  };

  const getAccessLevel = (connectionId: string, capability: WorkspaceCapabilityType): AccessLevel => {
    const connectionConfig = permissions.find(p => p.connectionId === connectionId);
    return connectionConfig?.permissions[capability]?.accessLevel || AccessLevel.READ;
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
                              const accessLevel = getAccessLevel(connection.id, capability);

                              return (
                                <div key={capability} className="flex items-center justify-between p-3 bg-gray-750 rounded-lg">
                                  <div className="flex items-center">
                                    <input
                                      type="checkbox"
                                      checked={isEnabled}
                                      onChange={(e) => updatePermission(
                                        connection.id,
                                        capability,
                                        e.target.checked,
                                        AccessLevel.READ
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

                                  {isEnabled && (
                                    <select
                                      value={accessLevel}
                                      onChange={(e) => updateAccessLevel(
                                        connection.id,
                                        capability,
                                        e.target.value as AccessLevel
                                      )}
                                      className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-1 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                      {Object.entries(ACCESS_LEVEL_DESCRIPTIONS).map(([level, description]) => (
                                        <option key={level} value={level}>
                                          {description}
                                        </option>
                                      ))}
                                    </select>
                                  )}
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
                    return (
                      <div key={config.connectionId}>
                        <strong>{config.connectionName}:</strong> {enabledCount} permission{enabledCount !== 1 ? 's' : ''} enabled
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