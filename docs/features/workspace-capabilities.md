# Workspace Capabilities Integration

## Overview

This document outlines the comprehensive system for integrating workspace capabilities into our agent ecosystem. The system enables agents to interact with Microsoft 365, Google Workspace, and Zoho platforms through both organizational and personal account connections, providing access to emails, documents, calendars, and cloud storage.

## Architecture Design

### Core Principles

Following the implementation guidelines:
- **Clean Break from Legacy**: New ULID-based identity system for workspace connections
- **Strict Type Safety**: All workspace data structures are properly typed
- **Modular Design**: Each workspace provider is implemented as a separate module
- **Interface-First**: Abstract interfaces define capabilities before implementation
- **Permission-Based Access**: Fine-grained permissions control agent access to workspace features

### System Components

```
Workspace Integration System
├── Authentication Layer (SSO/OAuth)
├── Provider Abstraction Layer
├── Permission Management System
├── Agent Capability Extension
├── Data Synchronization Layer
└── Audit & Security Layer
```

## Database Schema Extensions

### Workspace Connection Management

```sql
-- User workspace connections
model WorkspaceConnection {
  id                String              @id @default(cuid())
  userId            String?             // Optional: for personal connections
  organizationId    String?             // Optional: for org connections
  provider          WorkspaceProvider   
  accountType       WorkspaceAccountType
  connectionType    ConnectionType      // SSO, Personal, Service
  
  -- OAuth/Authentication
  accessToken       String              @db.Text
  refreshToken      String?             @db.Text
  tokenExpiresAt    DateTime?
  scopes            String[]            // Granted OAuth scopes
  
  -- Connection metadata  
  providerAccountId String              // External account ID
  displayName       String
  email             String
  domain            String?             // For org accounts
  
  -- Status and health
  status            ConnectionStatus    @default(ACTIVE)
  lastSyncAt        DateTime?
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  
  -- Relationships
  capabilities      WorkspaceCapability[]
  agentPermissions  AgentWorkspacePermission[]
  auditLogs         WorkspaceAuditLog[]
  
  @@unique([provider, providerAccountId])
  @@index([userId, provider])
  @@index([organizationId, provider])
}

-- Agent permissions for workspace access
model AgentWorkspacePermission {
  id                    String               @id @default(cuid())
  agentId               String
  workspaceConnectionId String
  capability            WorkspaceCapabilityType
  accessLevel           AccessLevel          @default(READ)
  restrictions          Json?                // Capability-specific restrictions
  
  -- Audit fields
  grantedBy             String               // User ID who granted permission
  grantedAt             DateTime             @default(now())
  revokedAt             DateTime?
  lastUsedAt            DateTime?
  
  -- Relationships
  workspaceConnection   WorkspaceConnection  @relation(fields: [workspaceConnectionId], references: [id], onDelete: Cascade)
  
  @@unique([agentId, workspaceConnectionId, capability])
  @@index([agentId])
}

-- Capability-specific configurations
model WorkspaceCapability {
  id                    String               @id @default(cuid())
  workspaceConnectionId String
  capabilityType        WorkspaceCapabilityType
  isEnabled             Boolean              @default(true)
  configuration         Json                 // Provider-specific config
  
  -- Rate limiting
  rateLimitPerHour      Int?
  rateLimitPerDay       Int?
  
  -- Relationships
  workspaceConnection   WorkspaceConnection  @relation(fields: [workspaceConnectionId], references: [id], onDelete: Cascade)
  
  @@unique([workspaceConnectionId, capabilityType])
}

-- Audit logging for compliance
model WorkspaceAuditLog {
  id                    String               @id @default(cuid())
  workspaceConnectionId String
  agentId               String?
  action                WorkspaceAction
  capability            WorkspaceCapabilityType
  resourceId            String?              // Email ID, Document ID, etc.
  result                ActionResult
  metadata              Json?
  timestamp             DateTime             @default(now())
  
  -- Relationships
  workspaceConnection   WorkspaceConnection  @relation(fields: [workspaceConnectionId], references: [id], onDelete: Cascade)
  
  @@index([workspaceConnectionId, timestamp])
  @@index([agentId, timestamp])
}

-- Enums
enum WorkspaceProvider {
  MICROSOFT_365
  GOOGLE_WORKSPACE  
  ZOHO
}

enum WorkspaceAccountType {
  ORGANIZATIONAL
  PERSONAL
}

enum ConnectionType {
  SSO
  OAUTH_PERSONAL
  SERVICE_ACCOUNT
}

enum ConnectionStatus {
  ACTIVE
  EXPIRED
  REVOKED
  ERROR
}

enum WorkspaceCapabilityType {
  EMAIL_SEND
  EMAIL_READ
  DOCUMENT_READ
  DOCUMENT_CREATE
  DOCUMENT_EDIT
  CALENDAR_READ
  CALENDAR_CREATE
  CALENDAR_EDIT
  DRIVE_READ
  DRIVE_UPLOAD
  DRIVE_MANAGE
  CONTACTS_READ
  CONTACTS_MANAGE
}

enum AccessLevel {
  NONE
  READ
  WRITE
  ADMIN
}

enum WorkspaceAction {
  CONNECT
  DISCONNECT
  ACCESS_GRANTED
  ACCESS_REVOKED
  EMAIL_SENT
  DOCUMENT_ACCESSED
  CALENDAR_ACCESSED
  DRIVE_ACCESSED
}

enum ActionResult {
  SUCCESS
  FAILURE
  UNAUTHORIZED
  RATE_LIMITED
}
```

