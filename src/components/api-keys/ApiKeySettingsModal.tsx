'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Settings, AlertCircle, CheckCircle, Eye, EyeOff, Key, Save } from 'lucide-react';

// Types for API key integrations
export enum ApiKeyProvider {
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  CODA = 'CODA',
  STRIPE = 'STRIPE',
  SENDGRID = 'SENDGRID',
  MAILCHIMP = 'MAILCHIMP',
  TYPEFORM = 'TYPEFORM',
  CALENDLY = 'CALENDLY'
}

export enum ApiKeyStatus {
  ACTIVE = 'ACTIVE',
  INVALID = 'INVALID',
  EXPIRED = 'EXPIRED',
  NOT_SET = 'NOT_SET'
}

export interface ApiKeyConnection {
  id: string;
  provider: ApiKeyProvider;
  displayName: string;
  apiKey: string; // Masked for display
  status: ApiKeyStatus;
  lastValidated?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ApiKeyFormData {
  provider: ApiKeyProvider;
  apiKey: string;
  displayName?: string;
}

interface ApiKeySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  organizationId?: string;
}

export const ApiKeySettingsModal: React.FC<ApiKeySettingsModalProps> = ({
  isOpen,
  onClose,
  userId,
  organizationId
}) => {
  const [connections, setConnections] = useState<ApiKeyConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<ApiKeyProvider | null>(null);
  const [formData, setFormData] = useState<ApiKeyFormData>({
    provider: ApiKeyProvider.OPENAI,
    apiKey: '',
    displayName: ''
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadApiKeys();
    }
  }, [isOpen]);

  const loadApiKeys = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // TODO: Implement /api/api-keys/connections endpoint
      // For now, return empty array
      setConnections([]);
    } catch (error) {
      console.error('Error loading API keys:', error);
      setError(error instanceof Error ? error.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (provider: ApiKeyProvider) => {
    const existing = connections.find(conn => conn.provider === provider);
    setEditingProvider(provider);
    setFormData({
      provider,
      apiKey: '',
      displayName: existing?.displayName || getProviderDisplayName(provider)
    });
    setShowApiKey(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // TODO: Implement API key save endpoint
      console.log('Saving API key for', formData.provider, '(key hidden for security)');
      
      alert(`API key for ${getProviderDisplayName(formData.provider)} will be implemented in the API key management system`);
      
      setEditingProvider(null);
      setFormData({ provider: ApiKeyProvider.OPENAI, apiKey: '', displayName: '' });
    } catch (error) {
      console.error('Error saving API key:', error);
      setError(error instanceof Error ? error.message : 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const getProviderDisplayName = (provider: ApiKeyProvider): string => {
    switch (provider) {
      case ApiKeyProvider.CODA:
        return 'Coda';
      case ApiKeyProvider.STRIPE:
        return 'Stripe';
      case ApiKeyProvider.SENDGRID:
        return 'SendGrid';
      case ApiKeyProvider.MAILCHIMP:
        return 'Mailchimp';
      case ApiKeyProvider.TYPEFORM:
        return 'Typeform';
      case ApiKeyProvider.CALENDLY:
        return 'Calendly';
      default:
        return provider;
    }
  };

  const getProviderIcon = (provider: ApiKeyProvider): string => {
    switch (provider) {
      case ApiKeyProvider.CODA:
        return '📄';
      case ApiKeyProvider.STRIPE:
        return '💳';
      case ApiKeyProvider.SENDGRID:
        return '📧';
      case ApiKeyProvider.MAILCHIMP:
        return '🐵';
      case ApiKeyProvider.TYPEFORM:
        return '📝';
      case ApiKeyProvider.CALENDLY:
        return '📅';
      default:
        return '🔑';
    }
  };

  const getProviderDescription = (provider: ApiKeyProvider): string => {
    switch (provider) {
      case ApiKeyProvider.CODA:
        return 'Document and database management';
      case ApiKeyProvider.STRIPE:
        return 'Payment processing and billing';
      case ApiKeyProvider.SENDGRID:
        return 'Email delivery and marketing';
      case ApiKeyProvider.MAILCHIMP:
        return 'Email marketing and automation';
      case ApiKeyProvider.TYPEFORM:
        return 'Form and survey creation';
      case ApiKeyProvider.CALENDLY:
        return 'Meeting scheduling and calendar management';
      default:
        return 'API integration';
    }
  };

  // Available providers (user-configurable only)
  const availableProviders = [
    ApiKeyProvider.CODA,
    ApiKeyProvider.STRIPE,
    ApiKeyProvider.SENDGRID,
    ApiKeyProvider.MAILCHIMP,
    ApiKeyProvider.TYPEFORM,
    ApiKeyProvider.CALENDLY
  ];

  // Service-provided APIs (shown as info only)
  const serviceProvidedApis = [
    {
      name: 'OpenAI',
      icon: '🤖',
      description: 'AI language models and completions',
      status: 'Provided by service'
    },
    {
      name: 'OpenRouter',
      icon: '🔀',
      description: 'Multi-model AI routing and access',
      status: 'Provided by service'
    },
    {
      name: 'Apify',
      icon: '🕷️',
      description: 'Web scraping and automation',
      status: 'Provided by service'
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center">
              <Key className="mr-2 h-6 w-6" />
              API Keys
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Configure your own API keys for additional integrations. Core AI services (OpenAI, OpenRouter, Apify) are included.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Edit Form */}
        {editingProvider && (
          <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center">
              <span className="text-2xl mr-2">{getProviderIcon(editingProvider)}</span>
              Configure {getProviderDisplayName(editingProvider)} API Key
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  placeholder={getProviderDisplayName(editingProvider)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={formData.apiKey}
                    onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 pr-12"
                    placeholder="Enter your API key..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {getProviderDescription(editingProvider)}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setEditingProvider(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.apiKey.trim() || saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save API Key
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* API Key List */}
        <div className="space-y-6">
          {/* Service-Provided APIs */}
          <div>
            <h3 className="text-lg font-medium text-white mb-2">Service-Provided APIs</h3>
            <p className="text-gray-400 text-sm mb-4">
              These APIs are included with your service and don't require configuration
            </p>
            
            <div className="space-y-3">
              {serviceProvidedApis.map((api) => (
                <div
                  key={api.name}
                  className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">
                        {api.icon}
                      </span>
                      <div>
                        <h4 className="text-white font-medium">
                          {api.name}
                        </h4>
                        <p className="text-gray-400 text-sm">
                          {api.description}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="px-3 py-1 bg-green-900/20 text-green-400 text-xs rounded border border-green-800">
                        ✓ {api.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User-Configurable APIs */}
          <div>
            <h3 className="text-lg font-medium text-white mb-2">Your API Keys</h3>
            <p className="text-gray-400 text-sm mb-4">
              Configure your own API keys for additional services
            </p>
            
            <div className="space-y-4">
              {availableProviders.map((provider) => {
                const connection = connections.find(conn => conn.provider === provider);
                
                return (
                  <div
                    key={provider}
                    className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
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
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(provider)}
                          className="flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Configure
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-400 mr-2 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-yellow-400 font-medium mb-1">Security Notice</p>
              <p className="text-yellow-300">
                API keys are encrypted and stored securely. They are only used for authenticated requests to their respective services.
                Never share your API keys or commit them to version control.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 