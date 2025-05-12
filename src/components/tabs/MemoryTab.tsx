import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AlertCircleIcon, Filter, X, Tag, Info, RefreshCw, ChevronDown, Loader2, Search, Hash, Settings, Menu, Bug, User } from 'lucide-react';
import MemoryItemComponent from '../memory/MemoryItem';
import { MemoryType, isValidMemoryType } from '../../lib/constants/memory';
import { BaseMemorySchema, MemoryPoint } from '../../server/memory/models';
import { SearchResult } from '../../server/memory/services/search/types';
import useMemory from '../../hooks/useMemory';
import useMemorySearch from '../../hooks/useMemorySearch';
import AgentMemoryStats from '../memory/AgentMemoryStats';
import { BaseMetadata } from '../../types/metadata';

// Memory property path constants
const PROPERTY_PATHS = {
  // Common type paths
  TYPE_PATHS: {
    PAYLOAD_TYPE: 'payload.type',
    KIND: 'kind',
    METADATA_TYPE: 'metadata.type',
    ROOT_TYPE: 'type',
    METADATA_CATEGORY: 'payload.metadata.category',
  },
  // Common timestamp paths
  TIMESTAMP_PATHS: {
    PAYLOAD_TIMESTAMP: 'payload.timestamp',
    ROOT_TIMESTAMP: 'timestamp',
    POINT_PAYLOAD_TIMESTAMP: 'point.payload.timestamp',
    CREATED_AT: 'created_at',
    PAYLOAD_CREATED_AT: 'payload.created_at',
  },
  // Common content paths
  CONTENT_PATHS: {
    PAYLOAD_TEXT: 'payload.text',
    POINT_PAYLOAD_TEXT: 'point.payload.text',
    CONTENT: 'content',
    TEXT: 'text',
    PAYLOAD_CONTENT: 'payload.content',
    VALUE: 'value',
    SUMMARY: 'summary',
    MESSAGE: 'message',
    PAYLOAD_MESSAGE: 'payload.message',
    THOUGHT: 'thought',
    PAYLOAD_THOUGHT: 'payload.thought',
  },
  // Memory types
  MEMORY_TYPES: {
    MESSAGE: 'message',
    THOUGHT: 'thought',
    DOCUMENT: 'document',
    UNKNOWN: 'unknown',
    MEMORY_EDIT: 'memory_edit',
  }
};

// API endpoints
const API_ENDPOINTS = {
  MEMORY_STATUS: {
    DIAGNOSTICS: '/api/diagnostics/memory-status',
    MEMORY: '/api/memory/status',
  },
  MEMORY_CHECK: '/api/diagnostics/memory-check',
  TAG_UPDATE: (memoryId: string) => `/api/memory/${memoryId}/tags`,
  TAG_REJECT: (memoryId: string) => `/api/memory/${memoryId}/tags/reject`,
  MEMORY_HISTORY: (memoryId: string) => `/api/memory/history/${memoryId}`,
};

// Define types for the debug result
interface SuspectedMessage {
  id: string;
  text: string;
  timestamp: string;
}

interface DebugResult {
  status: string;
  message: string;
  totalMessages: number;
  suspectedReflectionCount: number;
  suspectedMessages: SuspectedMessage[];
  error?: string;
}

// Update the ExtendedMemoryItem interface to be more flexible with types
interface ExtendedMemoryItem extends MemoryPoint<BaseMemorySchema> {
  kind?: string;
  metadata?: Record<string, any>;
  isMemoryEdit?: boolean;
  // Add optional type property at root level for flexible memory structures
  type?: string;
}

// Add new interfaces for agent support
interface AgentInfo {
  id: string;
  name: string;
}

// Interface for MemoryTab component props
interface MemoryTabProps {
  selectedAgentId?: string;
  availableAgents: AgentInfo[];
  onAgentChange?: (agentId: string) => void;
  showAllMemories?: boolean;
  onViewChange?: (showAll: boolean) => void;
}

// Update the MemoryEntry interface to include all necessary properties
interface MemoryEntry {
  id: string;
  type: MemoryType;
  content?: string;
  text?: string;
  created?: string;
  timestamp?: string;
  payload?: {
    text?: string;
    type?: string;
    timestamp?: string;
    metadata?: {
      context?: string;
      tags?: string[];
      [key: string]: any;
    };
    [key: string]: any;
  };
  metadata?: {
    context?: string;
    tags?: string[];
    [key: string]: any;
  };
  isMemoryEdit?: boolean;
  importance?: number;
  source?: string;
}