## Provider Abstraction Layer

### Core Interfaces

```typescript
// Base workspace provider interface
export interface IWorkspaceProvider {
  readonly providerId: WorkspaceProvider;
  readonly supportedCapabilities: WorkspaceCapabilityType[];
  
  // Connection management
  initiateConnection(config: ConnectionConfig): Promise<ConnectionResult>;
  refreshConnection(connectionId: string): Promise<ConnectionResult>;
  validateConnection(connectionId: string): Promise<ValidationResult>;
  revokeConnection(connectionId: string): Promise<void>;
  
  // Capability factories
  createEmailCapability(connection: WorkspaceConnection): IEmailCapability;
  createDocumentCapability(connection: WorkspaceConnection): IDocumentCapability;
  createCalendarCapability(connection: WorkspaceConnection): ICalendarCapability;
  createDriveCapability(connection: WorkspaceConnection): IDriveCapability;
}

// Capability interfaces for future implementation
export interface IEmailCapability {
  sendEmail(params: SendEmailParams): Promise<EmailResult>;
  readEmails(query: EmailQuery): Promise<Email[]>;
  getEmail(emailId: string): Promise<Email>;
}

export interface IDocumentCapability {
  createDocument(params: CreateDocumentParams): Promise<Document>;
  readDocument(documentId: string): Promise<DocumentContent>;
  updateDocument(documentId: string, changes: DocumentChanges): Promise<Document>;
  listDocuments(query: DocumentQuery): Promise<Document[]>;
}

export interface ICalendarCapability {
  createEvent(params: CreateEventParams): Promise<CalendarEvent>;
  getEvents(query: EventQuery): Promise<CalendarEvent[]>;
  updateEvent(eventId: string, changes: EventChanges): Promise<CalendarEvent>;
  deleteEvent(eventId: string): Promise<void>;
}

export interface IDriveCapability {
  uploadFile(params: UploadFileParams): Promise<DriveFile>;
  downloadFile(fileId: string): Promise<FileContent>;
  listFiles(query: FileQuery): Promise<DriveFile[]>;
  deleteFile(fileId: string): Promise<void>;
}
```

### Provider Implementations

