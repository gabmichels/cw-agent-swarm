# Memory System API Documentation

This document provides comprehensive documentation for the standardized memory system services, their methods, parameters, and usage examples.

## Table of Contents

1. [Memory Service](#memory-service)
2. [Search Service](#search-service)
3. [Client Services](#client-services)
4. [Error Handling](#error-handling)
5. [Common Patterns](#common-patterns)
6. [React Hooks](#react-hooks)
7. [UI Integration Examples](#ui-integration-examples)

## Memory Service

The Memory Service provides operations for creating, retrieving, updating, and deleting memories of various types.

### Initialization

```typescript
import { MemoryService } from 'server/memory/services/memory/memory-service';
import { QdrantMemoryClient } from 'server/memory/services/client/qdrant-client';
import { EmbeddingService } from 'server/memory/services/client/embedding-service';

// Create the client and embedding services
const client = new QdrantMemoryClient({
  qdrantUrl: 'http://localhost:6333'
});

const embeddingService = new EmbeddingService({
  model: 'text-embedding-3-small'
});

// Initialize the services
await client.initialize();

// Create memory service
const memoryService = new MemoryService({
  client,
  embeddingService
});
```

### Adding a Memory

```typescript
// Add a message memory
const result = await memoryService.addMemory({
  type: MemoryType.MESSAGE,
  content: "This is a test message",
  metadata: {
    sender: "user",
    importance: ImportanceLevel.MEDIUM
  }
});

// Add a memory with an existing embedding
const result = await memoryService.addMemory({
  type: MemoryType.DOCUMENT,
  content: "Document content",
  embedding: [0.1, 0.2, 0.3, ...], // Pre-computed embedding
  metadata: {
    source: "file upload",
    filename: "example.pdf"
  }
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | `MemoryType` | Type of memory (MESSAGE, THOUGHT, DOCUMENT, TASK, MEMORY_EDIT) |
| `content` | `string` | Text content of the memory |
| `embedding` | `number[]` | Optional pre-computed embedding |
| `metadata` | `Record<string, any>` | Additional metadata for the memory |
| `id` | `string` | Optional ID (generated if not provided) |
| `timestamp` | `string` | Optional timestamp (current time if not provided) |

### Getting a Memory

```typescript
// Get a memory by ID
const memory = await memoryService.getMemory({
  id: "memory-123"
});

// Get a memory with specific fields
const memory = await memoryService.getMemory({
  id: "memory-123",
  includeVector: true,
  includeMetadata: true
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | ID of the memory to retrieve |
| `includeVector` | `boolean` | Whether to include the embedding vector |
| `includeMetadata` | `boolean` | Whether to include metadata |

### Updating a Memory

```typescript
// Update content (will generate new embedding)
const updated = await memoryService.updateMemory({
  id: "memory-123",
  content: "Updated content"
});

// Update metadata only (preserves embedding)
const updated = await memoryService.updateMemory({
  id: "memory-123",
  metadata: {
    importance: ImportanceLevel.HIGH
  },
  preserveEmbedding: true
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | ID of the memory to update |
| `content` | `string` | Optional new content |
| `metadata` | `Record<string, any>` | Optional metadata updates |
| `embedding` | `number[]` | Optional new embedding |
| `preserveEmbedding` | `boolean` | Whether to preserve existing embedding |

### Deleting a Memory

```typescript
// Permanently delete a memory
const deleted = await memoryService.deleteMemory({
  id: "memory-123"
});

// Soft delete (mark as deleted in metadata)
const softDeleted = await memoryService.deleteMemory({
  id: "memory-123",
  soft: true
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | ID of the memory to delete |
| `soft` | `boolean` | Whether to perform a soft delete |

### Searching Memories

```typescript
// Search by text
const results = await memoryService.searchMemories({
  query: "example search",
  types: [MemoryType.MESSAGE, MemoryType.DOCUMENT],
  limit: 10
});

// Search with filters
const results = await memoryService.searchMemories({
  query: "example",
  filter: {
    metadata: {
      importance: ImportanceLevel.HIGH
    }
  }
});
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `string` | Text to search for |
| `types` | `MemoryType[]` | Types of memories to search |
| `filter` | `FilterOptions` | Additional filters |
| `limit` | `number` | Maximum number of results |
| `offset` | `number` | Number of results to skip |
| `vector` | `number[]` | Optional search vector instead of text |

### Memory History

```typescript
// Get version history for a memory
const history = await memoryService.getMemoryHistory({
  id: "memory-123",
  limit: 10
});

// Create a new version of a memory
const versionResult = await memoryService.createMemoryVersion({
  originalMemoryId: "memory-123",
  content: "Updated version",
  editType: "update",
  editorType: "user"
});
```

## Search Service

The Search Service provides advanced search capabilities across multiple memory types.

### Initialization

```typescript
import { SearchService } from 'server/memory/services/search/search-service';

const searchService = new SearchService({
  memoryService,
  embeddingService
});
```

### Basic Search

```typescript
// Search across all memory types
const results = await searchService.search({
  query: "example search",
  limit: 10
});

// Search specific memory types
const results = await searchService.search({
  query: "example search",
  types: [MemoryType.MESSAGE, MemoryType.DOCUMENT],
  limit: 10
});
```

### Hybrid Search

```typescript
// Perform hybrid (vector + keyword) search
const results = await searchService.hybridSearch({
  query: "example search",
  hybridRatio: 0.7, // 70% vector search, 30% keyword search
  limit: 10
});
```

### Building Filters

```typescript
// Create date range filter
const filter = searchService.buildFilter({
  dateRange: {
    start: "2023-01-01T00:00:00Z",
    end: "2023-12-31T23:59:59Z"
  }
});

// Create metadata filter
const filter = searchService.buildFilter({
  metadata: {
    importance: ImportanceLevel.HIGH,
    tags: ["important", "follow-up"]
  }
});

// Create combined filter
const filter = searchService.buildFilter({
  types: [MemoryType.MESSAGE],
  dateRange: {
    start: "2023-01-01T00:00:00Z"
  },
  metadata: {
    importance: ImportanceLevel.HIGH
  },
  textContains: "example"
});
```

## Client Services

### QdrantMemoryClient

The QdrantMemoryClient provides low-level operations for interacting with the Qdrant vector database.

#### Initialization

```typescript
import { QdrantMemoryClient } from 'server/memory/services/client/qdrant-client';

const client = new QdrantMemoryClient({
  qdrantUrl: 'http://localhost:6333',
  qdrantApiKey: 'your-api-key', // Optional
  useInMemoryFallback: true, // Optional, falls back to in-memory storage if Qdrant is unavailable
  connectionTimeout: 5000 // Optional, timeout in ms
});

await client.initialize();
```

#### Collection Management

```typescript
// Check if collection exists
const exists = await client.hasCollection("messages");

// Create a collection
await client.createCollection("messages", {
  dimensions: 1536,
  metadata: {
    created: new Date().toISOString()
  }
});

// Create indices for faster filtering
await client.createIndices("messages", ["metadata.importance", "metadata.tags"]);
```

#### Point Operations

```typescript
// Add a point
const id = await client.addPoint("messages", {
  id: "point-123", // Optional, generated if not provided
  vector: [0.1, 0.2, 0.3, ...],
  payload: {
    text: "Example message",
    timestamp: new Date().toISOString(),
    metadata: {
      importance: ImportanceLevel.MEDIUM
    }
  }
});

// Get points by IDs
const points = await client.getPoints("messages", ["point-123", "point-456"]);

// Search for points
const results = await client.searchPoints("messages", {
  vector: [0.1, 0.2, 0.3, ...],
  filter: {
    "metadata.importance": ImportanceLevel.HIGH
  },
  limit: 10
});

// Update a point
await client.updatePoint("messages", "point-123", {
  payload: {
    metadata: {
      importance: ImportanceLevel.HIGH
    }
  }
});

// Delete a point
await client.deletePoint("messages", "point-123");
```

### EmbeddingService

The EmbeddingService provides text-to-vector encoding using various embedding models.

#### Initialization

```typescript
import { EmbeddingService } from 'server/memory/services/client/embedding-service';

const embeddingService = new EmbeddingService({
  model: 'text-embedding-3-small', // OpenAI model to use
  dimensions: 1536, // Optional, dimensions of the embeddings
  apiKey: 'your-openai-api-key', // Optional, uses environment variable if not provided
  useFallback: true // Optional, uses random vectors if OpenAI is unavailable
});
```

#### Generating Embeddings

```typescript
// Generate embedding for a single text
const result = await embeddingService.getEmbedding("Example text");
console.log(result.embedding); // Vector representation
console.log(result.dimensions); // Number of dimensions

// Generate embeddings for multiple texts
const results = await embeddingService.getBatchEmbeddings([
  "Example text 1",
  "Example text 2"
]);
```

## Error Handling

The memory system uses standardized error handling with specific error types and codes.

### Error Types

```typescript
// Import error types
import { MemoryError, ErrorCode } from 'server/memory/utils/error-handler';

// Handling errors
try {
  const memory = await memoryService.getMemory({ id: "non-existent-id" });
} catch (error) {
  if (error instanceof MemoryError) {
    switch (error.code) {
      case ErrorCode.NOT_FOUND:
        console.log("Memory not found");
        break;
      case ErrorCode.VALIDATION_ERROR:
        console.log("Invalid parameters", error.details);
        break;
      case ErrorCode.DATABASE_ERROR:
        console.log("Database error", error.message);
        break;
      default:
        console.log("Unknown error", error);
    }
  }
}
```

## Common Patterns

### Working with Different Memory Types

```typescript
// Create a message memory
await memoryService.addMemory({
  type: MemoryType.MESSAGE,
  content: "Hello, world!",
  metadata: {
    sender: "user",
    recipient: "assistant"
  }
});

// Create a document memory
await memoryService.addMemory({
  type: MemoryType.DOCUMENT,
  content: "Document content",
  metadata: {
    source: "file",
    filename: "example.pdf",
    filesize: 1024
  }
});

// Create a task memory
await memoryService.addMemory({
  type: MemoryType.TASK,
  content: "Complete project documentation",
  metadata: {
    status: "in_progress",
    dueDate: "2023-12-31T00:00:00Z",
    priority: "high"
  }
});
```

### Implementing Version History

```typescript
// Create original memory
const originalResult = await memoryService.addMemory({
  type: MemoryType.DOCUMENT,
  content: "Original content",
});

// Create a new version
await memoryService.createMemoryVersion({
  originalMemoryId: originalResult.id,
  content: "Updated content",
  editType: "update",
  editorType: "user",
  diffSummary: "Minor changes to content"
});

// Get all versions
const history = await memoryService.getMemoryHistory({
  id: originalResult.id
});

// Compare versions
const diff = memoryService.compareVersions(history[0], history[1]);
```

### Implementing Importance Tracking

```typescript
// Create memory with importance
await memoryService.addMemory({
  type: MemoryType.MESSAGE,
  content: "Important information about the project",
  metadata: {
    importance: ImportanceLevel.HIGH
  }
});

// Update importance
await memoryService.updateMemory({
  id: "memory-123",
  metadata: {
    importance: ImportanceLevel.CRITICAL
  },
  preserveEmbedding: true // Don't regenerate embedding for metadata-only updates
});

// Search by importance
const results = await searchService.search({
  query: "project",
  filter: searchService.buildFilter({
    metadata: {
      importance: ImportanceLevel.CRITICAL
    }
  })
});
```

## React Hooks

The memory system provides React hooks for easy integration with UI components.

### useMemory Hook

Use this hook to fetch, create, and manipulate memories.

```typescript
import { useMemory } from 'hooks/useMemory';

function MemoryItem({ memoryId }) {
  const { 
    memory, 
    loading, 
    error, 
    updateMemory, 
    deleteMemory,
    history
  } = useMemory(memoryId);

  if (loading) return <Spinner />;
  if (error) return <Alert severity="error">{error.message}</Alert>;
  if (!memory) return <Empty message="Memory not found" />;

  const handleImportanceChange = (newImportance) => {
    updateMemory({
      metadata: { importance: newImportance },
      preserveEmbedding: true
    });
  };

  const handleDelete = async () => {
    await deleteMemory();
    // Handle post-deletion UI updates
  };

  return (
    <div>
      <p>{memory.content}</p>
      <ImportanceSelector 
        value={memory.metadata?.importance || ImportanceLevel.MEDIUM} 
        onChange={handleImportanceChange} 
      />
      {history && history.length > 0 && (
        <VersionHistory versions={history} />
      )}
    </div>
  );
}
```

### useMemorySearch Hook

Use this hook to search and filter memories.

```typescript
import { useMemorySearch } from 'hooks/useMemorySearch';
import { MemoryType, ImportanceLevel } from 'server/memory/config';

function MemorySearchComponent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [memoryType, setMemoryType] = useState(MemoryType.MESSAGE);
  const [importance, setImportance] = useState(null);

  const { 
    results, 
    loading, 
    error,
    search,
    buildFilter
  } = useMemorySearch();

  useEffect(() => {
    if (searchTerm) {
      const filter = buildFilter({
        types: memoryType ? [memoryType] : undefined,
        metadata: importance ? { importance } : undefined
      });

      search({
        query: searchTerm,
        filter,
        limit: 20
      });
    }
  }, [searchTerm, memoryType, importance]);

  return (
    <div>
      <SearchInput 
        value={searchTerm} 
        onChange={(e) => setSearchTerm(e.target.value)} 
      />
      
      <TypeSelector 
        value={memoryType} 
        onChange={setMemoryType} 
      />
      
      <ImportanceFilter 
        value={importance} 
        onChange={setImportance} 
      />
      
      {loading ? (
        <Spinner />
      ) : error ? (
        <Alert severity="error">{error.message}</Alert>
      ) : (
        <MemoryList memories={results} />
      )}
    </div>
  );
}
```

### useMemoryAddition Hook

Use this hook to add new memories.

```typescript
import { useMemoryAddition } from 'hooks/useMemoryAddition';
import { MemoryType, ImportanceLevel } from 'server/memory/config';

function MemoryAddForm() {
  const [content, setContent] = useState('');
  const [memoryType, setMemoryType] = useState(MemoryType.THOUGHT);
  const [metadata, setMetadata] = useState({
    importance: ImportanceLevel.MEDIUM
  });

  const { 
    addMemory, 
    loading, 
    error, 
    success 
  } = useMemoryAddition();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    await addMemory({
      type: memoryType,
      content,
      metadata
    });
    
    if (success) {
      setContent('');
      // Show success message or redirect
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <TypeSelector 
        value={memoryType} 
        onChange={setMemoryType} 
      />
      
      <TextEditor 
        value={content} 
        onChange={setContent} 
      />
      
      <MetadataEditor 
        value={metadata} 
        onChange={setMetadata} 
      />
      
      <Button 
        type="submit" 
        disabled={loading || !content}
      >
        {loading ? 'Adding...' : 'Add Memory'}
      </Button>
      
      {error && <Alert severity="error">{error.message}</Alert>}
      {success && <Alert severity="success">Memory added successfully</Alert>}
    </form>
  );
}
```

## UI Integration Examples

### Memory Tab Implementation

Example of how to implement the Memory Tab component using the new memory system.

```typescript
import { useEffect, useState } from 'react';
import { useMemorySearch } from 'hooks/useMemorySearch';
import { MemoryType, ImportanceLevel } from 'server/memory/config';

function MemoryTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<MemoryType[]>([]);
  const [hybridRatio, setHybridRatio] = useState(0.7); // 70% vector search, 30% keyword search
  const [importance, setImportance] = useState<ImportanceLevel | null>(null);
  
  const { 
    results, 
    loading, 
    error,
    search,
    hybridSearch,
    buildFilter
  } = useMemorySearch();

  useEffect(() => {
    if (searchTerm) {
      const filter = buildFilter({
        types: selectedTypes.length > 0 ? selectedTypes : undefined,
        metadata: importance ? { importance } : undefined
      });

      // Use hybrid search for better results
      hybridSearch({
        query: searchTerm,
        filter,
        hybridRatio,
        limit: 20
      });
    }
  }, [searchTerm, selectedTypes, importance, hybridRatio]);

  return (
    <div className="memory-tab">
      <div className="search-controls">
        <SearchInput 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          placeholder="Search memories..." 
        />
        
        <TypeFilter 
          selectedTypes={selectedTypes} 
          onChange={setSelectedTypes} 
        />
        
        <ImportanceFilter 
          value={importance} 
          onChange={setImportance} 
        />
        
        <HybridSearchSlider 
          value={hybridRatio} 
          onChange={setHybridRatio} 
        />
      </div>
      
      {loading ? (
        <Spinner />
      ) : error ? (
        <Alert severity="error">{error.message}</Alert>
      ) : (
        <>
          <div className="results-summary">
            Found {results.length} memories matching your search
          </div>
          
          <MemoryList memories={results} />
        </>
      )}
    </div>
  );
}

// Memory item component to display individual memory
function MemoryItem({ memory }) {
  const [showHistory, setShowHistory] = useState(false);
  const { history, loading: historyLoading } = useMemory(memory.id);
  
  return (
    <div className="memory-item">
      <div className="memory-header">
        <div className="memory-type">{memory.type}</div>
        <ImportanceBadge importance={memory.metadata?.importance} />
        <TimeAgo date={memory.timestamp} />
      </div>
      
      <div className="memory-content">{memory.content}</div>
      
      <div className="memory-actions">
        <Button onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? 'Hide History' : 'Show History'}
        </Button>
        <EditButton memoryId={memory.id} />
        <DeleteButton memoryId={memory.id} />
      </div>
      
      {showHistory && (
        <div className="memory-history">
          {historyLoading ? (
            <Spinner />
          ) : (
            <VersionHistoryList versions={history} />
          )}
        </div>
      )}
    </div>
  );
}
```

### Chat Interface Integration

Example of how to integrate the memory system with the chat interface.

```typescript
import { useState, useEffect } from 'react';
import { useMemory, useMemorySearch } from 'hooks/useMemory';
import { MemoryType, ImportanceLevel } from 'server/memory/config';

function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  
  const { addMemory } = useMemoryAddition();
  const { results, search } = useMemorySearch();
  
  // Load chat history
  useEffect(() => {
    const filter = buildFilter({
      types: [MemoryType.MESSAGE],
      metadata: {
        notForChat: false // Only include messages meant for the chat
      }
    });
    
    search({
      filter,
      sort: { field: 'timestamp', direction: 'asc' },
      limit: 50
    });
  }, []);
  
  // Update messages when search results change
  useEffect(() => {
    setMessages(results);
  }, [results]);
  
  const sendMessage = async () => {
    if (!input.trim()) return;
    
    // Add user message to memory
    const userMessage = await addMemory({
      type: MemoryType.MESSAGE,
      content: input,
      metadata: {
        sender: 'user',
        recipient: 'assistant',
        importance: ImportanceLevel.MEDIUM
      }
    });
    
    setInput('');
    
    // Process message with AI assistant
    const assistantResponse = await processWithAssistant(input);
    
    // Add assistant response to memory
    await addMemory({
      type: MemoryType.MESSAGE,
      content: assistantResponse,
      metadata: {
        sender: 'assistant',
        recipient: 'user',
        importance: ImportanceLevel.MEDIUM,
        inResponseTo: userMessage.id
      }
    });
  };
  
  return (
    <div className="chat-interface">
      <div className="message-list">
        {messages.map(message => (
          <ChatMessage 
            key={message.id} 
            message={message} 
          />
        ))}
      </div>
      
      <div className="chat-input">
        <TextInput 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          onEnter={sendMessage} 
        />
        <Button onClick={sendMessage}>Send</Button>
      </div>
    </div>
  );
}

function ChatMessage({ message }) {
  const isMine = message.metadata?.sender === 'user';
  const { updateMemory } = useMemory(message.id);
  
  const flagAsImportant = () => {
    updateMemory({
      metadata: { importance: ImportanceLevel.HIGH },
      preserveEmbedding: true
    });
  };
  
  return (
    <div className={`chat-message ${isMine ? 'mine' : 'theirs'}`}>
      <div className="message-content">{message.content}</div>
      <div className="message-actions">
        <FlagButton onClick={flagAsImportant} />
      </div>
    </div>
  );
}
``` 