'use client';

import React, { useState } from 'react';
import { X, Settings, Wifi, Users, Shield, Bell, Palette, Database, Building } from 'lucide-react';
import { SocialMediaSettingsModal } from './social-media/SocialMediaSettingsModal';
import { ThirdPartyToolsSettingsModal } from './third-party-tools/ThirdPartyToolsSettingsModal';
import { ApiKeySettingsModal } from './api-keys/ApiKeySettingsModal';
import { DepartmentManagementModal } from './organization/DepartmentManagementModal';
import { NotificationSettingsPanel } from './notifications/NotificationSettingsPanel';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  organizationId?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  userId,
  organizationId
}) => {
  const [isSocialMediaModalOpen, setIsSocialMediaModalOpen] = useState(false);
  const [isThirdPartyToolsModalOpen, setIsThirdPartyToolsModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);

  if (!isOpen) return null;

  const settingsCategories = [
    {
      id: 'connections',
      title: 'Connections',
      description: 'Manage your external service connections',
      icon: Wifi,
      items: [
        {
          title: 'Social Media',
          description: 'Connect and manage social media accounts',
          action: () => setIsSocialMediaModalOpen(true),
          badge: 'New'
        },
        {
          title: 'Third-Party Tools',
          description: 'Connect to Zoom, Dropbox, OneDrive, and more',
          action: () => setIsThirdPartyToolsModalOpen(true),
          badge: 'Phase 2.5'
        },
        {
          title: 'Workspace Integrations',
          description: 'Connect to productivity tools and services',
          action: () => console.log('Workspace integrations'),
          disabled: false
        }
      ]
    },
    {
      id: 'agents',
      title: 'Agent Management',
      description: 'Configure agent behavior and permissions',
      icon: Users,
      items: [
        {
          title: 'Default Permissions',
          description: 'Set default permissions for new agents',
          action: () => console.log('Default permissions'),
          disabled: true
        },
        {
          title: 'Agent Templates',
          description: 'Create and manage agent templates',
          action: () => console.log('Agent templates'),
          disabled: true
        }
      ]
    },
    {
      id: 'organization',
      title: 'Organization',
      description: 'Manage departments and organizational structure',
      icon: Building,
      items: [
        {
          title: 'Department Management',
          description: 'Create and manage organizational departments',
          action: () => setIsDepartmentModalOpen(true),
          badge: 'New'
        }
      ]
    },
    {
      id: 'security',
      title: 'Security & Privacy',
      description: 'Manage security settings and data privacy',
      icon: Shield,
      items: [
        {
          title: 'API Keys',
          description: 'Manage your API keys and tokens',
          action: () => setIsApiKeyModalOpen(true),
          badge: 'New'
        },
        {
          title: 'Data Export',
          description: 'Export your data and conversation history',
          action: () => console.log('Data export'),
          disabled: true
        }
      ]
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Configure notification preferences',
      icon: Bell,
      items: [
        {
          title: 'Notification Settings',
          description: 'Configure all notification preferences and behaviors',
          action: () => setIsNotificationSettingsOpen(true),
          badge: 'New'
        },
        {
          title: 'Email Notifications',
          description: 'Configure email notification settings',
          action: () => console.log('Email notifications'),
          disabled: true
        }
      ]
    },
    {
      id: 'appearance',
      title: 'Appearance',
      description: 'Customize the look and feel',
      icon: Palette,
      items: [
        {
          title: 'Theme',
          description: 'Choose between light and dark themes',
          action: () => console.log('Theme settings'),
          disabled: true
        },
        {
          title: 'Layout',
          description: 'Customize dashboard layout and components',
          action: () => console.log('Layout settings'),
          disabled: true
        }
      ]
    },
    {
      id: 'data',
      title: 'Data & Storage',
      description: 'Manage data storage and backup settings',
      icon: Database,
      items: [
        {
          title: 'Storage Usage',
          description: 'View and manage storage usage',
          action: () => console.log('Storage usage'),
          disabled: true
        },
        {
          title: 'Backup Settings',
          description: 'Configure automatic backups',
          action: () => console.log('Backup settings'),
          disabled: true
        }
      ]
    }
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              Settings
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-6">
            {settingsCategories.map((category) => (
              <div key={category.id} className="border border-gray-700 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <category.icon className="h-5 w-5 text-blue-400 mr-2" />
                  <h3 className="text-lg font-medium text-white">{category.title}</h3>
                </div>
                <p className="text-gray-400 text-sm mb-4">{category.description}</p>
                
                <div className="space-y-2">
                  {category.items.map((item, index) => (
                    <button
                      key={index}
                      onClick={item.action}
                      disabled={item.disabled}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        item.disabled
                          ? 'border-gray-700 bg-gray-800/50 cursor-not-allowed opacity-50'
                          : 'border-gray-600 bg-gray-700/50 hover:bg-gray-700 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center">
                            <span className="text-white font-medium">{item.title}</span>
                            {item.badge && (
                              <span className="ml-2 px-2 py-0.5 bg-green-600 text-xs text-white rounded-full">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-sm mt-1">{item.description}</p>
                        </div>
                        {item.disabled && (
                          <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
                            Coming Soon
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-700">
            <div className="flex justify-between items-center text-sm text-gray-400">
              <span>Version 1.0.0</span>
              <span>© 2024 Crowd Wisdom</span>
            </div>
          </div>
        </div>
      </div>

      {/* Social Media Settings Modal */}
      <SocialMediaSettingsModal
        isOpen={isSocialMediaModalOpen}
        onClose={() => setIsSocialMediaModalOpen(false)}
        userId={userId}
        organizationId={organizationId}
      />
      
      {/* Third-Party Tools Settings Modal */}
      <ThirdPartyToolsSettingsModal
        isOpen={isThirdPartyToolsModalOpen}
        onClose={() => setIsThirdPartyToolsModalOpen(false)}
        userId={userId}
        organizationId={organizationId}
      />
      
      {/* API Keys Settings Modal */}
      <ApiKeySettingsModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        userId={userId}
        organizationId={organizationId}
      />
      
      {/* Department Management Modal */}
      <DepartmentManagementModal
        isOpen={isDepartmentModalOpen}
        onClose={() => setIsDepartmentModalOpen(false)}
      />

      {/* Notification Settings Modal */}
      {isNotificationSettingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <Bell className="mr-2 h-5 w-5" />
                Notification Settings
              </h2>
              <button
                onClick={() => setIsNotificationSettingsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <NotificationSettingsPanel />
            </div>
          </div>
        </div>
      )}
    </>
  );
}; 