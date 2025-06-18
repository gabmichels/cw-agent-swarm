import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PlusCircle, ChevronDown, ChevronUp, Loader2, AlertCircle, Edit, Trash2, Save, X } from 'lucide-react';
import { 
  CapabilityType, 
  CapabilityLevel, 
  getCapabilityLevelDisplay,
  getCapabilityLevelPercentage
} from '../../agents/shared/capability-system';
import { useCapabilitiesFromDatabase, DatabaseCapability } from '../../hooks/useCapabilitiesFromDatabase';
import { AgentProfile } from '@/lib/multi-agent/types/agent';

interface Capability {
  id: string;
  name: string;
  description: string;
  type: CapabilityType;
  level?: CapabilityLevel;
}

interface AgentCapabilityEditorProps {
  agent: AgentProfile;
  onCapabilitiesUpdate: (updatedAgent: AgentProfile) => void;
  isEditing: boolean;
  onEditingChange: (editing: boolean) => void;
}

// Helper function to convert DatabaseCapability to Capability
const convertDatabaseCapability = (dbCapability: DatabaseCapability): Capability => ({
  id: dbCapability.id,
  name: dbCapability.name,
  description: dbCapability.description,
  type: dbCapability.type as CapabilityType
});

// Helper function to extract capability level from agent capability parameters
const extractCapabilityLevel = (agentCapability: any): CapabilityLevel => {
  const level = agentCapability.parameters?.level || agentCapability.parameters?.proficiency;
  switch (level) {
    case 'basic': return CapabilityLevel.BASIC;
    case 'intermediate': return CapabilityLevel.INTERMEDIATE;
    case 'advanced': return CapabilityLevel.ADVANCED;
    default: return CapabilityLevel.BASIC;
  }
};

// Helper function to convert agent capabilities to local format
const convertAgentCapabilities = (agentCapabilities: AgentProfile['capabilities']): {
  skills: Record<string, CapabilityLevel>;
  domains: string[];
  roles: string[];
  tags: string[];
  descriptions: Record<string, string>;
} => {
  const result = {
    skills: {} as Record<string, CapabilityLevel>,
    domains: [] as string[],
    roles: [] as string[],
    tags: [] as string[],
    descriptions: {} as Record<string, string>
  };

  // Handle empty or undefined capabilities array
  if (!agentCapabilities || agentCapabilities.length === 0) {
    return result;
  }

  // Track processed IDs and originalCapabilityIds to avoid duplicates
  const processedIds = new Set<string>();
  const processedOriginalIds = new Set<string>();
  const processedNameTypes = new Set<string>();

  agentCapabilities.forEach(cap => {
    // Skip if we've already processed this capability ID
    if (processedIds.has(cap.id)) {
      return;
    }
    
    // Skip if we've already processed this originalCapabilityId
    const originalCapabilityId = cap.parameters?.originalCapabilityId;
    if (originalCapabilityId && typeof originalCapabilityId === 'string' && processedOriginalIds.has(originalCapabilityId)) {
      return;
    }
    
    // Skip if we've already processed this name-type combination
    const type = cap.parameters?.type || 'skill';
    const nameTypeKey = `${cap.name}-${type}`;
    if (processedNameTypes.has(nameTypeKey)) {
      return;
    }
    
    // Add to processed sets
    processedIds.add(cap.id);
    if (originalCapabilityId && typeof originalCapabilityId === 'string') {
      processedOriginalIds.add(originalCapabilityId);
    }
    processedNameTypes.add(nameTypeKey);

    const level = extractCapabilityLevel(cap);
    
    result.descriptions[cap.id] = cap.description;
    
    switch (type) {
      case 'skill':
        result.skills[cap.id] = level;
        break;
      case 'domain':
        result.domains.push(cap.id);
        break;
      case 'role':
        result.roles.push(cap.id);
        break;
      case 'tag':
        result.tags.push(cap.id);
        break;
    }
  });

  return result;
};

