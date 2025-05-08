# Multi-Agent System API Documentation

This document provides detailed information about the API endpoints implemented for the multi-agent system.

## Important Notes

Based on Next.js routing issues in this project, all endpoints follow the recommended pattern with dynamic parameters in the middle of the path. For example:

```
/api/multi-agent/[agentType]/chats/[chatId]/participants
```

## Agent Endpoints

### List/Search Agents

- **URL**: `/api/multi-agent/system/agents`
- **Method**: `GET`
- **Query Parameters**:
  - `capability` (optional): Filter agents by capability
  - `status` (optional): Filter agents by status (e.g., "available")
  - `agentId` (optional): Get a specific agent by ID
- **Success Response**:
  - Code: 200
  - Content: `{ "agents": [...] }` or `{ "agent": {...} }`
- **Error Response**:
  - Code: 400, 404, or 500
  - Content: `{ "error": "Error message" }`

### Create Agent

- **URL**: `/api/multi-agent/system/agents`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "name": "Research Agent",
    "description": "Specialized agent for research tasks",
    "capabilities": [
      {
        "id": "research",
        "name": "Research",
        "description": "Can perform online research",
        "version": "1.0.0"
      }
    ],
    "parameters": {
      "model": "gpt-4",
      "temperature": 0.7,
      "maxTokens": 4000
    }
  }
  ```
- **Success Response**:
  - Code: 201
  - Content: `{ "agent": {...} }`
- **Error Response**:
  - Code: 400 or 500
  - Content: `{ "error": "Error message" }`

### Get Agent by ID

- **URL**: `/api/multi-agent/system/agents/{agentId}`
- **Method**: `GET`
- **Success Response**:
  - Code: 200
  - Content: `{ "agent": {...} }`
- **Error Response**:
  - Code: 404 or 500
  - Content: `{ "error": "Error message" }`

### Update Agent

- **URL**: `/api/multi-agent/system/agents/{agentId}`
- **Method**: `PUT`
- **Body**: Agent data with fields to update
- **Success Response**:
  - Code: 200
  - Content: `{ "agent": {...} }`
- **Error Response**:
  - Code: 400, 404, or 500
  - Content: `{ "error": "Error message" }`

### Delete Agent

- **URL**: `/api/multi-agent/system/agents/{agentId}`
- **Method**: `DELETE`
- **Success Response**:
  - Code: 200
  - Content: `{ "success": true, "message": "Agent deleted successfully" }`
- **Error Response**:
  - Code: 404 or 500
  - Content: `{ "error": "Error message" }`

### Update Agent Status or Capabilities

- **URL**: `/api/multi-agent/system/agents/{agentId}`
- **Method**: `PATCH`
- **Body**:
  ```json
  {
    "status": "busy",
    "capabilities": [...]
  }
  ```
- **Success Response**:
  - Code: 200
  - Content: `{ "agent": {...} }`
- **Error Response**:
  - Code: 400, 404, or 500
  - Content: `{ "error": "Error message" }`

### Get Agent Capabilities

- **URL**: `/api/multi-agent/system/agents/{agentId}/capabilities`
- **Method**: `GET`
- **Success Response**:
  - Code: 200
  - Content: `{ "capabilities": [...] }`
- **Error Response**:
  - Code: 404 or 500
  - Content: `{ "error": "Error message" }`

### Add Agent Capability

- **URL**: `/api/multi-agent/system/agents/{agentId}/capabilities`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "name": "Web Search",
    "description": "Can search the web for information",
    "version": "1.0.0"
  }
  ```
- **Success Response**:
  - Code: 201
  - Content: `{ "capability": {...}, "message": "Capability added successfully" }`
- **Error Response**:
  - Code: 400, 404, 409, or 500
  - Content: `{ "error": "Error message" }`

### Replace Agent Capabilities

- **URL**: `/api/multi-agent/system/agents/{agentId}/capabilities`
- **Method**: `PUT`
- **Body**: Array of capabilities
- **Success Response**:
  - Code: 200
  - Content: `{ "capabilities": [...], "message": "Agent capabilities updated successfully" }`
- **Error Response**:
  - Code: 400, 404, or 500
  - Content: `{ "error": "Error message" }`

## Chat Endpoints

### List Chats

- **URL**: `/api/multi-agent/system/chats`
- **Method**: `GET`
- **Query Parameters**:
  - `userId` (optional): Get chats for a specific user
  - `agentId` (optional): Get chats for a specific agent
- **Success Response**:
  - Code: 200
  - Content: `{ "chats": [...] }`
- **Error Response**:
  - Code: 400 or 500
  - Content: `{ "error": "Error message" }`

### Create Chat

