# Memory Edit Functionality

## Overview
The memory edit system provides version control and change tracking for memories in the agent system. It allows tracking of all changes made to memories, including creation, updates, and deletions, while maintaining a complete history of modifications.

## Purpose
- Track version history of memories
- Maintain audit trail of changes
- Support collaborative editing
- Enable memory rollback if needed
- Provide transparency in memory modifications

## Architecture

### Core Components

1. **Memory Edit Type**
```typescript
interface MemoryEditMetadata extends BaseMetadata {
  // Link to original memory
  original_memory_id: string;
  original_type: string;
  original_timestamp: string;
  
  // Edit information
  edit_type: EditType;  // 'create' | 'update' | 'delete'
  editor_type: EditorType;
  editor_id?: string;
  diff_summary?: string;
  
  // Version tracking
  current: boolean;
  previous_version_id?: string;
  
  // Special flag to prevent recursion
  _skip_logging?: boolean;
}
```

2. **Edit Types**
- `create`: Initial creation of a memory
- `update`: Modification of existing memory
- `delete`: Deletion of a memory

3. **Editor Types**
- `system`: Automated system changes
- `user`: User-initiated changes
- `agent`: Agent-initiated changes

### Implementation Status

#### Working Features
- ✅ Memory type tracking
- ✅ Edit metadata storage
- ✅ Version history display
- ✅ Edit type categorization
- ✅ Editor tracking
- ✅ Diff summaries
- ✅ Basic UI for version history

#### In Progress/Needs Attention
- 🟡 Real version history implementation (currently mocked)
- 🟡 Full integration with memory update process
- 🟡 Complete UI integration
- 🟡 Performance optimization for history queries

### Current Implementation Details

1. **Storage**
- Uses dedicated `MEMORY_EDIT_COLLECTION`
- Each edit creates a new memory record
- Links to original memory via `original_memory_id`
- Maintains version chain via `previous_version_id`

2. **API Layer**
- `GET /api/memory/history/:id` - Fetch version history
- `PATCH /api/memory/:id` - Update memory (creates edit record)
- `DELETE /api/memory/:id` - Delete memory (creates edit record)

3. **UI Components**
- `MemoryItem` displays version history
- Version selector in memory details
- Diff summary display
- Editor information display

### Usage Examples

1. **Creating a Memory Edit**
```typescript
const editDefaults = createMemoryEditDefaults(
  originalMemoryId,
  originalType,
  originalTimestamp
);
```

2. **Updating a Memory**
```typescript
await memoryService.updateMemory({
  id: memoryId,
  type: MemoryType.MESSAGE,
  content: newContent,
  metadata: {
    edit_type: 'update',
    editor_type: 'user',
    editor_id: userId
  }
});
```

3. **Fetching Version History**
```typescript
const history = await getMemoryHistory(memoryId);
```

## Future Improvements

1. **Technical Improvements**
- Implement real version history storage
- Add efficient diffing algorithm
- Optimize history queries
- Add batch history operations

2. **Feature Enhancements**
- Add memory comparison view
- Implement memory rollback
- Add collaborative editing features
- Enhance diff visualization

3. **UI Improvements**
- Add timeline view for version history
- Improve diff display
- Add version branching support
- Enhance editor information display

## Integration Points

1. **Memory Service**
- `updateMemory`: Creates edit records
- `getMemoryHistory`: Retrieves version history
- `deleteMemory`: Creates deletion records

2. **Memory Hook**
- `useMemory` hook provides history access
- `getMemoryHistory` function
- `updateMemory` with edit tracking

3. **UI Components**
- `MemoryItem` version display
- `MemoryTab` filtering
- Version history modal

## Best Practices

1. **Creating Edits**
- Always include edit metadata
- Set appropriate editor type
- Provide meaningful diff summaries
- Maintain version chain

2. **Accessing History**
- Use pagination for large histories
- Cache frequently accessed versions
- Filter by edit type when needed
- Consider performance impact

3. **UI Considerations**
- Show clear version indicators
- Provide easy navigation
- Display meaningful diffs
- Indicate current version

## Current Limitations

1. **Technical**
- Mocked version history implementation
- Limited diff capabilities
- No batch operations
- Performance concerns with large histories

2. **Feature**
- No rollback functionality
- Limited collaborative features
- Basic diff visualization
- No version branching

## Migration Notes

When updating the system:
1. Preserve existing edit records
2. Update type definitions
3. Maintain backward compatibility
4. Update UI components
5. Test version history functionality

## Related Components

- `MemoryType` enum
- `MemoryService`
- `MemoryItem` component
- `useMemory` hook
- Memory API routes
- Version history UI 