const AgentCapabilityEditor: React.FC<AgentCapabilityEditorProps> = ({
  agent,
  onCapabilitiesUpdate,
  isEditing,
  onEditingChange
}) => {
  const formRef = useRef<HTMLDivElement>(null);
  const [capabilities, setCapabilities] = useState(() => convertAgentCapabilities(agent.capabilities));
  const [selectedCapabilities, setSelectedCapabilities] = useState<Capability[]>([]);
  const [showCapabilitySelector, setShowCapabilitySelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [isEditingCapability, setIsEditingCapability] = useState(false);
  const [editingCapabilityId, setEditingCapabilityId] = useState<string | null>(null);
  const [customCapability, setCustomCapability] = useState({
    id: '',
    name: '',
    description: '',
    type: CapabilityType.SKILL,
    level: CapabilityLevel.BASIC
  });
  const [isCreatingCapabilityInDB, setIsCreatingCapabilityInDB] = useState(false);
  const [createCapabilityError, setCreateCapabilityError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const capabilityListRef = useRef<HTMLDivElement>(null);
  const [capabilityTypeFilter, setCapabilityTypeFilter] = useState<CapabilityType | null>(null);

  // Fetch capabilities from database with pagination
  const { 
    capabilities: skillsFromDb, 
    loading: loadingSkills,
    error: skillsError,
    refetch: refetchSkills,
    hasMore: hasMoreSkills,
    fetchNextPage: fetchMoreSkills
  } = useCapabilitiesFromDatabase({ 
    type: CapabilityType.SKILL,
    limit: 30
  });

  const { 
    capabilities: domainsFromDb, 
    loading: loadingDomains,
    error: domainsError,
    refetch: refetchDomains,
    hasMore: hasMoreDomains,
    fetchNextPage: fetchMoreDomains
  } = useCapabilitiesFromDatabase({ 
    type: CapabilityType.DOMAIN,
    limit: 30 
  });

  const { 
    capabilities: rolesFromDb, 
    loading: loadingRoles,
    error: rolesError,
    refetch: refetchRoles,
    hasMore: hasMoreRoles,
    fetchNextPage: fetchMoreRoles
  } = useCapabilitiesFromDatabase({ 
    type: CapabilityType.ROLE,
    limit: 30
  });

  // Search capabilities when user enters search term
  const { 
    capabilities: searchResults, 
    loading: loadingSearch,
    error: searchError,
    refetch: refetchSearch,
    hasMore: hasMoreSearch,
    fetchNextPage: fetchMoreSearch
  } = useCapabilitiesFromDatabase({ 
    searchQuery: searchTerm,
    enabled: searchTerm.length > 2,
    limit: 30
  });

  // Update search results when search term changes
  useEffect(() => {
    if (searchTerm.length > 2) {
      refetchSearch();
    }
  }, [searchTerm, refetchSearch]);

  // Update selected capabilities when agent capabilities change
  useEffect(() => {
    const agentCapabilities = convertAgentCapabilities(agent.capabilities);
    setCapabilities(agentCapabilities);
    
    // Convert agent capabilities to selected capabilities format
    // Handle empty capabilities array gracefully
    const selected: Capability[] = (agent.capabilities || []).map(cap => ({
      id: cap.id,
      name: cap.name,
      description: cap.description,
      type: (cap.parameters?.type || 'skill') as CapabilityType,
      level: extractCapabilityLevel(cap)
    }));
    
    // Deduplicate selected capabilities by ID, originalCapabilityId, and name
    const seenIds = new Set<string>();
    const seenOriginalIds = new Set<string>();
    const seenNames = new Set<string>();
    
    const deduplicatedSelected = selected.filter(cap => {
      // Check for duplicate ID
      if (seenIds.has(cap.id)) {
        return false;
      }
      
      // Check for duplicate originalCapabilityId (from agent capabilities)
      const originalCapabilityId = (agent.capabilities || [])
        .find(agentCap => agentCap.id === cap.id)?.parameters?.originalCapabilityId;
      if (originalCapabilityId && typeof originalCapabilityId === 'string' && seenOriginalIds.has(originalCapabilityId)) {
        return false;
      }
      
      // Check for duplicate name within the same type
      const nameTypeKey = `${cap.name}-${cap.type}`;
      if (seenNames.has(nameTypeKey)) {
        return false;
      }
      
      // Add to seen sets
      seenIds.add(cap.id);
      if (originalCapabilityId && typeof originalCapabilityId === 'string') {
        seenOriginalIds.add(originalCapabilityId);
      }
      seenNames.add(nameTypeKey);
      
      return true;
    });
    
    setSelectedCapabilities(deduplicatedSelected);
  }, [agent.capabilities]);

  // Combine all database capabilities with filtering by type
  const databaseCapabilities = React.useMemo(() => {
    let capabilities: Capability[] = [];
    
    // If searching, prioritize search results
    if (searchTerm.length > 2) {
      capabilities = searchResults.map(convertDatabaseCapability);
    } else if (capabilityTypeFilter) {
      // Apply type filter if selected
      switch (capabilityTypeFilter) {
        case CapabilityType.SKILL:
          capabilities = skillsFromDb.map(convertDatabaseCapability);
          break;
        case CapabilityType.DOMAIN:
          capabilities = domainsFromDb.map(convertDatabaseCapability);
          break;
        case CapabilityType.ROLE:
          capabilities = rolesFromDb.map(convertDatabaseCapability);
          break;
        default:
          capabilities = [];
      }
    } else {
      // Return all capabilities if no filter, but deduplicate by ID
      const allCapabilities = [
        ...skillsFromDb.map(convertDatabaseCapability),
        ...domainsFromDb.map(convertDatabaseCapability),
        ...rolesFromDb.map(convertDatabaseCapability)
      ];
      
      // Deduplicate by ID to prevent duplicate keys
      const seenIds = new Set<string>();
      capabilities = allCapabilities.filter(cap => {
        if (seenIds.has(cap.id)) {
          return false;
        }
        seenIds.add(cap.id);
        return true;
      });
    }
    
    return capabilities;
  }, [skillsFromDb, domainsFromDb, rolesFromDb, searchResults, searchTerm, capabilityTypeFilter]);

  // Save capabilities to agent
  const saveCapabilities = async () => {
    setIsSaving(true);
    setSaveError(null);
    
    try {
      // Convert local capabilities format back to agent format
      const updatedCapabilities = selectedCapabilities.map(cap => {
        const level = cap.type === CapabilityType.SKILL ? cap.level : undefined;
        return {
          id: cap.id,
          name: cap.name,
          description: capabilities.descriptions[cap.id] || cap.description,
          version: '1.0.0',
          parameters: {
            level: level ? level.toString() : undefined,
            type: cap.type.toString(),
            proficiency: level ? level.toString() : undefined,
            dateAdded: new Date().toISOString(),
            source: 'agent-edit'
          }
        };
      });

      const updatedAgent = {
        ...agent,
        capabilities: updatedCapabilities
      };

      // Call API to update agent
      const response = await fetch(`/api/multi-agent/agents/${agent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedAgent)
      });

      if (!response.ok) {
        throw new Error(`Failed to update agent capabilities: ${response.statusText}`);
      }

      const data = await response.json();
      onCapabilitiesUpdate(data.agent || updatedAgent);
      onEditingChange(false);
      
    } catch (error) {
      console.error('Error saving capabilities:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save capabilities');
    } finally {
      setIsSaving(false);
    }
  };

  // Add capability
  const addCapability = (capability: Capability) => {
    if (selectedCapabilities.some(c => c.id === capability.id)) {
      return; // Already added
    }

    const newCapability = { ...capability };
    setSelectedCapabilities(prev => [...prev, newCapability]);
    
    // Update local capabilities state
    if (capability.type === CapabilityType.SKILL) {
      setCapabilities(prev => ({
        ...prev,
        skills: { ...prev.skills, [capability.id]: capability.level || CapabilityLevel.BASIC }
      }));
    } else if (capability.type === CapabilityType.DOMAIN) {
      setCapabilities(prev => ({
        ...prev,
        domains: [...prev.domains, capability.id]
      }));
    } else if (capability.type === CapabilityType.ROLE) {
      setCapabilities(prev => ({
        ...prev,
        roles: [...prev.roles, capability.id]
      }));
    }
  };

  // Remove capability
  const removeCapability = (capability: Capability) => {
    setSelectedCapabilities(prev => prev.filter(c => c.id !== capability.id));
    
    // Update local capabilities state
    if (capability.type === CapabilityType.SKILL) {
      setCapabilities(prev => {
        const { [capability.id]: removed, ...rest } = prev.skills;
        return { ...prev, skills: rest };
      });
    } else if (capability.type === CapabilityType.DOMAIN) {
      setCapabilities(prev => ({
        ...prev,
        domains: prev.domains.filter(id => id !== capability.id)
      }));
    } else if (capability.type === CapabilityType.ROLE) {
      setCapabilities(prev => ({
        ...prev,
        roles: prev.roles.filter(id => id !== capability.id)
      }));
    }
  };

  // Update capability level
  const updateCapabilityLevel = (capability: Capability, level: CapabilityLevel) => {
    setSelectedCapabilities(prev => 
      prev.map(c => c.id === capability.id ? { ...c, level } : c)
    );
    
    if (capability.type === CapabilityType.SKILL) {
      setCapabilities(prev => ({
        ...prev,
        skills: { ...prev.skills, [capability.id]: level }
      }));
    }
  };

  // Save capability to database
  const saveCapabilityToDatabase = async (capability: Capability): Promise<boolean> => {
    setIsCreatingCapabilityInDB(true);
    setCreateCapabilityError(null);
    
    try {
      const response = await fetch('/api/multi-agent/capabilities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: capability.name,
          description: capability.description,
          type: capability.type,
          version: '1.0.0',
          parameters: {},
          tags: [],
          domains: [],
          relatedCapabilityIds: []
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create capability');
      }
      
      // Refetch capabilities after creating a new one
      if (capability.type === CapabilityType.SKILL) {
        refetchSkills();
      } else if (capability.type === CapabilityType.DOMAIN) {
        refetchDomains();
      } else if (capability.type === CapabilityType.ROLE) {
        refetchRoles();
      }
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setCreateCapabilityError(errorMessage);
      return false;
    } finally {
      setIsCreatingCapabilityInDB(false);
    }
  };

  // Handle adding custom capability
  const handleAddCustomCapability = async () => {
    if (!customCapability.name) {
      alert('Please enter a name for the custom capability');
      return;
    }
    
    const id = isEditingCapability && editingCapabilityId 
      ? editingCapabilityId 
      : `${customCapability.type}.${customCapability.name.toLowerCase().replace(/\s+/g, '_')}`;
    
    const newCapability = {
      ...customCapability,
      id,
      level: customCapability.type === CapabilityType.SKILL ? customCapability.level : undefined
    };
    
    if (isEditingCapability) {
      // Update existing capability
      setSelectedCapabilities(prev => 
        prev.map(cap => cap.id === id ? newCapability : cap)
      );
    } else {
      // Add new capability
      addCapability(newCapability);
      
      // Save to database if it's a custom capability
      if (!databaseCapabilities.some(cap => cap.id === newCapability.id)) {
        await saveCapabilityToDatabase(newCapability);
      }
    }
    
    // Reset form state
    setCustomCapability({
      id: '',
      name: '',
      description: '',
      type: CapabilityType.SKILL,
      level: CapabilityLevel.BASIC
    });
    setIsEditingCapability(false);
    setEditingCapabilityId(null);
    setIsAddingCustom(false);
    setSearchTerm('');
    setShowCapabilitySelector(false);
  };

  // Get capability type color
  const getCapabilityTypeColor = (type: CapabilityType): string => {
    switch (type) {
      case CapabilityType.SKILL:
        return 'bg-blue-900 border-blue-700 text-blue-200';
      case CapabilityType.DOMAIN:
        return 'bg-green-900 border-green-700 text-green-200';
      case CapabilityType.ROLE:
        return 'bg-purple-900 border-purple-700 text-purple-200';
      case CapabilityType.TAG:
        return 'bg-yellow-900 border-yellow-700 text-yellow-200';
      default:
        return 'bg-gray-900 border-gray-700 text-gray-200';
    }
  };

  // Get capability level color
  const getCapabilityLevelColor = (level: CapabilityLevel | undefined): string => {
    switch (level) {
      case CapabilityLevel.BASIC:
        return 'text-yellow-400';
      case CapabilityLevel.INTERMEDIATE:
        return 'text-orange-400';
      case CapabilityLevel.ADVANCED:
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  if (!isEditing) {
    // Read-only view
    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Capabilities</h2>
          <button
            onClick={() => onEditingChange(true)}
            className="flex items-center text-blue-500 hover:text-blue-400"
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </button>
        </div>
        
        <div className="space-y-2">
          {selectedCapabilities.map((capability, index) => (
            <div key={`selected-readonly-${capability.id}-${capability.type}-${index}`} className={`p-3 rounded border ${getCapabilityTypeColor(capability.type)}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-medium">{capability.name}</h3>
                  <p className="text-sm opacity-80">{capability.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-1 bg-black/20 rounded">
                      {capability.type.toUpperCase()}
                    </span>
                    {capability.type === CapabilityType.SKILL && capability.level && (
                      <span className={`text-xs font-medium ${getCapabilityLevelColor(capability.level)}`}>
                        {getCapabilityLevelDisplay(capability.level)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {selectedCapabilities.length === 0 && (
            <div className="text-center text-gray-400 py-8 border-2 border-dashed border-gray-600 rounded-lg">
              No capabilities assigned to this agent.
            </div>
          )}
        </div>
      </div>
    );
  }

  // Editing view
  return (
    <div ref={formRef}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Edit Capabilities</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => onEditingChange(false)}
            className="flex items-center text-gray-400 hover:text-gray-300"
            disabled={isSaving}
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </button>
          <button
            onClick={saveCapabilities}
            className="flex items-center text-green-500 hover:text-green-400"
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save
          </button>
        </div>
      </div>

      {saveError && (
        <div className="bg-red-900 border border-red-700 text-white px-4 py-2 rounded mb-4">
          {saveError}
        </div>
      )}

      {/* Selected Capabilities */}
      <div className="space-y-2 mb-4">
        {selectedCapabilities.map((capability, index) => (
          <div key={`selected-edit-${capability.id}-${capability.type}-${index}`} className={`p-3 rounded border ${getCapabilityTypeColor(capability.type)}`}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-medium">{capability.name}</h3>
                <p className="text-sm opacity-80">{capability.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-1 bg-black/20 rounded">
                    {capability.type.toUpperCase()}
                  </span>
                  {capability.type === CapabilityType.SKILL && (
                    <select
                      value={capability.level || CapabilityLevel.BASIC}
                      onChange={(e) => updateCapabilityLevel(capability, e.target.value as CapabilityLevel)}
                      className="text-xs bg-black/20 border border-white/20 rounded px-2 py-1"
                    >
                      <option value={CapabilityLevel.BASIC}>Basic</option>
                      <option value={CapabilityLevel.INTERMEDIATE}>Intermediate</option>
                      <option value={CapabilityLevel.ADVANCED}>Advanced</option>
                    </select>
                  )}
                </div>
              </div>
              <button
                onClick={() => removeCapability(capability)}
                className="text-red-400 hover:text-red-300 ml-2"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {selectedCapabilities.length === 0 && (
          <div className="text-center text-gray-400 py-8 border-2 border-dashed border-gray-600 rounded-lg">
            No capabilities selected. Use the button below to add capabilities.
          </div>
        )}
      </div>

      {/* Add Capability Button */}
      <button
        onClick={() => setShowCapabilitySelector(!showCapabilitySelector)}
        className="flex items-center w-full p-3 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-gray-300 hover:border-gray-500 transition-colors"
      >
        <PlusCircle className="h-5 w-5 mr-2" />
        Add Capability
      </button>

      {/* Capability Selector */}
      {showCapabilitySelector && (
        <div className="mt-4 p-4 bg-gray-800 border border-gray-700 rounded-lg">
          {/* Search and Filter */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Search capabilities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
            />
            <select
              value={capabilityTypeFilter || ''}
              onChange={(e) => setCapabilityTypeFilter(e.target.value as CapabilityType || null)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
            >
              <option value="">All Types</option>
              <option value={CapabilityType.SKILL}>Skills</option>
              <option value={CapabilityType.DOMAIN}>Domains</option>
              <option value={CapabilityType.ROLE}>Roles</option>
            </select>
          </div>

          {/* Available Capabilities */}
          <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
            {databaseCapabilities
              .filter(cap => !selectedCapabilities.some(selected => selected.id === cap.id))
              .map((capability, index) => (
                <div
                  key={`available-${capability.id}-${capability.type}-${index}`}
                  onClick={() => addCapability(capability)}
                  className={`p-2 rounded border cursor-pointer hover:bg-opacity-80 ${getCapabilityTypeColor(capability.type)}`}
                >
                  <h4 className="font-medium text-sm">{capability.name}</h4>
                  <p className="text-xs opacity-80">{capability.description}</p>
                </div>
              ))}
            {databaseCapabilities.filter(cap => !selectedCapabilities.some(selected => selected.id === cap.id)).length === 0 && (
              <div className="text-center text-gray-400 py-4">
                {searchTerm.length > 2 ? 'No capabilities found matching your search.' : 'No additional capabilities available.'}
              </div>
            )}
          </div>

          {/* Create Custom Capability */}
          <button
            onClick={() => setIsAddingCustom(!isAddingCustom)}
            className="w-full p-2 bg-blue-900 hover:bg-blue-800 text-blue-200 rounded text-sm"
          >
            Create Custom Capability
          </button>

          {isAddingCustom && (
            <div className="mt-4 p-4 bg-gray-900 border border-gray-600 rounded">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={customCapability.name}
                    onChange={(e) => setCustomCapability({...customCapability, name: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    value={customCapability.type}
                    onChange={(e) => setCustomCapability({...customCapability, type: e.target.value as CapabilityType})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
                  >
                    <option value={CapabilityType.SKILL}>Skill</option>
                    <option value={CapabilityType.DOMAIN}>Domain</option>
                    <option value={CapabilityType.ROLE}>Role</option>
                  </select>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={customCapability.description}
                  onChange={(e) => setCustomCapability({...customCapability, description: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
                  rows={3}
                />
              </div>

              {customCapability.type === CapabilityType.SKILL && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Level</label>
                  <select
                    value={customCapability.level}
                    onChange={(e) => setCustomCapability({...customCapability, level: e.target.value as CapabilityLevel})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
                  >
                    <option value={CapabilityLevel.BASIC}>Basic</option>
                    <option value={CapabilityLevel.INTERMEDIATE}>Intermediate</option>
                    <option value={CapabilityLevel.ADVANCED}>Advanced</option>
                  </select>
                </div>
              )}

              {createCapabilityError && (
                <div className="bg-red-900 border border-red-700 text-white px-3 py-2 rounded text-sm mb-4">
                  {createCapabilityError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleAddCustomCapability}
                  disabled={isCreatingCapabilityInDB}
                  className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                >
                  {isCreatingCapabilityInDB ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Add Capability
                </button>
                <button
                  onClick={() => setIsAddingCustom(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentCapabilityEditor; 