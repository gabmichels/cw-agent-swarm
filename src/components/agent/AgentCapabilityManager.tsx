import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PlusCircle, ChevronDown, ChevronUp, Loader2, AlertCircle, ArrowDown } from 'lucide-react';
import { 
  CapabilityType, 
  CapabilityLevel, 
  getCapabilityLevelDisplay,
  getCapabilityLevelPercentage,
  defaultCapabilities
} from '../../agents/shared/capability-system';
import { useCapabilitiesFromDatabase, DatabaseCapability } from '../../hooks/useCapabilitiesFromDatabase';

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
    descriptions?: Record<string, string>;
  };
  onChange: (capabilities: {
  skills: Record<string, CapabilityLevel>;
  domains: string[];
  roles: string[];
  tags?: string[];
    descriptions?: Record<string, string>;
  }) => void;
}

// Fallback capabilities in case the database is empty or API errors out
const FALLBACK_CAPABILITIES: Capability[] = [
  { id: 'skill.problem_solving', name: 'Problem Solving', description: 'Ability to analyze and solve complex problems', type: CapabilityType.SKILL },
  { id: 'skill.creative_thinking', name: 'Creative Thinking', description: 'Ability to come up with novel ideas and solutions', type: CapabilityType.SKILL },
  { id: 'skill.research', name: 'Research', description: 'Ability to find and synthesize information', type: CapabilityType.SKILL },
  { id: 'domain.marketing', name: 'Marketing', description: 'Knowledge of marketing principles and strategies', type: CapabilityType.DOMAIN },
  { id: 'domain.technology', name: 'Technology', description: 'Knowledge of technology trends and applications', type: CapabilityType.DOMAIN },
  { id: 'role.assistant', name: 'Assistant', description: 'Acts as a helpful assistant', type: CapabilityType.ROLE },
  { id: 'role.advisor', name: 'Advisor', description: 'Provides expert advice and recommendations', type: CapabilityType.ROLE },
];

// Helper function to convert DatabaseCapability to Capability
const convertDatabaseCapability = (dbCapability: DatabaseCapability): Capability => ({
  id: dbCapability.id,
  name: dbCapability.name,
  description: dbCapability.description,
  type: dbCapability.type as CapabilityType
});