```typescript
// Microsoft 365 Provider
export class Microsoft365Provider implements IWorkspaceProvider {
  readonly providerId = WorkspaceProvider.MICROSOFT_365;
  readonly supportedCapabilities = [
    WorkspaceCapabilityType.EMAIL_SEND,
    WorkspaceCapabilityType.EMAIL_READ,
    WorkspaceCapabilityType.DOCUMENT_READ,
    WorkspaceCapabilityType.DOCUMENT_CREATE,
    WorkspaceCapabilityType.CALENDAR_READ,
    WorkspaceCapabilityType.DRIVE_READ,
    // ... more capabilities
  ];
  
  constructor(
    private readonly graphClient: GraphServiceClient,
    private readonly cryptoService: ICryptoService,
    private readonly auditLogger: IAuditLogger
  ) {}
  
  async initiateConnection(config: ConnectionConfig): Promise<ConnectionResult> {
    // Microsoft Graph OAuth flow implementation
    // Handle both organizational and personal accounts
  }
  
  // ... other methods
}

// Google Workspace Provider  
export class GoogleWorkspaceProvider implements IWorkspaceProvider {
  readonly providerId = WorkspaceProvider.GOOGLE_WORKSPACE;
  // ... implementation
}

// Zoho Provider
export class ZohoProvider implements IWorkspaceProvider {
  readonly providerId = WorkspaceProvider.ZOHO;
  // ... implementation
}
```

## Authentication & Security Layer

### SSO Integration Architecture

```typescript
export interface ISSOAuthService {
  // Organization SSO
  initiateOrgSSO(provider: WorkspaceProvider, orgDomain: string): Promise<SSOInitiationResult>;
  completeOrgSSO(ssoToken: string, state: string): Promise<WorkspaceConnection>;
  
  // Personal OAuth
  initiatePersonalOAuth(provider: WorkspaceProvider, scopes: string[]): Promise<OAuthInitiationResult>;
  completePersonalOAuth(authCode: string, state: string): Promise<WorkspaceConnection>;
  
  // Token management
  refreshTokens(connectionId: string): Promise<TokenRefreshResult>;
  revokeTokens(connectionId: string): Promise<void>;
}

export interface ISecurityService {
  // Encryption for stored tokens
  encryptTokens(tokens: TokenSet): Promise<EncryptedTokens>;
  decryptTokens(encryptedTokens: EncryptedTokens): Promise<TokenSet>;
  
  // Permission validation
  validateAgentPermission(
    agentId: string, 
    capability: WorkspaceCapabilityType,
    workspaceConnectionId: string
  ): Promise<PermissionValidationResult>;
  
  // Audit logging
  logWorkspaceAction(auditEntry: WorkspaceAuditEntry): Promise<void>;
}
```

## Agent Integration Layer

### Enhanced Agent Capability System

```typescript
// Extension of existing agent capability system
export interface IWorkspaceCapabilityAgent {
  // Workspace connection management
  getWorkspaceConnections(): Promise<WorkspaceConnection[]>;
  requestWorkspaceAccess(
    capability: WorkspaceCapabilityType,
    connectionId: string,
    justification: string
  ): Promise<AccessRequestResult>;
  
  // Capability usage (for future phases)
  sendEmail(connectionId: string, params: SendEmailParams): Promise<EmailResult>;
  readDocument(connectionId: string, documentId: string): Promise<DocumentContent>;
  createCalendarEvent(connectionId: string, params: CreateEventParams): Promise<CalendarEvent>;
  uploadFile(connectionId: string, params: UploadFileParams): Promise<DriveFile>;
}

// Agent workspace permission service
export class AgentWorkspacePermissionService {
  constructor(
    private readonly db: PrismaClient,
    private readonly auditLogger: IAuditLogger
  ) {}
  
  async grantPermission(params: GrantPermissionParams): Promise<AgentWorkspacePermission> {
    // Validate request
    // Create permission record
    // Log audit event
  }
  
  async revokePermission(permissionId: string, revokedBy: string): Promise<void> {
    // Update permission record
    // Log audit event
  }
  
  async checkPermission(
    agentId: string,
    capability: WorkspaceCapabilityType,
    connectionId: string
  ): Promise<boolean> {
    // Check active permissions
    // Validate connection status
    // Return permission status
  }
}
```

## User Interface Components

### Settings Integration

