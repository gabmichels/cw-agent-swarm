# Memory Tab Integration Plan

This document provides a detailed plan for updating the Memory Tab components to use the new standardized memory system.

## Overview

The Memory Tab is the primary interface for users to browse, search, and interact with their memories. We're updating these components to use the new memory service, which will provide improved search capabilities, standardized data structure, and better performance.

## Components to Update

### 1. MemoryTab.tsx

This is the main container component for the memory tab.

#### Changes Needed:

1. **API Integration**
   - Replace direct `/api/memory/all` fetch calls with memory service calls
   - Update the search functionality to use the new hybrid search capabilities
   - Implement standardized filtering based on memory types

2. **UI Enhancements**
   - Add UI controls for hybrid search options (vector similarity vs. keyword matching)
   - Implement filter controls for standardized memory types
   - Add visualization options for memory relationships

3. **Type Updates**
   - Update component props and state types to match standardized memory schemas
   - Implement type adapters between UI types and memory system types

### 2. MemoryItem.tsx

This component displays individual memory items.

#### Changes Needed:

1. **Data Structure Adaptation**
   - Update to use standardized memory structure
   - Implement proper handling of all memory types
   - Add support for metadata display

2. **Version History**
   - Add version history viewing functionality
   - Implement version comparison
   - Add version restoration capabilities

3. **Relationship Visualization**
   - Add relationship indicators
   - Implement relationship navigation
   - Add support for relationship creation/editing

4. **Importance Visualization**
   - Add importance level indicators
   - Implement importance level editing
   - Add importance filtering

### 3. MemoryTable.tsx

This component displays a table of memory items with sorting and filtering.

#### Changes Needed:

1. **Filtering Updates**
   - Update filtering to use new memory search capabilities
   - Implement type-specific filters
   - Add metadata filtering

2. **Sorting Updates**
   - Modify sort logic to work with standardized memory fields
   - Add support for sorting by importance and relevance
   - Implement multi-field sorting

3. **Display Enhancements**
   - Add relationship visualization in table view
   - Implement metadata column customization
   - Add bulk selection and operations

## Implementation Steps

### Step 1: Set Up Memory Service Access

1. Create a shared instance of the memory service in a centralized location
2. Implement React hooks for memory operations (useMemory, useMemorySearch)
3. Set up proper error handling and loading states

### Step 2: Update MemoryTab.tsx

1. Replace the direct API calls with new memory service hooks
2. Update the state management to work with standardized memory types
3. Implement the enhanced filtering UI
4. Add support for hybrid search controls
5. Update the rendering logic to handle all memory types

### Step 3: Update MemoryItem.tsx

1. Refactor to use standardized memory structure
2. Implement version history functionality
3. Add importance level visualization
4. Implement relationship display
5. Update metadata display

### Step 4: Update MemoryTable.tsx

1. Update filtering and sorting logic
2. Implement standardized column definitions
3. Add support for bulk operations
4. Implement relationship visualization in table view

### Step 5: Testing and Refinement

1. Test with various memory types
2. Verify search functionality
3. Test performance with large memory sets
4. Refine UI based on testing results

## Code Examples

### Example: Memory Service Hook

```typescript
// src/hooks/useMemory.ts
import { useState, useEffect } from 'react';
import { MemoryService } from '../server/memory/services/memory/memory-service';
import { MemoryType } from '../server/memory/config';

// Initialize memory service
const memoryService = new MemoryService(/* configuration */);

export function useMemories(options = {}) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { types, limit, filter } = options;

  useEffect(() => {
    async function fetchMemories() {
      try {
        setLoading(true);
        const result = await memoryService.getAllMemories({
          types: types || Object.values(MemoryType),
          limit: limit || 100,
          filter
        });
        setMemories(result);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    fetchMemories();
  }, [types, limit, JSON.stringify(filter)]);

  return { memories, loading, error };
}

export function useMemorySearch(query, options = {}) {
  // Similar implementation for search functionality
}
```

### Example: Updated MemoryTab Component

```typescript
// src/components/tabs/MemoryTab.tsx (simplified example)
import { useState } from 'react';
import { useMemories, useMemorySearch } from '../../hooks/useMemory';
import { MemoryType } from '../../server/memory/config';

const MemoryTab = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState(Object.values(MemoryType));
  const [useHybridSearch, setUseHybridSearch] = useState(true);
  
  // Use our custom hook
  const { 
    memories, 
    loading, 
    error 
  } = searchQuery 
    ? useMemorySearch(searchQuery, { types: selectedTypes, hybridSearch: useHybridSearch })
    : useMemories({ types: selectedTypes });
    
  // Component implementation...
};
```

## Timeline

| Task | Estimated Time |
|------|---------------|
| Set up memory service access | 0.5 day |
| Update MemoryTab.tsx | 1 day |
| Update MemoryItem.tsx | 1 day |
| Update MemoryTable.tsx | 0.5 day |
| Testing and refinement | 1 day |
| Total | 4 days |

## Success Criteria

1. All memory tab components correctly use the new memory service
2. Search functionality provides improved relevance with hybrid search
3. Filtering works with all standardized memory types
4. Version history is properly displayed and navigable
5. Importance levels and relationships are visually indicated
6. Performance meets or exceeds previous implementation 