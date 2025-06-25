'use client';

import { Loader2, Plus, Settings, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

// Types for third-party tool integrations
export enum ThirdPartyToolProvider {
  ZOOM = 'ZOOM',
  DROPBOX = 'DROPBOX',
  ONEDRIVE = 'ONEDRIVE',
  WHATSAPP_BUSINESS = 'WHATSAPP_BUSINESS',
  CANVA = 'CANVA',
  YOUTUBE = 'YOUTUBE',
  STRIPE = 'STRIPE',
  N8N_CLOUD = 'N8N_CLOUD'
}

export enum ThirdPartyToolConnectionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  ERROR = 'ERROR',
  DISABLED = 'DISABLED'
}

export interface ThirdPartyToolConnection {
  id: string;
  provider: ThirdPartyToolProvider;
  providerAccountId: string;
  accountDisplayName: string;
  accountEmail?: string;
  connectionStatus: ThirdPartyToolConnectionStatus;
  scopes: string[];
  lastValidated: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ConnectionsState {
  connections: ThirdPartyToolConnection[];
  loading: boolean;
  error: string | null;
}

interface ThirdPartyToolsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  organizationId?: string;
}

export const ThirdPartyToolsSettingsModal: React.FC<ThirdPartyToolsSettingsModalProps> = ({
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
  const [connecting, setConnecting] = useState<ThirdPartyToolProvider | null>(null);

  // Load connections when modal opens
  useEffect(() => {
    if (isOpen) {
      loadConnections();
    }
  }, [isOpen, userId, organizationId]);

  const loadConnections = async () => {
    setConnectionsState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // For now, return empty array since API doesn't exist yet
      // TODO: Implement /api/third-party-tools/connections endpoint
      setConnectionsState(prev => ({
        ...prev,
        connections: [],
        loading: false
      }));
    } catch (error) {
      console.error('Error loading third-party tool connections:', error);
      setConnectionsState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load connections'
      }));
    }
  };

  const handleConnect = async (provider: ThirdPartyToolProvider) => {
    setConnecting(provider);
    
    try {
      console.log(`Connecting to ${provider}`);
      
      // TODO: Implement actual OAuth flow
      alert(`${getProviderDisplayName(provider)} connection will be implemented in Phase 2.5`);
    } catch (error) {
      console.error('Error connecting to third-party tool:', error);
      alert(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setConnecting(null);
    }
  };

  const getProviderDisplayName = (provider: ThirdPartyToolProvider): string => {
    switch (provider) {
      case ThirdPartyToolProvider.ZOOM:
        return 'Zoom';
      case ThirdPartyToolProvider.DROPBOX:
        return 'Dropbox';
      case ThirdPartyToolProvider.ONEDRIVE:
        return 'OneDrive';
      case ThirdPartyToolProvider.WHATSAPP_BUSINESS:
        return 'WhatsApp Business';
      case ThirdPartyToolProvider.CANVA:
        return 'Canva';
      case ThirdPartyToolProvider.YOUTUBE:
        return 'YouTube';
      case ThirdPartyToolProvider.STRIPE:
        return 'Stripe';
      case ThirdPartyToolProvider.N8N_CLOUD:
        return 'N8N Cloud';
      default:
        return provider;
    }
  };

  const getProviderIcon = (provider: ThirdPartyToolProvider): string => {
    switch (provider) {
      case ThirdPartyToolProvider.ZOOM:
        return '📹';
      case ThirdPartyToolProvider.DROPBOX:
        return '📦';
      case ThirdPartyToolProvider.ONEDRIVE:
        return '☁️';
      case ThirdPartyToolProvider.WHATSAPP_BUSINESS:
        return '💬';
      case ThirdPartyToolProvider.CANVA:
        return '🎨';
      case ThirdPartyToolProvider.YOUTUBE:
        return '📺';
      case ThirdPartyToolProvider.STRIPE:
        return '💳';
      case ThirdPartyToolProvider.N8N_CLOUD:
        return '🌐';
      default:
        return '🔧';
    }
  };

  const getProviderDescription = (provider: ThirdPartyToolProvider): string => {
    switch (provider) {
      case ThirdPartyToolProvider.ZOOM:
        return 'Video conferencing and meetings';
      case ThirdPartyToolProvider.DROPBOX:
        return 'Cloud file storage and sharing';
      case ThirdPartyToolProvider.ONEDRIVE:
        return 'Microsoft cloud storage';
      case ThirdPartyToolProvider.WHATSAPP_BUSINESS:
        return 'Business messaging platform';
      case ThirdPartyToolProvider.CANVA:
        return 'Design and visual content creation';
      case ThirdPartyToolProvider.YOUTUBE:
        return 'Video hosting and management';
      case ThirdPartyToolProvider.STRIPE:
        return 'Payment processing and billing';
      case ThirdPartyToolProvider.N8N_CLOUD:
        return 'Workflow automation platform';
      default:
        return 'Third-party integration';
    }
  };

  // Available providers (Phase 2.5 focus)
  const availableProviders = [
    ThirdPartyToolProvider.ZOOM,
    ThirdPartyToolProvider.DROPBOX,
    ThirdPartyToolProvider.ONEDRIVE,
    ThirdPartyToolProvider.WHATSAPP_BUSINESS,
    ThirdPartyToolProvider.N8N_CLOUD
  ];

  // Coming soon providers
  const comingSoonProviders = [
    ThirdPartyToolProvider.CANVA,
    ThirdPartyToolProvider.YOUTUBE,
    ThirdPartyToolProvider.STRIPE
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center">
              <Settings className="mr-2 h-6 w-6" />
              Third-Party Tools
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Connect external services and tools for enhanced functionality
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Available Providers */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-white mb-4">Available Tools</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableProviders.map((provider) => {
              const isConnecting = connecting === provider;

              return (
                <div
                  key={provider}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-center mb-3">
                    <span className="text-2xl mr-3">
                      {getProviderIcon(provider)}
                    </span>
                    <div>
                      <h4 className="text-white font-medium">
                        {getProviderDisplayName(provider)}
                      </h4>
                      <p className="text-gray-400 text-sm">
                        {getProviderDescription(provider)}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleConnect(provider)}
                    disabled={isConnecting}
                    className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      isConnecting
                        ? 'bg-blue-900/20 text-blue-400 border border-blue-800 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isConnecting ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Connecting...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <Plus className="h-4 w-4 mr-2" />
                        Connect
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coming Soon */}
        {comingSoonProviders.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Coming Soon</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comingSoonProviders.map((provider) => (
                <div
                  key={provider}
                  className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 opacity-60"
                >
                  <div className="flex items-center mb-3">
                    <span className="text-2xl mr-3 grayscale">
                      {getProviderIcon(provider)}
                    </span>
                    <div>
                      <h4 className="text-gray-300 font-medium">
                        {getProviderDisplayName(provider)}
                      </h4>
                      <p className="text-gray-500 text-sm">
                        {getProviderDescription(provider)}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    disabled
                    className="w-full py-2 px-4 rounded-lg text-sm font-medium bg-gray-700/50 text-gray-400 border border-gray-600/50 cursor-not-allowed"
                  >
                    Coming Soon
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 