```typescript
// Extend Header component with workspace settings
export interface HeaderProps {
  // ... existing props
  onOpenWorkspaceSettings: () => void;
}

// New workspace settings modal
export interface WorkspaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionAdded: (connection: WorkspaceConnection) => void;
  onConnectionRemoved: (connectionId: string) => void;
}

// Workspace connection card component
export interface WorkspaceConnectionCardProps {
  connection: WorkspaceConnection;
  onDisconnect: () => void;
  onManagePermissions: () => void;
}

// Agent permission management component
export interface AgentPermissionManagerProps {
  agentId: string;
  workspaceConnections: WorkspaceConnection[];
  currentPermissions: AgentWorkspacePermission[];
  onPermissionChange: (permission: AgentWorkspacePermission) => void;
}
```

## Implementation Phases

### Phase 1: Foundation (Current Phase)
- Database schema implementation
- Provider abstraction layer
- Basic authentication infrastructure
- UI components for workspace connection management

### Phase 2: Core Workspace Integration
- Microsoft 365 provider implementation
- Google Workspace provider implementation  
- Zoho provider implementation
- SSO and OAuth flow implementation

### Phase 3: Agent Capability Integration
- Agent permission system integration
- Workspace capability exposure to agents
- Basic read-only operations (emails, documents, calendar viewing)

### Phase 4: Advanced Capabilities
- Email sending capabilities
- Document creation and editing
- Calendar management
- File upload and management

### Phase 5: Intelligence & Automation
- Smart workspace insights
- Automated workflow triggers
- Cross-platform data synchronization
- Advanced security and compliance features

## Required Infrastructure Advancements

### Database Enhancements
- **Current State**: Basic SQLite with Prisma
- **Required**: 
  - PostgreSQL migration for better JSON support and concurrent access
  - Encrypted fields for sensitive token storage
  - Advanced indexing for audit logs and permissions
  - Connection pooling for high-volume workspace operations

### Security Infrastructure
- **Token Encryption Service**: AES-256 encryption for stored OAuth tokens
- **Certificate Management**: SSL/TLS certificate handling for webhook endpoints
- **Rate Limiting Service**: Per-connection and per-agent rate limiting
- **Audit Compliance System**: SOC2/GDPR compliance features

### Monitoring & Observability
- **Connection Health Monitoring**: Automated token refresh and health checks
- **Performance Metrics**: API call latency and success rates per provider
- **Security Monitoring**: Unusual access pattern detection
- **Quota Management**: Usage tracking and limits per workspace connection

### Caching & Performance
- **Redis Integration**: Caching for frequently accessed workspace data
- **Connection Pooling**: Efficient management of provider API connections
- **Background Job System**: Async processing for bulk operations
- **CDN Integration**: Caching for document thumbnails and media

### Webhook Infrastructure
- **Webhook Receiver Service**: Real-time updates from workspace providers
- **Event Processing Queue**: Reliable processing of workspace events
- **Subscription Management**: Automated webhook subscription lifecycle

## Security Considerations

### Data Protection
- All OAuth tokens encrypted at rest using AES-256
- Workspace data cached temporarily with automatic expiration
- Zero-knowledge architecture for sensitive document content
- Regular security audits and penetration testing

### Access Control
- Principle of least privilege for agent permissions
- Time-limited access tokens with automatic renewal
- Multi-factor authentication for sensitive operations
- Administrative override capabilities for security incidents

### Compliance
- GDPR compliance for EU users
- SOC2 Type II certification requirements
- Industry-specific compliance (HIPAA, FINRA) as needed
- Regular compliance audits and reporting

## Integration Testing Strategy

### Unit Testing
- Provider interface implementations
- Authentication flow components
- Permission validation logic
- Encryption/decryption services

### Integration Testing  
- End-to-end OAuth flows for each provider
- Agent permission enforcement
- Cross-provider data consistency
- Error handling and recovery scenarios

### Security Testing
- Token encryption/decryption validation
- Permission boundary testing
- Rate limiting enforcement
- Audit log integrity verification

### Performance Testing
- Concurrent connection handling
- Large-scale data synchronization
- API rate limit compliance
- Database query optimization

## Migration & Deployment Strategy

### Development Environment
- Local development with mock workspace providers
- Docker containers for consistent testing environments
- Automated testing pipeline with security scans

