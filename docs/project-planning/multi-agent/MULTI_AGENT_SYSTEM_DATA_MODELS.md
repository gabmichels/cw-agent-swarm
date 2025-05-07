# Multi-Agent System Data Models

This document defines the core data models for the multi-agent system implementation, focusing on the Agent and Chat schemas with their relationships and memory integration.

## Agent Model

### Core Properties

```typescript
interface Agent {
  // Core identity
  id: StructuredId;
  name: string;
  description: string;
  
  // Creation and modification tracking
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // UserID or SystemID
  
  // Configuration
  capabilities: AgentCapability[];
  parameters: AgentParameters;
  
  // State
  status: AgentStatus;
  lastActive: Date;
  
  // Relationships
  chatIds: StructuredId[]; // Chats this agent is participating in
  teamIds: StructuredId[]; // Teams this agent belongs to
  
  // Metadata for vector search and filtering
  metadata: AgentMetadata;
}

enum AgentStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance'
}

interface AgentCapability {
  id: string;
  name: string;
  description: string;
  version: string;
  parameters?: Record<string, unknown>;
}

interface AgentParameters {
  model: string;
  temperature: number;
  maxTokens: number;
  tools: AgentTool[];
  customInstructions?: string;
  contextWindow?: number;
  systemMessages?: string[];
}

interface AgentTool {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  requiredPermissions: string[];
}

interface AgentMetadata {
  tags: string[];
  domain: string[];
  specialization: string[];
  performanceMetrics: {
    successRate: number;
    averageResponseTime: number;
    taskCompletionRate: number;
  };
  version: string;
  isPublic: boolean;
}
```

## Chat Model

### Core Properties

```typescript
interface Chat {
  // Core identity
  id: StructuredId;
  name: string;
  description?: string;
  
  // Creation and modification tracking
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // UserID or SystemID
  
  // Participants
  participants: ChatParticipant[];
  
  // Configuration
  settings: ChatSettings;
  
  // State
  status: ChatStatus;
  lastMessageAt: Date;
  messageCount: number;
  
  // Context and purpose
  purpose: string;
  contextIds: StructuredId[]; // Related contexts or resources
  
  // Metadata for vector search and filtering
  metadata: ChatMetadata;
}

interface ChatParticipant {
  id: string; // User or Agent ID
  type: 'user' | 'agent';
  role: ChatParticipantRole;
  joinedAt: Date;
  lastActiveAt: Date;
  permissions: ChatPermission[];
}

enum ChatParticipantRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  OBSERVER = 'observer'
}

enum ChatPermission {
  READ = 'read',
  WRITE = 'write',
  INVITE = 'invite',
  REMOVE = 'remove',
  MANAGE = 'manage'
}

enum ChatStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
  SCHEDULED = 'scheduled'
}

interface ChatSettings {
  visibility: 'public' | 'private' | 'restricted';
  allowAnonymousMessages: boolean;
  retentionPeriod?: number; // Days to retain messages
  enableBranching: boolean;
  recordTranscript: boolean;
  maxParticipants?: number;
}

interface ChatMetadata {
  tags: string[];
  category: string[];
  priority: 'low' | 'medium' | 'high';
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  language: string[];
  version: string;
}
```

## Message Model

### Core Properties

```typescript
interface Message {
  // Core identity
  id: StructuredId;
  chatId: StructuredId;
  
  // Creation tracking
  createdAt: Date;
  
  // Sender information
  senderId: string; // User or Agent ID
  senderType: 'user' | 'agent';
  
  // Content
  content: MessageContent;
  contentType: MessageContentType;
  
  // Threading and relationships
  parentId?: StructuredId; // For threaded replies
  referencedMessageIds?: StructuredId[]; // Messages referenced by this message
  
  // Delivery and receipt
  status: MessageStatus;
  deliveredTo: MessageReceipt[];
  
  // Metadata for search and filtering
  metadata: MessageMetadata;
}

interface MessageContent {
  text: string;
  attachments?: Attachment[];
  embeds?: Embed[];
  actions?: Action[];
}

enum MessageContentType {
  TEXT = 'text',
  MARKDOWN = 'markdown',
  HTML = 'html',
  COMMAND = 'command',
  SYSTEM = 'system'
}

enum MessageStatus {
  SENDING = 'sending',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

interface MessageReceipt {
  participantId: string;
  deliveredAt?: Date;
  readAt?: Date;
}

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

interface Embed {
  type: 'link' | 'image' | 'video' | 'code' | 'file';
  url?: string;
  content?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
}

interface Action {
  id: string;
  type: 'button' | 'select' | 'input';
  label: string;
  value?: string;
  style?: 'primary' | 'secondary' | 'danger';
  options?: { label: string; value: string }[];
}

interface MessageMetadata {
  tags: string[];
  importance: 'low' | 'normal' | 'high' | 'urgent';
  processingStatus: 'pending' | 'processed' | 'requires_action';
  sentiment?: 'positive' | 'neutral' | 'negative';
  languageCode?: string;
  version: string;
}
```

