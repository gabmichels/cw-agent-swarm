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
export class ZohoWorkspaceProvider implements IWorkspaceProvider {
  readonly providerId = WorkspaceProvider.ZOHO;
  readonly supportedCapabilities = [
    WorkspaceCapabilityType.EMAIL_SEND,
    WorkspaceCapabilityType.EMAIL_READ,
    WorkspaceCapabilityType.DOCUMENT_READ,
    WorkspaceCapabilityType.DOCUMENT_CREATE,
    WorkspaceCapabilityType.DOCUMENT_EDIT,
    WorkspaceCapabilityType.CALENDAR_READ,
    WorkspaceCapabilityType.CALENDAR_CREATE,
    WorkspaceCapabilityType.CALENDAR_EDIT,
    WorkspaceCapabilityType.CALENDAR_DELETE,
    WorkspaceCapabilityType.SPREADSHEET_READ,
    WorkspaceCapabilityType.SPREADSHEET_CREATE,
    WorkspaceCapabilityType.SPREADSHEET_EDIT,
    WorkspaceCapabilityType.DRIVE_READ,
    WorkspaceCapabilityType.DRIVE_UPLOAD,
    WorkspaceCapabilityType.DRIVE_MANAGE
  ];

  constructor(
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string,
    private region: string = 'com' // Zoho region (com, eu, in, etc.)
  ) {}