### Staging Environment
- Production-like workspace provider integrations
- Full security and compliance testing
- Performance and load testing
- User acceptance testing

### Production Deployment
- Blue-green deployment strategy
- Feature flags for gradual rollout
- Real-time monitoring and alerting
- Rollback procedures for critical issues

## Future Extensibility

### Additional Providers
- Slack integration for team communication
- Notion integration for knowledge management
- Salesforce integration for CRM capabilities
- Custom API provider framework

### Advanced AI Capabilities
- Cross-platform content analysis
- Automated workflow suggestions
- Intelligent scheduling and coordination
- Predictive document and email management

### Enterprise Features
- Multi-tenant organization support
- Advanced reporting and analytics
- Custom compliance frameworks
- White-label deployment options

This comprehensive workspace capabilities system provides a solid foundation for integrating workspace platforms while maintaining security, scalability, and extensibility for future enhancements.

## Real-Time Event Processing Architecture

### Gmail Push Notifications

```typescript
// Gmail webhook configuration
export interface GmailWebhookConfig {
  topicName: string;        // Google Cloud Pub/Sub topic
  subscriptionName: string; // Subscription name
  webhookUrl: string;       // Our webhook endpoint
  historyId: string;        // Last processed history ID
}

// Gmail event processing
export interface GmailEventProcessor {
  processHistoryEvents(historyId: string, connection: WorkspaceConnection): Promise<void>;
  notifyAgentsOfNewEmails(emails: Email[], agentIds: string[]): Promise<void>;
  handleCalendarInvites(emails: Email[], connection: WorkspaceConnection): Promise<void>;
}
```

### Google Calendar Push Notifications

```typescript
// Calendar webhook configuration  
export interface CalendarWebhookConfig {
  channelId: string;        // Unique channel ID
  resourceId: string;       // Calendar resource ID
  webhookUrl: string;       // Our webhook endpoint
  expiration: number;       // Channel expiration timestamp
}

// Calendar event processing
export interface CalendarEventProcessor {
  processCalendarChanges(channelId: string, connection: WorkspaceConnection): Promise<void>;
  notifyAgentsOfCalendarEvents(events: CalendarEvent[], agentIds: string[]): Promise<void>;
  handleEventInvitations(events: CalendarEvent[], connection: WorkspaceConnection): Promise<void>;
}
```

### Agent Notification System

```typescript
// Agent notification queue
model AgentNotification {
  id              String               @id @default(cuid())
  agentId         String
  connectionId    String
  eventType       WorkspaceEventType
  eventData       Json                 // Event-specific data
  priority        NotificationPriority @default(NORMAL)
  status          NotificationStatus   @default(PENDING)
  
  // Processing metadata
  createdAt       DateTime             @default(now())
  processedAt     DateTime?
  failedAt        DateTime?
  retryCount      Int                  @default(0)
  errorMessage    String?
  
  // Relationships
  workspaceConnection WorkspaceConnection @relation(fields: [connectionId], references: [id])
  
  @@index([agentId, status])
  @@index([connectionId, eventType])
}

// Additional enums
enum WorkspaceEventType {
  NEW_EMAIL
  CALENDAR_INVITE
  CALENDAR_UPDATE
  CALENDAR_CANCELLATION
  EMAIL_REPLY_NEEDED
  MEETING_REMINDER
}

enum NotificationPriority {
  LOW
  NORMAL
  HIGH
  URGENT
}

enum NotificationStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}
```

### Background Job System

```typescript
// Background job for email checking
export interface EmailCheckJob {
  connectionId: string;
  lastCheckTime: Date;
  checkInterval: number; // minutes
  agentIds: string[];    // agents with permission
}

// Job processing service
export interface WorkspaceJobService {
  scheduleEmailCheck(connectionId: string, intervalMinutes: number): Promise<void>;
  scheduleCalendarSync(connectionId: string, intervalMinutes: number): Promise<void>;
  processNotificationQueue(): Promise<void>;
  cleanupExpiredTokens(): Promise<void>;
}
``` 