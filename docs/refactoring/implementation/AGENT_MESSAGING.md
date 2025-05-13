# Agent Messaging System and Capability Discovery

## Overview

The Agent Messaging System provides a secure, flexible communication framework for agent-to-agent messaging with support for different message types, security levels, and communication patterns. The system integrates with the capability discovery mechanism and permission system to create a comprehensive platform for inter-agent cooperation.

## Key Components

### 1. Agent Messaging System

The messaging system provides the core infrastructure for sending and receiving messages between agents:

- **Message Types**: Structured messages with various types (TEXT, COMMAND, REQUEST, RESPONSE, EVENT, ERROR)
- **Security Levels**: Controls message visibility (PUBLIC, PROTECTED, PRIVATE, ENCRYPTED)
- **Message Priority**: Support for different message priorities (URGENT, HIGH, NORMAL, LOW)
- **Request-Response Pattern**: First-class support for request-response workflows
- **Topic-based Messaging**: Subscription capabilities for pub/sub communication
- **Message Threading**: Support for threaded conversations

Implementation:
```typescript
export class DefaultAgentMessagingSystem extends AbstractBaseManager implements AgentMessagingSystem {
  // Core messaging capabilities
  async sendMessage(recipientId: string, type: MessageType, content: unknown, options?: SendMessageOptions): Promise<SendMessageResult>;
  async sendTextMessage(recipientId: string, text: string, options?: SendMessageOptions): Promise<SendMessageResult>;
  async sendRequestMessage(recipientId: string, requestType: string, params?: Record<string, unknown>, options?: SendMessageOptions): Promise<SendMessageResult>;
  
  // Message handling
  async registerHandler(filter: MessageFilter, handler: MessageHandler): Promise<string>;
  async getMessages(filter: MessageFilter, limit?: number): Promise<AgentMessage[]>;
  async subscribe(topic: string, filter?: MessageFilter): Promise<string>;
}
```

### 2. Secure Communication Channels

The secure channel system provides encryption and authentication for agent communications:

- **Security Levels**: Multiple encryption strengths (STANDARD, HIGH, MAXIMUM)
- **Authentication Methods**: Various auth options (SHARED_KEY, TOKEN, MULTI_FACTOR)
- **End-to-End Encryption**: Message content is encrypted between endpoints
- **Message Integrity**: Support for message signing and verification
- **Channel Lifecycle**: Channels can be created, initialized, used, and closed

Implementation:
```typescript
export class SecureChannel {
  // Channel setup
  async initialize(): Promise<boolean>;
  getChannelId(): string;
  getState(): ChannelState;
  
  // Messaging
  async sendMessage(payload: unknown, metadata?: Record<string, unknown>): Promise<string>;
  async receiveMessage(encryptedMessage: EncryptedMessage): Promise<ChannelMessage | null>;
  
  // Lifecycle
  async close(): Promise<void>;
  addEventListener(event: string, listener: ChannelEventListener): void;
}
```

### 3. Channel Manager

The channel manager handles creation and management of secure channels:

- **Channel Creation**: Create channels with specific security parameters
- **Channel Discovery**: Find channels to specific agents
- **Channel Selection**: Get the "best" channel based on security and recency
- **Channel Lifecycle**: Manage channel state and cleanup

Implementation:
```typescript
export class ChannelManager {
  // Channel management
  async createChannel(options: CreateChannelOptions): Promise<SecureChannel>;
  getChannel(channelId: string): SecureChannel | undefined;
  getBestChannelToAgent(remoteAgentId: string): SecureChannel | undefined;
  
  // Channel operations
  async closeChannel(channelId: string): Promise<boolean>;
  async closeAllChannelsToAgent(remoteAgentId: string): Promise<number>;
  getChannelStats(): { /* statistics */ };
}
```

### 4. Capability Discovery

The capability discovery system enables agents to discover and request access to each other's capabilities:

- **Capability Registry**: Agents register their capabilities with metadata
- **Capability Discovery**: Agents can discover capabilities from other agents
- **Access Control**: Fine-grained control over capability access
- **Request Workflow**: Structured workflow for requesting capability access
- **Grant Management**: Control and track capability grants

Implementation:
```typescript
export class CapabilityDiscovery {
  // Capability registration
  registerCapability(metadata: CapabilityMetadata, options?: { /* options */ }): string;
  getCapabilities(): CapabilityInstance[];
  
  // Discovery
  discoverCapabilities(fromAgentId: string, capabilities: AgentCapability[]): void;
  getDiscoveredCapabilities(options?: { /* filters */ }): AgentCapability[];
  
  // Access management
  requestCapability(capabilityId: string, accessMode: CapabilityAccessMode, options?: { /* options */ }): string;
  handleCapabilityRequest(request: CapabilityRequest): void;
  respondToRequest(requestId: string, approve: boolean, reason?: string, options?: { /* options */ }): boolean;
}
```

### 5. Permission System

The permission system provides a unified approach to managing access across different scopes:

- **Permission Scopes**: Various permission domains (MEMORY, CAPABILITY, MESSAGING, etc.)
- **Access Levels**: Granular control with multiple access levels (NONE, READ, LIMITED, FULL)
- **Rule-Based Evaluation**: Configurable rules for permission decisions
- **Request-Grant Workflow**: Structured workflow for permission requests
- **Constraint Support**: Ability to attach constraints to permissions

