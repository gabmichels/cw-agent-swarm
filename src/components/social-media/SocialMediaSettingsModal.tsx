'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Settings, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { SocialMediaProvider, SocialMediaConnection, SocialMediaConnectionStatus } from '../../services/social-media/database/ISocialMediaDatabase';
import { SocialMediaConnectionCard } from './SocialMediaConnectionCard';
import { getSocialMediaScopes } from '../../services/social-media/scopes/SocialMediaScopes';

interface SocialMediaSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  organizationId?: string;
}

interface ConnectionsState {
  connections: SocialMediaConnection[];
  loading: boolean;
  error: string | null;
}

export const SocialMediaSettingsModal: React.FC<SocialMediaSettingsModalProps> = ({
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
  const [connecting, setConnecting] = useState<SocialMediaProvider | null>(null);

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

      const response = await fetch(`/api/social-media/connections?${params}`);
      const data = await response.json();

      if (data.success) {
        setConnectionsState(prev => ({
          ...prev,
          connections: data.connections,
          loading: false
        }));
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('socialMediaConnectionsUpdated'));
      } else {
        throw new Error(data.error || 'Failed to load connections');
      }
    } catch (error) {
      console.error('Error loading social media connections:', error);
      setConnectionsState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load connections'
      }));
    }
  };

  const handleConnect = async (provider: SocialMediaProvider) => {
    setConnecting(provider);
    
    try {
      const scopes = getDefaultScopes(provider);
      console.log(`Connecting to ${provider} with scopes:`, scopes);
      
      const response = await fetch('/api/social-media/connect', {
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
      console.error('Error connecting to social media platform:', error);
      alert(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect this social media account? This will revoke access for all agents.')) {
      return;
    }

    try {
      const response = await fetch(`/api/social-media/connections/${connectionId}`, {
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
      console.error('Error disconnecting social media account:', error);
      alert(`Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getDefaultScopes = (provider: SocialMediaProvider): string[] => {
    // Use the centralized scope configuration - single source of truth
    return getSocialMediaScopes(provider);
  };

  const getProviderDisplayName = (provider: SocialMediaProvider): string => {
    switch (provider) {
      case SocialMediaProvider.TWITTER:
        return 'Twitter / X';
      case SocialMediaProvider.LINKEDIN:
        return 'LinkedIn';
      case SocialMediaProvider.FACEBOOK:
        return 'Facebook';
      case SocialMediaProvider.INSTAGRAM:
        return 'Instagram';
      case SocialMediaProvider.REDDIT:
        return 'Reddit';
      case SocialMediaProvider.TIKTOK:
        return 'TikTok';
      default:
        return provider;
    }
  };

  const getProviderIcon = (provider: SocialMediaProvider): string => {
    switch (provider) {
      case SocialMediaProvider.TWITTER:
        return '🐦'; // Twitter bird
      case SocialMediaProvider.LINKEDIN:
        return '💼'; // LinkedIn professional
      case SocialMediaProvider.FACEBOOK:
        return '📘'; // Facebook blue
      case SocialMediaProvider.INSTAGRAM:
        return '📸'; // Instagram camera
      case SocialMediaProvider.REDDIT:
        return '🤖'; // Reddit alien
      case SocialMediaProvider.TIKTOK:
        return '🎵'; // TikTok music
      default:
        return '📱';
    }
  };

  const getProviderDescription = (provider: SocialMediaProvider): string => {
    switch (provider) {
      case SocialMediaProvider.TWITTER:
        return 'Post tweets, threads, and engage with your audience';
      case SocialMediaProvider.LINKEDIN:
        return 'Share professional content and network updates';
      case SocialMediaProvider.FACEBOOK:
        return 'Create posts, stories, and manage your page';
      case SocialMediaProvider.INSTAGRAM:
        return 'Share photos, videos, stories, and reels';
      case SocialMediaProvider.REDDIT:
        return 'Post to communities and engage in discussions';
      case SocialMediaProvider.TIKTOK:
        return 'Upload videos, create content, and go viral';
      default:
        return 'Connect to manage your social media presence';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            Social Media Connections
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
          <h3 className="text-lg font-medium text-white mb-4">Connect New Platform</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(SocialMediaProvider).map((provider) => (
              <button
                key={provider}
                onClick={() => handleConnect(provider)}
                disabled={connecting === provider}
                className="flex flex-col items-start p-4 border border-gray-600 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-3">{getProviderIcon(provider)}</span>
                  <div className="text-left">
                    <div className="text-white font-medium">
                      {getProviderDisplayName(provider)}
                    </div>
                    {connecting === provider && (
                      <div className="flex items-center text-blue-400 text-sm mt-1">
                        <Clock className="h-3 w-3 mr-1 animate-spin" />
                        Connecting...
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-gray-400 text-sm text-left">
                  {getProviderDescription(provider)}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Existing connections section */}
        <div>
          <h3 className="text-lg font-medium text-white mb-4">Connected Accounts</h3>
          
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
                  <p>No social media connections found.</p>
                  <p className="text-sm">Connect a platform above to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {connectionsState.connections.map((connection) => (
                    <SocialMediaConnectionCard
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