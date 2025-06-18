'use client';

import React, { useState, useEffect } from 'react';
import { AgentConfigTemplate } from '../../types/organization';

export interface AgentConfigurationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateAgent: (config: AgentSpawnConfig) => Promise<void>;
  templates?: AgentConfigTemplate[];
  preselectedCategory?: string;
  className?: string;
}

export interface AgentSpawnConfig {
  templateId?: string;
  name: string;
  description: string;
  category?: string;
  department?: string;
  position?: string;
  customConfig?: Record<string, unknown>;
}

/**
 * Agent Configuration Panel Component
 * Provides template selection and agent spawning interface
 */
export const AgentConfigurationPanel: React.FC<AgentConfigurationPanelProps> = ({
  isOpen,
  onClose,
  onCreateAgent,
  templates = [],
  preselectedCategory,
  className = ''
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<AgentConfigTemplate | null>(null);
  const [agentConfig, setAgentConfig] = useState<AgentSpawnConfig>({
    name: '',
    description: '',
    category: preselectedCategory || ''
  });
  const [currentStep, setCurrentStep] = useState<'template' | 'config' | 'preview'>('template');
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Batch creation state
  const [batchMode, setBatchMode] = useState(false);
  const [batchConfig, setBatchConfig] = useState({
    count: 5,
    namePattern: 'Agent-{index}',
    assignToDepartment: '',
    customizations: [] as Array<{ index: number; name: string; description: string }>
  });

  // Reset form when panel opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('template');
      setSelectedTemplate(null);
      setAgentConfig({
        name: '',
        description: '',
        category: preselectedCategory || ''
      });
      setSearchQuery('');
    }
  }, [isOpen, preselectedCategory]);

  // Filter templates based on search query
  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.templateCategory.toString().toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group templates by category
  const templatesByCategory = filteredTemplates.reduce((acc, template) => {
    const category = template.templateCategory.toString();
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(template);
    return acc;
  }, {} as Record<string, AgentConfigTemplate[]>);

  const handleTemplateSelect = (template: AgentConfigTemplate) => {
    setSelectedTemplate(template);
    setAgentConfig(prev => ({
      ...prev,
      templateId: template.id,
      name: `${template.name} Assistant`,
      description: template.description,
      category: prev.category || template.defaultCategory || ''
    }));
    setCurrentStep('config');
  };

  const handleCreateFromScratch = () => {
    setSelectedTemplate(null);
    setAgentConfig(prev => ({
      ...prev,
      templateId: undefined
    }));
    setCurrentStep('config');
  };

  const handleConfigSubmit = () => {
    setCurrentStep('preview');
  };

  const handleFinalCreate = async () => {
    setIsCreating(true);
    try {
      if (batchMode) {
        // Create multiple agents based on batch configuration
        for (let i = 1; i <= batchConfig.count; i++) {
          const customization = batchConfig.customizations.find(c => c.index === i);
          const agentName = customization?.name || batchConfig.namePattern.replace('{index}', i.toString());
          const agentDescription = customization?.description || agentConfig.description;
          
          const batchAgentConfig: AgentSpawnConfig = {
            ...agentConfig,
            name: agentName,
            description: agentDescription,
            department: batchConfig.assignToDepartment || agentConfig.department
          };
          
          await onCreateAgent(batchAgentConfig);
        }
      } else {
        // Create single agent
        await onCreateAgent(agentConfig);
      }
      onClose();
    } catch (error) {
      console.error('Failed to create agent(s):', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleBatchCustomizationChange = (index: number, field: 'name' | 'description', value: string) => {
    setBatchConfig(prev => {
      const existingCustomization = prev.customizations.find(c => c.index === index);
      if (existingCustomization) {
        return {
          ...prev,
          customizations: prev.customizations.map(c =>
            c.index === index ? { ...c, [field]: value } : c
          )
        };
      } else {
        return {
          ...prev,
          customizations: [...prev.customizations, {
            index,
            name: field === 'name' ? value : batchConfig.namePattern.replace('{index}', index.toString()),
            description: field === 'description' ? value : agentConfig.description
          }]
        };
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${className}`}>
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="inline-block align-bottom bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">
                {currentStep === 'template' && 'Choose Template'}
                {currentStep === 'config' && 'Configure Agent'}
                {currentStep === 'preview' && 'Review & Create'}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Progress Steps */}
            <div className="flex items-center mt-4 space-x-4">
              <div className={`flex items-center ${currentStep === 'template' ? 'text-blue-400' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  currentStep === 'template' ? 'border-blue-400 bg-blue-400 text-white' : 'border-gray-600'
                }`}>
                  1
                </div>
                <span className="ml-2">Template</span>
              </div>
              <div className="flex-1 h-px bg-gray-600" />
              <div className={`flex items-center ${currentStep === 'config' ? 'text-blue-400' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  currentStep === 'config' ? 'border-blue-400 bg-blue-400 text-white' : 'border-gray-600'
                }`}>
                  2
                </div>
                <span className="ml-2">Configure</span>
              </div>
              <div className="flex-1 h-px bg-gray-600" />
              <div className={`flex items-center ${currentStep === 'preview' ? 'text-blue-400' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  currentStep === 'preview' ? 'border-blue-400 bg-blue-400 text-white' : 'border-gray-600'
                }`}>
                  3
                </div>
                <span className="ml-2">Preview</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-gray-800 px-6 py-6">
            {/* Template Selection Step */}
            {currentStep === 'template' && (
              <div>
                {/* Search Bar */}
                <div className="mb-6">
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
                      className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Create from Scratch Option */}
                <div className="mb-6">
                  <button
                    onClick={handleCreateFromScratch}
                    className="w-full p-4 bg-gray-700 border border-gray-600 rounded-lg hover:border-blue-500 transition-colors duration-200 text-left"
                  >
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mr-4">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-white font-medium">Create from Scratch</h4>
                        <p className="text-gray-400 text-sm">Start with a blank agent and customize everything</p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Template Categories */}
                <div className="space-y-6">
                  {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
                    <div key={category}>
                      <h4 className="text-white font-medium mb-3 capitalize">{category.replace('_', ' ')}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {categoryTemplates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => handleTemplateSelect(template)}
                            className="p-4 bg-gray-700 border border-gray-600 rounded-lg hover:border-blue-500 transition-colors duration-200 text-left"
                          >
                            <div className="flex items-start">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                                <span className="text-white text-sm font-bold">
                                  {template.name.charAt(0)}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h5 className="text-white font-medium truncate">{template.name}</h5>
                                <p className="text-gray-400 text-sm mt-1 line-clamp-2">{template.description}</p>
                                <div className="flex items-center mt-2 text-xs text-gray-500">
                                  <span>Used {template.usageCount} times</span>
                                  {template.lastUsed && (
                                    <span className="ml-2">• Last used {new Date(template.lastUsed).toLocaleDateString()}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {filteredTemplates.length === 0 && (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h4 className="text-white font-medium mb-2">No templates found</h4>
                    <p className="text-gray-400">Try adjusting your search or create an agent from scratch</p>
                  </div>
                )}
              </div>
            )}

            {/* Configuration Step */}
            {currentStep === 'config' && (
              <div className="space-y-6">
                {selectedTemplate && (
                  <div className="bg-gray-700 rounded-lg p-4 mb-6">
                    <h4 className="text-white font-medium mb-2">Based on: {selectedTemplate.name}</h4>
                    <p className="text-gray-400 text-sm">{selectedTemplate.description}</p>
                  </div>
                )}

                {/* Batch Mode Toggle */}
                <div className="bg-gray-700 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">Batch Creation Mode</h4>
                      <p className="text-gray-400 text-sm">Create multiple agents at once with customization options</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={batchMode}
                        onChange={(e) => setBatchMode(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Agent Name *</label>
                    <input
                      type="text"
                      value={agentConfig.name}
                      onChange={(e) => setAgentConfig(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter agent name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                    <select
                      value={agentConfig.category}
                      onChange={(e) => setAgentConfig(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select category</option>
                      <option value="Productivity">Productivity</option>
                      <option value="Finance">Finance</option>
                      <option value="Health">Health</option>
                      <option value="Learning">Learning</option>
                      <option value="Communication">Communication</option>
                      <option value="Entertainment">Entertainment</option>
                      <option value="Home">Home</option>
                      <option value="Travel">Travel</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    value={agentConfig.description}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe what this agent will do..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Position/Role</label>
                  <input
                    type="text"
                    value={agentConfig.position}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, position: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Personal Assistant, Financial Advisor"
                  />
                </div>

                {/* Batch Configuration */}
                {batchMode && (
                  <div className="bg-gray-700 rounded-lg p-4 space-y-4">
                    <h4 className="text-white font-medium">Batch Configuration</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Number of Agents</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={batchConfig.count}
                          onChange={(e) => setBatchConfig(prev => ({ ...prev, count: parseInt(e.target.value) || 1 }))}
                          className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Name Pattern</label>
                        <input
                          type="text"
                          value={batchConfig.namePattern}
                          onChange={(e) => setBatchConfig(prev => ({ ...prev, namePattern: e.target.value }))}
                          className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Use {index} for numbering"
                        />
                        <p className="text-xs text-gray-400 mt-1">Use {'{index}'} to insert agent number</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Assign to Department</label>
                      <input
                        type="text"
                        value={batchConfig.assignToDepartment}
                        onChange={(e) => setBatchConfig(prev => ({ ...prev, assignToDepartment: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Department ID (optional)"
                      />
                    </div>

                    {/* Individual Customizations */}
                    <div>
                      <h5 className="text-white font-medium mb-3">Individual Customizations (Optional)</h5>
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {Array.from({ length: batchConfig.count }, (_, i) => i + 1).map((index) => {
                          const customization = batchConfig.customizations.find(c => c.index === index);
                          const defaultName = batchConfig.namePattern.replace('{index}', index.toString());
                          
                          return (
                            <div key={index} className="bg-gray-600 rounded-lg p-3">
                              <h6 className="text-white text-sm font-medium mb-2">Agent {index}</h6>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <input
                                    type="text"
                                    placeholder={defaultName}
                                    value={customization?.name || ''}
                                    onChange={(e) => handleBatchCustomizationChange(index, 'name', e.target.value)}
                                    className="w-full px-2 py-1 bg-gray-500 border border-gray-400 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                                <div>
                                  <input
                                    type="text"
                                    placeholder="Custom description (optional)"
                                    value={customization?.description || ''}
                                    onChange={(e) => handleBatchCustomizationChange(index, 'description', e.target.value)}
                                    className="w-full px-2 py-1 bg-gray-500 border border-gray-400 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Preview Step */}
            {currentStep === 'preview' && (
              <div className="space-y-6">
                <div className="bg-gray-700 rounded-lg p-6">
                  <h4 className="text-white font-medium mb-4">
                    {batchMode ? `Batch Creation Preview (${batchConfig.count} agents)` : 'Agent Preview'}
                  </h4>
                  
                  {!batchMode ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <div className="space-y-3">
                          <div>
                            <span className="text-gray-400 text-sm">Name:</span>
                            <p className="text-white font-medium">{agentConfig.name}</p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-sm">Category:</span>
                            <p className="text-white">{agentConfig.category || 'Uncategorized'}</p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-sm">Position:</span>
                            <p className="text-white">{agentConfig.position || 'Not specified'}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-gray-400 text-sm">Description:</span>
                        <p className="text-white mt-1">{agentConfig.description || 'No description provided'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <span className="text-gray-400 text-sm">Agents to create:</span>
                          <p className="text-white font-medium">{batchConfig.count}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-sm">Name pattern:</span>
                          <p className="text-white font-medium">{batchConfig.namePattern}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-sm">Department:</span>
                          <p className="text-white font-medium">{batchConfig.assignToDepartment || 'None specified'}</p>
                        </div>
                      </div>

                      <div>
                        <span className="text-gray-400 text-sm">Base configuration:</span>
                        <div className="mt-2 bg-gray-600 rounded-lg p-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-gray-300">Category:</span>
                              <span className="text-white ml-2">{agentConfig.category || 'Uncategorized'}</span>
                            </div>
                            <div>
                              <span className="text-gray-300">Position:</span>
                              <span className="text-white ml-2">{agentConfig.position || 'Not specified'}</span>
                            </div>
                          </div>
                          <div className="mt-2">
                            <span className="text-gray-300">Description:</span>
                            <p className="text-white text-sm mt-1">{agentConfig.description || 'No description provided'}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="text-gray-400 text-sm">Agent names preview:</span>
                        <div className="mt-2 bg-gray-600 rounded-lg p-3 max-h-40 overflow-y-auto">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            {Array.from({ length: batchConfig.count }, (_, i) => i + 1).map((index) => {
                              const customization = batchConfig.customizations.find(c => c.index === index);
                              const agentName = customization?.name || batchConfig.namePattern.replace('{index}', index.toString());
                              
                              return (
                                <div key={index} className="text-white">
                                  {index}. {agentName}
                                  {customization?.description && (
                                    <span className="text-gray-300 text-xs ml-2">({customization.description})</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedTemplate && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      <span className="text-gray-400 text-sm">Based on template:</span>
                      <p className="text-white">{selectedTemplate.name}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-700 px-6 py-4 flex justify-between">
            <div>
              {currentStep !== 'template' && (
                <button
                  onClick={() => {
                    if (currentStep === 'config') setCurrentStep('template');
                    if (currentStep === 'preview') setCurrentStep('config');
                  }}
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  ← Back
                </button>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors duration-200"
              >
                Cancel
              </button>
              
              {currentStep === 'config' && (
                <button
                  onClick={handleConfigSubmit}
                  disabled={!agentConfig.name.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
                >
                  Continue
                </button>
              )}
              
              {currentStep === 'preview' && (
                <button
                  onClick={handleFinalCreate}
                  disabled={isCreating}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 flex items-center"
                >
                  {isCreating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {batchMode ? 'Creating Agents...' : 'Creating...'}
                    </>
                  ) : (
                    batchMode ? `Create ${batchConfig.count} Agents` : 'Create Agent'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentConfigurationPanel; 