- **URL**: `/api/multi-agent/system/chats`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "userId": "user123",
    "agentId": "agent456",
    "title": "Research Project Discussion",
    "description": "Chat for discussing research project details",
    "type": "group",
    "participants": [
      {
        "id": "agent789",
        "type": "agent",
        "name": "Analysis Agent"
      }
    ]
  }
  ```
- **Success Response**:
  - Code: 200
  - Content: `{ "chat": {...} }`
- **Error Response**:
  - Code: 400 or 500
  - Content: `{ "error": "Error message" }`

### Get Chat by ID

- **URL**: `/api/multi-agent/system/chats/{chatId}`
- **Method**: `GET`
- **Success Response**:
  - Code: 200
  - Content: `{ "chat": {...} }`
- **Error Response**:
  - Code: 404 or 500
  - Content: `{ "error": "Error message" }`

### Update Chat

- **URL**: `/api/multi-agent/system/chats/{chatId}`
- **Method**: `PUT`
- **Body**:
  ```json
  {
    "title": "Updated Title",
    "description": "Updated description",
    "status": "archived"
  }
  ```
- **Success Response**:
  - Code: 200
  - Content: `{ "chat": {...} }`
- **Error Response**:
  - Code: 400, 404, or 500
  - Content: `{ "error": "Error message" }`

### Delete Chat

- **URL**: `/api/multi-agent/system/chats/{chatId}`
- **Method**: `DELETE`
- **Success Response**:
  - Code: 200
  - Content: `{ "success": true, "message": "Chat deleted successfully" }`
- **Error Response**:
  - Code: 404 or 500
  - Content: `{ "error": "Error message" }`

## Chat Participants Endpoints

### List Participants

- **URL**: `/api/multi-agent/system/chats/{chatId}/participants`
- **Method**: `GET`
- **Success Response**:
  - Code: 200
  - Content: `{ "participants": [...] }`
- **Error Response**:
  - Code: 404 or 500
  - Content: `{ "error": "Error message" }`

### Add Participant

- **URL**: `/api/multi-agent/system/chats/{chatId}/participants`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "id": "agent123",
    "type": "agent"
  }
  ```
- **Success Response**:
  - Code: 200
  - Content: `{ "participant": {...}, "message": "Participant added successfully" }`
- **Error Response**:
  - Code: 400, 404, 409, or 500
  - Content: `{ "error": "Error message" }`

### Remove All Additional Participants

- **URL**: `/api/multi-agent/system/chats/{chatId}/participants`
- **Method**: `DELETE`
- **Success Response**:
  - Code: 200
  - Content: `{ "message": "Additional participants removed successfully", "remainingParticipants": 2 }`
- **Error Response**:
  - Code: 404 or 500
  - Content: `{ "error": "Error message" }`

### Get Specific Participant

- **URL**: `/api/multi-agent/system/chats/{chatId}/participants/{participantId}`
- **Method**: `GET`
- **Success Response**:
  - Code: 200
  - Content: `{ "participant": {...} }`
- **Error Response**:
  - Code: 404 or 500
  - Content: `{ "error": "Error message" }`

### Remove Specific Participant

- **URL**: `/api/multi-agent/system/chats/{chatId}/participants/{participantId}`
- **Method**: `DELETE`
- **Success Response**:
  - Code: 200
  - Content: `{ "success": true, "message": "Participant removed successfully" }`
- **Error Response**:
  - Code: 400, 404, or 500
  - Content: `{ "error": "Error message" }`

### Update Participant

- **URL**: `/api/multi-agent/system/chats/{chatId}/participants/{participantId}`
- **Method**: `PATCH`
- **Body**:
  ```json
  {
    "leftAt": true,
    "metadata": {
      "reason": "Task completed"
    }
  }
  ```
- **Success Response**:
  - Code: 200
  - Content: `{ "participant": {...}, "message": "Participant updated successfully" }`
- **Error Response**:
  - Code: 404 or 500
  - Content: `{ "error": "Error message" }`

## Collection Management Endpoints

### List Collections

- **URL**: `/api/multi-agent/system/collections`
- **Method**: `GET`
- **Query Parameters**:
  - `name` (optional): Filter collections by name
  - `type` (optional): Filter collections by type
- **Success Response**:
  - Code: 200
  - Content: `{ "collections": [...] }`
- **Error Response**:
  - Code: 500
  - Content: `{ "error": "Error message" }`

### Create Collection

