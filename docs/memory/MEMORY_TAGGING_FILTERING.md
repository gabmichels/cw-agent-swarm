# Memory Tagging and Filtering System

## Overview

The Memory Tagging and Filtering System enables efficient organization, categorization, and retrieval of memories through automated and manual tagging capabilities coupled with advanced filtering options. This document outlines the architecture, APIs, and usage patterns for the memory tagging and filtering functionality.

## System Architecture

The system consists of several key components:

1. **Tag Extraction**: Automated extraction of relevant tags from content
2. **Tag Management**: APIs for adding, removing, and updating tags
3. **Advanced Filtering**: Type-safe querying across memory collections
4. **Bulk Operations**: Support for tagging multiple memories simultaneously

## Tag Extraction

### Automatic Tag Generation

Tags are automatically extracted from memory content during creation using the following methods:

- **TF-IDF Analysis**: Identifies statistically significant terms
- **Entity Recognition**: Extracts named entities (people, places, concepts)
- **Topic Modeling**: Categorizes content into defined topics
- **Custom Rules**: Applies domain-specific rules for specialized tagging

### Tag Suggestion and Approval

The system provides a workflow for tag management:

1. **Automatic Tagging**: Initial tags are generated automatically
2. **Tag Suggestions**: Additional tags may be suggested based on content analysis
3. **Approval/Rejection**: Users can approve, reject, or modify suggested tags
4. **Manual Tagging**: Users can manually add custom tags

## Filtering API

### Basic Filtering

The system supports filtering memories by various criteria:

```typescript
// Filter by specific tags
const filteredMemories = await searchService.filter({
  filter: {
    'metadata.tags': { $in: ['important', 'work'] }
  }
});

// Filter by memory type and time range
const filteredMemories = await searchService.filter({
  types: [MemoryType.MESSAGE, MemoryType.DOCUMENT],
  filter: {
    timestamp: {
      $gte: startDate.getTime().toString(),
      $lte: endDate.getTime().toString()
    }
  }
});
```

### Advanced Query Options

The filter API supports complex query operations:

- **Tag Combinations**: Filter by memories containing specific tag combinations
- **Time Ranges**: Filter memories created within specific time periods
- **Metadata Filtering**: Query based on custom metadata attributes
- **Sorting**: Order results by various properties (timestamp, importance, etc.)
- **Pagination**: Control result size through limit and offset parameters

## API Reference

### Memory Filter Endpoint

**POST /api/memory/filter**

Filter memories based on various criteria.

**Request Body:**

```json
{
  "tags": ["important", "work"],
  "types": ["message", "document"],
  "timeRange": {
    "startDate": "2023-01-01T00:00:00Z",
    "endDate": "2023-12-31T23:59:59Z"
  },
  "metadata": {
    "importance": "high"
  },
  "sortBy": "timestamp",
  "sortOrder": "desc",
  "textSearch": "optional text to search for",
  "limit": 50,
  "offset": 0
}
```

**Response:**

```json
{
  "results": [
    {
      "point": {
        "id": "mem_123456",
        "payload": {
          "text": "Memory content",
          "type": "message",
          "timestamp": "1672531200000",
          "metadata": {
            "tags": ["important", "work"],
            "importance": "high"
          }
        }
      },
      "score": 1.0,
      "type": "message",
      "collection": "message"
    }
  ],
  "total": 1,
  "filterInfo": {
    "tags": ["important", "work"],
    "types": ["message", "document"],
    "timeRange": {
      "startDate": "2023-01-01T00:00:00Z",
      "endDate": "2023-12-31T23:59:59Z"
    },
    "metadata": {
      "importance": "high"
    },
    "limit": 50,
    "offset": 0,
    "sortBy": "timestamp",
    "sortOrder": "desc",
    "textSearch": "optional text to search for"
  }
}
```

### Bulk Tagging Endpoint

**POST /api/memory/bulk-tag**

Apply tags to multiple memories matching a filter.

**Request Body:**

```json
{
  "tags": ["project-x", "priority"],
  "operation": "add",
  "filter": {
    "metadata.category": "work"
  },
  "types": ["message", "document"],
  "limit": 100
}
```

**Operations:**
- `"add"`: Add tags to existing tags
- `"remove"`: Remove specified tags
- `"replace"`: Replace all tags with the provided tags

**Response:**

```json
{
  "success": true,
  "summary": {
    "operation": "add",
    "totalMemories": 25,
    "updatedCount": 25,
    "failedCount": 0
  },
  "updatedMemories": [
    {
      "id": "mem_123456",
      "type": "message",
      "oldTags": ["work"],
      "newTags": ["work", "project-x", "priority"]
    }
  ]
}
```

### Update Tags Endpoint

**POST /api/memory/updateTags**

Update tags for a specific memory.

**Request Body:**

```json
{
  "memoryId": "mem_123456",
  "tags": ["important", "work", "meeting"],
  "action": "approve"
}
```

**Actions:**
- `"approve"`: Set the specified tags and mark as approved
- `"reject"`: Reject suggested tags

**Response:**

```json
{
  "success": true,
  "message": "Tags approved successfully",
  "memoryId": "mem_123456",
  "tags": ["important", "work", "meeting"]
}
```

## Implementation Details

### Filter Method in SearchService

The `filter` method in the SearchService provides direct memory filtering without requiring semantic search:

```typescript
/**
 * Filter memories without semantic search
 * Retrieves memories based on exact filtering criteria without embedding comparison
 */
async filter<T extends BaseMemorySchema>(
  options: FilterOptions = {}
): Promise<SearchResult<T>[]> {
  // Implementation details...
}
```

### FilterOptions Interface

```typescript
/**
 * Filter options for direct filtering without semantic search
 */
export interface FilterOptions {
  // Memory types to filter (all if not specified)
  types?: MemoryType[];
  
  // Filter to apply
  filter?: MemoryFilter;
  
  // Maximum results to return
  limit?: number;
  
  // Offset for pagination
  offset?: number;
  
  // Field to sort by (e.g., 'timestamp')
  sortBy?: string;
  
  // Sort direction
  sortOrder?: 'asc' | 'desc';
}
```

## Best Practices

### Effective Tagging

- **Use Consistent Tags**: Establish a tagging vocabulary for consistency
- **Hierarchical Tags**: Consider using prefixes for tag hierarchies (e.g., `project/x` and `project/y`)
- **Tag Meaningful Content**: Focus on tagging the most important memories
- **Review Suggested Tags**: Regularly review and approve/reject suggested tags

### Efficient Filtering

- **Combine Criteria**: Use multiple filter criteria for more precise results
- **Include Types**: Always specify memory types when known to improve performance
- **Limit Results**: Use pagination to avoid loading too many results at once
- **Sort Appropriately**: Choose sorting based on your use case (recency, relevance, etc.)

## Performance Considerations

- Filtering operations are optimized to use Qdrant's native filtering capabilities
- Complex filters may impact performance, especially with large memory collections
- Consider using text search only when necessary, as it requires additional computation
- Bulk operations are limited to 100 memories by default to prevent timeouts

## Future Enhancements

Planned enhancements for the tagging and filtering system include:

- **Tag Analytics**: Dashboard for viewing tag usage and relationships
- **Automated Tag Maintenance**: Tools for merging, splitting, and renaming tags
- **Tag Recommendations**: Improved tag suggestions based on memory relationships
- **Advanced Filtering UI**: Visual interface for constructing complex filters
- **Tag Hierarchies**: Formal support for tag hierarchies and inheritance 