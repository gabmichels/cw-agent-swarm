'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Settings, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { WorkspaceProvider, WorkspaceConnection, ConnectionStatus } from '../../services/database/types';
import { WorkspaceConnectionCard } from '@/components/workspace/WorkspaceConnectionCard';
import { getRequiredScopes } from '../../services/workspace/scopes/WorkspaceScopes';

interface WorkspaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  organizationId?: string;
}

interface ConnectionsState {
  connections: WorkspaceConnection[];
  loading: boolean;
  error: string | null;
}

export const WorkspaceSettingsModal: React.FC<WorkspaceSettingsModalProps> = ({
  isOpen,
  onClose,
  userId,
  organizationId
}) => {
  const [connectionsState, setConnectionsState] = useState<ConnectionsState>({
    connections: [],
    loading: false,
    error: null
  });
  const [connecting, setConnecting] = useState<WorkspaceProvider | null>(null);

  // Load connections when modal opens
  useEffect(() => {
    if (isOpen) {
      loadConnections();
    }
  }, [isOpen, userId, organizationId]);

  const loadConnections = async () => {
    setConnectionsState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (organizationId) params.append('organizationId', organizationId);

      const response = await fetch(`/api/workspace/connections?${params}`);
      const data = await response.json();

      if (data.success) {
        setConnectionsState(prev => ({
          ...prev,
          connections: data.connections,
          loading: false
        }));
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('workspaceConnectionsUpdated'));
      } else {
        throw new Error(data.error || 'Failed to load connections');
      }
    } catch (error) {
      console.error('Error loading connections:', error);
      setConnectionsState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load connections'
      }));
    }
  };

  const handleConnect = async (provider: WorkspaceProvider) => {
    setConnecting(provider);
    
    try {
      const scopes = getDefaultScopes(provider);
      console.log(`Connecting to ${provider} with scopes:`, scopes);
      
      const response = await fetch('/api/workspace/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          userId,
          organizationId,
          scopes
        }),
      });

      const data = await response.json();

      if (data.success && data.authUrl) {
        console.log(`Generated auth URL for ${provider}:`, data.authUrl);
        // Redirect to OAuth URL
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || 'Failed to initiate connection');
      }
    } catch (error) {
      console.error('Error connecting to workspace:', error);
      alert(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect this workspace? This will revoke access for all agents.')) {
      return;
    }

    try {
      const response = await fetch(`/api/workspace/connections/${connectionId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        // Reload connections
        await loadConnections();
      } else {
        throw new Error(data.error || 'Failed to disconnect');
      }
    } catch (error) {
      console.error('Error disconnecting workspace:', error);
      alert(`Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getDefaultScopes = (provider: WorkspaceProvider): string[] => {
    // Use the centralized scope configuration - single source of truth
    return getRequiredScopes(provider);
  };

  const getProviderDisplayName = (provider: WorkspaceProvider): string => {
    switch (provider) {
      case WorkspaceProvider.GOOGLE_WORKSPACE:
        return 'Google Workspace';
      case WorkspaceProvider.MICROSOFT_365:
        return 'Microsoft 365';
      case WorkspaceProvider.ZOHO:
        return 'Zoho';
      default:
        return provider;
    }
  };

  const getProviderIcon = (provider: WorkspaceProvider): string => {
    switch (provider) {
      case WorkspaceProvider.GOOGLE_WORKSPACE:
        return '🔵'; // Google blue
      case WorkspaceProvider.MICROSOFT_365:
        return '🟦'; // Microsoft blue
      case WorkspaceProvider.ZOHO:
        return '🟠'; // Zoho orange
      default:
        return '⚡';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            Workspace Connections
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Add new connection section */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-white mb-4">Connect New Workspace</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.values(WorkspaceProvider).map((provider) => (
              <button
                key={provider}
                onClick={() => handleConnect(provider)}
                disabled={connecting === provider}
                className="flex items-center p-4 border border-gray-600 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-2xl mr-3">{getProviderIcon(provider)}</span>
                <div className="text-left">
                  <div className="text-white font-medium">
                    {getProviderDisplayName(provider)}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {connecting === provider ? 'Connecting...' : 'Click to connect'}
                  </div>
                </div>
                {connecting === provider && (
                  <Clock className="ml-auto h-4 w-4 text-blue-400 animate-spin" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Existing connections section */}
        <div>
          <h3 className="text-lg font-medium text-white mb-4">Connected Workspaces</h3>
          
          {connectionsState.loading && (
            <div className="flex items-center justify-center py-8">
              <Clock className="h-6 w-6 text-blue-400 animate-spin mr-2" />
              <span className="text-gray-400">Loading connections...</span>
            </div>
          )}

          {connectionsState.error && (
            <div className="flex items-center p-4 bg-red-900/20 border border-red-500 rounded-lg mb-4">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <span className="text-red-400">{connectionsState.error}</span>
            </div>
          )}

          {!connectionsState.loading && !connectionsState.error && (
            <>
              {connectionsState.connections.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No workspace connections found.</p>
                  <p className="text-sm">Connect a workspace above to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {connectionsState.connections.map((connection) => (
                    <WorkspaceConnectionCard
                      key={connection.id}
                      connection={connection}
                      onDisconnect={() => handleDisconnect(connection.id)}
                      onRefresh={() => loadConnections()}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}; 