/**
 * Common database types shared across all database providers
 */

// Enums from the schema
export enum WorkspaceProvider {
  MICROSOFT_365 = "MICROSOFT_365",
  GOOGLE_WORKSPACE = "GOOGLE_WORKSPACE",
  ZOHO = "ZOHO"
}

export enum WorkspaceAccountType {
  ORGANIZATIONAL = "ORGANIZATIONAL",
  PERSONAL = "PERSONAL"
}

export enum ConnectionType {
  SSO = "SSO",
  OAUTH_PERSONAL = "OAUTH_PERSONAL",
  SERVICE_ACCOUNT = "SERVICE_ACCOUNT"
}

export enum ConnectionStatus {
  ACTIVE = "ACTIVE",
  EXPIRED = "EXPIRED",
  REVOKED = "REVOKED",
  ERROR = "ERROR"
}

export enum WorkspaceCapabilityType {
  EMAIL_SEND = "EMAIL_SEND",
  EMAIL_READ = "EMAIL_READ",
  DOCUMENT_READ = "DOCUMENT_READ",
  DOCUMENT_CREATE = "DOCUMENT_CREATE",
  DOCUMENT_EDIT = "DOCUMENT_EDIT",
  CALENDAR_READ = "CALENDAR_READ",
  CALENDAR_CREATE = "CALENDAR_CREATE",
  CALENDAR_EDIT = "CALENDAR_EDIT",
  CALENDAR_DELETE = "CALENDAR_DELETE",
  DRIVE_READ = "DRIVE_READ",
  DRIVE_UPLOAD = "DRIVE_UPLOAD",
  DRIVE_MANAGE = "DRIVE_MANAGE",
  CONTACTS_READ = "CONTACTS_READ",
  CONTACTS_MANAGE = "CONTACTS_MANAGE",
  SPREADSHEET_READ = "SPREADSHEET_READ",
  SPREADSHEET_CREATE = "SPREADSHEET_CREATE",
  SPREADSHEET_EDIT = "SPREADSHEET_EDIT",
  SPREADSHEET_DELETE = "SPREADSHEET_DELETE"
}

export enum AccessLevel {
  NONE = "NONE",
  READ = "READ",
  WRITE = "WRITE",
  ADMIN = "ADMIN"
}

export enum WorkspaceAction {
  CONNECT = "CONNECT",
  DISCONNECT = "DISCONNECT",
  ACCESS_GRANTED = "ACCESS_GRANTED",
  ACCESS_REVOKED = "ACCESS_REVOKED",
  EMAIL_SENT = "EMAIL_SENT",
  DOCUMENT_ACCESSED = "DOCUMENT_ACCESSED",
  CALENDAR_ACCESSED = "CALENDAR_ACCESSED",
  DRIVE_ACCESSED = "DRIVE_ACCESSED"
}

export enum ActionResult {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
  UNAUTHORIZED = "UNAUTHORIZED",
  RATE_LIMITED = "RATE_LIMITED"
}

// Event types for notifications
export enum WorkspaceEventType {
  NEW_EMAIL = "NEW_EMAIL",
  CALENDAR_INVITE = "CALENDAR_INVITE",
  CALENDAR_UPDATE = "CALENDAR_UPDATE",
  CALENDAR_CANCELLATION = "CALENDAR_CANCELLATION",
  EMAIL_REPLY_NEEDED = "EMAIL_REPLY_NEEDED",
  MEETING_REMINDER = "MEETING_REMINDER"
}

export enum NotificationPriority {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  URGENT = "URGENT"
}

export enum NotificationStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED"
}

// Common data types
export interface WorkspaceConnection {
  id: string;
  userId?: string;
  organizationId?: string;
  provider: WorkspaceProvider;
  accountType: WorkspaceAccountType;
  connectionType: ConnectionType;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  scopes: string;
  providerAccountId: string;
  displayName: string;
  email: string;
  domain?: string;
  status: ConnectionStatus;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentWorkspacePermission {
  id: string;
  agentId: string;
  workspaceConnectionId: string;
  capability: WorkspaceCapabilityType;
  accessLevel: AccessLevel;
  restrictions?: any;
  grantedBy: string;
  grantedAt: Date;
  revokedAt?: Date;
  lastUsedAt?: Date;
}

export interface WorkspaceAuditLog {
  id: string;
  workspaceConnectionId: string;
  agentId?: string;
  action: WorkspaceAction;
  capability: WorkspaceCapabilityType;
  resourceId?: string;
  result: ActionResult;
  metadata?: any;
  timestamp: Date;
}

export interface AgentNotification {
  id: string;
  agentId: string;
  connectionId: string;
  eventType: WorkspaceEventType;
  eventData: any;
  priority: NotificationPriority;
  status: NotificationStatus;
  createdAt: Date;
  processedAt?: Date;
  failedAt?: Date;
  retryCount: number;
  errorMessage?: string;
}

// Input types for database operations
export interface WorkspaceConnectionCreateInput {
  userId?: string;
  organizationId?: string;
  provider: WorkspaceProvider;
  accountType: WorkspaceAccountType;
  connectionType: ConnectionType;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  scopes: string;
  providerAccountId: string;
  displayName: string;
  email: string;
  domain?: string;
  status?: ConnectionStatus;
}

export interface WorkspaceConnectionUpdateInput {
  userId?: string;
  organizationId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  scopes?: string;
  displayName?: string;
  status?: ConnectionStatus;
  lastSyncAt?: Date;
}

export interface WorkspaceConnectionQuery {
  userId?: string;
  organizationId?: string;
  provider?: WorkspaceProvider;
  email?: string;
  domain?: string;
  status?: ConnectionStatus;
}

export interface AgentWorkspacePermissionCreateInput {
  agentId: string;
  workspaceConnectionId: string;
  capability: WorkspaceCapabilityType;
  accessLevel: AccessLevel;
  restrictions?: any;
  grantedBy: string;
}

export interface AgentWorkspacePermissionUpdateInput {
  accessLevel?: AccessLevel;
  restrictions?: any;
  revokedAt?: Date;
  lastUsedAt?: Date;
}

export interface AgentWorkspacePermissionQuery {
  agentId?: string;
  workspaceConnectionId?: string;
  capability?: WorkspaceCapabilityType;
  accessLevel?: AccessLevel;
}

export interface WorkspaceAuditLogCreateInput {
  workspaceConnectionId: string;
  agentId?: string;
  action: WorkspaceAction;
  capability: WorkspaceCapabilityType;
  resourceId?: string;
  result: ActionResult;
  metadata?: any;
}

export interface WorkspaceAuditLogQuery {
  workspaceConnectionId?: string;
  agentId?: string;
  action?: WorkspaceAction;
  capability?: WorkspaceCapabilityType;
  result?: ActionResult;
  fromTimestamp?: Date;
  toTimestamp?: Date;
}

export interface AgentNotificationCreateInput {
  agentId: string;
  connectionId: string;
  eventType: WorkspaceEventType;
  eventData: any;
  priority?: NotificationPriority;
}

export interface AgentNotificationQuery {
  agentId?: string;
  connectionId?: string;
  eventType?: WorkspaceEventType;
  status?: NotificationStatus;
  priority?: NotificationPriority;
}
