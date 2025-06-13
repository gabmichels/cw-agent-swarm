/**
 * Core interfaces for workspace provider capabilities
 */

import { 
  WorkspaceProvider, 
  WorkspaceCapabilityType, 
  WorkspaceConnection,
  ConnectionStatus
} from './types';

/**
 * Configuration for initiating a new workspace connection
 */
export interface ConnectionConfig {
  userId?: string;
  organizationId?: string;
  accountType: 'ORGANIZATIONAL' | 'PERSONAL';
  connectionType: 'SSO' | 'OAUTH_PERSONAL' | 'SERVICE_ACCOUNT';
  scopes: string[];
  redirectUri: string;
  state: string;
}

/**
 * Result of a connection request
 */
export interface ConnectionResult {
  success: boolean;
  connectionId?: string;
  authUrl?: string;
  error?: string;
}

/**
 * Result of validating a connection
 */
export interface ValidationResult {
  isValid: boolean;
  status: ConnectionStatus;
  expiresAt?: Date;
  error?: string;
}

/**
 * Token refresh result
 */
export interface TokenRefreshResult {
  success: boolean;
  newExpiresAt?: Date;
  error?: string;
}

// Email capability types
export interface SendEmailParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
}

export interface EmailQuery {
  folder?: string;
  query?: string;
  from?: Date;
  to?: Date;
  read?: boolean;
  limit?: number;
  skip?: number;
}

export interface Email {
  id: string;
  conversationId?: string;
  threadId?: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
  bodyPreview?: string;
  isHtml?: boolean;
  isRead: boolean;
  importance: 'LOW' | 'NORMAL' | 'HIGH';
  receivedAt: Date;
  attachments?: EmailAttachment[];
  hasAttachments: boolean;
}

export interface EmailAddress {
  name?: string;
  address: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Calendar capability types
export interface CreateEventParams {
  subject: string;
  body?: string;
  isBodyHtml?: boolean;
  start: Date;
  end: Date;
  location?: string;
  attendees?: EventAttendee[];
  isAllDay?: boolean;
  recurrence?: RecurrencePattern;
  reminderMinutesBefore?: number;
}

export interface EventAttendee {
  name?: string;
  email: string;
  required?: boolean;
}

export interface RecurrencePattern {
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  daysOfWeek?: string[];
  dayOfMonth?: number;
  endAfterOccurrences?: number;
  endDate?: Date;
}

export interface EventQuery {
  calendarId?: string;
  from?: Date;
  to?: Date;
  query?: string;
  limit?: number;
  skip?: number;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  subject: string;
  body?: string;
  isBodyHtml?: boolean;
  start: Date;
  end: Date;
  location?: string;
  attendees: EventAttendee[];
  organizer: EventAttendee;
  isAllDay: boolean;
  recurrence?: RecurrencePattern;
  status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  responseStatus?: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'NOT_RESPONDED';
}

export interface EventChanges {
  subject?: string;
  body?: string;
  isBodyHtml?: boolean;
  start?: Date;
  end?: Date;
  location?: string;
  attendees?: EventAttendee[];
  isAllDay?: boolean;
  recurrence?: RecurrencePattern;
  reminderMinutesBefore?: number;
}

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
  createCalendarCapability(connection: WorkspaceConnection): ICalendarCapability;
}

// Capability interfaces
export interface IEmailCapability {
  sendEmail(params: SendEmailParams): Promise<EmailResult>;
  readEmails(query: EmailQuery): Promise<Email[]>;
  getEmail(emailId: string): Promise<Email>;
  
  // Webhook subscription management for real-time updates
  subscribeToEmailUpdates(callbackUrl: string): Promise<SubscriptionResult>;
  unsubscribeFromEmailUpdates(subscriptionId: string): Promise<boolean>;
}

export interface ICalendarCapability {
  createEvent(params: CreateEventParams): Promise<CalendarEvent>;
  getEvents(query: EventQuery): Promise<CalendarEvent[]>;
  updateEvent(eventId: string, changes: EventChanges): Promise<CalendarEvent>;
  deleteEvent(eventId: string): Promise<void>;
  
  // Webhook subscription management for real-time updates
  subscribeToCalendarUpdates(calendarId: string, callbackUrl: string): Promise<SubscriptionResult>;
  unsubscribeFromCalendarUpdates(subscriptionId: string): Promise<boolean>;
}

// Webhook subscription types
export interface SubscriptionResult {
  id: string;
  resourceId?: string; // Different providers use different formats
  expirationTime: Date;
  success: boolean;
  error?: string;
}

// Authentication service interface
export interface IAuthService {
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

export interface SSOInitiationResult {
  authUrl: string;
  state: string;
  error?: string;
}

export interface OAuthInitiationResult {
  authUrl: string;
  state: string;
  error?: string;
}

// Security service interface
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

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: Date;
}

export interface EncryptedTokens {
  encryptedAccessToken: string;
  encryptedRefreshToken?: string;
  encryptedIdToken?: string;
  expiresAt?: Date;
  iv: string;
}

export interface PermissionValidationResult {
  isValid: boolean;
  accessLevel: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
  restrictions?: any;
  error?: string;
}

export interface WorkspaceAuditEntry {
  workspaceConnectionId: string;
  agentId?: string;
  action: string;
  capability: WorkspaceCapabilityType;
  resourceId?: string;
  result: 'SUCCESS' | 'FAILURE' | 'UNAUTHORIZED' | 'RATE_LIMITED';
  metadata?: any;
}
