import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AlertCircleIcon, Filter, X, Tag, Info, RefreshCw, ChevronDown, Loader2, Search, Hash, Settings, Menu, Bug } from 'lucide-react';
import MemoryItemComponent from '../memory/MemoryItem';
import { MemoryType } from '../../server/memory/config';
import { BaseMemorySchema, MemoryPoint } from '../../server/memory/models';
import { SearchResult } from '../../server/memory/services/search/types';
import useMemory from '../../hooks/useMemory';
import useMemorySearch from '../../hooks/useMemorySearch';

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

// Legacy memory types to include in dropdowns
const LEGACY_MEMORY_TYPES = [
  "reflection",
  "fact",
  "insight",
  "system_learning",
  "decision",
  "feedback",
  "knowledge",
  "unknown",
  "chat",
  "idea",
  "summary"
];

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

// Interface for MemoryTab component props
interface MemoryTabProps {
  isLoadingMemories?: boolean;
  allMemories?: ExtendedMemoryItem[];
  onRefresh?: () => void;
}

const MemoryTab: React.FC<MemoryTabProps> = ({
  isLoadingMemories: externalLoading,
  allMemories: externalMemories,
  onRefresh: externalRefresh
}) => {
  // Use standardized memory hooks
  const { memories, isLoading: isLoadingMemoryHook, error, totalCount, getMemories } = useMemory();
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [memoryCount, setMemoryCount] = useState<number>(0);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [typeMenuOpen, setTypeMenuOpen] = useState<boolean>(false);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [showRawMemory, setShowRawMemory] = useState<string | null>(null);
  const [showDebugInfo, setShowDebugInfo] = useState<boolean>(false);

  // Derive loading and memory states, preferring hook values but falling back to props
  const isLoadingMemories = isLoadingMemoryHook || externalLoading || false;
  const allMemories = useMemo(() => {
    // Always prefer memory hook data if available
    if (memories && memories.length > 0) {
      console.log(`Using ${memories.length} memories from hook`);
      return memories;
    }
    
    // Fall back to external memories if provided
    if (externalMemories && externalMemories.length > 0) {
      console.log(`Using ${externalMemories.length} external memories`);
      return externalMemories;
    }
    
    console.log('No memories available from any source');
    return [];
  }, [memories, externalMemories]);

  // All possible memory types as strings - use the enum values
  const MEMORY_TYPES: string[] = useMemo(() => {
    // Use a Set to eliminate duplicates
    const typeSet = new Set<string>([
      ...Object.values(MemoryType),
      // Add legacy or additional types that might still be in the system
      ...LEGACY_MEMORY_TYPES
    ]);
    
    // Convert to array and sort
    return Array.from(typeSet).sort();
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
    if (!externalMemories) {
      handleRefresh();
    }
  }, []);

  // All possible memory types
  const memoryTypes = useMemo(() => {
    const typeSet = new Set<string>();
    if (allMemories && Array.isArray(allMemories)) {
      allMemories.forEach(memory => {
        if (!memory) return;
        
        // Cast to any to avoid TypeScript errors during property access
        const memoryObj = memory as any;
        
        // Check each property safely using our constants
        if (memoryObj.payload?.type && typeof memoryObj.payload.type === 'string') {
          typeSet.add(memoryObj.payload.type);
        }
        
        if (typeof memoryObj.kind === 'string') {
          typeSet.add(memoryObj.kind);
        }
        
        if (memoryObj.metadata?.type && typeof memoryObj.metadata.type === 'string') {
          typeSet.add(memoryObj.metadata.type);
        }
        
        if (memoryObj.payload?.metadata?.category && 
            typeof memoryObj.payload.metadata.category === 'string') {
          typeSet.add(memoryObj.payload.metadata.category);
        }
        
        if (typeof memoryObj.type === 'string') {
          typeSet.add(memoryObj.type);
        }
      });
    }
    return Array.from(typeSet).sort();
  }, [allMemories]);

  // Create typeCount map for displaying memory type counts
  const typeCount = useMemo(() => {
    const counts: Record<string, number> = {};
    
    if (allMemories && Array.isArray(allMemories)) {
      allMemories.forEach(memory => {
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
  }, [allMemories]);

  // Log memory data when it changes
  useEffect(() => {
    console.log('MemoryTab: allMemories updated', {
      count: allMemories?.length || 0,
      isArray: Array.isArray(allMemories),
      firstThree: allMemories && allMemories.length > 0 ? allMemories.slice(0, 3).map(m => {
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
    
    setMemoryCount(allMemories?.length || 0);
  }, [allMemories]);

  // Extract all unique tags from memories
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    if (allMemories && Array.isArray(allMemories)) {
      allMemories.forEach(memory => {
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
  }, [allMemories]);

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
      if (allMemories.length === 0) {
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
      allMemoriesCount: allMemories?.length || 0,
      hasSearchQuery: !!searchQuery,
      selectedTypesCount: selectedTypes.length,
      hasTagFilter: !!selectedTagFilter
    });

    // If we have search results and search query, use the search results
    if (searchResults && searchResults.length > 0 && searchQuery) {
      console.log(`Using ${searchResults.length} search results instead of filtering`);
      return searchResults as any[];
    }
    
    if (!allMemories || !Array.isArray(allMemories) || allMemories.length === 0) {
      console.warn("No memories available for filtering");
      return [];
    }
    
    console.log(`Starting with ${allMemories.length} total memories`);
    
    // First, filter out memory_edit records - we'll display these as versions of their originals
    // But keep them if explicitly showing memory_edits type
    const memoryEditType = MemoryType.MEMORY_EDIT as string;
    let filtered = selectedTypes.includes(memoryEditType) || selectedTypes.includes('memory_edit')
      ? allMemories 
      : allMemories.filter(memory => {
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
        
        // Check for type in all possible locations
        let types: string[] = [];
        
        // Standard payload.type
        if (memoryObj.payload?.type && typeof memoryObj.payload.type === 'string') {
          types.push(memoryObj.payload.type);
        }
        
        // Legacy kind property
        if (typeof memoryObj.kind === 'string') {
          types.push(memoryObj.kind);
        }
        
        // Metadata type
        if (memoryObj.metadata?.type && typeof memoryObj.metadata.type === 'string') {
          types.push(memoryObj.metadata.type);
        }
        
        // Category in metadata
        if (memoryObj.payload?.metadata?.category && 
            typeof memoryObj.payload.metadata.category === 'string') {
          types.push(memoryObj.payload.metadata.category);
        }
        
        // Root level type property
        if (typeof memoryObj.type === 'string') {
          types.push(memoryObj.type);
        }
        
        // If no type found, default to unknown
        if (types.length === 0) {
          types.push(PROPERTY_PATHS.MEMORY_TYPES.UNKNOWN);
        }
        
        // Check if any of the memory's types match any selected type
        return selectedTypes.some(selectedType => types.includes(selectedType));
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
  }, [allMemories, selectedTypes, selectedTagFilter, searchQuery, searchResults]);

  const toggleTypeSelection = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
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
    if (externalRefresh) {
      externalRefresh();
    }
    
    // Always call getMemories with a larger limit to make sure we get data
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
        if (allMemories && Array.isArray(allMemories)) {
          allMemories.forEach(memory => {
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
            total: allMemories?.length || 0,
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

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setSearchQuery(newQuery);
    
    // Clear search results if the query is empty
    if (!newQuery.trim()) {
      clearSearch();
    }
  };

  // Update the beginning of the component to log when memories are loaded
  useEffect(() => {
    console.log("Memory state updated:", {
      memoryCount: memories.length,
      externalCount: externalMemories?.length || 0,
      allMemoriesCount: allMemories?.length || 0,
      sampleMemory: memories.length > 0 ? memories[0] : null
    });
  }, [memories, externalMemories, allMemories]);

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

  return (
    <div className="bg-gray-800 text-white p-4 space-y-4">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          Memory System
          <span className="text-sm font-normal text-gray-400">
            ({memoryCount} items)
          </span>
        </h2>
        
        <div className="flex gap-2">
          <button 
            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white"
            onClick={handleRefresh}
            disabled={isLoadingMemories}
          >
            {isLoadingMemories ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Refresh
          </button>
          
          <button
            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white"
            onClick={handleDebugClick}
          >
            <Bug size={14} />
            Debug
          </button>
          
          <button 
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${showDebugInfo ? 'bg-yellow-600' : 'bg-gray-700'} hover:bg-gray-600 text-white`}
            onClick={toggleDebugInfo}
          >
            <Info size={14} />
            Raw Data
          </button>
          
          <button 
            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white"
            onClick={checkAllMemoryTypes}
            disabled={isChecking}
          >
            {isChecking ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Settings size={14} />
            )}
            Status
          </button>
        </div>
      </div>
      
      {/* Search and filters */}
      <div className="space-y-4">
        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-grow">
              <input
                type="text"
                value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search memories..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md pl-9"
              />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <Search size={16} />
            </div>
            </div>
            
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
            disabled={isSearching}
          >
            {isSearching ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
          </button>
        </form>
        
        {/* Filters section */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <div className="flex items-center gap-1 text-gray-400">
            <Filter size={14} />
            <span className="text-sm">Filters:</span>
            </div>
            
          {/* Type filter */}
          <div className="relative" ref={typeMenuRef}>
              <button
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white"
                onClick={() => setTypeMenuOpen(!typeMenuOpen)}
            >
              Type ({selectedTypes.length || 'All'})
              <ChevronDown size={14} />
              </button>
              
              {typeMenuOpen && (
              <div className="absolute z-10 mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg p-2 max-h-60 overflow-y-auto w-64">
                <div className="space-y-1">
                    {MEMORY_TYPES.map((type, index) => (
                      <div 
                        key={`filter-${type}-${index}`} 
                        className="flex items-center gap-2 px-2 py-1 hover:bg-gray-700 rounded cursor-pointer"
                        onClick={() => toggleTypeSelection(type)}
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedTypes.includes(type)} 
                          onChange={() => {}} 
                          className="h-4 w-4"
                        />
                      <span className="text-sm text-white">{type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          
          {/* Tag filter */}
          {allTags.length > 0 && (
            <div className="relative">
              <select
                value={selectedTagFilter}
                onChange={(e) => setSelectedTagFilter(e.target.value)}
                className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white cursor-pointer"
              >
                <option value="">Tag (All)</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
          )}
            
            {/* Clear filters button */}
          {(selectedTypes.length > 0 || selectedTagFilter || searchQuery) && (
              <button 
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-800 hover:bg-red-700 text-white"
                onClick={clearFilters}
              >
              <X size={14} />
              Clear Filters
              </button>
            )}
        </div>
        
        {/* Memory type counts - update styling */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(typeCount).map(([type, count], index) => (
            <div 
              key={`${type}-${index}`} 
              className={`px-2 py-1 text-xs rounded-md flex items-center gap-1 cursor-pointer ${
                selectedTypes.includes(type) 
                  ? 'bg-blue-800 border border-blue-700' 
                  : 'bg-gray-700 border border-gray-600'
              }`}
              onClick={() => toggleTypeSelection(type)}
            >
              <Hash size={12} />
              <span>{type}</span>
              <span className="font-semibold">({count})</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Debug panel */}
      {showDebug && (
        <div className="bg-gray-700 border border-gray-600 rounded-md p-4 my-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium flex items-center gap-2 text-white">
              <AlertCircleIcon size={16} className="text-yellow-500" />
              Debug Tools
            </h3>
            <button
              className="text-gray-400 hover:text-gray-200"
              onClick={toggleDebug}
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="space-y-2">
            <button
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-2"
              onClick={checkIncorrectReflections}
              disabled={isChecking}
            >
              {isChecking ? <Loader2 size={14} className="animate-spin" /> : 'Check Memories'}
            </button>
            
            {debugResult && (
              <div className="mt-2 space-y-2 text-gray-300">
                <div className="text-sm">
                  <strong>Status:</strong> {debugResult.status}
                </div>
                <div className="text-sm">
                  <strong>Message:</strong> {debugResult.message}
                </div>
                <div className="text-sm">
                  <strong>Total Messages:</strong> {debugResult.totalMessages}
                </div>
                <div className="text-sm">
                  <strong>Suspected Issues:</strong> {debugResult.suspectedReflectionCount}
                </div>
          
          {debugResult.suspectedMessages && debugResult.suspectedMessages.length > 0 && (
            <div className="mt-2">
                    <h4 className="font-medium text-sm mb-1 text-white">Suspicious Messages:</h4>
                    <ul className="space-y-2">
                      {debugResult.suspectedMessages.map((msg) => (
                        <li key={msg.id} className="bg-gray-800 p-2 rounded border border-gray-600 text-sm">
                          <div><strong>ID:</strong> {msg.id}</div>
                          <div><strong>Date:</strong> {new Date(msg.timestamp).toLocaleString()}</div>
                          <div className="mt-1 text-xs bg-gray-900 p-1 rounded whitespace-pre-wrap">{msg.text}</div>
                  </li>
                ))}
                    </ul>
                  </div>
                )}
                
                {debugResult.error && (
                  <div className="text-red-400 text-sm">
                    <strong>Error:</strong> {debugResult.error}
                  </div>
                )}
            </div>
          )}
          </div>
        </div>
      )}
      
      {/* Loading indicator */}
      {isLoadingMemories && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      )}
      
      {/* Memories list */}
      {!isLoadingMemories && filteredMemories.length === 0 && (
        <div className="text-center py-10 bg-gray-700 rounded-lg border border-gray-600 my-4">
          <div className="mb-4 text-gray-300">
            {allMemories.length === 0 ? (
              <>
                <div className="text-xl mb-2">No memories could be loaded</div>
                <div className="text-sm text-gray-400 mb-4">
                  This may be due to missing collections or a connection issue
                </div>
              </>
            ) : (
              <>
                <div className="text-xl mb-2">No memories match your filters</div>
                <div className="text-sm text-gray-400">
                  Try adjusting your search terms or filters
                </div>
              </>
            )}
          </div>
          
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 mx-auto"
            onClick={handleRefresh}
          >
            <RefreshCw size={16} />
            Retry Loading Memories
          </button>
          
          {(selectedTypes.length > 0 || selectedTagFilter || searchQuery) && (
            <button 
              className="px-4 py-2 mt-3 bg-gray-600 text-white rounded-md hover:bg-gray-500 flex items-center gap-2 mx-auto"
              onClick={clearFilters}
            >
              <X size={16} />
              Clear All Filters
            </button>
          )}
        </div>
      )}
      
        <div className="space-y-4">
        {Array.isArray(filteredMemories) ? filteredMemories.map((memory, index) => {
          // Skip null or invalid memories
          if (!memory) {
            console.warn(`Skipping null memory at index ${index}`);
            return null;
          }
          
          try {
            // Generate a stable key - use the memory ID if available
            const key = memory.id || `memory-${index}-${Math.random().toString(36).substring(7)}`;
            
            // For better debugging - log the complete memory object for the first item
            if (index === 0) {
              console.log("Full memory object structure:", memory);
            }
            
            // Update the text content extraction
            let textContent = extractMemoryText(memory);
            
            // Determine type from various possible locations
            let typeInfo = "unknown";
            if (memory.payload?.type && typeof memory.payload.type === 'string') {
              typeInfo = memory.payload.type;
            } else if (typeof memory.kind === 'string') {
              typeInfo = memory.kind;
            } else if (memory.metadata?.type && typeof memory.metadata.type === 'string') {
              typeInfo = memory.metadata.type;
            } else if (memory.type && typeof memory.type === 'string') {
              typeInfo = memory.type;
            } else if (memory.payload?.metadata?.category && typeof memory.payload.metadata.category === 'string') {
              typeInfo = memory.payload.metadata.category;
            }
            
            // Create timestamp from various possible locations
            let timestamp = '';
            if (memory.payload?.timestamp) {
              timestamp = memory.payload.timestamp;
            } else if (memory.timestamp) {
              timestamp = memory.timestamp;
            } else if (memory.created_at) {
              timestamp = memory.created_at;
            } else if (memory.payload?.created_at) {
              timestamp = memory.payload.created_at;
            } else if (memory.point?.payload?.timestamp) {
              // Qdrant specific path
              timestamp = memory.point.payload.timestamp;
            }
            
            // Handle numerical timestamps (Unix timestamps)
            if (timestamp && !isNaN(Number(timestamp))) {
              // If it's a 13-digit timestamp (milliseconds), use as is
              // If it's a 10-digit timestamp (seconds), multiply by 1000 to get ms
              const timeMs = String(timestamp).length >= 13 ? 
                Number(timestamp) : Number(timestamp) * 1000;
              timestamp = new Date(timeMs).toISOString();
            }
            
            // Build metadata object from various possible locations
            let metadata = {};
            if (memory.payload?.metadata && typeof memory.payload.metadata === 'object') {
              metadata = memory.payload.metadata;
            } else if (memory.metadata && typeof memory.metadata === 'object') {
              metadata = memory.metadata;
            }
            
            // Make sure we have a minimal valid structure for MemoryItem with richer content detection
            const enhancedMemory = {
              ...memory,
              id: memory.id || memory.point?.id || `generated-id-${index}`,
              // Ensure vector exists
              vector: memory.vector || [],
              // Build a rich payload with all possible content sources
              payload: {
                // Start with existing payload if any
                ...(memory.payload || {}),
                // If this is a Qdrant point object, include its payload data
                ...(memory.point?.payload ? memory.point.payload : {}),
                // Ensure text exists with the extracted content - provide the DIRECT text content
                text: (() => {
                  // Check if this is point.payload.text structure
                  const memAny = memory as any;
                  if (memAny.point?.payload?.text) {
                    return memAny.point.payload.text;
                  }
                  
                  // Otherwise try to use the existing textContent or textContent extraction
                  return textContent;
                })(),
                // Ensure type exists
                type: typeInfo,
                // NEVER override timestamp if it already exists in payload
                timestamp: memory.payload?.timestamp || 
                          memory.point?.payload?.timestamp || 
                          timestamp || '',
                // Ensure metadata exists
                metadata: {
                  ...(metadata || {}),
                  ...(memory.point?.payload?.metadata || {})
                }
              }
            };
            
            // Better debug info with full structure
            if (index < 2) { // Only log first two items to avoid console spam
              const originalTimestamp = memory.payload?.timestamp || (memory as any).timestamp || '';
              console.log(`Memory[${index}]:`, {
                id: enhancedMemory.id, 
                type: enhancedMemory.payload.type,
                hasText: !!enhancedMemory.payload.text,
                textPreview: enhancedMemory.payload.text?.substring(0, 30) + (enhancedMemory.payload.text?.length > 30 ? '...' : ''),
                originalTimestamp,
                enhancedTimestamp: enhancedMemory.payload.timestamp,
                didTimestampChange: originalTimestamp !== enhancedMemory.payload.timestamp
              });
            }
            
            // Include debug info if enabled
            if (showDebugInfo) {
              return (
                <div key={key} className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4 font-mono text-xs">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-bold text-blue-400">
                      Memory Debug - ID: {memory.id || 'unknown'} - Type: {typeInfo}
                    </div>
                    <div className="text-gray-500">Index: {index}</div>
                  </div>
                  <pre className="whitespace-pre-wrap overflow-auto max-h-96 bg-gray-950 p-4 rounded border border-gray-800">
                    {(() => {
                      try {
                        return safeStringify(memory);
                      } catch (error) {
                        return `Error stringifying memory: ${error}`;
                      }
                    })()}
                  </pre>
                </div>
              );
            }
            
            return (
              <MemoryItemComponent
                key={key}
                memory={enhancedMemory}
                onTagUpdate={handleTagUpdate}
                onTagSuggestionRemove={handleTagRejection}
                regenerateTagsForMemory={regenerateTagsForMemory}
              />
            );
          } catch (error) {
            console.error(`Error rendering memory at index ${index}:`, error, memory);
            return null;
          }
        }) : (
          <div className="text-center py-10 text-gray-400">
            No valid memory array found
          </div>
        )}
        </div>
    </div>
  );
};

export default MemoryTab; 