  async getAuthUrl(state: string, scopes: string[]): Promise<string> {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.zoho.${this.region}/oauth/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<TokenResult> {
    const response = await axios.post(`https://accounts.zoho.${this.region}/oauth/v2/token`, {
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      code
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      scope: response.data.scope
    };
  }

  async getAuthenticatedClient(connectionId: string): Promise<AxiosInstance> {
    const connection = await this.getValidConnection(connectionId);
    
    return axios.create({
      baseURL: `https://mail.zoho.${this.region}`,
      headers: {
        'Authorization': `Zoho-oauthtoken ${connection.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }
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

### Phase 3: Agent Capability Integration (Current Focus)

**Objective**: Enable agents to interact with workspace data through natural language processing and structured permissions.

#### 3.1 Agent Workspace Permission System

**Permission Configuration UI**:
- Checkbox-based permission selection during agent creation/editing
- Multi-workspace support with clear visual separation
- Permission inheritance and conflict resolution
- Real-time permission validation and testing

**Agent Registration Integration**:
```typescript
// Enhanced agent creation form
export interface AgentWorkspaceConfig {
  enableWorkspaceIntegration: boolean;
  workspacePermissions: {
    connectionId: string;
    connectionName: string; // "Gmail - john@company.com"
    provider: WorkspaceProvider;
    permissions: {
      [WorkspaceCapabilityType.EMAIL_READ]: boolean;
      [WorkspaceCapabilityType.EMAIL_SEND]: boolean;
      [WorkspaceCapabilityType.CALENDAR_READ]: boolean;
      [WorkspaceCapabilityType.CALENDAR_CREATE]: boolean;
      [WorkspaceCapabilityType.CALENDAR_EDIT]: boolean;
      [WorkspaceCapabilityType.DRIVE_READ]: boolean;
      [WorkspaceCapabilityType.SPREADSHEET_CREATE]: boolean;
      [WorkspaceCapabilityType.SPREADSHEET_EDIT]: boolean;
    };
    restrictions?: {
      emailDomainWhitelist?: string[];
      calendarTimeRestrictions?: TimeRestriction[];
      drivePathRestrictions?: string[];
    };
  }[];
}

// Permission validation service
export interface AgentPermissionValidator {
  validatePermissions(agentId: string, capability: WorkspaceCapabilityType, connectionId: string): Promise<boolean>;
  getAgentWorkspaceCapabilities(agentId: string): Promise<AgentWorkspaceCapability[]>;
  checkRateLimit(agentId: string, capability: WorkspaceCapabilityType): Promise<RateLimitResult>;
}
```

#### 3.2 Natural Language Processing Integration

**Core NLP Workspace Tools**:
```typescript
// Agent tool definitions for workspace capabilities
export interface WorkspaceAgentTools {
  // Email capabilities
  readSpecificEmail: AgentTool<ReadEmailParams, EmailContent>;
  findImportantEmails: AgentTool<EmailQueryParams, Email[]>;
  replyToEmail: AgentTool<ReplyEmailParams, EmailResult>;
  forwardEmail: AgentTool<ForwardEmailParams, EmailResult>;
  createEmail: AgentTool<CreateEmailParams, EmailResult>;
  
  // Calendar capabilities  
  readCalendar: AgentTool<CalendarQueryParams, CalendarEvent[]>;
  findEvents: AgentTool<EventSearchParams, CalendarEvent[]>;
  scheduleEvent: AgentTool<CreateEventParams, CalendarEvent>;
  summarizeDay: AgentTool<DaySummaryParams, DaySummary>;
  findAvailability: AgentTool<AvailabilityParams, AvailabilitySlot[]>;
  editCalendarEntry: AgentTool<EditEventParams, CalendarEvent>;
  deleteCalendarEntry: AgentTool<DeleteEventParams, void>;
  
  // Google Sheets capabilities
  createSpreadsheet: AgentTool<CreateSpreadsheetParams, Spreadsheet>;
  editSpreadsheet: AgentTool<EditSpreadsheetParams, SpreadsheetResult>;
  readSpreadsheet: AgentTool<ReadSpreadsheetParams, SpreadsheetData>;
  
  // Google Drive capabilities
  findFiles: AgentTool<FileSearchParams, DriveFile[]>;
  uploadFile: AgentTool<UploadFileParams, DriveFile>;
  downloadFile: AgentTool<DownloadFileParams, FileContent>;
}

// Example tool implementations
export const readSpecificEmailTool: AgentTool<ReadEmailParams, EmailContent> = {
  name: "read_specific_email",
  description: "Read a specific email by ID or search criteria",
  parameters: {
    type: "object",
    properties: {
      emailId: { type: "string", description: "Email ID to read" },
      searchQuery: { type: "string", description: "Search query if no ID provided" },
      connectionId: { type: "string", description: "Workspace connection ID" }
    },
    required: ["connectionId"]
  },
  execute: async (params: ReadEmailParams, context: AgentContext) => {
    // Validate permissions
    await validateAgentPermission(context.agentId, WorkspaceCapabilityType.EMAIL_READ, params.connectionId);
    
    // Execute email read
    const emailService = getEmailService(params.connectionId);
    return await emailService.readEmail(params);
  }
};

export const scheduleEventTool: AgentTool<CreateEventParams, CalendarEvent> = {
  name: "schedule_event",
  description: "Schedule a calendar event with specified attendees",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Event title" },
      startTime: { type: "string", description: "Start time in ISO format" },
      endTime: { type: "string", description: "End time in ISO format" },
      attendees: { 
        type: "array", 
        items: { type: "string" },
        description: "Email addresses of attendees" 
      },
      description: { type: "string", description: "Event description" },
      connectionId: { type: "string", description: "Workspace connection ID" }
    },
    required: ["title", "startTime", "endTime", "connectionId"]
  },
  execute: async (params: CreateEventParams, context: AgentContext) => {
    // Validate permissions
    await validateAgentPermission(context.agentId, WorkspaceCapabilityType.CALENDAR_CREATE, params.connectionId);
    
    // Execute event creation
    const calendarService = getCalendarService(params.connectionId);
    return await calendarService.createEvent(params);
  }
};
```

#### 3.3 Example Use Cases & NLP Handling

**Use Case 1: "What is my schedule for tomorrow?"**
```typescript
// NLP Processing Flow
const scheduleQuery = {
  intent: "READ_CALENDAR",
  entities: {
    timeframe: "tomorrow",
    date: "2024-01-15"
  },
  tool: "readCalendar",
  params: {
    startDate: "2024-01-15T00:00:00Z",
    endDate: "2024-01-15T23:59:59Z",
    connectionId: "user-primary-calendar"
  }
};

// Agent Response Generation
const response = await agent.processWorkspaceQuery({
  query: "What is my schedule for tomorrow?",
  expectedTool: "readCalendar",
  responseTemplate: "Here's your schedule for tomorrow:\n{events_formatted}"
});
```

**Use Case 2: "Do I have time for a 30-min meeting tomorrow? If yes, schedule with test@email.com"**
```typescript
// Multi-step NLP Processing
const availabilityCheck = {
  step1: {
    intent: "CHECK_AVAILABILITY",
    tool: "findAvailability",
    params: {
      date: "2024-01-15",
      duration: 30,
      connectionId: "user-primary-calendar"
    }
  },
  step2: {
    intent: "SCHEDULE_EVENT",
    tool: "scheduleEvent",
    conditionalOn: "availability_found",
    params: {
      title: "Meeting",
      duration: 30,
      attendees: ["test@email.com"],
      connectionId: "user-primary-calendar"
    }
  }
};
```

**Use Case 3: "Do I have any important emails that require my attention?"**
```typescript
const importantEmailsQuery = {
  intent: "FIND_IMPORTANT_EMAILS",
  tool: "findImportantEmails",
  params: {
    filters: {
      unread: true,
      importance: "high",
      timeframe: "last_24_hours"
    },
    connectionId: "user-primary-email"
  }
};
```

**Use Case 4: "Create a Google Sheet for business expenses"**
```typescript
const createExpenseSheet = {
  intent: "CREATE_SPREADSHEET",
  tool: "createSpreadsheet",
  params: {
    title: "Business Expenses Tracker",
    headers: ["Date", "Description", "Category", "Amount", "Receipt"],
    template: "expense_tracking",
    connectionId: "user-primary-drive"
  }
};
```

#### 3.4 Comprehensive Capability Implementation

**Email Capabilities**:
```typescript
export interface EmailCapabilities {
  // Read operations
  readSpecificEmail(emailId: string, connectionId: string): Promise<EmailContent>;
  findImportantEmails(criteria: ImportanceFilter, connectionId: string): Promise<Email[]>;
  searchEmails(query: EmailSearchQuery, connectionId: string): Promise<Email[]>;
  
  // Write operations  
  replyToEmail(emailId: string, content: EmailContent, connectionId: string): Promise<EmailResult>;
  forwardEmail(emailId: string, recipients: string[], content: EmailContent, connectionId: string): Promise<EmailResult>;
  createEmail(params: CreateEmailParams, connectionId: string): Promise<EmailResult>;
  
  // Smart operations
  categorizeEmails(emails: Email[]): Promise<CategorizedEmails>;
  extractActionItems(emails: Email[]): Promise<ActionItem[]>;
  generateEmailSummary(emails: Email[]): Promise<EmailSummary>;
}

export interface ImportanceFilter {
  unread?: boolean;
  fromVIPs?: boolean;
  hasAttachments?: boolean;
  keywords?: string[];
  timeframe?: TimeRange;
  priority?: EmailPriority;
}
```

**Calendar Capabilities**:
```typescript
export interface CalendarCapabilities {
  // Read operations
  readCalendar(dateRange: DateRange, connectionId: string): Promise<CalendarEvent[]>;
  findEvents(searchCriteria: EventSearchCriteria, connectionId: string): Promise<CalendarEvent[]>;
  getEventDetails(eventId: string, connectionId: string): Promise<CalendarEventDetails>;
  
  // Availability operations
  findAvailability(params: AvailabilityParams, connectionId: string): Promise<AvailabilitySlot[]>;
  checkConflicts(proposedEvent: EventParams, connectionId: string): Promise<ConflictResult>;
  
  // Write operations
  scheduleEvent(params: CreateEventParams, connectionId: string): Promise<CalendarEvent>;
  editCalendarEntry(eventId: string, changes: EventChanges, connectionId: string): Promise<CalendarEvent>;
  deleteCalendarEntry(eventId: string, connectionId: string): Promise<void>;
  
  // Smart operations
  summarizeDay(date: string, connectionId: string): Promise<DaySummary>;
  generateMeetingAgenda(eventId: string, connectionId: string): Promise<MeetingAgenda>;
  suggestMeetingTimes(participants: string[], duration: number, preferences: SchedulingPreferences): Promise<TimeSlot[]>;
}

export interface DaySummary {
  date: string;
  totalEvents: number;
  totalDuration: number;
  eventsByType: Record<string, number>;
  busyHours: TimeSlot[];
  freeHours: TimeSlot[];
  upcomingDeadlines: CalendarEvent[];
  summary: string; // AI-generated summary
}
```

**Google Sheets Capabilities**:
```typescript
export interface SpreadsheetCapabilities {
  // Creation operations
  createSpreadsheet(params: CreateSpreadsheetParams, connectionId: string): Promise<Spreadsheet>;
  createFromTemplate(templateType: SpreadsheetTemplate, params: TemplateParams, connectionId: string): Promise<Spreadsheet>;
  
  // Read operations
  readSpreadsheet(spreadsheetId: string, range?: string, connectionId: string): Promise<SpreadsheetData>;
  searchSpreadsheets(query: SpreadsheetSearchQuery, connectionId: string): Promise<Spreadsheet[]>;
  
  // Edit operations
  editSpreadsheet(spreadsheetId: string, changes: SpreadsheetChanges, connectionId: string): Promise<SpreadsheetResult>;
  appendData(spreadsheetId: string, data: any[][], range?: string, connectionId: string): Promise<SpreadsheetResult>;
  
  // Smart operations
  analyzeData(spreadsheetId: string, analysisType: AnalysisType, connectionId: string): Promise<DataAnalysis>;
  generateCharts(spreadsheetId: string, chartConfig: ChartConfig, connectionId: string): Promise<Chart>;
}

export enum SpreadsheetTemplate {
  EXPENSE_TRACKER = "expense_tracker",
  PROJECT_TIMELINE = "project_timeline", 
  BUDGET_PLANNER = "budget_planner",
  INVENTORY_TRACKER = "inventory_tracker",
  CONTACT_LIST = "contact_list"
}
```

**Google Drive Capabilities**:
```typescript
export interface DriveCapabilities {
  // Search operations
  findFiles(query: FileSearchQuery, connectionId: string): Promise<DriveFile[]>;
  searchByContent(contentQuery: string, fileTypes: string[], connectionId: string): Promise<DriveFile[]>;
  
  // File operations
  uploadFile(params: UploadFileParams, connectionId: string): Promise<DriveFile>;
  downloadFile(fileId: string, connectionId: string): Promise<FileContent>;
  deleteFile(fileId: string, connectionId: string): Promise<void>;
  
  // Organization operations
  createFolder(name: string, parentId?: string, connectionId: string): Promise<DriveFolder>;
  moveFile(fileId: string, newParentId: string, connectionId: string): Promise<DriveFile>;
  shareFile(fileId: string, shareParams: ShareParams, connectionId: string): Promise<ShareResult>;
  
  // Smart operations
  organizeFiles(folderId: string, organizationRules: OrganizationRule[], connectionId: string): Promise<OrganizationResult>;
  generateFileIndex(folderId: string, connectionId: string): Promise<FileIndex>;
}
```

#### 3.5 Testing Strategy

**Unit Tests for Each Capability**:
```typescript
describe('Email Capabilities', () => {
  test('should read specific email with valid permissions', async () => {
    const emailContent = await emailCapabilities.readSpecificEmail('email-123', 'connection-456');
    expect(emailContent).toBeDefined();
    expect(emailContent.subject).toBeTruthy();
  });
  
  test('should find important unread emails', async () => {
    const importantEmails = await emailCapabilities.findImportantEmails({
      unread: true,
      priority: EmailPriority.HIGH
    }, 'connection-456');
    expect(importantEmails).toBeInstanceOf(Array);
  });
  
  test('should create and send email', async () => {
    const result = await emailCapabilities.createEmail({
      to: ['test@example.com'],
      subject: 'Test Email',
      body: 'This is a test email'
    }, 'connection-456');
    expect(result.success).toBe(true);
  });
});

describe('Calendar Capabilities', () => {
  test('should read calendar for specific date range', async () => {
    const events = await calendarCapabilities.readCalendar({
      start: '2024-01-15T00:00:00Z',
      end: '2024-01-15T23:59:59Z'
    }, 'connection-456');
    expect(events).toBeInstanceOf(Array);
  });
  
  test('should find availability for meeting scheduling', async () => {
    const availability = await calendarCapabilities.findAvailability({
      date: '2024-01-15',
      duration: 30,
      workingHours: { start: '09:00', end: '17:00' }
    }, 'connection-456');
    expect(availability).toBeInstanceOf(Array);
  });
  
  test('should schedule event with attendees', async () => {
    const event = await calendarCapabilities.scheduleEvent({
      title: 'Test Meeting',
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T10:30:00Z',
      attendees: ['test@example.com']
    }, 'connection-456');
    expect(event.id).toBeTruthy();
  });
});

describe('Spreadsheet Capabilities', () => {
  test('should create expense tracking spreadsheet', async () => {
    const spreadsheet = await spreadsheetCapabilities.createFromTemplate(
      SpreadsheetTemplate.EXPENSE_TRACKER,
      { title: 'Business Expenses 2024' },
      'connection-456'
    );
    expect(spreadsheet.id).toBeTruthy();
  });
  
  test('should read and analyze spreadsheet data', async () => {
    const analysis = await spreadsheetCapabilities.analyzeData(
      'spreadsheet-123',
      AnalysisType.FINANCIAL_SUMMARY,
      'connection-456'
    );
    expect(analysis.summary).toBeTruthy();
  });
});

describe('Drive Capabilities', () => {
  test('should find files by search query', async () => {
    const files = await driveCapabilities.findFiles({
      query: 'business expenses',
      fileType: 'spreadsheet'
    }, 'connection-456');
    expect(files).toBeInstanceOf(Array);
  });
  
  test('should upload and organize files', async () => {
    const file = await driveCapabilities.uploadFile({
      name: 'test-document.pdf',
      content: Buffer.from('test content'),
      parentFolderId: 'folder-123'
    }, 'connection-456');
    expect(file.id).toBeTruthy();
  });
});
```

#### 3.6 LLM Integration Architecture

**Response Generation System**:
```typescript
export interface WorkspaceLLMIntegration {
  // Email response generation
  generateEmailReply(originalEmail: Email, context: ConversationContext): Promise<EmailDraft>;
  generateEmailSummary(emails: Email[]): Promise<string>;
  
  // Calendar response generation  
  generateScheduleSummary(events: CalendarEvent[], date: string): Promise<string>;
  generateMeetingAgenda(event: CalendarEvent, context: MeetingContext): Promise<string>;
  
  // Document generation
  generateSpreadsheetStructure(purpose: string, requirements: string[]): Promise<SpreadsheetTemplate>;
  generateDocumentContent(type: DocumentType, specifications: DocumentSpecs): Promise<string>;
  
  // Smart suggestions
  suggestEmailActions(emails: Email[]): Promise<EmailAction[]>;
  suggestCalendarOptimizations(events: CalendarEvent[]): Promise<CalendarSuggestion[]>;
  suggestFileOrganization(files: DriveFile[]): Promise<OrganizationSuggestion[]>;
}

// Context-aware response generation
export interface ResponseGenerator {
  generateWorkspaceResponse(
    query: string,
    workspaceData: WorkspaceData,
    agentPersonality: AgentPersonality
  ): Promise<AgentResponse>;
  
  formatWorkspaceResults(
    results: WorkspaceOperationResult,
    responseFormat: ResponseFormat
  ): Promise<FormattedResponse>;
}
```

This expanded Phase 3 provides a comprehensive foundation for natural language workspace integration, with detailed implementations for all requested capabilities and robust testing strategies.

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
- **Zoho Workspace** - Complete implementation with Mail, Calendar, WorkDrive, and Sheet integration
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

## Zoho Workspace Implementation

### Overview
The Zoho Workspace provider offers comprehensive integration with Zoho's suite of productivity applications, including Zoho Mail, Calendar, WorkDrive, and Sheet. This implementation follows the same architectural patterns as Google Workspace but adapts to Zoho's specific API requirements and authentication mechanisms.

### Zoho Provider Architecture

```typescript
/**
 * Zoho Workspace Provider Implementation
 * Handles OAuth authentication and API client management for Zoho services
 */
export class ZohoWorkspaceProvider implements IWorkspaceProvider {
  readonly providerId = WorkspaceProvider.ZOHO;
  readonly supportedCapabilities = [
    WorkspaceCapabilityType.EMAIL_SEND,
    WorkspaceCapabilityType.EMAIL_READ,
    WorkspaceCapabilityType.DOCUMENT_READ,
    WorkspaceCapabilityType.DOCUMENT_CREATE,
    WorkspaceCapabilityType.DOCUMENT_EDIT,
    WorkspaceCapabilityType.CALENDAR_READ,
    WorkspaceCapabilityType.CALENDAR_CREATE,
    WorkspaceCapabilityType.CALENDAR_EDIT,
    WorkspaceCapabilityType.CALENDAR_DELETE,
    WorkspaceCapabilityType.SPREADSHEET_READ,
    WorkspaceCapabilityType.SPREADSHEET_CREATE,
    WorkspaceCapabilityType.SPREADSHEET_EDIT,
    WorkspaceCapabilityType.DRIVE_READ,
    WorkspaceCapabilityType.DRIVE_UPLOAD,
    WorkspaceCapabilityType.DRIVE_MANAGE
  ];

  constructor(
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string,
    private region: string = 'com' // Zoho region (com, eu, in, etc.)
  ) {}

  async getAuthUrl(state: string, scopes: string[]): Promise<string> {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.zoho.${this.region}/oauth/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<TokenResult> {
    const response = await axios.post(`https://accounts.zoho.${this.region}/oauth/v2/token`, {
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      code
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      scope: response.data.scope
    };
  }

  async getAuthenticatedClient(connectionId: string): Promise<AxiosInstance> {
    const connection = await this.getValidConnection(connectionId);
    
    return axios.create({
      baseURL: `https://mail.zoho.${this.region}`,
      headers: {
        'Authorization': `Zoho-oauthtoken ${connection.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }
}
```

### Zoho Email Capabilities

```typescript
/**
 * Zoho Mail Integration
 * Implements email reading and sending through Zoho Mail API
 */
export class ZohoEmailCapabilities extends EmailCapabilities {
  async sendEmail(params: SendEmailParams): Promise<EmailResult> {
    const client = await this.zohoProvider.getAuthenticatedClient(this.connectionId);
    
    const emailData = {
      fromAddress: params.from || await this.getDefaultFromAddress(client),
      toAddress: Array.isArray(params.to) ? params.to.join(',') : params.to,
      ccAddress: params.cc ? (Array.isArray(params.cc) ? params.cc.join(',') : params.cc) : undefined,
      bccAddress: params.bcc ? (Array.isArray(params.bcc) ? params.bcc.join(',') : params.bcc) : undefined,
      subject: params.subject,
      content: params.body || params.html || '',
      mailFormat: params.html ? 'html' : 'plaintext',
      askReceipt: params.requestReadReceipt ? 'yes' : 'no'
    };

    const response = await client.post('/mail/v1/accounts/primary/messages', emailData);
    
    if (response.data.status?.code === 200) {
      return {
        success: true,
        id: response.data.data?.messageId,
        message: 'Email sent successfully via Zoho Mail'
      };
    } else {
      throw new Error(response.data.status?.description || 'Failed to send email');
    }
  }

  async readEmails(query: EmailQuery): Promise<Email[]> {
    const client = await this.zohoProvider.getAuthenticatedClient(this.connectionId);
    
    const params: any = {
      limit: query.maxResults || 50,
      start: query.pageToken ? parseInt(query.pageToken) : 0
    };

    if (query.q) {
      params.searchKey = query.q;
    }

    if (query.labelIds && query.labelIds.length > 0) {
      const folderMap: Record<string, string> = {
        'INBOX': 'Inbox',
        'SENT': 'Sent',
        'DRAFT': 'Drafts',
        'SPAM': 'Spam',
        'TRASH': 'Trash'
      };
      params.folder = folderMap[query.labelIds[0]] || query.labelIds[0];
    }

    const response = await client.get('/mail/v1/accounts/primary/messages', { params });
    const messages = response.data.data || [];
    
    return Promise.all(
      messages.map(async (msg: any) => this.convertZohoMessageToEmail(client, msg))
    );
  }
}
```

### Zoho Calendar Integration

```typescript
/**
 * Zoho Calendar Integration
 * Manages calendar events through Zoho Calendar API
 */
export class ZohoCalendarCapabilities extends CalendarCapabilities {
  async getEvents(query: CalendarQuery): Promise<CalendarEvent[]> {
    const client = await this.getZohoCalendarClient();
    
    const params = {
      range: {
        start: query.timeMin,
        end: query.timeMax
      },
      maxResults: query.maxResults || 250
    };

    const response = await client.get('/calendar/v1/calendars/primary/events', { params });
    return response.data.events?.map(this.convertZohoEventToCalendarEvent) || [];
  }

  async createEvent(event: CalendarEventInput): Promise<CalendarEvent> {
    const client = await this.getZohoCalendarClient();
    
    const zohoEvent = {
      title: event.summary,
      description: event.description,
      start: {
        dateTime: event.start.dateTime,
        timeZone: event.start.timeZone || 'UTC'
      },
      end: {
        dateTime: event.end.dateTime,
        timeZone: event.end.timeZone || 'UTC'
      },
      participants: event.attendees?.map(attendee => ({
        email: attendee.email,
        name: attendee.displayName
      })) || []
    };

    const response = await client.post('/calendar/v1/calendars/primary/events', zohoEvent);
    return this.convertZohoEventToCalendarEvent(response.data);
  }

  private getZohoCalendarClient(): Promise<AxiosInstance> {
    return axios.create({
      baseURL: `https://calendar.zoho.${this.region}`,
      headers: {
        'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }
}
```

### Zoho WorkDrive Integration

```typescript
/**
 * Zoho WorkDrive Integration
 * Handles file operations through Zoho WorkDrive API
 */
export class ZohoDriveCapabilities extends DriveCapabilities {
  async searchFiles(query: DriveQuery): Promise<DriveFile[]> {
    const client = await this.getZohoWorkDriveClient();
    
    const params = {
      q: query.q,
      limit: query.maxResults || 100,
      offset: query.pageToken ? parseInt(query.pageToken) : 0
    };

    const response = await client.get('/workdrive/api/v1/files/search', { params });
    return response.data.data?.map(this.convertZohoFileToDriverFile) || [];
  }

  async createFile(params: CreateFileParams): Promise<DriveFile> {
    const client = await this.getZohoWorkDriveClient();
    
    const formData = new FormData();
    formData.append('filename', params.name);
    formData.append('content', params.content);
    formData.append('parent_id', params.parentId || 'root');

    const response = await client.post('/workdrive/api/v1/files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return this.convertZohoFileToDriverFile(response.data.data);
  }

  private getZohoWorkDriveClient(): Promise<AxiosInstance> {
    return axios.create({
      baseURL: `https://workdrive.zoho.${this.region}`,
      headers: {
        'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }
}
```

### Zoho Sheet Integration

```typescript
/**
 * Zoho Sheet Integration
 * Manages spreadsheets through Zoho Sheet API
 */
export class ZohoSheetsCapabilities extends SheetsCapabilities {
  async createSpreadsheet(params: CreateSpreadsheetParams): Promise<Spreadsheet> {
    const client = await this.getZohoSheetClient();
    
    const spreadsheetData = {
      spreadsheet_name: params.title,
      sheet_names: params.sheets?.map(sheet => sheet.properties?.title) || ['Sheet1']
    };

    const response = await client.post('/sheet/v2/spreadsheets', spreadsheetData);
    
    return {
      spreadsheetId: response.data.spreadsheet_id,
      properties: {
        title: params.title
      },
      sheets: response.data.sheets?.map((sheet: any) => ({
        properties: {
          sheetId: sheet.sheet_id,
          title: sheet.sheet_name,
          gridProperties: {
            rowCount: sheet.row_count || 1000,
            columnCount: sheet.column_count || 26
          }
        }
      })) || []
    };
  }

  async updateValues(params: UpdateValuesParams): Promise<UpdateValuesResult> {
    const client = await this.getZohoSheetClient();
    
    const [spreadsheetId, range] = params.range.split('!');
    const updateData = {
      values: params.values,
      range: range
    };

    const response = await client.put(
      `/sheet/v2/spreadsheets/${params.spreadsheetId}/data`,
      updateData
    );

    return {
      spreadsheetId: params.spreadsheetId,
      updatedRange: params.range,
      updatedRows: params.values.length,
      updatedColumns: Math.max(...params.values.map(row => row.length)),
      updatedCells: params.values.reduce((total, row) => total + row.length, 0)
    };
  }

  private getZohoSheetClient(): Promise<AxiosInstance> {
    return axios.create({
      baseURL: `https://sheet.zoho.${this.region}`,
      headers: {
        'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }
}
```

### Zoho OAuth Scopes

**⚠️ IMPORTANT: Scopes are now centrally managed in `src/services/workspace/scopes/WorkspaceScopes.ts`**

For the most up-to-date and authoritative list of scopes, see the centralized configuration file. This ensures consistency across all components and prevents scope mismatches.

```typescript
// Import the centralized scopes
import { getRequiredScopes, ZOHO_SCOPES } from '../services/workspace/scopes/WorkspaceScopes';

// Get all required scopes for Zoho
const zohoScopes = getRequiredScopes(WorkspaceProvider.ZOHO);

// Or access individual scope constants
const calendarAllScope = ZOHO_SCOPES.CALENDAR_ALL; // 'ZohoCalendar.calendar.ALL'
```

**Current Zoho Scopes (as of latest update):**
- ✅ `ZohoCalendar.calendar.ALL` - Full calendar management
- ✅ `ZohoCalendar.event.ALL` - Complete event operations  
- ✅ `ZohoCalendar.search.ALL` - Search functionality
- ✅ `ZohoCalendar.freebusy.ALL` - Availability checking
- ✅ `ZohoSheet.dataAPI.*` - All spreadsheet operations
- ✅ `WorkDrive.files.READ` + search scopes - File operations

**Legacy Documentation (DO NOT USE):**
The following function is deprecated and should not be used. It's kept here for reference only:

```typescript
// ❌ DEPRECATED - DO NOT USE
export function getRequiredZohoScopes(capabilities: WorkspaceCapabilityType[]): string[] {
  // This function is deprecated - use the centralized scopes instead
  console.warn('getRequiredZohoScopes is deprecated. Use getRequiredScopes from WorkspaceScopes.ts');
  return getRequiredScopes(WorkspaceProvider.ZOHO);
}
```