const MemoryTab: React.FC<MemoryTabProps> = ({
  selectedAgentId = '',
  availableAgents = [],
  onAgentChange,
  showAllMemories = false,
  onViewChange
}) => {
  const [localSelectedAgentId, setLocalSelectedAgentId] = useState(selectedAgentId);
  const [localShowAllMemories, setLocalShowAllMemories] = useState(showAllMemories);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  
  const { getAgentMemories } = useMemory();
  
  useEffect(() => {
    const loadMemories = async () => {
      if (!localSelectedAgentId && !localShowAllMemories) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const agentMemories = await getAgentMemories(
          localSelectedAgentId,
          { limit: 100 }
        );
        setMemories(agentMemories);
      } catch (err) {
        console.error('Error loading memories:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadMemories();
  }, [localSelectedAgentId, localShowAllMemories, getAgentMemories]);

  // Use standardized memory hooks
  const { isLoading: isLoadingMemoryHook, error: memoryHookError, totalCount, getMemories } = useMemory();
  const { 
    results: searchResults,
    loading: isSearching,
    hybridSearch,
    clearSearch
  } = useMemorySearch<BaseMemorySchema>();

  // State variables
  const [isChecking, setIsChecking] = useState(false);
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('');
  const [memoryCount, setMemoryCount] = useState<number>(0);
  const [selectedTypes, setSelectedTypes] = useState<MemoryType[]>([]);
  const [typeMenuOpen, setTypeMenuOpen] = useState<boolean>(false);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [showRawMemory, setShowRawMemory] = useState<string | null>(null);
  const [showDebugInfo, setShowDebugInfo] = useState<boolean>(false);

  // Derive loading and memory states, preferring hook values but falling back to props
  const isLoadingMemories = isLoadingMemoryHook || isLoading || false;

  // All possible memory types as strings - use the enum values
  const MEMORY_TYPES: string[] = useMemo(() => {
    // Use the MemoryType enum values
    return Object.values(MemoryType).sort();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (typeMenuRef.current && !typeMenuRef.current.contains(event.target as Node)) {
        setTypeMenuOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Load memories when component mounts
  useEffect(() => {
    if (!memories) {
      handleRefresh();
    }
  }, []);

  // Get unique memory types for filtering
  const availableMemoryTypes = useMemo(() => {
    const types = new Set<MemoryType>();
    memories.forEach(memory => {
      if (isValidMemoryType(memory.type)) {
        types.add(memory.type as MemoryType);
      }
    });
    return Array.from(types).sort();
  }, [memories]);

  // Filter memories based on selected types and search query
  const displayedMemories = useMemo(() => {
    let filtered = memories;

    // Apply type filtering
    if (selectedTypes.length > 0) {
      filtered = filtered.filter(memory => 
        selectedTypes.includes(memory.type as MemoryType)
      );
    }

    // Apply search filtering
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(memory =>
        (memory.content?.toLowerCase().includes(query) ?? false) ||
        memory.type.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [memories, selectedTypes, searchQuery]);

  // Create typeCount map for displaying memory type counts
  const typeCount = useMemo(() => {
    const counts: Record<string, number> = {};
    
    if (memories && Array.isArray(memories)) {
      memories.forEach(memory => {
        // Make sure memory is a valid object before accessing properties
        if (!memory) return;
        
        // Cast to any to avoid TypeScript errors during property access
        const memoryObj = memory as any;
        
        // Get the type with safe property access
        let type = 'unknown';
        
        if (memoryObj.payload?.type && typeof memoryObj.payload.type === 'string') {
          type = memoryObj.payload.type;
        } else if (typeof memoryObj.kind === 'string') {
          type = memoryObj.kind;
        } else if (memoryObj.metadata?.type && typeof memoryObj.metadata.type === 'string') {
          type = memoryObj.metadata.type;
        } else if (memoryObj.payload?.metadata?.category && 
                  typeof memoryObj.payload.metadata.category === 'string') {
          type = memoryObj.payload.metadata.category;
        } else if (typeof memoryObj.type === 'string') {
          type = memoryObj.type;
        }
        
        counts[type] = (counts[type] || 0) + 1;
      });
    }
    
    return counts;
  }, [memories]);

  // Log memory data when it changes
  useEffect(() => {
    console.log('MemoryTab: allMemories updated', {
      count: memories?.length || 0,
      isArray: Array.isArray(memories),
      firstThree: memories && memories.length > 0 ? memories.slice(0, 3).map(m => {
        // Cast to any to safely access properties
        const mem = m as any;
        return {
          id: mem.id,
          type: mem.payload?.type || mem.kind || mem.metadata?.type || 
                mem.payload?.metadata?.category || 'unknown',
          contentPreview: mem.payload?.text ? 
                         mem.payload.text.substring(0, 30) + '...' : 'No content',
          timestamp: mem.payload?.timestamp
        };
      }) : [],
    });
    
    setMemoryCount(memories?.length || 0);
  }, [memories]);

  // Extract all unique tags from memories
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    if (memories && Array.isArray(memories)) {
      memories.forEach(memory => {
        // Cast to any to safely access properties
        const mem = memory as any;
        if (mem && mem.payload?.metadata?.tags && Array.isArray(mem.payload.metadata.tags)) {
          mem.payload.metadata.tags.forEach((tag: string) => {
            if (tag) tagSet.add(tag);
          });
        }
      });
    }
    return Array.from(tagSet).sort();
  }, [memories]);

  // Update the memory initialization useEffect to force a load on mount
  useEffect(() => {
    console.log("Component mounted - loading memories");
    // Explicitly call getMemories to load data on mount regardless of external memories
    getMemories({
      limit: 200 // Increase the limit to load more memories
    });
  }, []); // Empty dependency array to run only on mount

  // Add a new effect to forcefully trigger when the memory count changes
  useEffect(() => {
    if (memories.length > 0) {
      console.log(`Memory hook has ${memories.length} items loaded`);
      // Force the allMemories state to update if it's empty but the hook has memories
      if (memories.length === 0) {
        console.log("Updating allMemories from memory hook");
        // No need to set state - this will use the derived value logic
      }
    }
  }, [memories.length]);

  // Update the filteredMemories logic to handle missing collections more gracefully
  const filteredMemories = useMemo(() => {
    // First, log the status of data sources
    console.log("Computing filtered memories:", {
      searchResultsCount: searchResults?.length || 0,
      allMemoriesCount: memories?.length || 0,
      hasSearchQuery: !!searchQuery,
      selectedTypesCount: selectedTypes.length,
      hasTagFilter: !!selectedTagFilter
    });

    // If we have search results and search query, use the search results
    if (searchResults && searchResults.length > 0 && searchQuery) {
      console.log(`Using ${searchResults.length} search results instead of filtering`);
      return searchResults as any[];
    }
    
    if (!memories || !Array.isArray(memories) || memories.length === 0) {
      console.warn("No memories available for filtering");
      return [];
    }
    
    console.log(`Starting with ${memories.length} total memories`);
    
    // First, filter out memory_edit records - we'll display these as versions of their originals
    // But keep them if explicitly showing memory_edits type
    const memoryEditType = MemoryType.MEMORY_EDIT;
    let filtered = selectedTypes.includes(memoryEditType) || selectedTypes.includes(MemoryType.MEMORY_EDIT)
      ? memories 
      : memories.filter(memory => {
          // Cast to any to safely access properties
          const memoryObj = memory as any;
          return !(
            memoryObj.isMemoryEdit || 
            (memoryObj.metadata && memoryObj.metadata.isMemoryEdit) || 
            (memoryObj.payload && memoryObj.payload.type === memoryEditType)
          );
        });
    
    // Apply text search filter if any
    if (searchQuery && searchResults?.length === 0) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(memory => {
        // Cast to any to safely access properties
        const memoryObj = memory as any;
        return memoryObj.payload && 
               typeof memoryObj.payload.text === 'string' && 
               memoryObj.payload.text.toLowerCase().includes(query);
      });
    }
    
    // Apply tag filter if selected
    if (selectedTagFilter) {
      filtered = filtered.filter(memory => {
        // Cast to any to safely access properties
        const memoryObj = memory as any;
        const tags = memoryObj.payload && 
                    memoryObj.payload.metadata && 
                    Array.isArray(memoryObj.payload.metadata.tags) 
                      ? memoryObj.payload.metadata.tags 
                      : [];
        return tags.includes(selectedTagFilter);
      });
    }
    
    // Update the memory type filter section to be more flexible
    if (selectedTypes.length > 0) {
      filtered = filtered.filter(memory => {
        // Cast to any to safely access properties
        const memoryObj = memory as any;
        
        // Get the type with safe property access
        let type = MemoryType.UNKNOWN;
        
        if (memoryObj.type && typeof memoryObj.type === 'string') {
          // Validate the type is a valid MemoryType
          type = isValidMemoryType(memoryObj.type) ? memoryObj.type : MemoryType.UNKNOWN;
        }
        
        return selectedTypes.includes(type);
      });
    }
    
    // Sort by timestamp (newest first)
    filtered.sort((a, b) => {
      try {
        // Get timestamps safely using type casting to access properties
        const memA = a as any;
        const memB = b as any;
        
        // Extract timestamps from all possible locations
        let timestampA = '';
        let timestampB = '';
        
        // Check all possible timestamp locations for A
        if (memA.payload?.timestamp) {
          timestampA = memA.payload.timestamp;
        } else if (memA.timestamp) {
          timestampA = memA.timestamp;
        } else if (memA.point?.payload?.timestamp) {
          timestampA = memA.point.payload.timestamp;
        } else if (memA.created_at) {
          timestampA = memA.created_at;
        } else if (memA.payload?.created_at) {
          timestampA = memA.payload.created_at;
        }
        
        // Check all possible timestamp locations for B
        if (memB.payload?.timestamp) {
          timestampB = memB.payload.timestamp;
        } else if (memB.timestamp) {
          timestampB = memB.timestamp;
        } else if (memB.point?.payload?.timestamp) {
          timestampB = memB.point.payload.timestamp;
        } else if (memB.created_at) {
          timestampB = memB.created_at;
        } else if (memB.payload?.created_at) {
          timestampB = memB.payload.created_at;
        }
        
        // Process Unix timestamps (numeric timestamps)
        if (timestampA && !isNaN(Number(timestampA))) {
          const timeMs = String(timestampA).length >= 13 ? 
            Number(timestampA) : Number(timestampA) * 1000;
          timestampA = new Date(timeMs).toISOString();
        }
        
        if (timestampB && !isNaN(Number(timestampB))) {
          const timeMs = String(timestampB).length >= 13 ? 
            Number(timestampB) : Number(timestampB) * 1000;
          timestampB = new Date(timeMs).toISOString();
        }
        
        // If both are empty or invalid, don't change order
        if ((!timestampA && !timestampB) || (isNaN(Date.parse(timestampA)) && isNaN(Date.parse(timestampB)))) {
          return 0;
        }
        
        // If only one has a valid timestamp, put it first
        if (isNaN(Date.parse(timestampA))) return 1;
        if (isNaN(Date.parse(timestampB))) return -1;
        
        // Convert to Date objects
        const dateA = new Date(timestampA);
        const dateB = new Date(timestampB);
        
        // Sort newest first (descending order)
        return dateB.getTime() - dateA.getTime();
      } catch (e) {
        console.error("Error sorting by timestamp:", e);
        return 0;
      }
    });
    
    return filtered;
  }, [memories, selectedTypes, selectedTagFilter, searchQuery, searchResults]);

  // Handle type filter changes
  const handleTypeFilterChange = (type: MemoryType) => {
    setSelectedTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  // Handle search query changes
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  // Handle filter visibility toggle
  const toggleFilters = () => {
    setShowFilters(prev => !prev);
  };

  const checkIncorrectReflections = async () => {
    setIsChecking(true);
    setDebugResult(null);
    
    try {
      // Use standardized API endpoint
      const response = await fetch(API_ENDPOINTS.MEMORY_CHECK);
      if (!response.ok) {
        throw new Error(`Failed to run diagnostic: ${response.statusText}`);
      }
      const result = await response.json();
      setDebugResult(result);
    } catch (error) {
      console.error('Error checking reflections:', error);
      setDebugResult({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
        totalMessages: 0,
        suspectedReflectionCount: 0,
        suspectedMessages: []
      });
    } finally {
      setIsChecking(false);
    }
  };

  const clearFilters = () => {
    setSelectedTagFilter('');
    setSelectedTypes([]);
    setSearchQuery('');
    clearSearch();
  };

  const handleRefresh = () => {
    console.log("Forcing memory refresh");
    getMemories({
      limit: 200
    });
  };

  // Function to update tags for a memory
  const handleTagUpdate = useCallback(async (memoryId: string, tags: string[]) => {
    console.log(`Updating tags for memory ${memoryId}:`, tags);
    
    try {
      // Use standardized API endpoint for tag update
      const updateUrl = API_ENDPOINTS.TAG_UPDATE(memoryId);
      console.log(`Making tag update request to: ${updateUrl}`);
      
      const response = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tags }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update tags: ${response.status}`);
      }
      
      console.log(`Successfully updated tags for memory ${memoryId}`);
      
      // Refresh the memories list instead of updating state directly
      handleRefresh();
    } catch (error) {
      console.error('Error updating tags:', error);
    }
  }, [handleRefresh]);

  // Regenerate tags for a memory using OpenAI tag extractor
  const regenerateTagsForMemory = useCallback(async (memoryId: string, content: string): Promise<string[]> => {
    console.log(`Regenerating tags for memory ${memoryId} with content length ${content.length}`);
    
    // Set these fallback tags immediately so they can be returned in case of error
    const fallbackTags = ["memory", "content", "keywords", "recovery"];
    
    try {
      // Extract tags directly client-side without an API call
      // Split content into words, filter to words over 5 chars, exclude common words
      const uniqueWords = Array.from(new Set(
        content.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(word => 
            word.length > 5 && 
            !['about', 'there', 'these', 'their', 'would', 'should', 'could', 'which', 'where'].includes(word)
          )
      )).slice(0, 8);
      
      // Combine with some basic tags
      const generatedTags = Array.from(new Set([...uniqueWords, 'memory', 'content'])).slice(0, 10);
      
      // Update the memory with these tags using the existing API endpoint that works
      const updateUrl = API_ENDPOINTS.TAG_UPDATE(memoryId);
      console.log(`DEBUG: Directly updating tags via ${updateUrl}`);
      
      const response = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tags: generatedTags }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update tags: ${response.status}`);
      }
      
      console.log(`Successfully updated tags for memory ${memoryId}`);
      
      // Update UI by refreshing memories
      handleRefresh();
      
      return generatedTags;
    } catch (error) {
      console.error('Error generating/updating tags:', error);
      
      // Try to update with fallback tags
      try {
        const updateUrl = API_ENDPOINTS.TAG_UPDATE(memoryId);
        await fetch(updateUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tags: fallbackTags }),
        });
        
        // Update UI by refreshing memories
        handleRefresh();
      } catch (updateError) {
        console.error('Failed to update with fallback tags:', updateError);
      }
      
      return fallbackTags;
    }
  }, [handleRefresh]);

  const handleTagRejection = async (memoryId: string) => {
    console.log(`Rejecting suggested tags for memory ${memoryId}`);
    
    try {
      // Use standardized API endpoint for memory tag rejection
      const response = await fetch(API_ENDPOINTS.TAG_REJECT(memoryId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to reject tags: ${response.status} ${response.statusText}`);
        }
      
      // Process successful response
      const result = await response.json();
      console.log('Tags rejection processed successfully', result);
      
      // Refresh the memories list
      handleRefresh();
    } catch (error) {
      console.error('Error rejecting tags:', error);
    }
  };

  const toggleDebug = () => setShowDebug(!showDebug);

  const handleDebugClick = () => {
    // Toggle debug panel
    toggleDebug();
    
    // If turning on debug, check for incorrect reflections
    if (!showDebug) {
      checkIncorrectReflections();
    }
  };

  const checkAllMemoryTypes = async () => {
    console.log('Checking memory collection status...');
    setIsChecking(true);
    
    try {
      // Array of possible endpoints to try
      const possibleEndpoints = [
        API_ENDPOINTS.MEMORY_STATUS.DIAGNOSTICS,
        API_ENDPOINTS.MEMORY_STATUS.MEMORY,
        '/api/memory/diagnostics',
        '/api/memory-status',
        '/api/diagnostics'
      ];
      
      let response = null;
      let result = null;
      let apiSuccess = false;
      
      // Try each endpoint until one works
      for (const endpoint of possibleEndpoints) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);
          response = await fetch(endpoint);
          
          if (response.ok) {
            result = await response.json();
            console.log('Memory status result:', result);
            apiSuccess = true;
            break;
          }
        } catch (err: unknown) {
          console.log(`Failed with endpoint ${endpoint}: ${err instanceof Error ? err.message : String(err)}`);
          // Continue to next endpoint
        }
      }
      
      // If no API endpoint worked, generate stats from loaded memories
      if (!apiSuccess) {
        console.log('All API endpoints failed, using loaded memories for stats');
        
        // Generate stats from currently loaded memories
        const typeCounts: Record<string, number> = {};
        
        // Count by types
        if (memories && Array.isArray(memories)) {
          memories.forEach(memory => {
            if (!memory) return;
            
            // Get the memory type
            let type = PROPERTY_PATHS.MEMORY_TYPES.UNKNOWN;
            const memoryObj = memory as any;
            
            if (memoryObj.payload?.type && typeof memoryObj.payload.type === 'string') {
              type = memoryObj.payload.type;
            } else if (typeof memoryObj.kind === 'string') {
              type = memoryObj.kind;
            } else if (memoryObj.type && typeof memoryObj.type === 'string') {
              type = memoryObj.type;
            }
            
            typeCounts[type] = (typeCounts[type] || 0) + 1;
          });
        }
        
        result = {
          counts: {
            total: memories?.length || 0,
            byType: typeCounts
          },
          collections: ['local-memory-only'],
          vectorSize: 'unknown'
        };
      }
      
      // Process the result (either from API or generated)
      const totalCount = result?.counts?.total || result?.total || 0;
      const typeCounts = result?.counts?.byType || result?.byType || result?.types || {};
      const collections = result?.collections || [];
      const vectorSize = result?.vectorSize || result?.dimensions || 'unknown';
      
      alert(
        `Memory Database Status:\n\n` +
        `Total Memories: ${totalCount}\n` +
        `By Type:\n${Object.entries(typeCounts)
          .map(([type, count]) => `- ${type}: ${count}`)
          .join('\n')}\n\n` +
        (collections.length ? `Collections: ${collections.join(', ')}\n` : '') +
        (vectorSize !== 'unknown' ? `Vector Size: ${vectorSize}` : '') +
        (apiSuccess ? '' : '\n\nNote: API endpoints unavailable - showing stats from loaded memories only.')
      );
    } catch (error) {
      console.error('Error checking memory status:', error);
      alert(`Error checking memory status: ${error instanceof Error ? error.message : String(error)}\n\nPlease check the browser console for more details.`);
    } finally {
      setIsChecking(false);
    }
  };

  const performHybridSearch = async (query: string) => {
    if (!query.trim()) {
      clearSearch();
      return;
    }
    
    // Convert selected types to MemoryType enum values where possible
    const typesForSearch = selectedTypes.map(type => {
      // Check if this string is a valid MemoryType enum value
      if (Object.values(MemoryType).includes(type as any)) {
        return type as MemoryType;
      }
      return null;
    }).filter(Boolean) as MemoryType[];
    
    // Build filter object
    const filter: any = {};
    
    // Add type filter if we have types
    if (typesForSearch.length > 0) {
      filter.types = typesForSearch;
    }
    
    // Add tag filter if we have one
    if (selectedTagFilter) {
      filter.tags = [selectedTagFilter];
    }
    
    // Use the hybridSearch function from the hook
    await hybridSearch({
      query,
      filter,
      limit: 50,
      hybridRatio: 0.7 // 70% vector, 30% keyword
    });
  };

  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performHybridSearch(searchQuery);
  };

  // Update the beginning of the component to log when memories are loaded
  useEffect(() => {
    console.log("Memory state updated:", {
      memoryCount: memories.length,
      allMemoriesCount: memories?.length || 0,
      sampleMemory: memories.length > 0 ? memories[0] : null
    });
  }, [memories]);

  // Add safeStringify as a helper function at the component level, before the extractMemoryText function
  // For safe stringify with circular reference handling
  const safeStringify = (obj: any, indent = 2) => {
    let cache: any[] = [];
    const returnVal = JSON.stringify(
      obj,
      (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (cache.includes(value)) {
            return '[Circular Reference]';
          }
          cache.push(value);
        }
        return value;
      },
      indent
    );
    cache = []; // Empty the array instead of setting to null
    return returnVal;
  };

  // Update the extractMemoryText function to use the shared safeStringify
  const extractMemoryText = (memory: any): string => {
    // For debugging only - log safely
    try {
      console.log(`Memory object structure: ${safeStringify(memory)}`);
    } catch (error) {
      console.error("Error stringifying memory:", error);
    }

    if (!memory) return "No content available";

    try {
      // First check for point.payload.text structure (Qdrant nested structure)
      if (memory.point?.payload?.text && typeof memory.point.payload.text === 'string') {
        console.log("Found direct point.payload.text structure");
        return memory.point.payload.text;
      }
      
      // Try different paths to get the text content
      if (memory.payload?.text && typeof memory.payload.text === 'string') {
        // Check if payload.text is actually a JSON string with nested content
        const payloadText = memory.payload.text;
        if (payloadText.trim().startsWith('{') && 
            (payloadText.includes('"point"') || payloadText.includes('"payload"'))) {
          try {
            const parsed = JSON.parse(payloadText);
            
            // Look in parsed JSON for the actual text
            if (parsed.point?.payload?.text) {
              console.log("Found point.payload.text in parsed JSON");
              return parsed.point.payload.text;
            }
            
            if (parsed.payload?.text) {
              console.log("Found payload.text in parsed JSON");
              return parsed.payload.text;
            }
          } catch (e) {
            console.log("Failed to parse nested JSON:", e);
            // If parsing fails, continue with the original text
          }
        }
        
        // If not JSON or failed to parse, use as is
        return memory.payload.text;
      }
      
      // Special case for 'message' type memories - don't add prefixes since they should be shown directly
      if (memory.payload?.type === PROPERTY_PATHS.MEMORY_TYPES.MESSAGE || 
          memory.kind === PROPERTY_PATHS.MEMORY_TYPES.MESSAGE || 
          memory.type === PROPERTY_PATHS.MEMORY_TYPES.MESSAGE) {
        // For message types, look in different locations
        if (memory.payload?.text) return memory.payload.text;
        if (memory.message) {
          return typeof memory.message === 'string' ? memory.message : safeStringify(memory.message);
        }
        if (memory.payload?.message) {
          return typeof memory.payload.message === 'string' ? memory.payload.message : safeStringify(memory.payload.message);
        }
        if (memory.content && typeof memory.content === 'string') {
          return memory.content;
        }
      }
      
      // Special case for 'thought' type memories
      if (memory.payload?.type === PROPERTY_PATHS.MEMORY_TYPES.THOUGHT || 
          memory.kind === PROPERTY_PATHS.MEMORY_TYPES.THOUGHT || 
          memory.type === PROPERTY_PATHS.MEMORY_TYPES.THOUGHT) {
        if (memory.payload?.text) return memory.payload.text;
        if (memory.thought) {
          return typeof memory.thought === 'string' ? memory.thought : safeStringify(memory.thought);
        }
        if (memory.payload?.thought) {
          return typeof memory.payload.thought === 'string' ? memory.payload.thought : safeStringify(memory.payload.thought);
        }
        if (memory.content && typeof memory.content === 'string') {
          return memory.content;
        }
      }
      
      // Check for document content - special handling
      if (memory.payload?.type === PROPERTY_PATHS.MEMORY_TYPES.DOCUMENT && memory.payload.metadata?.path) {
        return `Document: ${memory.payload.metadata.path}\n${memory.payload.text || ''}`;
      }
      
      // Try all other common locations
      if (memory.content && typeof memory.content === 'string') {
        return memory.content;
      }
      
      if (memory.text && typeof memory.text === 'string') {
        return memory.text;
      }
      
      if (memory.payload?.content && typeof memory.payload.content === 'string') {
        return memory.payload.content;
      }
      
      if (typeof memory.value === 'string') {
        return memory.value;
      }
      
      if (memory.summary && typeof memory.summary === 'string') {
        return memory.summary;
      }
      
      // Check if the entire payload is a string
      if (typeof memory.payload === 'string') {
        return memory.payload;
      }
      
      // Check if any field in the payload could be content
      if (memory.payload && typeof memory.payload === 'object') {
        for (const key in memory.payload) {
          if (
            typeof memory.payload[key] === 'string' && 
            key !== 'id' && 
            key !== 'type' && 
            key !== 'timestamp' &&
            memory.payload[key].length > 10
          ) {
            return `${memory.payload[key]}`;
          }
        }
      }
      
      // Check if any field in the memory could be content
      for (const key in memory) {
        if (
          typeof memory[key] === 'string' && 
          key !== 'id' && 
          key !== 'type' && 
          key !== 'timestamp' &&
          memory[key].length > 10
        ) {
          return `${memory[key]}`;
        }
      }
      
      // For objects that got serialized incorrectly
      if (memory.payload && typeof memory.payload === 'object' && Object.keys(memory.payload).length > 0) {
        // If we have object data but no text field, show the structure
        return safeStringify(memory.payload);
      }
      
      // Last resort - if we have any data at all in the memory, show it
      if (memory && typeof memory === 'object' && Object.keys(memory).length > 0) {
        // Return the entire memory structure as JSON
        return safeStringify(memory);
      }
      
      return "No content available";
    } catch (error) {
      console.error("Error extracting memory text:", error);
      return "Error extracting memory content";
    }
  };

  const toggleDebugInfo = () => {
    setShowDebugInfo(!showDebugInfo);
    console.log("Debug info toggled:", !showDebugInfo);
  };

  // Update memory loading to handle agent scope
  useEffect(() => {
    console.log("Loading memories with agent scope:", {
      selectedAgentId: localSelectedAgentId,
      showAllMemories: localShowAllMemories
    });

    const loadMemories = async () => {
      if (localShowAllMemories) {
        await getMemories({ limit: 200 });
      } else if (localSelectedAgentId) {
        await getAgentMemories(localSelectedAgentId, { limit: 200 });
      }
    };

    loadMemories();
  }, [localSelectedAgentId, localShowAllMemories, getMemories, getAgentMemories]);

  // Handle agent selection change
  const handleAgentChange = (agentId: string) => {
    setLocalSelectedAgentId(agentId);
    if (onAgentChange) {
      onAgentChange(agentId);
    }
  };

  // Handle view mode change
  const handleViewChange = (showAll: boolean) => {
    setLocalShowAllMemories(showAll);
    if (onViewChange) {
      onViewChange(showAll);
    }
  };

  // Render memory type filter
  const renderTypeFilter = () => (
    <div className="flex flex-wrap gap-2 mb-4">
      {availableMemoryTypes.map(type => (
        <button
          key={type}
          onClick={() => handleTypeFilterChange(type)}
          className={`px-3 py-1 rounded-full text-sm ${
            selectedTypes.includes(type)
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {type}
        </button>
      ))}
    </div>
  );

  // Render memory list
  const renderMemoryList = () => {
    if (isLoading) {
      return <div className="text-center py-4">Loading memories...</div>;
    }

    if (error) {
      return <div className="text-center py-4 text-red-500">{error.message}</div>;
    }

    if (displayedMemories.length === 0) {
      return <div className="text-center py-4">No memories found</div>;
    }

    return (
      <div className="space-y-4">
        {displayedMemories.map(memory => (
          <div key={memory.id} className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-400">
                  {memory.type}
                </div>
                <div className="text-sm text-gray-400">
                  {memory.created || memory.timestamp ? 
                    new Date(memory.created || memory.timestamp || '').toLocaleString() : 
                    'No timestamp'}
                </div>
              </div>
              <div className="text-gray-200 whitespace-pre-wrap">
                {memory.content || memory.text || memory.payload?.text || ''}
              </div>
              {memory.payload?.metadata?.context && (
                <div className="mt-2 text-sm text-gray-400">
                  Context: {memory.payload.metadata.context}
                </div>
              )}
              {memory.importance && (
                <div className="mt-1 text-sm text-gray-400">
                  Importance: {memory.importance}
                </div>
              )}
              {memory.source && (
                <div className="mt-1 text-sm text-gray-400">
                  Source: {memory.source}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Agent selection and view controls */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <select
            value={localSelectedAgentId}
            onChange={(e) => {
              setLocalSelectedAgentId(e.target.value);
              onAgentChange?.(e.target.value);
            }}
            className="bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Agents</option>
            {availableAgents.map(agent => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          
          <button
            onClick={() => {
              setLocalShowAllMemories(!localShowAllMemories);
              onViewChange?.(!localShowAllMemories);
            }}
            className={`px-3 py-2 rounded flex items-center gap-2 ${
              localShowAllMemories 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <User className="w-4 h-4" />
            {localShowAllMemories ? 'All Memories' : 'Agent Memories'}
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-800 text-white pl-10 pr-4 py-2 rounded border border-gray-700 focus:outline-none focus:border-blue-500 w-64"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded ${
              showFilters 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Main content area */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left sidebar with stats */}
        {localSelectedAgentId && (
          <div className="w-80 border-r border-gray-700 overflow-y-auto">
            <AgentMemoryStats agentId={localSelectedAgentId} className="m-4" />
          </div>
        )}
        
        {/* Memory list */}
        <div className="flex-1 overflow-y-auto p-4">
          {renderMemoryList()}
        </div>
      </div>
    </div>
  );
};

export default MemoryTab; 