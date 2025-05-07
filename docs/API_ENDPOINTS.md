# API Endpoints Documentation

## Chat System API

### Chat Endpoints

#### `POST /api/chat`
Send a message to the chat system.

**Request Body:**
```json
{
  "message": "Your message here",
  "userId": "gab",
  "agentId": "chloe",
  "attachments": [],
  "visionResponseFor": null
}
```

**Response:**
```json
{
  "reply": "Agent's response",
  "chatId": "uuid-format-chat-id",
  "timestamp": "2023-07-20T15:30:45.123Z",
  "chatInfo": {
    "title": "Chat with chloe",
    "participants": [
      {
        "id": "gab",
        "type": "user" 
      },
      {
        "id": "chloe",
        "type": "agent"
      }
    ]
  }
}
```

#### `GET /api/chat/chats?userId=gab&agentId=chloe`
List chat sessions for a user, agent, or user-agent pair.

**Query Parameters:**
- `userId` (optional): Filter by user ID
- `agentId` (optional): Filter by agent ID

**Response:**
```json
{
  "chats": [
    {
      "id": "uuid-format-chat-id",
      "type": "direct",
      "createdAt": "2023-07-20T15:30:45.123Z",
      "updatedAt": "2023-07-20T15:35:12.456Z",
      "status": "active",
      "participants": [
        {
          "id": "gab",
          "type": "user",
          "joinedAt": "2023-07-20T15:30:45.123Z"
        },
        {
          "id": "chloe",
          "type": "agent",
          "joinedAt": "2023-07-20T15:30:45.123Z"
        }
      ],
      "metadata": {
        "title": "Chat with chloe",
        "description": "Conversation between user gab and agent chloe"
      }
    }
  ]
}
```

#### `POST /api/chat/chats`
Create a new chat session.

**Request Body:**
```json
{
  "userId": "gab",
  "agentId": "chloe",
  "title": "My custom chat title",
  "description": "A description of this chat",
  "type": "direct",
  "forceNew": false
}
```

**Response:**
```json
{
  "chat": {
    "id": "uuid-format-chat-id",
    "type": "direct",
    "createdAt": "2023-07-20T15:30:45.123Z",
    "updatedAt": "2023-07-20T15:30:45.123Z",
    "status": "active",
    "participants": [
      {
        "id": "gab",
        "type": "user",
        "joinedAt": "2023-07-20T15:30:45.123Z"
      },
      {
        "id": "chloe",
        "type": "agent",
        "joinedAt": "2023-07-20T15:30:45.123Z"
      }
    ],
    "metadata": {
      "title": "My custom chat title",
      "description": "A description of this chat"
    }
  }
}
```

#### `POST /api/chat/spawn`
Spawn a fresh chat with a new UUID.

**Request Body:**
```json
{
  "userId": "gab",
  "agentId": "chloe",
  "title": "New conversation",
  "description": "Fresh conversation with Chloe"
}
```

**Response:**
```json
{
  "success": true,
  "chat": {
    "id": "uuid-format-chat-id",
    "title": "New conversation",
    "createdAt": "2023-07-20T15:30:45.123Z",
    "participants": [
      {
        "id": "gab",
        "type": "user"
      },
      {
        "id": "chloe",
        "type": "agent"
      }
    ]
  }
}
```

#### `GET /api/chat/chats/{chatId}`
Get details of a specific chat.

**Response:**
```json
{
  "chat": {
    "id": "uuid-format-chat-id",
    "type": "direct",
    "createdAt": "2023-07-20T15:30:45.123Z",
    "updatedAt": "2023-07-20T15:35:12.456Z",
    "status": "active",
    "participants": [
      {
        "id": "gab",
        "type": "user",
        "joinedAt": "2023-07-20T15:30:45.123Z"
      },
      {
        "id": "chloe",
        "type": "agent",
        "joinedAt": "2023-07-20T15:30:45.123Z"
      }
    ],
    "metadata": {
      "title": "Chat with chloe",
      "description": "Conversation between user gab and agent chloe"
    }
  }
}
```

#### `PUT /api/chat/chats/{chatId}`
Update a chat session.

**Request Body:**
```json
{
  "title": "Updated chat title",
  "description": "Updated description",
  "status": "archived",
  "metadata": {
    "customField": "value"
  }
}
```

**Response:**
```json
{
  "chat": {
    "id": "uuid-format-chat-id",
    "type": "direct",
    "createdAt": "2023-07-20T15:30:45.123Z",
    "updatedAt": "2023-07-20T15:40:22.789Z",
    "status": "archived",
    "participants": [
      {
        "id": "gab",
        "type": "user",
        "joinedAt": "2023-07-20T15:30:45.123Z"
      },
      {
        "id": "chloe",
        "type": "agent",
        "joinedAt": "2023-07-20T15:30:45.123Z"
      }
    ],
    "metadata": {
      "title": "Updated chat title",
      "description": "Updated description",
      "customField": "value"
    }
  }
}
```

#### `DELETE /api/chat/chats/{chatId}`
Delete a chat session.

**Query Parameters:**
- `archive=true` (optional): Archive the chat instead of deleting it

**Response:**
```json
{
  "success": true,
  "message": "Chat deleted successfully"
}
```

#### `GET /api/chat/chats/{chatId}/messages`
Get messages for a specific chat.

**Query Parameters:**
- `limit=50` (optional): Maximum number of messages to return
- `offset=0` (optional): Offset for pagination
- `includeInternal=false` (optional): Whether to include internal messages

**Response:**
```json
{
  "chatId": "uuid-format-chat-id",
  "messages": [
    {
      "id": "message-id",
      "content": "Hello, how can I help you?",
      "sender": "agent",
      "timestamp": "2023-07-20T15:30:45.123Z",
      "metadata": {}
    },
    {
      "id": "message-id",
      "content": "I have a question",
      "sender": "user",
      "timestamp": "2023-07-20T15:31:15.456Z",
      "metadata": {}
    }
  ],
  "totalCount": 2,
  "hasMore": false
}
```

## Chat ID System

The system now uses proper UUIDs for chat IDs instead of the previous format (`chat-userId-agentId`). This provides:

1. **Better Scalability**: UUIDs provide virtually unlimited unique identifiers
2. **Better Security**: IDs don't expose user or agent information
3. **Consistency**: Standard format for all IDs in the system

### Legacy Support

For backward compatibility, the system still recognizes legacy chat IDs in the format `chat-userId-agentId`. When a chat is created:

1. First checks if a legacy ID exists and returns it if found
2. If not found, generates a new UUID-based chat ID
3. Always includes the legacy ID format in metadata for reference

### Spawning New Chats

To start a completely new conversation (even with the same user and agent), use the `/api/chat/spawn` endpoint, which forces the creation of a new UUID. 