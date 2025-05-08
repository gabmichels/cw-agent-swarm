import React, { useState, useEffect } from 'react';
import { 
  CapabilityType, 
  CapabilityLevel, 
  getCapabilityLevelDisplay,
  getCapabilityLevelPercentage,
  defaultCapabilities
} from '../../agents/shared/capability-system';

interface AgentCapability {
  id: string;
  name: string;
  description?: string;
  type: CapabilityType;
  level: CapabilityLevel;
}

interface AgentCapabilitySet {
  skills: Record<string, CapabilityLevel>;
  domains: string[];
  roles: string[];
  tags?: string[];
}

interface AgentCapabilityManagerProps {
  initialCapabilities?: AgentCapabilitySet;
  onChange: (capabilities: AgentCapabilitySet) => void;
}

/**
 * Component for managing agent capabilities
 */
const AgentCapabilityManager: React.FC<AgentCapabilityManagerProps> = ({
  initialCapabilities,
  onChange
}) => {
  // Default empty capability set
  const emptyCapabilitySet: AgentCapabilitySet = {
    skills: {},
    domains: [],
    roles: [],
    tags: []
  };

  // State for capability management
  const [capabilities, setCapabilities] = useState<AgentCapabilitySet>(
    initialCapabilities || emptyCapabilitySet
  );
  const [activeTab, setActiveTab] = useState<CapabilityType>(CapabilityType.SKILL);
  const [newCapability, setNewCapability] = useState<Partial<AgentCapability>>({
    id: '',
    name: '',
    description: '',
    type: activeTab,
    level: CapabilityLevel.INTERMEDIATE
  });
  const [selectedTemplate, setSelectedTemplate] = useState('');

  // Convert capabilities to a flat list for display
  const [capabilityList, setCapabilityList] = useState<AgentCapability[]>([]);

  // Update the capability list when capabilities change
  useEffect(() => {
    const list: AgentCapability[] = [];

    // Add skills
    Object.entries(capabilities.skills).forEach(([id, level]) => {
      // Extract name from ID (format: type.name)
      const nameParts = id.split('.');
      const name = nameParts.length > 1 ? nameParts[1] : id;
      
      list.push({
        id,
        name,
        type: CapabilityType.SKILL,
        level
      });
    });

    // Add domains
    capabilities.domains.forEach(domain => {
      list.push({
        id: `${CapabilityType.DOMAIN}.${domain}`,
        name: domain,
        type: CapabilityType.DOMAIN,
        level: CapabilityLevel.INTERMEDIATE // Default level for domains
      });
    });

    // Add roles
    capabilities.roles.forEach(role => {
      list.push({
        id: `${CapabilityType.ROLE}.${role}`,
        name: role,
        type: CapabilityType.ROLE,
        level: CapabilityLevel.INTERMEDIATE // Default level for roles
      });
    });

    // Add tags
    capabilities.tags?.forEach(tag => {
      list.push({
        id: `${CapabilityType.TAG}.${tag}`,
        name: tag,
        type: CapabilityType.TAG,
        level: CapabilityLevel.INTERMEDIATE // Default level for tags
      });
    });

    setCapabilityList(list);
  }, [capabilities]);

  // Update parent component when capabilities change
  useEffect(() => {
    onChange(capabilities);
  }, [capabilities, onChange]);

  // Update new capability type when active tab changes
  useEffect(() => {
    setNewCapability(prev => ({
      ...prev,
      type: activeTab
    }));
  }, [activeTab]);

  // Add a new capability
  const handleAddCapability = () => {
    if (!newCapability.name) return;

    const name = newCapability.name.trim().toLowerCase().replace(/\s+/g, '_');
    const type = newCapability.type || CapabilityType.SKILL;
    const level = newCapability.level || CapabilityLevel.INTERMEDIATE;
    const id = newCapability.id || `${type}.${name}`;

    const updatedCapabilities = { ...capabilities };

    switch (type) {
      case CapabilityType.SKILL:
        updatedCapabilities.skills = {
          ...updatedCapabilities.skills,
          [id]: level
        };
        break;
      case CapabilityType.DOMAIN:
        if (!updatedCapabilities.domains.includes(name)) {
          updatedCapabilities.domains = [...updatedCapabilities.domains, name];
        }
        break;
      case CapabilityType.ROLE:
        if (!updatedCapabilities.roles.includes(name)) {
          updatedCapabilities.roles = [...updatedCapabilities.roles, name];
        }
        break;
      case CapabilityType.TAG:
        if (!updatedCapabilities.tags?.includes(name)) {
          updatedCapabilities.tags = [...(updatedCapabilities.tags || []), name];
        }
        break;
    }

    setCapabilities(updatedCapabilities);
    
    // Reset new capability form
    setNewCapability({
      id: '',
      name: '',
      description: '',
      type: activeTab,
      level: CapabilityLevel.INTERMEDIATE
    });
  };

  // Remove a capability
  const handleRemoveCapability = (capability: AgentCapability) => {
    const { id, type, name } = capability;
    const updatedCapabilities = { ...capabilities };

    switch (type) {
      case CapabilityType.SKILL:
        const { [id]: _, ...remainingSkills } = updatedCapabilities.skills;
        updatedCapabilities.skills = remainingSkills;
        break;
      case CapabilityType.DOMAIN:
        updatedCapabilities.domains = updatedCapabilities.domains.filter(d => d !== name);
        break;
      case CapabilityType.ROLE:
        updatedCapabilities.roles = updatedCapabilities.roles.filter(r => r !== name);
        break;
      case CapabilityType.TAG:
        updatedCapabilities.tags = updatedCapabilities.tags?.filter(t => t !== name);
        break;
    }

    setCapabilities(updatedCapabilities);
  };

  // Update capability level
  const handleUpdateLevel = (capability: AgentCapability, level: CapabilityLevel) => {
    if (capability.type !== CapabilityType.SKILL) return;

    const updatedCapabilities = { ...capabilities };
    updatedCapabilities.skills = {
      ...updatedCapabilities.skills,
      [capability.id]: level
    };

    setCapabilities(updatedCapabilities);
  };

  // Load a template
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const template = e.target.value;
    setSelectedTemplate(template);
    
    if (!template) {
      setCapabilities(emptyCapabilitySet);
      return;
    }
    
    // Load a predefined template
    switch (template) {
      case 'marketing':
        setCapabilities(defaultCapabilities.marketingAgent);
        break;
      case 'developer':
        setCapabilities(defaultCapabilities.developerAgent);
        break;
      case 'researcher':
        setCapabilities(defaultCapabilities.researchAgent);
        break;
      case 'chloe':
        setCapabilities({
          skills: {
            'skill.marketing_strategy': CapabilityLevel.ADVANCED,
            'skill.growth_optimization': CapabilityLevel.EXPERT,
            'skill.viral_marketing': CapabilityLevel.ADVANCED,
            'skill.low_budget_acquisition': CapabilityLevel.EXPERT,
            'skill.content_marketing': CapabilityLevel.ADVANCED,
            'skill.analytics': CapabilityLevel.INTERMEDIATE
          },
          domains: ['marketing', 'growth', 'strategy'],
          roles: ['cmo', 'advisor', 'strategist'],
          tags: ['startup', 'user-acquisition', 'viral']
        });
        break;
      default:
        setCapabilities(emptyCapabilitySet);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 my-4">
      <h2 className="text-xl font-semibold mb-4">Agent Capabilities</h2>
      
      {/* Template Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Capability Template</label>
        <select 
          value={selectedTemplate} 
          onChange={handleTemplateChange}
          className="w-full bg-gray-700 border border-gray-600 rounded p-2"
        >
          <option value="">Custom Capabilities</option>
          <option value="marketing">Marketing Expert</option>
          <option value="developer">Developer</option>
          <option value="researcher">Researcher</option>
          <option value="chloe">Chloe (CMO)</option>
        </select>
      </div>
      
      {/* Capability Type Tabs */}
      <div className="mb-4">
        <nav className="flex space-x-2 border-b border-gray-700">
          {Object.values(CapabilityType).map(type => (
            <button
              key={type}
              onClick={() => setActiveTab(type)}
              className={`py-2 px-4 ${activeTab === type 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}s
            </button>
          ))}
        </nav>
      </div>
      
      {/* Add New Capability Form */}
      <div className="mb-6 bg-gray-700 p-4 rounded">
        <h3 className="text-md font-medium mb-3">Add New {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-sm mb-1">Name</label>
            <input
              type="text"
              value={newCapability.name}
              onChange={(e) => setNewCapability({ ...newCapability, name: e.target.value })}
              className="w-full bg-gray-600 border border-gray-500 rounded p-2"
              placeholder={`Enter ${activeTab} name`}
            />
          </div>
          
          {activeTab === CapabilityType.SKILL && (
            <div>
              <label className="block text-sm mb-1">Proficiency Level</label>
              <select
                value={newCapability.level}
                onChange={(e) => setNewCapability({ ...newCapability, level: e.target.value as CapabilityLevel })}
                className="w-full bg-gray-600 border border-gray-500 rounded p-2"
              >
                <option value={CapabilityLevel.BASIC}>Basic</option>
                <option value={CapabilityLevel.INTERMEDIATE}>Intermediate</option>
                <option value={CapabilityLevel.ADVANCED}>Advanced</option>
                <option value={CapabilityLevel.EXPERT}>Expert</option>
              </select>
            </div>
          )}
          
          <div>
            <label className="block text-sm mb-1">Description (optional)</label>
            <input
              type="text"
              value={newCapability.description}
              onChange={(e) => setNewCapability({ ...newCapability, description: e.target.value })}
              className="w-full bg-gray-600 border border-gray-500 rounded p-2"
              placeholder="Brief description"
            />
          </div>
        </div>
        
        <button
          onClick={handleAddCapability}
          disabled={!newCapability.name}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded disabled:opacity-50"
        >
          Add {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
        </button>
      </div>
      
      {/* Capability List */}
      <div>
        <h3 className="text-md font-medium mb-3">Current Capabilities</h3>
        
        {capabilityList.length === 0 ? (
          <p className="text-gray-400 text-sm mb-4">No capabilities added yet.</p>
        ) : (
          <div className="space-y-3">
            {capabilityList
              .filter(cap => cap.type === activeTab)
              .map(capability => (
                <div 
                  key={capability.id} 
                  className="bg-gray-700 p-3 rounded flex flex-col md:flex-row md:items-center justify-between"
                >
                  <div className="flex-grow">
                    <div className="flex items-center mb-1">
                      <h4 className="font-medium">{capability.name}</h4>
                      <span className="text-xs text-gray-400 ml-2">{capability.id}</span>
                    </div>
                    {capability.description && (
                      <p className="text-sm text-gray-300">{capability.description}</p>
                    )}
                  </div>
                  
                  {capability.type === CapabilityType.SKILL && (
                    <div className="mt-2 md:mt-0 md:ml-4 flex flex-col w-full md:w-40">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs">{getCapabilityLevelDisplay(capability.level)}</span>
                        <div className="flex">
                          {Object.values(CapabilityLevel).map(level => (
                            <button
                              key={level}
                              onClick={() => handleUpdateLevel(capability, level)}
                              className={`w-6 h-6 rounded-full mx-0.5 ${
                                capability.level === level 
                                  ? 'bg-blue-500' 
                                  : 'bg-gray-600 hover:bg-gray-500'
                              }`}
                              title={getCapabilityLevelDisplay(level)}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="bg-gray-600 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${getCapabilityLevelPercentage(capability.level)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => handleRemoveCapability(capability)}
                    className="mt-2 md:mt-0 md:ml-2 text-red-400 hover:text-red-300"
                    title="Remove capability"
                  >
                    Remove
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
      
      {/* Capability Summary */}
      <div className="mt-6 bg-gray-700 p-4 rounded">
        <h3 className="text-md font-medium mb-3">Capability Summary</h3>
        <div className="text-sm">
          <p><span className="font-medium">Skills:</span> {Object.keys(capabilities.skills).length}</p>
          <p><span className="font-medium">Domains:</span> {capabilities.domains.join(', ') || 'None'}</p>
          <p><span className="font-medium">Roles:</span> {capabilities.roles.join(', ') || 'None'}</p>
          <p><span className="font-medium">Tags:</span> {capabilities.tags?.join(', ') || 'None'}</p>
        </div>
      </div>
    </div>
  );
};

export default AgentCapabilityManager; 