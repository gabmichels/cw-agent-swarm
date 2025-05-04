# Memory System API Documentation

This document provides comprehensive information about the standardized memory system API endpoints, data structures, and usage patterns.

## Overview

The memory system provides a standardized interface for storing, retrieving, and searching different types of memories. The system is designed to be modular, type-safe, and performant, with support for vector search, hybrid search, and memory versioning.

## API Endpoints

### Memory Operations

#### List Memories
- **Endpoint**: `GET /api/memory`
- **Query Parameters**:
  - `type` (optional): Filter by memory type
  - `limit` (optional): Maximum number of results to return (default: 10)
  - `offset` (optional): Pagination offset (default: 0)
- **Response**:
  ```json
  {
    "memories": [
      {
        "id": "memory-id",
        "vector": [...],
        "payload": {
          "text": "Memory content",
          "type": "message",
          "timestamp": "2023-06-01T12:00:00Z",
          "metadata": {
            "tags": ["example", "test"]
          }
        }
      }
    ],
    "total": 1,
    "limit": 10,
    "offset": 0,
    "type": "message"
  }
  ```

#### Create Memory
- **Endpoint**: `POST /api/memory`
- **Request Body**:
  ```json
  {
    "type": "message",
    "content": "This is a new memory",
    "metadata": {
      "tags": ["example", "test"]
    },
    "id": "optional-custom-id",
    "embedding": [optional-vector-array]
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "memory": {
      "id": "memory-id",
      "vector": [...],
      "payload": {
        "text": "Memory content",
        "type": "message",
        "timestamp": "2023-06-01T12:00:00Z",
        "metadata": {
          "tags": ["example", "test"]
        }
      }
    },
    "id": "memory-id"
  }
  ```

#### Get Memory
- **Endpoint**: `GET /api/memory/[id]`
- **Response**:
  ```json
  {
    "id": "memory-id",
    "vector": [...],
    "payload": {
      "text": "Memory content",
      "type": "message",
      "timestamp": "2023-06-01T12:00:00Z",
      "metadata": {
        "tags": ["example", "test"]
      }
    }
  }
  ```

#### Update Memory
- **Endpoint**: `PATCH /api/memory/[id]`
- **Request Body**:
  ```json
  {
    "type": "message",
    "content": "Updated memory content",
    "metadata": {
      "tags": ["example", "test", "updated"]
    },
    "preserveEmbedding": false
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "memory": {
      "id": "memory-id",
      "vector": [...],
      "payload": {
        "text": "Updated memory content",
        "type": "message",
        "timestamp": "2023-06-01T12:00:00Z",
        "metadata": {
          "tags": ["example", "test", "updated"]
        }
      }
    }
  }
  ```

#### Delete Memory
- **Endpoint**: `DELETE /api/memory/[id]`
- **Request Body**:
  ```json
  {
    "type": "message",
    "hardDelete": false
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "id": "memory-id"
  }
  ```

### Search Operations

#### Vector Search
- **Endpoint**: `POST /api/memory/search`
- **Request Body**:
  ```json
  {
    "query": "vector search query",
    "filter": {
      "must": [
        {
          "key": "type",
          "match": {
            "value": "message"
          }
        }
      ]
    },
    "limit": 10,
    "offset": 0
  }
  ```
- **Response**:
  ```json
  {
    "results": [
      {
        "point": {
          "id": "memory-id",
          "vector": [...],
          "payload": {
            "text": "Memory content",
            "type": "message",
            "timestamp": "2023-06-01T12:00:00Z",
            "metadata": {
              "tags": ["example", "test"]
            }
          }
        },
        "score": 0.95,
        "type": "message",
        "collection": "memory_collection"
      }
    ],
    "total": 1
  }
  ```

#### Hybrid Search
- **Endpoint**: `POST /api/memory/hybrid-search`
- **Query Parameters**:
  - `hybridRatio` (optional): Weight between vector and text search (0-1, default: 0.7)
- **Request Body**:
  ```json
  {
    "query": "hybrid search query",
    "filter": {
      "must": [
        {
          "key": "type",
          "match": {
            "value": "message"
          }
        }
      ]
    },
    "limit": 10,
    "offset": 0
  }
  ```
- **Response**: Same format as vector search

### Memory History

#### Get Memory History
- **Endpoint**: `GET /api/memory/history/[id]`
- **Response**:
  ```json
  {
    "history": [
      {
        "id": "history-id",
        "payload": {
          "text": "Original memory content",
          "timestamp": "2023-06-01T12:00:00Z",
          "type": "message",
          "metadata": {
            "tags": ["example", "test"]
          },
          "original_memory_id": "memory-id",
          "edit_type": "create",
          "editor_type": "human",
          "current": false,
          "previous_version_id": null
        }
      },
      {
        "id": "memory-id",
        "payload": {
          "text": "Updated memory content",
          "timestamp": "2023-06-01T12:30:00Z",
          "type": "message",
          "metadata": {
            "tags": ["example", "test", "updated"]
          },
          "original_memory_id": "memory-id",
          "edit_type": "update",
          "editor_type": "human",
          "current": true,
          "previous_version_id": "history-id"
        }
      }
    ],
    "id": "memory-id"
  }
  ```