- **URL**: `/api/multi-agent/system/collections`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "name": "research-results",
    "description": "Research results from agent tasks",
    "type": "research",
    "vectorSize": 1536,
    "metadata": {
      "owner": "research-team",
      "visibility": "private"
    }
  }
  ```
- **Success Response**:
  - Code: 201
  - Content: `{ "collection": {...}, "message": "Collection created successfully" }`
- **Error Response**:
  - Code: 400, 409, or 500
  - Content: `{ "error": "Error message" }`

### Get Collection Details

- **URL**: `/api/multi-agent/system/collections/{collectionId}`
- **Method**: `GET`
- **Success Response**:
  - Code: 200
  - Content: `{ "collection": {...} }`
- **Error Response**:
  - Code: 404 or 500
  - Content: `{ "error": "Error message" }`

### Update Collection Metadata

- **URL**: `/api/multi-agent/system/collections/{collectionId}`
- **Method**: `PUT`
- **Body**:
  ```json
  {
    "metadata": {
      "description": "Updated description",
      "visibility": "public",
      "customField": "custom value"
    }
  }
  ```
- **Success Response**:
  - Code: 200
  - Content: `{ "collection": {...}, "message": "Collection metadata updated successfully" }`
- **Error Response**:
  - Code: 404 or 500
  - Content: `{ "error": "Error message" }`

### Delete Collection

- **URL**: `/api/multi-agent/system/collections/{collectionId}`
- **Method**: `DELETE`
- **Success Response**:
  - Code: 200
  - Content: `{ "success": true, "message": "Collection deleted successfully" }`
- **Error Response**:
  - Code: 404 or 500
  - Content: `{ "error": "Error message" }`

### Get Collection Statistics

- **URL**: `/api/multi-agent/system/collections/{collectionId}/stats`
- **Method**: `GET`
- **Success Response**:
  - Code: 200
  - Content: 
  ```json
  { 
    "stats": {
      "pointCount": 1250,
      "sampleSize": 1000,
      "memoryUsage": {
        "totalBytes": 1572864,
        "formattedSize": "1.5 MB",
        "metadataBytes": 524288,
        "vectorBytes": 1048576
      },
      "timeRange": {
        "oldest": "2023-01-15T12:30:45Z",
        "newest": "2023-06-20T09:15:32Z",
        "spanDays": 156
      },
      "typeDistribution": {
        "message": 65,
        "thought": 20,
        "task": 10,
        "unknown": 5
      },
      "collectionMetadata": {
        "description": "Research results",
        "type": "research",
        "createdAt": "2023-01-15T10:00:00Z"
      },
      "lastUpdated": "2023-06-20T10:30:15Z"
    }
  }
  ```
- **Error Response**:
  - Code: 404 or 500
  - Content: `{ "error": "Error message" }`

### Migrate Collection Data

- **URL**: `/api/multi-agent/system/collections/migrate`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "sourceCollectionId": "old-collection",
    "targetCollectionId": "new-collection",
    "filter": {
      "must": [
        { "key": "payload.metadata.type", "match": { "value": "message" } }
      ]
    },
    "limit": 1000,
    "transform": {
      "type": "addField",
      "options": {
        "field": "migrated",
        "value": true
      }
    }
  }
  ```
- **Success Response**:
  - Code: 200
  - Content: `{ "success": true, "message": "Successfully migrated 152 points from 'old-collection' to 'new-collection'", "migratedCount": 152, "totalPoints": 152 }`
- **Error Response**:
  - Code: 400, 404, or 500
  - Content: `{ "error": "Error message" }`

## Usage Examples

### Creating a Multi-Agent Chat

```javascript
// First create a chat with the primary user and agent
const createChatResponse = await fetch('/api/multi-agent/system/chats', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    userId: 'user123',
    agentId: 'coordinator-agent',
    title: 'Research Project',
    description: 'Collaborative research project',
    type: 'group',
    participants: [
      {
        id: 'research-agent',
        type: 'agent',
        name: 'Research Agent'
      },
      {
        id: 'analysis-agent',
        type: 'agent',
        name: 'Analysis Agent'
      }
    ]
  }),
});

const { chat } = await createChatResponse.json();
console.log(`Created multi-agent chat with ID: ${chat.id}`);
```

### Adding an Agent to a Chat

```javascript
const addParticipantResponse = await fetch(`/api/multi-agent/system/chats/${chatId}/participants`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    id: 'synthesis-agent',
    type: 'agent'
  }),
});

const { participant } = await addParticipantResponse.json();
console.log(`Added participant: ${participant.id}`);
```

### Updating Agent Status

```javascript
const updateStatusResponse = await fetch(`/api/multi-agent/system/agents/${agentId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    status: 'busy'
  }),
});

const { agent } = await updateStatusResponse.json();
console.log(`Updated agent status to: ${agent.status}`);
```

### Creating a New Collection

```javascript
const createCollectionResponse = await fetch('/api/multi-agent/system/collections', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'agent-interactions',
    description: 'Collection for storing agent interaction records',
    type: 'interaction',
    vectorSize: 1536
  }),
});

const { collection } = await createCollectionResponse.json();
console.log(`Created collection: ${collection.name}`);
```

### Migrating Data Between Collections

```javascript
const migrateResponse = await fetch('/api/multi-agent/system/collections/migrate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sourceCollectionId: 'old-messages',
    targetCollectionId: 'archived-messages',
    transform: {
      type: 'addField',
      options: {
        field: 'archived',
        value: true
      }
    }
  }),
});

const result = await migrateResponse.json();
console.log(`Migrated ${result.migratedCount} messages to archived collection`);
``` 