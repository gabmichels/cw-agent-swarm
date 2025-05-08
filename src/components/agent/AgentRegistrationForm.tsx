import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AgentCapability, AgentRegistrationRequest, AgentParameters, AgentMetadata } from '@/lib/multi-agent/types/agent';
import SystemPromptEditor from './SystemPromptEditor';
import KnowledgeUploader from './KnowledgeUploader';
import AgentPersonaForm from './AgentPersonaForm';
import AgentCapabilityManager from './AgentCapabilityManager';
import { CapabilityLevel } from '@/agents/shared/capability-system';

// Custom extensions to standard types
interface ExtendedAgentParameters extends AgentParameters {
  systemPrompt?: string;
}

interface ExtendedAgentMetadata extends AgentMetadata {
  // Additional metadata fields
  knowledgePaths?: string[];
  persona?: {
    background: string;
    personality: string;
    communicationStyle: string;
    preferences: string;
  };
}

interface KnowledgeFile {
  id: string;
  name: string;
  content: string;
  size: number;
  type: string;
  preview?: string;
}

interface PersonaData {
  background: string;
  personality: string;
  communicationStyle: string;
  preferences: string;
}

interface AgentConfig {
  knowledgePaths: string[];
  department?: string;
}

interface AgentRegistrationFormProps {
  onSubmit: (data: AgentRegistrationRequest) => Promise<void>;
  isSubmitting: boolean;
}

// Using our extended types
interface ExtendedAgentRegistrationRequest extends Omit<AgentRegistrationRequest, 'parameters' | 'metadata'> {
  parameters: ExtendedAgentParameters;
  metadata: ExtendedAgentMetadata;
}