## Memory Integration

### Collection Definitions

The multi-agent system will utilize the following collections in the memory system:

1. **agents**: Store agent definitions and configurations
2. **chats**: Store chat metadata and participant information
3. **messages**: Store chat messages with relationships
4. **agent-state**: Store runtime state for active agents

### Memory Service Wrappers

```typescript
// Agent Memory Service
class AgentMemoryService {
  // CRUD operations
  async createAgent(agent: Agent): Promise<Agent>;
  async getAgentById(id: StructuredId): Promise<Agent | null>;
  async updateAgent(id: StructuredId, update: Partial<Agent>): Promise<Agent>;
  async deleteAgent(id: StructuredId): Promise<boolean>;
  
  // Query operations
  async findAgentsByCapability(capability: string): Promise<Agent[]>;
  async findAvailableAgents(): Promise<Agent[]>;
  async findAgentsByMetadata(metadata: Partial<AgentMetadata>): Promise<Agent[]>;
  
  // Specialized operations
  async getAgentPerformanceHistory(id: StructuredId): Promise<AgentPerformanceRecord[]>;
  async updateAgentCapabilities(id: StructuredId, capabilities: AgentCapability[]): Promise<Agent>;
  async getAgentsByTeam(teamId: StructuredId): Promise<Agent[]>;
}

// Chat Memory Service
class ChatMemoryService {
  // CRUD operations
  async createChat(chat: Chat): Promise<Chat>;
  async getChatById(id: StructuredId): Promise<Chat | null>;
  async updateChat(id: StructuredId, update: Partial<Chat>): Promise<Chat>;
  async deleteChat(id: StructuredId): Promise<boolean>;
  
  // Participant operations
  async addParticipant(chatId: StructuredId, participant: ChatParticipant): Promise<Chat>;
  async removeParticipant(chatId: StructuredId, participantId: string): Promise<Chat>;
  async updateParticipantRole(chatId: StructuredId, participantId: string, role: ChatParticipantRole): Promise<Chat>;
  
  // Query operations
  async findChatsByParticipant(participantId: string): Promise<Chat[]>;
  async findActiveChats(): Promise<Chat[]>;
  async findChatsByMetadata(metadata: Partial<ChatMetadata>): Promise<Chat[]>;
  
  // Message operations
  async addMessage(chatId: StructuredId, message: Message): Promise<Message>;
  async getMessages(chatId: StructuredId, options?: MessageQueryOptions): Promise<Message[]>;
  async getMessageById(messageId: StructuredId): Promise<Message | null>;
}

// Message Query Options
interface MessageQueryOptions {
  limit?: number;
  offset?: number;
  fromDate?: Date;
  toDate?: Date;
  senderId?: string;
  contentTypes?: MessageContentType[];
  includeMetadata?: boolean;
  sortDirection?: 'asc' | 'desc';
  threadedView?: boolean;
}
```

## Data Relationships

The relationships between data models can be visualized as follows:

```
Agent 1:N ChatParticipant N:1 Chat
Chat 1:N Message
Message N:1 Agent (as sender)
Agent N:N Team
```

## Vector Search and Embedding

Both Agent and Chat models will support vector search through embeddings:

1. **Agent Embeddings**: 
   - Based on capabilities, description, and specialization
   - Used for finding similar agents or capability-matching

2. **Chat Embeddings**:
   - Based on purpose, description, and recent messages
   - Used for finding similar conversations or context-aware routing

3. **Message Embeddings**:
   - Based on message content
   - Used for semantic search and related message discovery

## Migration Strategy

For implementing these data models, the following migration strategy will be used:

1. Create basic schemas with required fields
2. Implement memory service wrappers with CRUD operations
3. Add indexing for efficient queries
4. Implement vector search capabilities
5. Extend with advanced features (threading, branching, etc.)

## Schema Validation

All data models will include JSON schema validation to ensure data integrity before storage:

```typescript
const agentSchema = {
  type: 'object',
  required: ['id', 'name', 'capabilities', 'parameters', 'status'],
  properties: {
    id: { type: 'object' }, // StructuredId
    name: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', maxLength: 500 },
    // ...additional properties
  }
};

// Similar schemas for Chat and Message
```

## Performance Considerations

1. **Indexing**: Create appropriate indices for common query patterns
2. **Pagination**: Implement cursor-based pagination for large result sets
3. **Caching**: Cache frequently accessed agent definitions and active chats
4. **Lazy Loading**: Implement lazy loading for chat history and message content
5. **Batch Operations**: Use batch operations for multiple updates 