Implementation:
```typescript
export class AgentPermissionSystem {
  // Permission management
  grantPermission(targetAgentId: string, scope: PermissionScope, level: PermissionLevel, options?: { /* options */ }): Permission;
  revokePermission(permissionId: string): boolean;
  
  // Permission checking
  async hasPermission(ownerAgentId: string, scope: PermissionScope, level: PermissionLevel, options?: { /* options */ }): Promise<boolean>;
  
  // Rule management
  addRule(rule: PermissionRule): void;
  removeRule(ruleId: string): boolean;
  setRuleEnabled(ruleId: string, enabled: boolean): boolean;
}
```

## Usage Examples

### Basic Messaging

```typescript
// Setup
const messaging = new DefaultAgentMessagingSystem({ agentId: 'agent1' });

// Register handler
await messaging.registerHandler(
  { recipientId: 'agent1', type: MessageType.TEXT },
  async (message) => {
    console.log(`Received text: ${message.content}`);
  }
);

// Send message
await messaging.sendTextMessage(
  'agent2',
  'Hello from Agent 1!',
  { priority: MessagePriority.NORMAL }
);
```

### Request-Response Pattern

```typescript
// On the responder side
await agent2.messaging.registerHandler(
  { recipientId: 'agent2', type: MessageType.REQUEST },
  async (message) => {
    const content = message.content as any;
    if (content.requestType === 'calculate') {
      const result = performCalculation(content.params);
      await agent2.messaging.sendResponseMessage(
        message.senderId,
        message.id,
        true,
        { result }
      );
    }
  }
);

// On the requester side
const response = await agent1.messaging.sendRequestMessage(
  'agent2',
  'calculate',
  { operation: 'add', values: [1, 2, 3] }
);

console.log(`Result: ${response.message.content.data.result}`);
```

### Secure Channel Usage

```typescript
// Create and initialize channel
const channel = await agent1.channelManager.createChannel({
  remoteAgentId: 'agent2',
  securityLevel: ChannelSecurityLevel.HIGH,
  authMethod: ChannelAuthMethod.SHARED_KEY,
  authCredentials: { sharedSecret: 'secret-key' },
  autoInitialize: true
});

// Send encrypted message
const messageId = await channel.sendMessage({
  command: 'processData',
  data: [/* sensitive data */]
});
```

### Capability Discovery and Access

```typescript
// Register a capability
const capabilityId = agent1.capabilities.registerCapability({
  name: 'DataAnalysis',
  description: 'Analyzes complex datasets',
  type: CapabilityType.PROCESSING
});

// Discover capabilities
const capabilities = agent1.capabilities.getDiscoverableCapabilities();
agent2.capabilities.discoverCapabilities('agent1', capabilities);

// Request access
const requestId = agent2.capabilities.requestCapability(
  capabilityId,
  CapabilityAccessMode.EXECUTE,
  { reason: 'Need to analyze customer data' }
);

// Approve request
agent1.capabilities.respondToRequest(requestId, true);
```

### Permission Management

```typescript
// Grant permission
const permission = agent1.permissions.grantPermission(
  'agent2',
  PermissionScope.MEMORY,
  PermissionLevel.READ,
  { targetId: 'memoryScope123' }
);

// Check permission
const hasPermission = await agent2.permissions.hasPermission(
  'agent1',
  PermissionScope.MEMORY,
  PermissionLevel.READ,
  { targetId: 'memoryScope123' }
);

// Add custom rule
agent1.permissions.addRule({
  id: 'custom-rule',
  name: 'Special Access',
  description: 'Grants special access to trusted agents',
  priority: 100,
  enabled: true,
  evaluate: async (context) => {
    if (context.requestingAgentId === 'agent2' && 
        context.scope === PermissionScope.CAPABILITY) {
      return { allowed: true, final: true };
    }
    return { allowed: false, final: false };
  }
});
```

## Testing

The implementation includes a comprehensive test suite that verifies:

1. Basic message sending and receiving
2. Request-response pattern functionality
3. Secure channel encryption and authentication
4. Capability discovery and access control
5. Permission system rule evaluation
6. Integration between all components

Test examples:
```typescript
// Testing basic messaging
const result = await agent1.messaging.sendTextMessage(
  agent2.id,
  'Hello from Agent 1!'
);

// Testing secure channels
const channel = await agent1.channelManager.createChannel({
  remoteAgentId: agent2.id,
  securityLevel: ChannelSecurityLevel.HIGH,
  authMethod: ChannelAuthMethod.SHARED_KEY,
  authCredentials: { sharedSecret: 'test-secret-key' },
  autoInitialize: true
});

// Testing capability discovery
const capabilities = agent2.capabilities.getDiscoverableCapabilities();
agent1.capabilities.discoverCapabilities(agent2.id, capabilities);
```

## Security Considerations

1. **Data Encryption**: All sensitive messages are encrypted with appropriate strength algorithms
2. **Authentication**: Channels require proper authentication before use
3. **Message Integrity**: Message signing ensures messages haven't been tampered with
4. **Access Control**: Permissions and capability grants control what actions agents can perform
5. **Expiration**: Grants and permissions can expire to limit access duration
6. **Audit Logging**: All significant actions are logged for audit purposes

## Future Enhancements

1. **Performance Optimization**: Enhance message routing for large-scale agent systems
2. **Advanced Encryption**: Support for additional encryption algorithms and protocols
3. **Group Messaging**: Support for efficient group communication patterns
4. **Federation**: Enable messaging across different agent networks
5. **Compression**: Add message compression for large payloads
6. **Schema Validation**: Add runtime validation of message schemas
7. **Access delegation**: Allow temporary delegation of access rights 