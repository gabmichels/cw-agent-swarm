import React, { useState, useEffect, useCallback } from 'react';
import { PlusCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { 
  CapabilityType, 
  CapabilityLevel, 
  getCapabilityLevelDisplay,
  getCapabilityLevelPercentage,
  defaultCapabilities
} from '../../agents/shared/capability-system';

interface Capability {
  id: string;
  name: string;
  description: string;
  type: CapabilityType;
  level?: CapabilityLevel;
}

interface AgentCapabilityManagerProps {
  initialCapabilities?: {
    skills: Record<string, CapabilityLevel>;
    domains: string[];
    roles: string[];
    tags?: string[];
  };
  onChange: (capabilities: {
    skills: Record<string, CapabilityLevel>;
    domains: string[];
    roles: string[];
    tags?: string[];
  }) => void;
}

const DEFAULT_CAPABILITIES: Capability[] = [
  { id: 'skill.problem_solving', name: 'Problem Solving', description: 'Ability to analyze and solve complex problems', type: CapabilityType.SKILL },
  { id: 'skill.creative_thinking', name: 'Creative Thinking', description: 'Ability to come up with novel ideas and solutions', type: CapabilityType.SKILL },
  { id: 'skill.research', name: 'Research', description: 'Ability to find and synthesize information', type: CapabilityType.SKILL },
  { id: 'skill.communication', name: 'Communication', description: 'Ability to clearly communicate ideas and information', type: CapabilityType.SKILL },
  { id: 'skill.critical_thinking', name: 'Critical Thinking', description: 'Ability to evaluate information and make reasoned judgments', type: CapabilityType.SKILL },
  { id: 'domain.marketing', name: 'Marketing', description: 'Knowledge of marketing principles and strategies', type: CapabilityType.DOMAIN },
  { id: 'domain.finance', name: 'Finance', description: 'Knowledge of financial principles and analysis', type: CapabilityType.DOMAIN },
  { id: 'domain.technology', name: 'Technology', description: 'Knowledge of technology trends and applications', type: CapabilityType.DOMAIN },
  { id: 'domain.hr', name: 'HR', description: 'Knowledge of human resources principles and practices', type: CapabilityType.DOMAIN },
  { id: 'domain.sales', name: 'Sales', description: 'Knowledge of sales principles and techniques', type: CapabilityType.DOMAIN },
  { id: 'role.assistant', name: 'Assistant', description: 'Acts as a helpful assistant', type: CapabilityType.ROLE },
  { id: 'role.advisor', name: 'Advisor', description: 'Provides expert advice and recommendations', type: CapabilityType.ROLE },
  { id: 'role.researcher', name: 'Researcher', description: 'Conducts comprehensive research and analysis', type: CapabilityType.ROLE },
  { id: 'role.analyst', name: 'Analyst', description: 'Analyzes data and provides insights', type: CapabilityType.ROLE },
  { id: 'role.strategist', name: 'Strategist', description: 'Develops strategic plans and initiatives', type: CapabilityType.ROLE },
];

const AgentCapabilityManager: React.FC<AgentCapabilityManagerProps> = ({
  initialCapabilities = {
    skills: {},
    domains: [],
    roles: [],
    tags: [],
  },
  onChange
}) => {
  const [capabilities, setCapabilities] = useState({
    skills: initialCapabilities.skills || {},
    domains: initialCapabilities.domains || [],
    roles: initialCapabilities.roles || [],
    tags: initialCapabilities.tags || []
  });
  
  const [selectedCapabilities, setSelectedCapabilities] = useState<Capability[]>([]);
  const [showCapabilitySelector, setShowCapabilitySelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customCapability, setCustomCapability] = useState({
    id: '',
    name: '',
    description: '',
    type: CapabilityType.SKILL
  });
  
  // Initialize selected capabilities from initial values
  useEffect(() => {
    const skills = Object.entries(initialCapabilities.skills || {}).map(([id, level]) => ({
      id,
      name: id.split('.')[1] || id,
      description: `Skill level: ${level}`,
      type: CapabilityType.SKILL,
      level
    }));
    
    const domains = (initialCapabilities.domains || []).map(domain => ({
      id: `domain.${domain.toLowerCase().replace(/\s+/g, '_')}`,
      name: domain,
      description: `Domain knowledge: ${domain}`,
      type: CapabilityType.DOMAIN
    }));
    
    const roles = (initialCapabilities.roles || []).map(role => ({
      id: `role.${role.toLowerCase().replace(/\s+/g, '_')}`,
      name: role,
      description: `Role: ${role}`,
      type: CapabilityType.ROLE
    }));
    
    setSelectedCapabilities([...skills, ...domains, ...roles]);
  }, [initialCapabilities]);
  
  // Notify parent component when capabilities change
  useEffect(() => {
    onChange(capabilities);
  }, [capabilities, onChange]);
  
  // Filter capabilities based on search term
  const filteredCapabilities = DEFAULT_CAPABILITIES.filter(cap => {
    const isAlreadySelected = selectedCapabilities.some(selected => selected.id === cap.id);
    if (isAlreadySelected) return false;
    
    if (!searchTerm) return true;
    
    return (
      cap.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cap.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cap.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });
  
  // Add capability
  const addCapability = (capability: Capability) => {
    setSelectedCapabilities(prev => [...prev, capability]);
    
    // Update the capabilities object based on the type
    if (capability.type === CapabilityType.SKILL) {
      setCapabilities(prev => ({
        ...prev,
        skills: {
          ...prev.skills,
          [capability.id]: capability.level || CapabilityLevel.BASIC
        }
      }));
    } else if (capability.type === CapabilityType.DOMAIN) {
      setCapabilities(prev => ({
        ...prev,
        domains: [...prev.domains, capability.name]
      }));
    } else if (capability.type === CapabilityType.ROLE) {
      setCapabilities(prev => ({
        ...prev,
        roles: [...prev.roles, capability.name]
      }));
    } else if (capability.type === CapabilityType.TAG) {
      setCapabilities(prev => ({
        ...prev,
        tags: [...(prev.tags || []), capability.name]
      }));
    }
    
    // Reset custom capability form if adding custom
    if (isAddingCustom) {
      setCustomCapability({
        id: '',
        name: '',
        description: '',
        type: CapabilityType.SKILL
      });
      setIsAddingCustom(false);
    }
    
    // Close capability selector after adding
    setShowCapabilitySelector(false);
  };
  
  // Remove capability
  const handleRemoveCapability = (capability: Capability) => {
    setSelectedCapabilities(prev => prev.filter(cap => cap.id !== capability.id));
    
    // Update the capabilities object based on the type
    if (capability.type === CapabilityType.SKILL) {
      setCapabilities(prev => {
        const newSkills = { ...prev.skills };
        delete newSkills[capability.id];
        return {
          ...prev,
          skills: newSkills
        };
      });
    } else if (capability.type === CapabilityType.DOMAIN) {
      setCapabilities(prev => ({
        ...prev,
        domains: prev.domains.filter(domain => domain !== capability.name)
      }));
    } else if (capability.type === CapabilityType.ROLE) {
      setCapabilities(prev => ({
        ...prev,
        roles: prev.roles.filter(role => role !== capability.name)
      }));
    } else if (capability.type === CapabilityType.TAG) {
      setCapabilities(prev => ({
        ...prev,
        tags: (prev.tags || []).filter(tag => tag !== capability.name)
      }));
    }
  };
  
  // Update capability level
  const handleUpdateLevel = (capability: Capability, level: CapabilityLevel) => {
    setSelectedCapabilities(prev =>
      prev.map(cap =>
        cap.id === capability.id ? { ...cap, level } : cap
      )
    );
    
    // Update the skills object
    setCapabilities(prev => ({
      ...prev,
      skills: {
        ...prev.skills,
        [capability.id]: level
      }
    }));
  };
  
  // Handle adding custom capability
  const handleAddCustomCapability = () => {
    // Validate required fields
    if (!customCapability.name) {
      alert('Please enter a name for the custom capability');
      return;
    }
    
    // Generate ID based on type and name
    const id = `${customCapability.type}.${customCapability.name.toLowerCase().replace(/\s+/g, '_')}`;
    
    const newCapability = {
      ...customCapability,
      id,
      level: customCapability.type === CapabilityType.SKILL ? CapabilityLevel.BASIC : undefined
    };
    
    addCapability(newCapability);
  };
  
  // Helper for displaying capability level
  const getCapabilityLevelDisplay = (level: CapabilityLevel | undefined) => {
    switch (level) {
      case CapabilityLevel.BASIC:
        return 'Basic';
      case CapabilityLevel.INTERMEDIATE:
        return 'Intermediate';
      case CapabilityLevel.ADVANCED:
        return 'Advanced';
      default:
        return 'Not specified';
    }
  };
  
  // Helper for displaying capability level as percentage
  const getCapabilityLevelPercentage = (level: CapabilityLevel | undefined) => {
    switch (level) {
      case CapabilityLevel.BASIC:
        return 20;
      case CapabilityLevel.INTERMEDIATE:
        return 40;
      case CapabilityLevel.ADVANCED:
        return 60;
      default:
        return 0;
    }
  };
  
  // Group selected capabilities by type
  const capabilityTypes = [CapabilityType.SKILL, CapabilityType.DOMAIN, CapabilityType.ROLE, CapabilityType.TAG];
  
  const groupedCapabilities = selectedCapabilities.reduce<Record<string, Capability[]>>(
    (acc, capability) => {
      const type = capability.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(capability);
      return acc;
    },
    {} as Record<string, Capability[]>
  );
  
  const capabilityList = selectedCapabilities.sort((a, b) => a.name.localeCompare(b.name));
  
  return (
    <div>
      <h2 className="wizard-panel-title">Agent Capabilities</h2>
      <p className="text-sm text-gray-400 mb-4">
        Define your agent's skills, knowledge domains, and roles
      </p>
      
      {/* Capability Selector */}
      <div className="mb-6">
        <button
          onClick={() => setShowCapabilitySelector(!showCapabilitySelector)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 rounded hover:bg-blue-700"
        >
          <PlusCircle size={16} />
          Add Capability
          {showCapabilitySelector ? (
            <ChevronUp size={16} />
          ) : (
            <ChevronDown size={16} />
          )}
        </button>
        
        {showCapabilitySelector && (
          <div className="mt-3 p-4 bg-gray-700 rounded">
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search capabilities..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            
            {!isAddingCustom ? (
              <>
                <div className="max-h-64 overflow-y-auto mb-4">
                  {filteredCapabilities.length === 0 ? (
                    <div className="text-center py-3 text-gray-400">
                      No matching capabilities found
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {filteredCapabilities.map(capability => (
                        <li
                          key={capability.id}
                          className="p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-750"
                          onClick={() => addCapability(capability)}
                        >
                          <div className="flex items-start">
                            <div>
                              <div className="font-medium">{capability.name}</div>
                              <div className="text-xs text-gray-400">
                                {capability.description}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Type: {capability.type}
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                
                <button
                  onClick={() => setIsAddingCustom(true)}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  + Add custom capability
                </button>
              </>
            ) : (
              <div className="space-y-3 mb-4">
                <h3 className="font-medium">Add Custom Capability</h3>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Capability Type
                  </label>
                  <select
                    value={customCapability.type}
                    onChange={e => setCustomCapability({ ...customCapability, type: e.target.value as CapabilityType })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                  >
                    <option value={CapabilityType.SKILL}>Skill</option>
                    <option value={CapabilityType.DOMAIN}>Domain</option>
                    <option value={CapabilityType.ROLE}>Role</option>
                    <option value={CapabilityType.TAG}>Tag</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={customCapability.name}
                    onChange={e => setCustomCapability({ ...customCapability, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                    placeholder="Enter capability name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    value={customCapability.description}
                    onChange={e => setCustomCapability({ ...customCapability, description: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                    placeholder="Enter capability description"
                    rows={2}
                  />
                </div>
                
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsAddingCustom(false)}
                    className="px-3 py-1 bg-gray-600 rounded hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCustomCapability}
                    className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Selected Capabilities */}
      <div className="mb-6">
        <h3 className="text-md font-medium mb-3">Selected Capabilities</h3>
        
        {selectedCapabilities.length === 0 ? (
          <div className="p-4 bg-gray-700 rounded text-center text-gray-400">
            No capabilities selected. Add some capabilities using the button above.
          </div>
        ) : (
          <div className="space-y-3">
            {capabilityList.map(capability => (
              <div 
                key={capability.id} 
                className="p-3 bg-gray-700 rounded flex flex-col md:flex-row md:items-center justify-between"
              >
                <div className="flex-1">
                  <div className="font-medium">{capability.name}</div>
                  <div className="text-xs text-gray-400">{capability.description}</div>
                  <div className="text-xs text-gray-500 mt-1">Type: {capability.type}</div>
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
      <div>
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