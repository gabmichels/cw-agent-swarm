'use client';

import React, { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  Trash2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { 
  SocialMediaConnection, 
  SocialMediaConnectionStatus, 
  SocialMediaProvider 
} from '../../services/social-media/database/ISocialMediaDatabase';

interface SocialMediaConnectionCardProps {
  connection: SocialMediaConnection;
  onDisconnect: () => void;
  onRefresh: () => void;
}

export const SocialMediaConnectionCard: React.FC<SocialMediaConnectionCardProps> = ({
  connection,
  onDisconnect,
  onRefresh
}) => {
  const [isValidating, setIsValidating] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);

  const getStatusIcon = (status: SocialMediaConnectionStatus) => {
    switch (status) {
      case SocialMediaConnectionStatus.ACTIVE:
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case SocialMediaConnectionStatus.EXPIRED:
        return <XCircle className="h-5 w-5 text-yellow-400" />;
      case SocialMediaConnectionStatus.ERROR:
        return <AlertCircle className="h-5 w-5 text-red-400" />;
      case SocialMediaConnectionStatus.REVOKED:
        return <XCircle className="h-5 w-5 text-gray-400" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: SocialMediaConnectionStatus) => {
    switch (status) {
      case SocialMediaConnectionStatus.ACTIVE:
        return 'Active';
      case SocialMediaConnectionStatus.EXPIRED:
        return 'Expired';
      case SocialMediaConnectionStatus.ERROR:
        return 'Error';
      case SocialMediaConnectionStatus.REVOKED:
        return 'Revoked';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: SocialMediaConnectionStatus) => {
    switch (status) {
      case SocialMediaConnectionStatus.ACTIVE:
        return 'text-green-400';
      case SocialMediaConnectionStatus.EXPIRED:
        return 'text-yellow-400';
      case SocialMediaConnectionStatus.ERROR:
        return 'text-red-400';
      case SocialMediaConnectionStatus.REVOKED:
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  const getProviderIcon = (provider: SocialMediaProvider): string => {
    switch (provider) {
      case SocialMediaProvider.TWITTER:
        return '🐦';
      case SocialMediaProvider.LINKEDIN:
        return '💼';
      case SocialMediaProvider.FACEBOOK:
        return '📘';
      case SocialMediaProvider.INSTAGRAM:
        return '📸';
      case SocialMediaProvider.REDDIT:
        return '🤖';
      case SocialMediaProvider.TIKTOK:
        return '🎵';
      default:
        return '📱';
    }
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

  const handleValidateConnection = async () => {
    setIsValidating(true);
    try {
      const response = await fetch(`/api/social-media/connections/${connection.id}`, {
        method: 'GET',
      });
      
      const data = await response.json();
      
      if (data.success) {
        onRefresh(); // Refresh the connection list to show updated status
      } else {
        console.error('Connection validation failed:', data.error);
      }
    } catch (error) {
      console.error('Error validating connection:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  return (
    <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <span className="text-2xl">{getProviderIcon(connection.provider)}</span>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-white font-medium truncate">
                {connection.accountDisplayName}
              </h3>
              <span className="text-gray-400 text-sm">
                @{connection.accountUsername}
              </span>
            </div>
            
            <div className="flex items-center space-x-2 mb-2">
              {getStatusIcon(connection.connectionStatus)}
              <span className={`text-sm ${getStatusColor(connection.connectionStatus)}`}>
                {getStatusText(connection.connectionStatus)}
              </span>
              <span className="text-gray-400 text-sm">•</span>
              <span className="text-gray-400 text-sm">
                {getProviderDisplayName(connection.provider)}
              </span>
              <span className="text-gray-400 text-sm">•</span>
              <span className="text-gray-400 text-sm capitalize">
                {connection.accountType}
              </span>
            </div>
            
            <div className="text-xs text-gray-400 space-y-1">
              <div>Last validated: {formatDate(connection.lastValidated)}</div>
              <div>Connected: {formatDate(connection.createdAt)}</div>
              <div>Scopes: {connection.scopes.length} permissions</div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          <button
            onClick={handleValidateConnection}
            disabled={isValidating}
            className="p-2 text-gray-400 hover:text-blue-400 disabled:opacity-50"
            title="Validate connection"
          >
            <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={onDisconnect}
            className="p-2 text-gray-400 hover:text-red-400"
            title="Disconnect account"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* Show scopes in an expandable section */}
      <div className="mt-3">
        <button 
          className="text-sm text-gray-400 cursor-pointer hover:text-gray-300 flex items-center space-x-1"
          onClick={() => setShowPermissions(!showPermissions)}
        >
          {showPermissions ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span>View permissions ({connection.scopes.length})</span>
        </button>
        {showPermissions && (
          <div className="mt-2 pl-4">
            <div className="flex flex-wrap gap-1">
              {connection.scopes.map((scope, index) => (
                <span 
                  key={index}
                  className="inline-block bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded"
                >
                  {scope}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Show error message if connection has an error */}
      {(() => {
        if (connection.connectionStatus === SocialMediaConnectionStatus.ERROR && connection.metadata?.error) {
          return (
            <div className="mt-3 p-2 bg-red-900/20 border border-red-800 rounded text-red-400 text-sm">
              Error: {String(connection.metadata.error)}
            </div>
          );
        }
        
        // Show migration message for expired connections that need re-authentication
        if (connection.connectionStatus === SocialMediaConnectionStatus.EXPIRED && 
            connection.metadata?.error && 
            String(connection.metadata.error).includes('Encryption format migration')) {
          return (
            <div className="mt-3 p-2 bg-blue-900/20 border border-blue-800 rounded text-blue-400 text-sm">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Reconnection Required</div>
                  <div className="text-xs mt-1 text-blue-300">
                    This connection uses an older security format. Please reconnect to continue using this account.
                  </div>
                </div>
              </div>
            </div>
          );
        }
        
        return null;
      })()}
    </div>
  );
}; 