const AgentRegistrationForm: React.FC<AgentRegistrationFormProps> = ({
  onSubmit,
  isSubmitting
}) => {
  const router = useRouter();
  
  // Use extended type for formData
  const [formData, setFormData] = useState<ExtendedAgentRegistrationRequest>({
    name: '',
    description: '',
    status: 'available',
    capabilities: [],
    parameters: {
      model: process.env.NEXT_PUBLIC_DEFAULT_MODEL || '',
      temperature: 0.7,
      maxTokens: 2000,
      tools: []
    },
    metadata: {
      tags: [],
      domain: [],
      specialization: [],
      performanceMetrics: {
        successRate: 0,
        averageResponseTime: 0,
        taskCompletionRate: 0
      },
      version: '1.0',
      isPublic: true
    }
  });

  const [newCapability, setNewCapability] = useState<Partial<AgentCapability>>({
    id: '',
    name: '',
    description: ''
  });
  
  const [newTag, setNewTag] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newSpecialization, setNewSpecialization] = useState('');

  const [systemPrompt, setSystemPrompt] = useState('');
  const [knowledgeData, setKnowledgeData] = useState<{
    knowledgePaths: string[];
    files: KnowledgeFile[];
  }>({
    knowledgePaths: ['data/knowledge/company', 'data/knowledge/agents/shared'],
    files: []
  });
  const [personaData, setPersonaData] = useState<PersonaData>({
    background: '',
    personality: '',
    communicationStyle: '',
    preferences: ''
  });
  const [agentCapabilities, setAgentCapabilities] = useState<{
    skills: Record<string, CapabilityLevel>;
    domains: string[];
    roles: string[];
    tags: string[];
  }>({
    skills: {},
    domains: [],
    roles: [],
    tags: []
  });
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    knowledgePaths: ['data/knowledge/company', 'data/knowledge/agents/shared']
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Handle nested properties
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      
      if (parent === 'parameters') {
        setFormData({
          ...formData,
          parameters: {
            ...formData.parameters,
            [child]: value
          }
        });
      } else if (parent === 'metadata') {
        setFormData({
          ...formData,
          metadata: {
            ...formData.metadata,
            [child]: value
          }
        });
      }
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value);
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      
      if (parent === 'parameters') {
        setFormData({
          ...formData,
          parameters: {
            ...formData.parameters,
            [child]: numValue
          }
        });
      } else if (parent === 'metadata') {
        setFormData({
          ...formData,
          metadata: {
            ...formData.metadata,
            [child]: numValue
          }
        });
      }
    } else {
      setFormData({
        ...formData,
        [name]: numValue
      });
    }
  };

  const addCapability = () => {
    if (newCapability.name && newCapability.description) {
      const capability: AgentCapability = {
        id: newCapability.id || `cap_${newCapability.name.toLowerCase().replace(/\s+/g, '_')}`,
        name: newCapability.name,
        description: newCapability.description
      };
      
      setFormData({
        ...formData,
        capabilities: [...formData.capabilities, capability]
      });
      
      setNewCapability({
        id: '',
        name: '',
        description: ''
      });
    }
  };

  const removeCapability = (id: string) => {
    setFormData({
      ...formData,
      capabilities: formData.capabilities.filter(cap => cap.id !== id)
    });
  };

  const addTag = () => {
    if (newTag && !formData.metadata.tags.includes(newTag)) {
      setFormData({
        ...formData,
        metadata: {
          ...formData.metadata,
          tags: [...formData.metadata.tags, newTag]
        }
      });
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      metadata: {
        ...formData.metadata,
        tags: formData.metadata.tags.filter(t => t !== tag)
      }
    });
  };

  const addDomain = () => {
    if (newDomain && !formData.metadata.domain.includes(newDomain)) {
      setFormData({
        ...formData,
        metadata: {
          ...formData.metadata,
          domain: [...formData.metadata.domain, newDomain]
        }
      });
      setNewDomain('');
    }
  };

  const removeDomain = (domain: string) => {
    setFormData({
      ...formData,
      metadata: {
        ...formData.metadata,
        domain: formData.metadata.domain.filter(d => d !== domain)
      }
    });
  };

  const addSpecialization = () => {
    if (newSpecialization && !formData.metadata.specialization.includes(newSpecialization)) {
      setFormData({
        ...formData,
        metadata: {
          ...formData.metadata,
          specialization: [...formData.metadata.specialization, newSpecialization]
        }
      });
      setNewSpecialization('');
    }
  };

  const removeSpecialization = (spec: string) => {
    setFormData({
      ...formData,
      metadata: {
        ...formData.metadata,
        specialization: formData.metadata.specialization.filter(s => s !== spec)
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create a standard compliant version of the request
    const standardRequest: AgentRegistrationRequest = {
      name: formData.name,
      description: formData.description,
      status: formData.status,
      capabilities: formData.capabilities,
      parameters: {
        model: formData.parameters.model,
        temperature: formData.parameters.temperature,
        maxTokens: formData.parameters.maxTokens,
        tools: formData.parameters.tools
      },
      metadata: {
        tags: formData.metadata.tags,
        domain: formData.metadata.domain,
        specialization: formData.metadata.specialization,
        performanceMetrics: formData.metadata.performanceMetrics,
        version: formData.metadata.version,
        isPublic: formData.metadata.isPublic
      }
    };
    
    await onSubmit(standardRequest);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Agent Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Agent Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3 text-white"
              placeholder="Enter agent name"
            />
          </div>
          
          <div>
            <label htmlFor="status" className="block text-sm font-medium mb-1">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3 text-white"
            >
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>
        
        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            rows={3}
            className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3 text-white"
            placeholder="Describe the agent's purpose and capabilities"
          />
        </div>
      </div>
      
      {/* System Prompt Editor */}
      <SystemPromptEditor 
        initialPrompt={systemPrompt}
        onChange={(prompt) => {
          setSystemPrompt(prompt);
          setFormData({
            ...formData,
            parameters: {
              ...formData.parameters,
              systemPrompt: prompt
            }
          });
        }}
      />
      
      {/* Knowledge Uploader */}
      <KnowledgeUploader 
        initialKnowledgePaths={knowledgeData.knowledgePaths}
        initialFiles={knowledgeData.files}
        onChange={(data) => {
          setKnowledgeData(data);
          setAgentConfig({
            ...agentConfig,
            knowledgePaths: data.knowledgePaths
          });
          setFormData({
            ...formData,
            metadata: {
              ...formData.metadata,
              knowledgePaths: data.knowledgePaths
            }
          });
        }}
      />
      
      {/* Agent Persona Form */}
      <AgentPersonaForm 
        initialBackground={personaData.background}
        initialPersonality={personaData.personality}
        initialCommunicationStyle={personaData.communicationStyle}
        initialPreferences={personaData.preferences}
        onChange={(data) => {
          setPersonaData(data);
          setFormData({
            ...formData,
            metadata: {
              ...formData.metadata,
              persona: data
            }
          });
        }}
      />
      
      {/* Agent Capability Manager */}
      <AgentCapabilityManager 
        initialCapabilities={agentCapabilities}
        onChange={(capabilities) => {
          const safeCapabilities = {
            ...capabilities,
            tags: capabilities.tags || []
          };
          
          setAgentCapabilities(safeCapabilities);
          
          const mappedCapabilities: AgentCapability[] = Object.entries(safeCapabilities.skills).map(([id, level]) => ({
            id,
            name: id.split('.')[1] || id,
            description: `Capability level: ${level}`,
            version: '1.0'
          }));
          
          setFormData({
            ...formData,
            capabilities: mappedCapabilities,
            metadata: {
              ...formData.metadata,
              domain: safeCapabilities.domains,
              specialization: [
                ...formData.metadata.specialization,
                ...safeCapabilities.roles
              ],
              tags: [
                ...formData.metadata.tags,
                ...safeCapabilities.tags
              ]
            }
          });
        }}
      />
      
      <div className="bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Model Parameters</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="parameters.model" className="block text-sm font-medium mb-1">
              Model
            </label>
            <input
              type="text"
              id="parameters.model"
              name="parameters.model"
              value={formData.parameters.model}
              onChange={handleChange}
              required
              className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3 text-white"
              placeholder="gpt-4-turbo"
            />
          </div>
          
          <div>
            <label htmlFor="parameters.temperature" className="block text-sm font-medium mb-1">
              Temperature
            </label>
            <input
              type="number"
              id="parameters.temperature"
              name="parameters.temperature"
              value={formData.parameters.temperature}
              onChange={handleNumberChange}
              min="0"
              max="1"
              step="0.1"
              required
              className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3 text-white"
            />
          </div>
          
          <div>
            <label htmlFor="parameters.maxTokens" className="block text-sm font-medium mb-1">
              Max Tokens
            </label>
            <input
              type="number"
              id="parameters.maxTokens"
              name="parameters.maxTokens"
              value={formData.parameters.maxTokens}
              onChange={handleNumberChange}
              min="100"
              required
              className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3 text-white"
            />
          </div>
        </div>
      </div>
      
      <div className="bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Metadata</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <div className="flex">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-l py-2 px-3 text-white"
                placeholder="Add tag"
              />
              <button
                type="button"
                onClick={addTag}
                className="bg-blue-600 hover:bg-blue-700 px-4 rounded-r text-white"
                disabled={!newTag}
              >
                Add
              </button>
            </div>
            {formData.metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.metadata.tags.map((tag) => (
                  <span key={tag} className="bg-gray-700 px-2 py-1 rounded text-sm flex items-center">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-2 text-red-400 hover:text-red-300"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Domains</label>
            <div className="flex">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-l py-2 px-3 text-white"
                placeholder="Add domain"
              />
              <button
                type="button"
                onClick={addDomain}
                className="bg-blue-600 hover:bg-blue-700 px-4 rounded-r text-white"
                disabled={!newDomain}
              >
                Add
              </button>
            </div>
            {formData.metadata.domain.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.metadata.domain.map((domain) => (
                  <span key={domain} className="bg-gray-700 px-2 py-1 rounded text-sm flex items-center">
                    {domain}
                    <button
                      type="button"
                      onClick={() => removeDomain(domain)}
                      className="ml-2 text-red-400 hover:text-red-300"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Specializations</label>
            <div className="flex">
              <input
                type="text"
                value={newSpecialization}
                onChange={(e) => setNewSpecialization(e.target.value)}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-l py-2 px-3 text-white"
                placeholder="Add specialization"
              />
              <button
                type="button"
                onClick={addSpecialization}
                className="bg-blue-600 hover:bg-blue-700 px-4 rounded-r text-white"
                disabled={!newSpecialization}
              >
                Add
              </button>
            </div>
            {formData.metadata.specialization.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.metadata.specialization.map((spec) => (
                  <span key={spec} className="bg-gray-700 px-2 py-1 rounded text-sm flex items-center">
                    {spec}
                    <button
                      type="button"
                      onClick={() => removeSpecialization(spec)}
                      className="ml-2 text-red-400 hover:text-red-300"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="metadata.isPublic"
              checked={formData.metadata.isPublic}
              onChange={(e) => setFormData({
                ...formData,
                metadata: {
                  ...formData.metadata,
                  isPublic: e.target.checked
                }
              })}
              className="bg-gray-700 border border-gray-600 rounded mr-2"
            />
            <label htmlFor="metadata.isPublic" className="text-sm">
              Make this agent publicly available
            </label>
          </div>
        </div>
      </div>
      
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="bg-gray-700 hover:bg-gray-600 py-2 px-6 rounded text-white"
        >
          Cancel
        </button>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 py-2 px-6 rounded text-white disabled:opacity-50"
        >
          {isSubmitting ? 'Registering...' : 'Register Agent'}
        </button>
      </div>
    </form>
  );
};

export default AgentRegistrationForm; 