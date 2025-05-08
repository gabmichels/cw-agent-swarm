import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AgentCapability, AgentRegistrationRequest } from '@/lib/multi-agent/types/agent';

interface AgentRegistrationFormProps {
  onSubmit: (data: AgentRegistrationRequest) => Promise<void>;
  isSubmitting: boolean;
}

const AgentRegistrationForm: React.FC<AgentRegistrationFormProps> = ({
  onSubmit,
  isSubmitting
}) => {
  const router = useRouter();
  const [formData, setFormData] = useState<AgentRegistrationRequest>({
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
    await onSubmit(formData);
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
      
      <div className="bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Capabilities</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label htmlFor="capabilityId" className="block text-sm font-medium mb-1">
              ID (optional)
            </label>
            <input
              type="text"
              id="capabilityId"
              value={newCapability.id || ''}
              onChange={(e) => setNewCapability({...newCapability, id: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3 text-white"
              placeholder="cap_example_id"
            />
          </div>
          
          <div>
            <label htmlFor="capabilityName" className="block text-sm font-medium mb-1">
              Name
            </label>
            <input
              type="text"
              id="capabilityName"
              value={newCapability.name || ''}
              onChange={(e) => setNewCapability({...newCapability, name: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3 text-white"
              placeholder="Capability name"
            />
          </div>
          
          <div className="md:col-span-3">
            <label htmlFor="capabilityDescription" className="block text-sm font-medium mb-1">
              Description
            </label>
            <div className="flex">
              <input
                type="text"
                id="capabilityDescription"
                value={newCapability.description || ''}
                onChange={(e) => setNewCapability({...newCapability, description: e.target.value})}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-l py-2 px-3 text-white"
                placeholder="Describe this capability"
              />
              <button
                type="button"
                onClick={addCapability}
                className="bg-blue-600 hover:bg-blue-700 px-4 rounded-r text-white"
                disabled={!newCapability.name || !newCapability.description}
              >
                Add
              </button>
            </div>
          </div>
        </div>
        
        {formData.capabilities.length > 0 && (
          <div className="mt-4">
            <h3 className="text-md font-medium mb-2">Added Capabilities:</h3>
            <div className="space-y-2">
              {formData.capabilities.map((capability) => (
                <div key={capability.id} className="bg-gray-700 p-3 rounded flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{capability.name}</h4>
                    <p className="text-sm text-gray-300">{capability.description}</p>
                    <span className="text-xs text-gray-400">{capability.id}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCapability(capability.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
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