### System Status

#### Health Check
- **Endpoint**: `GET /api/memory/health`
- **Response**:
  ```json
  {
    "status": "ok",
    "collections": [
      {
        "name": "messages",
        "count": 123,
        "status": "ready"
      },
      {
        "name": "thoughts",
        "count": 45,
        "status": "ready"
      }
    ],
    "embedding": "ready"
  }
  ```

## Data Structures

### Memory Types

The memory system supports the following memory types:

```typescript
enum MemoryType {
  MESSAGE = 'message',
  THOUGHT = 'thought',
  DOCUMENT = 'document',
  TASK = 'task',
  MEMORY_EDIT = 'memory_edit',
}
```

### Memory Point

The standard memory data structure:

```typescript
interface MemoryPoint<T extends BaseMemorySchema> {
  id: string;
  vector: number[];
  payload: T;
}
```

### Memory Schemas

All memory schemas extend from the base schema:

```typescript
interface BaseMemorySchema {
  text: string;
  type: string;
  timestamp: string;
  metadata: Record<string, any>;
}
```

Specialized schemas add additional fields as needed:

```typescript
interface MessageSchema extends BaseMemorySchema {
  role: 'user' | 'assistant' | 'system';
  conversation_id?: string;
}

interface ThoughtSchema extends BaseMemorySchema {
  category?: 'reflection' | 'planning' | 'reasoning';
  confidence?: number;
}

interface DocumentSchema extends BaseMemorySchema {
  source: string;
  file_type?: string;
  url?: string;
}

interface TaskSchema extends BaseMemorySchema {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority?: 'low' | 'medium' | 'high';
  due_date?: string;
}
```

### Search Query Structure

For filtering memory:

```typescript
interface MemoryFilter {
  must?: MemoryCondition[];
  should?: MemoryCondition[];
  must_not?: MemoryCondition[];
}

interface MemoryCondition {
  key: string;
  match?: {
    value: any;
    in?: any[];
  };
  range?: {
    gt?: any;
    gte?: any;
    lt?: any;
    lte?: any;
  };
}
```

## Example Usage

### Creating a Memory

```javascript
// Create a new memory
const createMemory = async () => {
  const response = await fetch('/api/memory', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'message',
      content: 'This is a test memory',
      metadata: {
        tags: ['test', 'example'],
        importance: 'medium'
      }
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log(`Memory created with ID: ${data.id}`);
  } else {
    console.error(`Error: ${data.error}`);
  }
};
```

### Searching Memories

```javascript
// Perform a hybrid search
const searchMemories = async (query) => {
  const response = await fetch('/api/memory/hybrid-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query,
      filter: {
        must: [
          {
            key: 'type',
            match: {
              value: 'message'
            }
          },
          {
            key: 'metadata.tags',
            match: {
              value: 'important'
            }
          }
        ]
      },
      limit: 5
    })
  });
  
  const data = await response.json();
  
  if (data.results) {
    return data.results.map(result => ({
      content: result.point.payload.text,
      score: result.score,
      tags: result.point.payload.metadata.tags
    }));
  } else {
    console.error(`Error: ${data.error}`);
    return [];
  }
};
```

## Error Handling

All API endpoints use standardized error codes:

```typescript
enum MemoryErrorCode {
  NOT_FOUND = 'MEMORY_NOT_FOUND',
  VALIDATION_ERROR = 'MEMORY_VALIDATION_ERROR',
  DATABASE_ERROR = 'MEMORY_DATABASE_ERROR',
  EMBEDDING_ERROR = 'MEMORY_EMBEDDING_ERROR',
  INITIALIZATION_ERROR = 'MEMORY_INITIALIZATION_ERROR',
  CONFIGURATION_ERROR = 'MEMORY_CONFIGURATION_ERROR',
  OPERATION_ERROR = 'MEMORY_OPERATION_ERROR',
}
```

Error responses follow this format:

```json
{
  "error": "Error message description",
  "code": "MEMORY_ERROR_CODE",
  "success": false
}
```

## Testing Scripts

Several scripts are available to test the memory system:

- `npm run memory:setup-collections` - Initialize Qdrant collections
- `npm run memory:health-check` - Check memory system health
- `npm run memory:api-test` - Test all memory API endpoints
- `npm run memory:test-hybrid-search` - Test hybrid search functionality 