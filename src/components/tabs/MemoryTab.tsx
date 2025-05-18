import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AlertCircleIcon, Filter, X, Tag, Info, RefreshCw, ChevronDown, Loader2, Search, Hash, Settings, Menu, Bug, User } from 'lucide-react';
import MemoryItemComponent from '../memory/MemoryItem';
import { MemoryType as ClientMemoryType, isValidMemoryType } from '../../lib/constants/memory';
import { BaseMemorySchema, MemoryPoint } from '../../server/memory/models';
import { SearchResult } from '../../server/memory/services/search/types';
import useMemory from '../../hooks/useMemory';
import useMemorySearch from '../../hooks/useMemorySearch';
import AgentMemoryStats from '../memory/AgentMemoryStats';
import { BaseMetadata } from '../../types/metadata';
import ReactMarkdown from 'react-markdown';
import { Toaster } from 'react-hot-toast';

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
  availableAgents?: AgentInfo[];
  onAgentChange?: (agentId: string) => void;
  showAllMemories?: boolean;
  onViewChange?: (showAll: boolean) => void;
  // Add the required props from the page.tsx usage
  isLoadingMemories?: boolean;
  allMemories?: any[];
  onRefresh?: () => Promise<void>;
}

// Update the MemoryEntry interface to include all necessary properties
interface MemoryEntry {
  id: string;
  type: ClientMemoryType;
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
  onViewChange,
  isLoadingMemories,
  allMemories,
  onRefresh
}) => {
  const [localSelectedAgentId, setLocalSelectedAgentId] = useState(selectedAgentId);
  const [localShowAllMemories, setLocalShowAllMemories] = useState(showAllMemories);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isLoadingInternal, setIsLoadingInternal] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  
  const { getAgentMemories } = useMemory();
  
  useEffect(() => {
    const loadMemories = async () => {
      if (!localSelectedAgentId && !localShowAllMemories) return;
      
      setIsLoadingInternal(true);
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
        setIsLoadingInternal(false);
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
  const [selectedTypes, setSelectedTypes] = useState<ClientMemoryType[]>([]);
  const [typeMenuOpen, setTypeMenuOpen] = useState<boolean>(false);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [showRawMemory, setShowRawMemory] = useState<string | null>(null);
  const [showDebugInfo, setShowDebugInfo] = useState<boolean>(false);

  // Combine loading states from props and internal state
  const combinedIsLoading = isLoadingMemoryHook || isLoadingInternal || isLoadingMemories || false;

  // All possible memory types as strings - use the enum values
  const MEMORY_TYPES: string[] = useMemo(() => {
    // Use the MemoryType enum values
    return Object.values(ClientMemoryType).sort();
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
    const types = new Set<ClientMemoryType>();
    memories.forEach(memory => {
      if (isValidMemoryType(memory.type)) {
        types.add(memory.type as ClientMemoryType);
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
        selectedTypes.includes(memory.type as ClientMemoryType)
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
    const memoryEditType = ClientMemoryType.MEMORY_EDIT;
    let filtered = selectedTypes.includes(memoryEditType) || selectedTypes.includes(ClientMemoryType.MEMORY_EDIT)
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
        let type = ClientMemoryType.UNKNOWN;
        
        if (memoryObj.type && typeof memoryObj.type === 'string') {
          // Validate the type is a valid MemoryType
          type = isValidMemoryType(memoryObj.type) ? memoryObj.type : ClientMemoryType.UNKNOWN;
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
  const handleTypeFilterChange = (type: ClientMemoryType) => {
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
      
      return true;
    } catch (error) {
      console.error('Error updating tags:', error);
      return false;
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
      await handleTagUpdate(memoryId, generatedTags);
      
      return generatedTags;
    } catch (error) {
      console.error('Error generating/updating tags:', error);
      
      // Try to update with fallback tags
      try {
        await handleTagUpdate(memoryId, fallbackTags);
      } catch (updateError) {
        console.error('Failed to update with fallback tags:', updateError);
      }
      
      return fallbackTags;
    }
  }, [handleTagUpdate]);

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
      if (Object.values(ClientMemoryType).includes(type as any)) {
        return type as ClientMemoryType;
      }
      return null;
    }).filter(Boolean) as ClientMemoryType[];
    
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

  // Extract memory content from different possible locations in the memory object
  const extractMemoryText = (memory: any): string => {
    if (!memory) return "No content available";

    try {
      // Log the memory for debugging
      console.log("Extracting content from memory:", memory);
      
      // Handle empty THOUGHT types specially (as seen in the screenshot)
      if (memory.type === "THOUGHT" || memory.type === "thought") {
        // Try to extract content from the JSON structure itself
        if (memory.payload && typeof memory.payload === 'object') {
          if (memory.payload.text && memory.payload.text.trim()) {
            return memory.payload.text;
          }
          
          // If text is empty but we have a timestamp and type, this is a new thought
          if (memory.payload.timestamp && memory.payload.type === "THOUGHT") {
            return "New thought - waiting for content";
          }
        }
      }
      
      // Try different structured locations for the content
      
      // For thoughts and reflections
      if (memory.thought) {
        return typeof memory.thought === 'string' ? memory.thought : JSON.stringify(memory.thought);
      }
      
      // For payload.thought structure
      if (memory.payload?.thought) {
        return typeof memory.payload.thought === 'string' ? memory.payload.thought : JSON.stringify(memory.payload.thought);
      }
      
      // Direct text field in payload (most common)
      if (memory.payload?.text && typeof memory.payload.text === 'string' && memory.payload.text.trim()) {
        return memory.payload.text;
      }
      
      // Direct content field in payload
      if (memory.payload?.content && typeof memory.payload.content === 'string' && memory.payload.content.trim()) {
        return memory.payload.content;
      }
      
      // Direct text or content fields at root level
      if (memory.text && typeof memory.text === 'string' && memory.text.trim()) {
        return memory.text;
      }
      
      if (memory.content && typeof memory.content === 'string' && memory.content.trim()) {
        return memory.content;
      }
      
      // Special handling for message objects
      if (memory.message) {
        return typeof memory.message === 'string' ? memory.message : JSON.stringify(memory.message);
      }
      
      // Check if payload itself is the content
      if (typeof memory.payload === 'string' && memory.payload.trim()) {
        return memory.payload;
      }
      
      // If all else fails, and we have a payload object, stringify it
      if (memory.payload && typeof memory.payload === 'object' && Object.keys(memory.payload).length > 0) {
        // If payload has text, extract it more cleanly
        if (memory.payload.text) {
          return memory.payload.text;
        }
        
        // Try to get a readable representation
        return JSON.stringify(memory.payload, null, 2);
      }
      
      // Last resort: stringify the entire memory
      if (typeof memory === 'object' && Object.keys(memory).length > 0) {
        return JSON.stringify(memory, null, 2);
      }
      
      return "No content available";
    } catch (error) {
      console.error("Error extracting memory content:", error);
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
      showAllMemories: localShowAllMemories,
      memoryCount: allMemories?.length || 0,
      hasLoadedMemories: !!allMemories?.length
    });

    // If we already have memories from props, use those
    if (allMemories && allMemories.length > 0) {
      console.log(`Using ${allMemories.length} memories from props`);
      console.log("Sample memory:", allMemories[0]);
      setMemories(allMemories);
      return;
    }

    const loadMemories = async () => {
      console.log("Explicitly loading memories from API");
      
      // Fetch memories without type filtering to get all types
      try {
        let memoriesToUse = [];
        
        if (localShowAllMemories) {
          const result = await getMemories({ limit: 100 });
          console.log("Fetched all memories:", result?.length || 0);
          memoriesToUse = result || [];
        } else if (localSelectedAgentId) {
          const result = await getAgentMemories(localSelectedAgentId, { limit: 100 });
          console.log("Fetched agent memories:", result?.length || 0);
          memoriesToUse = result || [];
        }
        
        // Try to fetch specific types if needed
        if (memoriesToUse.length === 0) {
          console.log("No memories found, trying direct API calls");
          
          // Construct query parameters
          const params = new URLSearchParams();
          params.append("limit", "50");
          if (localSelectedAgentId) {
            params.append("agentId", localSelectedAgentId);
          }
          
          try {
            // Direct API call to get memories
            const response = await fetch(`/api/memory?${params.toString()}`);
            const data = await response.json();
            
            if (data && Array.isArray(data.memories) && data.memories.length > 0) {
              console.log(`Direct API call returned ${data.memories.length} memories`);
              console.log("Sample memory from API:", data.memories[0]);
              memoriesToUse = data.memories;
            }
          } catch (err) {
            console.error("Error in direct API call:", err);
          }
        }
        
        if (memoriesToUse.length > 0) {
          setMemories(memoriesToUse);
        }
      } catch (error) {
        console.error("Error loading memories:", error);
        setError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        setIsLoadingInternal(false);
      }
    };

    loadMemories();
  }, [localSelectedAgentId, localShowAllMemories, getMemories, getAgentMemories, allMemories]);

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

  // Render memory list using the MemoryItem component
  const renderMemoryList = () => {
    if (combinedIsLoading) {
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
        {displayedMemories.map((memory, index) => (
          <MemoryItemComponent
            key={memory.id || `memory-${index}`}
            memory={{
              id: memory.id,
              payload: {
                text: extractMemoryText(memory),
                timestamp: memory.timestamp || memory.created || new Date().toISOString(),
                type: memory.type,
                metadata: {
                  ...(memory.metadata || {}),
                  ...(memory.payload?.metadata || {}),
                  tags: memory.payload?.metadata?.tags || memory.metadata?.tags || [],
                  schemaVersion: '1.0.0'
                }
              }
            }}
            onTagUpdate={handleTagUpdate}
            onTagSuggestionRemove={handleTagRejection}
            regenerateTagsForMemory={regenerateTagsForMemory}
          />
        ))}
      </div>
    );
  };

  // Add a specific effect to load on component mount
  useEffect(() => {
    console.log("Memory tab mounted, initializing memory loading");
    
    // Force memory loading on component mount
    setIsLoadingInternal(true);
    
    // If we already have memories from props, use those
    if (allMemories && allMemories.length > 0) {
      console.log("Using memories from props on mount");
      setMemories(allMemories);
      setIsLoadingInternal(false);
    } else {
      console.log("Fetching memories directly on mount");
      // Fetch memories directly
      const fetchMemoriesOnMount = async () => {
        try {
          // Try direct API call based on agent context
          const endpoint = selectedAgentId 
            ? `/api/memory?agentId=${selectedAgentId}&limit=50`
            : `/api/memory?limit=50`;
            
          const response = await fetch(endpoint);
          const data = await response.json();
          
          if (data && Array.isArray(data.memories) && data.memories.length > 0) {
            console.log(`API returned ${data.memories.length} memories on mount`);
            setMemories(data.memories);
          } else {
            console.log("No memories found via direct API call");
          }
        } catch (error) {
          console.error("Error loading memories on mount:", error);
          setError(error instanceof Error ? error : new Error(String(error)));
        } finally {
          setIsLoadingInternal(false);
        }
      };
      
      fetchMemoriesOnMount();
    }
  }, [selectedAgentId, allMemories, setMemories, setIsLoadingInternal, setError]); // Add proper dependencies

  // Add a utility function to get colors for different memory types
  const getTypeColor = (type: string) => {
    // Normalize the type to lowercase for consistent matching
    const normalizedType = type.toLowerCase();
    
    // Define color schemes for different memory types
    if (normalizedType.includes('document')) {
      return { bg: '#134e4a', text: '#5eead4' }; // Teal
    } else if (normalizedType.includes('thought')) {
      return { bg: '#1e3a8a', text: '#93c5fd' }; // Blue
    } else if (normalizedType.includes('message')) {
      return { bg: '#365314', text: '#bef264' }; // Green
    } else if (normalizedType.includes('task')) {
      return { bg: '#713f12', text: '#fcd34d' }; // Yellow
    } else if (normalizedType.includes('reflection')) {
      return { bg: '#581c87', text: '#d8b4fe' }; // Purple
    } else if (normalizedType.includes('edit')) {
      return { bg: '#881337', text: '#fda4af' }; // Red
    } else if (normalizedType.includes('fact') || normalizedType.includes('knowledge')) {
      return { bg: '#1e40af', text: '#93c5fd' }; // Blue
    } else if (normalizedType.includes('summary')) {
      return { bg: '#3f3f46', text: '#d4d4d8' }; // Gray
    }
    
    // Default color scheme
    return { bg: '#1f2937', text: '#9ca3af' };
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <Toaster position="bottom-right" />
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
            {availableAgents.map((agent, index) => (
              <option key={agent.id || `agent-${index}`} value={agent.id}>
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
      
      {/* Stats component - compact horizontal layout */}
      {localSelectedAgentId && (
        <div className="p-3 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center justify-between">
            {/* Total Memories */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-400">Total:</span>
              <span className="text-lg font-bold">{memoryCount}</span>
            </div>
            
            {/* Memory Types */}
            <div className="flex items-center space-x-4">
              {Object.entries(typeCount)
                .filter(([type]) => type !== 'unknown')
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center space-x-1">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" 
                      style={{
                        backgroundColor: type ? getTypeColor(type).bg : '#1e293b',
                        color: type ? getTypeColor(type).text : '#94a3b8'
                      }}>
                      {type}
                    </span>
                    <span className="text-sm font-semibold">{count}</span>
                  </div>
                ))
              }
              {Object.keys(typeCount).length > 3 && (
                <span className="text-xs text-gray-400">+{Object.keys(typeCount).length - 3} more</span>
              )}
            </div>
            
            {/* Recent Activity */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-400">Last Hour:</span>
                <span className="text-sm font-medium">0</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-400">Last 24h:</span>
                <span className="text-sm font-medium">0</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-400">Last Week:</span>
                <span className="text-sm font-medium">0</span>
              </div>
            </div>
            
            {/* Refresh button */}
            <button 
              onClick={handleRefresh} 
              className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
              title="Refresh memories"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      
      {/* Filters section */}
      {showFilters && (
        <div className="p-4 border-b border-gray-700 bg-gray-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium">Filters</h3>
            <button
              onClick={clearFilters}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Clear all filters
            </button>
          </div>
          
          {/* Type filters */}
          <div className="mb-4">
            <h4 className="text-xs font-medium mb-2">Memory Types</h4>
            <div className="flex flex-wrap gap-2">
              {MEMORY_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => handleTypeFilterChange(type as ClientMemoryType)}
                  className={`px-3 py-1 rounded-full text-xs ${
                    selectedTypes.includes(type as ClientMemoryType)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          
          {/* Tag filters */}
          {allTags.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-medium mb-2">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTagFilter(tag === selectedTagFilter ? '' : tag)}
                    className={`px-3 py-1 rounded-full text-xs ${
                      tag === selectedTagFilter
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Memory list */}
      <div className="flex-1 overflow-y-auto p-4">
        {renderMemoryList()}
      </div>
    </div>
  );
};

export default MemoryTab; 