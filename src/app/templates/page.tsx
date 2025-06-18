'use client';

import React, { useState, useEffect } from 'react';
import { AgentConfigTemplate } from '../../types/organization';
import { AgentTemplateService } from '../../services/organization/AgentTemplateService';
import { PlatformConfigService } from '../../services/PlatformConfigService';
import { AgentConfigurationPanel, AgentSpawnConfig } from '../../components/agents/AgentConfigurationPanel';

/**
 * Templates Page Component
 * Manages agent configuration templates
 */
export default function TemplatesPage() {
  const [templates, setTemplates] = useState<AgentConfigTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
  const [platformMode, setPlatformMode] = useState<'personal' | 'organizational'>('personal');

  // Template service
  const [templateService, setTemplateService] = useState<AgentTemplateService | null>(null);

  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize platform config
        const platformConfig = PlatformConfigService.getInstance();
        const mode = platformConfig.getPlatformMode();
        setPlatformMode(mode);

        // Initialize template service
        const service = new AgentTemplateService({} as any, {} as any); // Mock dependencies
        setTemplateService(service);

        // Load templates
        await loadTemplates(service);
      } catch (err) {
        console.error('Failed to initialize services:', err);
        setError('Failed to initialize template services');
      } finally {
        setLoading(false);
      }
    };

    initializeServices();
  }, []);

  const loadTemplates = async (service: AgentTemplateService) => {
    try {
      setLoading(true);
      const result = await service.listTemplates();
      if (result.success && result.data) {
        setTemplates(result.data);
      } else {
        setError(result.error?.message || 'Failed to load templates');
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || 
                           template.templateCategory.toString() === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(templates.map(t => t.templateCategory.toString())))];

  const handleCreateAgent = async (config: AgentSpawnConfig) => {
    if (!templateService) return;
    
    try {
      console.log('Creating agent with config:', config);
      // Here you would integrate with the actual agent creation service
      // For now, we'll just log the configuration
      alert('Agent creation would be implemented here');
    } catch (error) {
      console.error('Failed to create agent:', error);
      throw error;
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!templateService) return;
    
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      const result = await templateService.deleteTemplate(templateId);
      if (result.success) {
        setTemplates(prev => prev.filter(t => t.id !== templateId));
      } else {
        alert(result.error?.message || 'Failed to delete template');
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-64 mb-4"></div>
            <div className="h-4 bg-gray-700 rounded w-96 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 bg-gray-800 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Error Loading Templates</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => templateService && loadTemplates(templateService)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors duration-200"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">Agent Templates</h1>
              <p className="text-gray-400 mt-1">
                Pre-configured agent templates for quick deployment
              </p>
            </div>
            <button
              onClick={() => setIsConfigPanelOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors duration-200 flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Agent
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="sm:w-64">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">No templates found</h3>
            <p className="text-gray-400 mb-6">
              {searchQuery || selectedCategory !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Create your first agent template to get started'
              }
            </p>
            <button
              onClick={() => setIsConfigPanelOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors duration-200"
            >
              Create Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-all duration-200"
              >
                {/* Template Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white text-lg font-bold">
                        {template.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white truncate">{template.name}</h3>
                      <p className="text-sm text-gray-400 capitalize">
                        {template.templateCategory.toString().replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  
                  {/* Actions Menu */}
                  <div className="relative">
                    <button className="text-gray-400 hover:text-white p-1">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Template Description */}
                <p className="text-gray-400 text-sm mb-4 line-clamp-3">{template.description}</p>

                {/* Template Stats */}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <span>Used {template.usageCount} times</span>
                  {template.lastUsed && (
                    <span>Last used {new Date(template.lastUsed).toLocaleDateString()}</span>
                  )}
                </div>

                {/* Template Actions */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => setIsConfigPanelOpen(true)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    Use Template
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Statistics */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-blue-400 mb-2">{templates.length}</div>
            <div className="text-gray-400">Total Templates</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-green-400 mb-2">{categories.length - 1}</div>
            <div className="text-gray-400">Categories</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-purple-400 mb-2">
              {templates.reduce((sum, t) => sum + t.usageCount, 0)}
            </div>
            <div className="text-gray-400">Total Usage</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-yellow-400 mb-2">
              {templates.filter(t => t.isPublic).length}
            </div>
            <div className="text-gray-400">Public Templates</div>
          </div>
        </div>
      </div>

      {/* Agent Configuration Panel */}
      <AgentConfigurationPanel
        isOpen={isConfigPanelOpen}
        onClose={() => setIsConfigPanelOpen(false)}
        onCreateAgent={handleCreateAgent}
        templates={templates}
      />
    </div>
  );
} 