const AgentCapabilityManager: React.FC<AgentCapabilityManagerProps> = ({
  initialCapabilities = {
    skills: {},
    domains: [],
    roles: [],
    tags: [],
    descriptions: {}
  },
  onChange
}) => {
  const formRef = useRef<HTMLDivElement>(null);
  const [capabilities, setCapabilities] = useState({
    skills: initialCapabilities.skills || {},
    domains: initialCapabilities.domains || [],
    roles: initialCapabilities.roles || [],
    tags: initialCapabilities.tags || [],
    descriptions: initialCapabilities.descriptions || {}
  });
  
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

  // Fetch more capabilities of filtered type
  const handleFetchMoreCapabilities = async () => {
    if (searchTerm.length > 2) {
      await fetchMoreSearch();
      return;
    }
    
    if (capabilityTypeFilter === CapabilityType.SKILL) {
      await fetchMoreSkills();
    } else if (capabilityTypeFilter === CapabilityType.DOMAIN) {
      await fetchMoreDomains();
    } else if (capabilityTypeFilter === CapabilityType.ROLE) {
      await fetchMoreRoles();
    } else {
      // If no filter, fetch more of all types
      await Promise.all([
        fetchMoreSkills(),
        fetchMoreDomains(),
        fetchMoreRoles()
      ]);
    }
  };

  // Check if we have more capabilities to load
  const hasMoreCapabilities = searchTerm.length > 2 
    ? hasMoreSearch
    : capabilityTypeFilter === CapabilityType.SKILL
      ? hasMoreSkills
      : capabilityTypeFilter === CapabilityType.DOMAIN
        ? hasMoreDomains
        : capabilityTypeFilter === CapabilityType.ROLE
          ? hasMoreRoles
          : hasMoreSkills || hasMoreDomains || hasMoreRoles;

  // Combine all database capabilities with filtering by type
  const databaseCapabilities = React.useMemo(() => {
    // If searching, prioritize search results
    if (searchTerm.length > 2) {
      return searchResults.map(convertDatabaseCapability);
    }
    
    // Apply type filter if selected
    if (capabilityTypeFilter) {
      switch (capabilityTypeFilter) {
        case CapabilityType.SKILL:
          return skillsFromDb.map(convertDatabaseCapability);
        case CapabilityType.DOMAIN:
          return domainsFromDb.map(convertDatabaseCapability);
        case CapabilityType.ROLE:
          return rolesFromDb.map(convertDatabaseCapability);
        default:
          break;
      }
    }

    // Collect all capabilities
    const allCapabilities: Capability[] = [
      ...skillsFromDb.map(convertDatabaseCapability),
      ...domainsFromDb.map(convertDatabaseCapability),
      ...rolesFromDb.map(convertDatabaseCapability),
    ];

    // If we don't have any database capabilities, use fallback ones
    return allCapabilities.length > 0 ? allCapabilities : FALLBACK_CAPABILITIES;
  }, [
    skillsFromDb, 
    domainsFromDb, 
    rolesFromDb, 
    searchResults, 
    searchTerm, 
    capabilityTypeFilter
  ]);

  // Initialize selected capabilities from initial values
  useEffect(() => {
    const skills = Object.entries(initialCapabilities.skills || {}).map(([id, level]) => {
      // Extract descriptive name from ID (e.g., "skill.creative_thinking" -> "creative thinking")
      const namePart = id.split('.')[1] || id;
      const displayName = namePart
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      return {
        id,
        name: displayName,
        description: initialCapabilities.descriptions?.[id] || '', // Use stored description if available
        type: CapabilityType.SKILL,
        level
      };
    });

    const domains = (initialCapabilities.domains || []).map(domain => {
      const id = `domain.${domain.toLowerCase().replace(/\s+/g, '_')}`;
      return {
        id,
        name: domain,
        description: initialCapabilities.descriptions?.[id] || '', // Use stored description if available
        type: CapabilityType.DOMAIN
      };
    });

    const roles = (initialCapabilities.roles || []).map(role => {
      const id = `role.${role.toLowerCase().replace(/\s+/g, '_')}`;
      return {
        id,
        name: role,
        description: initialCapabilities.descriptions?.[id] || '', // Use stored description if available
        type: CapabilityType.ROLE
      };
    });

    setSelectedCapabilities([...skills, ...domains, ...roles]);
  }, [initialCapabilities]);

  // Notify parent component when capabilities change
  useEffect(() => {
      onChange(capabilities);
  }, [capabilities, onChange]);
  
  // Filter capabilities based on search term
  const filteredCapabilities = React.useMemo(() => {
    return databaseCapabilities.filter(cap => {
      const isAlreadySelected = selectedCapabilities.some(selected => selected.id === cap.id);
      if (isAlreadySelected) return false;
      
      if (!searchTerm) return true;
      
      return (
        cap.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cap.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cap.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [databaseCapabilities, selectedCapabilities, searchTerm]);

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
        },
        descriptions: {
          ...prev.descriptions,
          [capability.id]: capability.description // Store the description
        }
      }));
    } else if (capability.type === CapabilityType.DOMAIN) {
      setCapabilities(prev => ({
        ...prev,
        domains: [...prev.domains, capability.name],
        descriptions: {
          ...prev.descriptions,
          [capability.id]: capability.description // Store the description
        }
      }));
    } else if (capability.type === CapabilityType.ROLE) {
      setCapabilities(prev => ({
        ...prev,
        roles: [...prev.roles, capability.name],
        descriptions: {
          ...prev.descriptions,
          [capability.id]: capability.description // Store the description
        }
      }));
    } else if (capability.type === CapabilityType.TAG) {
      setCapabilities(prev => ({
        ...prev,
        tags: [...(prev.tags || []), capability.name],
        descriptions: {
          ...prev.descriptions,
          [capability.id]: capability.description // Store the description
        }
      }));
    }
    
    // Reset custom capability form if adding custom
    if (isAddingCustom) {
      setCustomCapability({
      id: '',
      name: '',
      description: '',
        type: CapabilityType.SKILL,
        level: CapabilityLevel.BASIC
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
        
        // Remove description
        const newDescriptions = { ...prev.descriptions };
        delete newDescriptions[capability.id];
        
        return {
          ...prev,
          skills: newSkills,
          descriptions: newDescriptions
        };
      });
    } else if (capability.type === CapabilityType.DOMAIN) {
      setCapabilities(prev => {
        // Remove description
        const newDescriptions = { ...prev.descriptions };
        delete newDescriptions[capability.id];
        
        return {
          ...prev,
          domains: prev.domains.filter(domain => domain !== capability.name),
          descriptions: newDescriptions
        };
      });
    } else if (capability.type === CapabilityType.ROLE) {
      setCapabilities(prev => {
        // Remove description
        const newDescriptions = { ...prev.descriptions };
        delete newDescriptions[capability.id];
        
        return {
          ...prev,
          roles: prev.roles.filter(role => role !== capability.name),
          descriptions: newDescriptions
        };
      });
    } else if (capability.type === CapabilityType.TAG) {
      setCapabilities(prev => {
        // Remove description
        const newDescriptions = { ...prev.descriptions };
        delete newDescriptions[capability.id];
        
        return {
          ...prev,
          tags: (prev.tags || []).filter(tag => tag !== capability.name),
          descriptions: newDescriptions
        };
      });
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

  // Send new capability to database
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

  // Update handleAddCustomCapability to optionally save to database
  const handleAddCustomCapability = async () => {
    // Validate required fields
    if (!customCapability.name) {
      alert('Please enter a name for the custom capability');
      return;
    }
    
    // Generate ID based on type and name
    const id = isEditingCapability && editingCapabilityId 
      ? editingCapabilityId 
      : `${customCapability.type}.${customCapability.name.toLowerCase().replace(/\s+/g, '_')}`;
    
    const newCapability = {
      ...customCapability,
      id,
      level: customCapability.type === CapabilityType.SKILL ? customCapability.level : undefined
    };
    
    if (isEditingCapability) {
      // Update the existing capability
      setSelectedCapabilities(prev => 
        prev.map(cap => cap.id === id ? newCapability : cap)
      );
      
      // Update the capabilities object based on the type
      if (newCapability.type === CapabilityType.SKILL && newCapability.level) {
        setCapabilities(prev => ({
          ...prev,
          skills: {
            ...prev.skills,
            [id]: newCapability.level as CapabilityLevel // Cast to ensure it's not undefined
          },
          descriptions: {
            ...prev.descriptions,
            [id]: newCapability.description // Update the description
          }
        }));
      } else {
        // For non-skill capabilities, just update the description
        setCapabilities(prev => ({
          ...prev,
          descriptions: {
            ...prev.descriptions,
            [id]: newCapability.description
          }
        }));
      }
    } else {
      // Add as a new capability
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
    
    // Close the form
    setShowCapabilitySelector(false);
  };
  
  // Start editing a capability
  const handleEditCapability = (capability: Capability) => {
    setIsEditingCapability(true);
    setEditingCapabilityId(capability.id);
    setIsAddingCustom(true);
    setShowCapabilitySelector(true);
    
    // Extract the real description without the "Skill level:" prefix if it's there
    let description = capability.description;
    if (capability.type === CapabilityType.SKILL && description.startsWith("Skill level:")) {
      description = ""; // Clear auto-generated descriptions
    }
    
    setCustomCapability({
      id: capability.id,
      name: capability.name,
      description: description,
      type: capability.type,
      level: capability.type === CapabilityType.SKILL 
        ? capability.level || CapabilityLevel.BASIC 
        : CapabilityLevel.BASIC
    });
    
    // Scroll to the form container after a short delay to ensure it's visible
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };
  
  // Handle clicking Add Capability button
  const handleAddCapabilityClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Reset form and show selector
    setIsEditingCapability(false);
    setEditingCapabilityId(null);
    setSearchTerm("");
    setCustomCapability({
      id: '',
      name: '',
      description: '',
      type: CapabilityType.SKILL,
      level: CapabilityLevel.BASIC
    });
    
    setShowCapabilitySelector(!showCapabilitySelector);
  }
  
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
  
  // Add state for capability filtering
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  
  // Get color by capability type
  const getCapabilityTypeColor = (type: CapabilityType): string => {
    switch (type) {
      case CapabilityType.SKILL:
        return 'bg-purple-500 text-purple-100 border-purple-400';
      case CapabilityType.DOMAIN:
        return 'bg-blue-500 text-blue-100 border-blue-400';
      case CapabilityType.ROLE:
        return 'bg-green-500 text-green-100 border-green-400';
      case CapabilityType.TAG:
        return 'bg-amber-500 text-amber-100 border-amber-400';
      default:
        return 'bg-gray-500 text-gray-100 border-gray-400';
    }
  };
  
  // Get color by capability level
  const getCapabilityLevelColor = (level: CapabilityLevel | undefined): string => {
    switch (level) {
      case CapabilityLevel.BASIC:
        return 'bg-emerald-500 text-emerald-100';
      case CapabilityLevel.INTERMEDIATE:
        return 'bg-yellow-500 text-yellow-100';
      case CapabilityLevel.ADVANCED:
        return 'bg-red-500 text-red-100';
      default:
        return 'bg-gray-500 text-gray-100';
    }
  };
  
  // Filter capabilities by type or show all if no filter active
  const filteredSelectedCapabilities = activeFilter
    ? selectedCapabilities.filter(cap => cap.type === activeFilter)
    : selectedCapabilities;
  
  // Sort filtered capabilities alphabetically
  const capabilityList = filteredSelectedCapabilities.sort((a, b) => a.name.localeCompare(b.name));

  // Display loading indicator when fetching capabilities
  const isLoading = loadingSkills || loadingDomains || loadingRoles || (searchTerm.length > 2 && loadingSearch);
  const hasError = skillsError || domainsError || rolesError || (searchTerm.length > 2 && searchError);

  return (
    <div>
      {/* Capability Selector */}
      <div className="mb-6" ref={formRef}>
        <button
          type="button"
          onClick={handleAddCapabilityClick}
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
            
            {/* Type filter buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={() => setCapabilityTypeFilter(null)}
                className={`px-3 py-1 rounded text-sm ${
                  capabilityTypeFilter === null 
                    ? 'bg-white text-gray-800' 
                    : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                }`}
              >
                All Types
              </button>
              {Object.values(CapabilityType).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCapabilityTypeFilter(
                    capabilityTypeFilter === type ? null : type
                  )}
                  className={`px-3 py-1 rounded text-sm ${
                    capabilityTypeFilter === type 
                      ? getCapabilityTypeColor(type)
                      : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}s
                </button>
              ))}
            </div>
          
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="animate-spin mr-2" size={20} />
                <span>Loading capabilities...</span>
              </div>
            )}
            
            {/* Error State */}
            {hasError && !isLoading && (
              <div className="flex items-center bg-red-900/30 text-red-200 p-3 rounded mb-4">
                <AlertCircle className="mr-2" size={20} />
                <span>
                  Error loading capabilities. Using fallback capabilities instead.
                </span>
              </div>
            )}
          
            {!isAddingCustom ? (
              <>
                <div className="max-h-64 overflow-y-auto mb-4" ref={capabilityListRef}>
                  {filteredCapabilities.length === 0 && !isLoading ? (
                    <div className="text-center py-3 text-gray-400">
                      No matching capabilities found
                    </div>
                  ) : (
                    <>
                      <ul className="space-y-2">
                        {!isLoading && filteredCapabilities.map(capability => (
                          <li
                            key={capability.id}
                            className="p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-750"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              addCapability(capability);
                            }}
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
                      
                      {/* Load more button */}
                      {hasMoreCapabilities && !isLoading && (
                        <div className="text-center mt-4">
                          <button
                            type="button"
                            onClick={handleFetchMoreCapabilities}
                            className="flex items-center justify-center mx-auto px-3 py-1 bg-gray-600 rounded hover:bg-gray-500 text-sm"
                          >
                            Load more capabilities
                            <ArrowDown className="ml-1" size={14} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsAddingCustom(true);
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  + Add custom capability
                </button>
              </>
            ) : (
              <div className="space-y-3 mb-4">
                <h3 className="font-medium">
                  {isEditingCapability ? 'Edit Capability' : 'Add Custom Capability'}
                </h3>
                
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
                
                {/* Add Skill Level selector for Skills */}
                {customCapability.type === CapabilityType.SKILL && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Skill Level
                    </label>
                    <div className="flex items-center space-x-2">
                      {Object.values(CapabilityLevel).map(level => (
                        <button
                          key={level}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCustomCapability({ ...customCapability, level });
                          }}
                          className={`px-3 py-1 rounded ${
                            customCapability.level === level 
                              ? getCapabilityLevelColor(level)
                              : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          {getCapabilityLevelDisplay(level)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Display creation error if any */}
                {createCapabilityError && (
                  <div className="text-red-400 text-sm mt-2">
                    <AlertCircle className="inline-block mr-1" size={14} />
                    {createCapabilityError}
                  </div>
                )}
                
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsAddingCustom(false);
                      setCreateCapabilityError(null);
                    }}
                    className="px-3 py-1 bg-gray-600 rounded hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddCustomCapability();
                    }}
                    className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700 flex items-center"
                    disabled={isCreatingCapabilityInDB}
                  >
                    {isCreatingCapabilityInDB && (
                      <Loader2 className="animate-spin mr-2" size={16} />
                    )}
                    {isEditingCapability ? 'Update' : 'Add'}
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
        
        {/* Type Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => setActiveFilter(null)}
            className={`px-3 py-1 rounded text-sm font-medium border ${
              activeFilter === null 
                ? 'bg-white text-gray-800 border-white' 
                : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
            }`}
          >
            All ({selectedCapabilities.length})
          </button>
        
          {Object.entries(groupedCapabilities).map(([type, caps]) => (
            <button
              key={type}
              type="button"
              onClick={() => setActiveFilter(activeFilter === type ? null : type)}
              className={`px-3 py-1 rounded text-sm font-medium border ${
                activeFilter === type 
                  ? getCapabilityTypeColor(type as CapabilityType)
                  : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}s ({caps.length})
            </button>
          ))}
        </div>
        
        {selectedCapabilities.length === 0 ? (
          <div className="p-4 bg-gray-700 rounded text-center text-gray-400">
            No capabilities selected. Add some capabilities using the button above.
          </div>
        ) : capabilityList.length === 0 ? (
          <div className="p-4 bg-gray-700 rounded text-center text-gray-400">
            No capabilities match the current filter.
          </div>
        ) : (
          <div className="space-y-3">
            {capabilityList.map(capability => (
                <div 
                  key={capability.id} 
                  className={`p-3 bg-gray-700 rounded flex flex-col md:flex-row md:items-center justify-between ${
                    activeFilter === capability.type ? 'border-l-4' : ''
                  } ${activeFilter === capability.type ? getCapabilityTypeColor(capability.type).replace('bg-', 'border-').split(' ')[0] : ''}`}
                >
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    <span>{capability.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getCapabilityTypeColor(capability.type)}`}>
                      {capability.type}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">{capability.description}</div>
                  </div>
                  
                  {capability.type === CapabilityType.SKILL && (
                    <div className="mt-2 md:mt-0 md:ml-4 flex items-center">
                      <div className="flex gap-2">
                        <div className="relative group">
                          <span 
                            className={`text-xs px-2 py-0.5 rounded-full cursor-pointer ${getCapabilityLevelColor(capability.level)}`}
                            title="Click to change level"
                          >
                            {getCapabilityLevelDisplay(capability.level)}
                          </span>
                          
                          <div className="hidden group-hover:block absolute left-0 right-0 mt-1 bg-gray-800 rounded shadow-lg p-1 z-10">
                            <div className="flex flex-col gap-1 min-w-[120px]">
                          {Object.values(CapabilityLevel).map(level => (
                            <button
                              key={level}
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleUpdateLevel(capability, level);
                                  }}
                                  className={`text-xs px-2 py-1 rounded text-left ${
                                capability.level === level 
                                      ? getCapabilityLevelColor(level)
                                      : 'bg-gray-700 hover:bg-gray-600'
                              }`}
                                >
                                  {getCapabilityLevelDisplay(level)}
                                </button>
                          ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                <div className="mt-2 md:mt-0 md:ml-2 flex">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleEditCapability(capability);
                    }}
                    className="text-blue-400 hover:text-blue-300 mr-3"
                    title="Edit capability"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveCapability(capability);
                    }}
                    className="text-red-400 hover:text-red-300"
                    title="Remove capability"
                  >
                    Remove
                  </button>
                </div>
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