import React, { useState, useEffect } from 'react';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { ChevronDown, ChevronRight, Shield, AlertCircle, CheckCircle, Users, Settings } from 'lucide-react';
import { 
  SocialMediaProvider, 
  SocialMediaConnection, 
  SocialMediaCapability, 
  AccessLevel,
  AgentSocialMediaPermission
} from '../../services/social-media/database/ISocialMediaDatabase';

interface SocialMediaPermissionsData {
  connections: SocialMediaConnection[];
  permissions: AgentSocialMediaPermission[];
  approvalSettings: Array<{
    toolName: string;
    needsApproval: boolean;
  }>;
  error?: string;
}

interface SocialMediaPermissionsTabProps {
  agentId?: string;
}

const SocialMediaPermissionsTab: React.FC<SocialMediaPermissionsTabProps> = ({ agentId }) => {
  const [permissionsData, setPermissionsData] = useState<SocialMediaPermissionsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());

  const fetchSocialMediaPermissions = async () => {
    if (!agentId) return;
    
    setIsLoading(true);
    try {
      // Fetch connections, permissions, and approval settings in parallel
      const [connectionsRes, permissionsRes, approvalRes] = await Promise.all([
        fetch('/api/social-media/connections'),
        fetch(`/api/social-media/permissions?agentId=${agentId}`),
        fetch(`/api/agent/social-media-approval?agentId=${agentId}`)
      ]);

      const [connectionsData, permissionsData, approvalData] = await Promise.all([
        connectionsRes.json(),
        permissionsRes.json(),
        approvalRes.json()
      ]);

      setPermissionsData({
        connections: connectionsData.success ? connectionsData.connections : [],
        permissions: permissionsData.success ? permissionsData.permissions : [],
        approvalSettings: approvalData.settings || [],
        error: connectionsData.error || permissionsData.error || approvalData.error
      });
    } catch (error) {
      console.error('Error fetching social media permissions:', error);
      setPermissionsData({
        connections: [],
        permissions: [],
        approvalSettings: [],
        error: 'Failed to load social media permissions'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (agentId) {
      fetchSocialMediaPermissions();
    }
  }, [agentId]);

  const toggleConnectionExpansion = (connectionId: string) => {
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

  const getCapabilityDisplayName = (capability: SocialMediaCapability): string => {
    const names: Partial<Record<SocialMediaCapability, string>> = {
      [SocialMediaCapability.POST_CREATE]: 'Create Posts',
      [SocialMediaCapability.POST_READ]: 'Read Posts',
      [SocialMediaCapability.POST_EDIT]: 'Edit Posts',
      [SocialMediaCapability.POST_DELETE]: 'Delete Posts',
      [SocialMediaCapability.POST_SCHEDULE]: 'Schedule Posts',
      [SocialMediaCapability.ANALYTICS_READ]: 'Read Analytics',
      [SocialMediaCapability.COMMENT_READ]: 'Read Comments',
      [SocialMediaCapability.COMMENT_CREATE]: 'Create Comments',
      [SocialMediaCapability.DM_READ]: 'Read Direct Messages',
      [SocialMediaCapability.DM_SEND]: 'Send Direct Messages',
    };
    return names[capability] || capability;
  };

  const getAccessLevelColor = (level: AccessLevel): string => {
    switch (level) {
      case AccessLevel.READ: return 'bg-green-900 text-green-300';
      case AccessLevel.LIMITED: return 'bg-yellow-900 text-yellow-300';
      case AccessLevel.FULL: return 'bg-red-900 text-red-300';
      default: return 'bg-gray-700 text-gray-300';
    }
  };

  const getConnectionPermissions = (connectionId: string) => {
    return permissionsData?.permissions.filter(p => p.connectionId === connectionId) || [];
  };

  const getApprovalSetting = (toolName: string): boolean => {
    return permissionsData?.approvalSettings.find(s => s.toolName === toolName)?.needsApproval || false;
  };

  if (!agentId) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">Select an agent to view social media permissions</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading social media permissions...</span>
        </div>
      </div>
    );
  }

  if (!permissionsData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-2">⚠️</div>
          <p className="text-red-600">Failed to load social media permissions</p>
          <button 
            onClick={fetchSocialMediaPermissions}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (permissionsData.connections.length === 0) {
    return (
      <div className="text-center py-8">
        <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400 mb-2">No social media connections available</p>
        <p className="text-gray-500 text-sm">Connect social media accounts to assign permissions to agents</p>
      </div>
    );
  }

  const totalPermissions = permissionsData.permissions.length;
  const connectionsWithPermissions = new Set(permissionsData.permissions.map(p => p.connectionId)).size;
  const approvalCount = permissionsData.approvalSettings.filter(s => s.needsApproval).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            📱 Social Media Permissions
          </h1>
          <p className="text-gray-400 mt-1">
            Social media platform access and approval settings for this agent
          </p>
        </div>
        <button
          onClick={fetchSocialMediaPermissions}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300">Connected Accounts</h3>
          <div className="text-2xl font-bold mt-1 text-white">
            {permissionsData.connections.length}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {connectionsWithPermissions} with permissions
          </p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300">Total Permissions</h3>
          <div className="text-2xl font-bold mt-1 text-white">
            {totalPermissions}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Granted capabilities
          </p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300">Approval Required</h3>
          <div className="text-2xl font-bold text-yellow-400 mt-1">
            {approvalCount}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Actions need approval
          </p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300">Status</h3>
          <div className="text-2xl font-bold text-green-400 mt-1">
            {totalPermissions > 0 ? 'Active' : 'None'}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Permission status
          </p>
        </div>
      </div>

      {/* Connections List */}
      <div className="space-y-4">
        {permissionsData.connections.map((connection) => {
          const isExpanded = expandedConnections.has(connection.id);
          const connectionPermissions = getConnectionPermissions(connection.id);
          
          return (
            <div key={connection.id} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
              <div 
                className="p-4 hover:bg-gray-700 transition-colors cursor-pointer"
                onClick={() => toggleConnectionExpansion(connection.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {isExpanded ? '🔽' : '▶️'}
                    </span>
                    <span className="text-xl">{getProviderIcon(connection.provider)}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {connection.accountDisplayName}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {getProviderName(connection.provider)} • @{connection.accountUsername}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-gray-600 text-gray-300 rounded text-sm">
                      {connectionPermissions.length} permission{connectionPermissions.length !== 1 ? 's' : ''}
                    </span>
                    {connectionPermissions.length > 0 && (
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    )}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-600">
                  <div className="p-4 bg-gray-900">
                    {connectionPermissions.length === 0 ? (
                      <div className="bg-yellow-900 border border-yellow-700 rounded-md p-4">
                        <p className="text-yellow-300">No permissions granted for this connection</p>
                        <p className="text-yellow-400 text-sm mt-1">
                          Configure permissions in the agent edit page
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {connectionPermissions.map((permission) => (
                          <div key={permission.id} className="bg-gray-700 border border-gray-600 rounded-md p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-blue-400" />
                                <span className="font-medium text-white">Permission Set</span>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs ${getAccessLevelColor(permission.accessLevel)}`}>
                                {permission.accessLevel}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                              {permission.capabilities.map((capability) => (
                                <div key={capability} className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-300">
                                  {getCapabilityDisplayName(capability)}
                                </div>
                              ))}
                            </div>

                            <div className="text-xs text-gray-400 space-y-1">
                              <p>Granted by: {permission.grantedBy}</p>
                              <p>Granted: {new Date(permission.grantedAt).toLocaleDateString()}</p>
                              {permission.restrictions && Object.keys(permission.restrictions).length > 0 && (
                                <p>Restrictions: {JSON.stringify(permission.restrictions)}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SocialMediaPermissionsTab; 