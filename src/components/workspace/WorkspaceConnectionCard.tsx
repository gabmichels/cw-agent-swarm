'use client';

import React, { useState } from 'react';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Trash2, 
  RefreshCw, 
  Settings,
  Mail,
  Calendar,
  FileText,
  HardDrive
} from 'lucide-react';
import { 
  WorkspaceConnection, 
  WorkspaceProvider, 
  ConnectionStatus,
  WorkspaceCapabilityType 
} from '../../services/database/types';

interface WorkspaceConnectionCardProps {
  connection: WorkspaceConnection;
  onDisconnect: () => void;
  onRefresh: () => void;
}

export const WorkspaceConnectionCard: React.FC<WorkspaceConnectionCardProps> = ({
  connection,
  onDisconnect,
  onRefresh
}) => {
  const [validating, setValidating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    status: ConnectionStatus;
    error?: string;
  } | null>(null);

  const handleValidate = async () => {
    setValidating(true);
    try {
      const response = await fetch(`/api/workspace/connections/${connection.id}`);
      const data = await response.json();
      
      if (data.success) {
        setValidationResult(data.validation);
      } else {
        setValidationResult({
          isValid: false,
          status: 'ERROR' as ConnectionStatus,
          error: data.error || 'Validation failed'
        });
      }
    } catch (error) {
      console.error('Error validating connection:', error);
      setValidationResult({
        isValid: false,
        status: 'ERROR' as ConnectionStatus,
        error: 'Failed to validate connection'
      });
    } finally {
      setValidating(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/workspace/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionId: connection.id,
          force: true
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setValidationResult({
          isValid: true,
          status: 'ACTIVE' as ConnectionStatus,
          error: undefined
        });
        // Trigger a refresh of the parent component
        onRefresh();
      } else {
        setValidationResult({
          isValid: false,
          status: 'EXPIRED' as ConnectionStatus,
          error: data.error || 'Refresh failed'
        });
      }
    } catch (error) {
      console.error('Error refreshing connection:', error);
      setValidationResult({
        isValid: false,
        status: 'ERROR' as ConnectionStatus,
        error: 'Failed to refresh connection'
      });
    } finally {
      setRefreshing(false);
    }
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
        return '🔵';
      case WorkspaceProvider.MICROSOFT_365:
        return '🟦';
      case WorkspaceProvider.ZOHO:
        return '🟠';
      default:
        return '⚡';
    }
  };

  const getStatusIcon = (status: ConnectionStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'EXPIRED':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      case 'REVOKED':
      case 'ERROR':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: ConnectionStatus): string => {
    switch (status) {
      case 'ACTIVE':
        return 'text-green-400';
      case 'EXPIRED':
        return 'text-yellow-400';
      case 'REVOKED':
      case 'ERROR':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getCapabilityIcon = (capability: WorkspaceCapabilityType) => {
    if (capability.includes('EMAIL')) return <Mail className="h-3 w-3" />;
    if (capability.includes('CALENDAR')) return <Calendar className="h-3 w-3" />;
    if (capability.includes('DOCUMENT')) return <FileText className="h-3 w-3" />;
    if (capability.includes('DRIVE')) return <HardDrive className="h-3 w-3" />;
    return <Settings className="h-3 w-3" />;
  };

  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  return (
    <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          <span className="text-2xl mr-3">{getProviderIcon(connection.provider as WorkspaceProvider)}</span>
          <div>
            <h4 className="text-white font-medium">
              {getProviderDisplayName(connection.provider as WorkspaceProvider)}
            </h4>
            <p className="text-gray-400 text-sm">{connection.email}</p>
            {connection.displayName && (
              <p className="text-gray-300 text-sm">{connection.displayName}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {getStatusIcon(connection.status as ConnectionStatus)}
          <span className={`text-sm ${getStatusColor(connection.status as ConnectionStatus)}`}>
            {connection.status}
          </span>
        </div>
      </div>

      {/* Connection details */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <span className="text-gray-400">Account Type:</span>
          <span className="text-white ml-2 capitalize">{connection.accountType?.toLowerCase()}</span>
        </div>
        <div>
          <span className="text-gray-400">Connection Type:</span>
          <span className="text-white ml-2">{connection.connectionType}</span>
        </div>
        <div>
          <span className="text-gray-400">Connected:</span>
          <span className="text-white ml-2">{formatDate(connection.createdAt)}</span>
        </div>
        {connection.lastSyncAt && (
          <div>
            <span className="text-gray-400">Last Sync:</span>
            <span className="text-white ml-2">{formatDate(connection.lastSyncAt)}</span>
          </div>
        )}
      </div>

      {/* Scopes/Capabilities */}
      {connection.scopes && connection.scopes.length > 0 && (
        <div className="mb-4">
          <span className="text-gray-400 text-sm">Granted Permissions:</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {connection.scopes.split(' ').filter(scope => scope.length > 0).map((scope, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded"
              >
                {scope.includes('gmail') && <Mail className="h-3 w-3 mr-1" />}
                {scope.includes('calendar') && <Calendar className="h-3 w-3 mr-1" />}
                {scope.includes('drive') && <HardDrive className="h-3 w-3 mr-1" />}
                {scope.split('/').pop()?.split('.').pop() || scope}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Expired connection help message */}
      {connection.status === 'EXPIRED' && !validationResult && (
        <div className="mb-4 p-3 rounded border bg-yellow-900/20 border-yellow-500 text-yellow-400">
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-2" />
            <span className="text-sm">Connection Expired</span>
          </div>
          <p className="text-sm mt-1 opacity-80">
            If this connection was created recently, the refresh token may still be valid. 
            Try the "Refresh Tokens" button below to attempt automatic renewal.
          </p>
        </div>
      )}

      {/* Validation result */}
      {validationResult && (
        <div className={`mb-4 p-3 rounded border ${
          validationResult.isValid 
            ? 'bg-green-900/20 border-green-500 text-green-400' 
            : 'bg-red-900/20 border-red-500 text-red-400'
        }`}>
          <div className="flex items-center">
            {validationResult.isValid ? (
              <CheckCircle className="h-4 w-4 mr-2" />
            ) : (
              <AlertCircle className="h-4 w-4 mr-2" />
            )}
            <span className="text-sm">
              {validationResult.isValid ? 'Connection is valid' : 'Connection has issues'}
            </span>
          </div>
          {validationResult.error && (
            <p className="text-sm mt-1 opacity-80">{validationResult.error}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <button
            onClick={handleValidate}
            disabled={validating}
            className="flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${validating ? 'animate-spin' : ''}`} />
            {validating ? 'Validating...' : 'Validate'}
          </button>
          
          {/* Show token refresh button for expired connections */}
          {connection.status === 'EXPIRED' ? (
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="flex items-center px-3 py-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing Tokens...' : 'Refresh Tokens'}
            </button>
          ) : (
            <button
              onClick={onRefresh}
              className="flex items-center px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reload Data
            </button>
          )}
        </div>

        <button
          onClick={onDisconnect}
          className="flex items-center px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Disconnect
        </button>
      </div>
    </div>
  );
}; 