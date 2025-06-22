/**
 * Microsoft Outlook Integration - Phase 2 Strategic Integration
 * 
 * Provides comprehensive email management capabilities through Microsoft Graph API
 * including sending emails, managing folders, calendar integration, and contact management.
 * 
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - ULID-based IDs for all entities
 * - Strict TypeScript interfaces
 * - Dependency injection pattern
 * - Comprehensive error handling
 * - Immutable data structures
 */

import { ulid } from 'ulid';
import { logger } from '../../../lib/logging';
import { 
  ExternalWorkflowError,
  WorkflowExecutionError,
  WorkflowValidationError,
  WorkflowConnectionError
} from '../errors/ExternalWorkflowErrors';

// ============================================================================
// Outlook Integration Interfaces
// ============================================================================

export interface OutlookConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly tenantId: string;
  readonly redirectUri: string;
  readonly scopes: readonly string[];
}

export interface OutlookEmailParams {
  readonly to: readonly string[];
  readonly cc?: readonly string[];
  readonly bcc?: readonly string[];
  readonly subject: string;
  readonly body: string;
  readonly bodyType: 'text' | 'html';
  readonly attachments?: readonly OutlookAttachment[];
  readonly importance: 'low' | 'normal' | 'high';
  readonly isDeliveryReceiptRequested?: boolean;
  readonly isReadReceiptRequested?: boolean;
  readonly categories?: readonly string[];
  readonly saveToSentItems?: boolean;
}

export interface OutlookAttachment {
  readonly name: string;
  readonly contentType: string;
  readonly contentBytes: string; // Base64 encoded
  readonly size: number;
  readonly isInline?: boolean;
  readonly contentId?: string;
}

export interface OutlookEmailResult {
  readonly success: boolean;
  readonly messageId?: string;
  readonly conversationId?: string;
  readonly internetMessageId?: string;
  readonly sentDateTime?: Date;
  readonly error?: string;
  readonly webLink?: string;
}

export interface OutlookFolder {
  readonly id: string;
  readonly displayName: string;
  readonly parentFolderId?: string;
  readonly childFolderCount: number;
  readonly unreadItemCount: number;
  readonly totalItemCount: number;
  readonly isHidden: boolean;
  readonly wellKnownName?: string;
}

export interface OutlookMessage {
  readonly id: string;
  readonly subject: string;
  readonly bodyPreview: string;
  readonly body: {
    readonly contentType: 'text' | 'html';
    readonly content: string;
  };
  readonly from: OutlookEmailAddress;
  readonly toRecipients: readonly OutlookEmailAddress[];
  readonly ccRecipients: readonly OutlookEmailAddress[];
  readonly bccRecipients: readonly OutlookEmailAddress[];
  readonly sentDateTime: Date;
  readonly receivedDateTime: Date;
  readonly hasAttachments: boolean;
  readonly importance: 'low' | 'normal' | 'high';
  readonly isRead: boolean;
  readonly isDraft: boolean;
  readonly conversationId: string;
  readonly internetMessageId: string;
  readonly categories: readonly string[];
  readonly webLink: string;
}

export interface OutlookEmailAddress {
  readonly name: string;
  readonly address: string;
}

export interface OutlookCalendarEvent {
  readonly id: string;
  readonly subject: string;
  readonly bodyPreview: string;
  readonly start: {
    readonly dateTime: Date;
    readonly timeZone: string;
  };
  readonly end: {
    readonly dateTime: Date;
    readonly timeZone: string;
  };
  readonly location?: {
    readonly displayName: string;
    readonly address?: string;
  };
  readonly attendees: readonly OutlookAttendee[];
  readonly organizer: OutlookEmailAddress;
  readonly isAllDay: boolean;
  readonly isCancelled: boolean;
  readonly importance: 'low' | 'normal' | 'high';
  readonly sensitivity: 'normal' | 'personal' | 'private' | 'confidential';
  readonly showAs: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  readonly recurrence?: OutlookRecurrence;
  readonly webLink: string;
}

export interface OutlookAttendee {
  readonly emailAddress: OutlookEmailAddress;
  readonly status: {
    readonly response: 'none' | 'organizer' | 'tentativelyAccepted' | 'accepted' | 'declined' | 'notResponded';
    readonly time?: Date;
  };
  readonly type: 'required' | 'optional' | 'resource';
}

export interface OutlookRecurrence {
  readonly pattern: {
    readonly type: 'daily' | 'weekly' | 'absoluteMonthly' | 'relativeMonthly' | 'absoluteYearly' | 'relativeYearly';
    readonly interval: number;
    readonly month?: number;
    readonly dayOfMonth?: number;
    readonly daysOfWeek?: readonly string[];
    readonly firstDayOfWeek?: string;
    readonly index?: 'first' | 'second' | 'third' | 'fourth' | 'last';
  };
  readonly range: {
    readonly type: 'endDate' | 'noEnd' | 'numbered';
    readonly startDate: Date;
    readonly endDate?: Date;
    readonly numberOfOccurrences?: number;
  };
}

export interface OutlookContact {
  readonly id: string;
  readonly displayName: string;
  readonly givenName?: string;
  readonly surname?: string;
  readonly emailAddresses: readonly OutlookEmailAddress[];
  readonly businessPhones: readonly string[];
  readonly homePhones: readonly string[];
  readonly mobilePhone?: string;
  readonly jobTitle?: string;
  readonly companyName?: string;
  readonly department?: string;
  readonly officeLocation?: string;
  readonly businessAddress?: OutlookAddress;
  readonly homeAddress?: OutlookAddress;
  readonly birthday?: Date;
  readonly categories: readonly string[];
}

export interface OutlookAddress {
  readonly street?: string;
  readonly city?: string;
  readonly state?: string;
  readonly countryOrRegion?: string;
  readonly postalCode?: string;
}

// ============================================================================
// Custom Error Types
// ============================================================================

export class OutlookIntegrationError extends ExternalWorkflowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'OUTLOOK_INTEGRATION_ERROR', context);
    this.name = 'OutlookIntegrationError';
  }
}

export class OutlookAuthenticationError extends OutlookIntegrationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(`Authentication failed: ${message}`, context);
    this.name = 'OutlookAuthenticationError';
  }
}

export class OutlookRateLimitError extends OutlookIntegrationError {
  constructor(retryAfter: number, context?: Record<string, unknown>) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds`, { ...context, retryAfter });
    this.name = 'OutlookRateLimitError';
  }
}

export class OutlookMailboxError extends OutlookIntegrationError {
  constructor(message: string, mailboxId?: string, context?: Record<string, unknown>) {
    super(`Mailbox error: ${message}`, { ...context, mailboxId });
    this.name = 'OutlookMailboxError';
  }
}

// ============================================================================
// Microsoft Outlook Integration Service
// ============================================================================

export class MicrosoftOutlookIntegration {
  private readonly baseUrl = 'https://graph.microsoft.com/v1.0';
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(
    private readonly config: OutlookConfig,
    private readonly httpClient: {
      get: (url: string, headers?: Record<string, string>) => Promise<any>;
      post: (url: string, data?: any, headers?: Record<string, string>) => Promise<any>;
      put: (url: string, data?: any, headers?: Record<string, string>) => Promise<any>;
      delete: (url: string, headers?: Record<string, string>) => Promise<any>;
    } = {
      get: async (url, headers) => {
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
      },
      post: async (url, data, headers) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: data ? JSON.stringify(data) : undefined
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
      },
      put: async (url, data, headers) => {
        const response = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: data ? JSON.stringify(data) : undefined
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
      },
      delete: async (url, headers) => {
        const response = await fetch(url, { method: 'DELETE', headers });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.ok;
      }
    }
  ) {
    this.validateConfig();
  }

  // ============================================================================
  // Authentication & Authorization
  // ============================================================================

  /**
   * Authenticate with Microsoft Graph API using client credentials flow
   */
  async authenticate(): Promise<boolean> {
    try {
      const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
      
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new OutlookAuthenticationError(
          `Token request failed: ${error.error_description || error.error}`,
          { statusCode: response.status, error }
        );
      }

      const tokenData = await response.json();
      this.accessToken = tokenData.access_token;
      this.tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      logger.info('Microsoft Outlook authentication successful', {
        integrationId: ulid(),
        expiresAt: this.tokenExpiresAt
      });

      return true;
    } catch (error) {
      logger.error('Microsoft Outlook authentication failed', { error });
      throw error instanceof OutlookAuthenticationError 
        ? error 
        : new OutlookAuthenticationError('Authentication process failed', { originalError: error });
    }
  }

  /**
   * Test connection to Microsoft Graph API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.ensureAuthenticated();
      
      const response = await this.httpClient.get(
        `${this.baseUrl}/me`,
        this.getAuthHeaders()
      );

      return response && response.id !== undefined;
    } catch (error) {
      logger.error('Outlook connection test failed', { error });
      return false;
    }
  }

  // ============================================================================
  // Email Operations
  // ============================================================================

  /**
   * Send an email through Outlook
   */
  async sendEmail(params: OutlookEmailParams): Promise<OutlookEmailResult> {
    try {
      await this.ensureAuthenticated();
      this.validateEmailParams(params);

      const message = this.buildEmailMessage(params);
      
      const response = await this.httpClient.post(
        `${this.baseUrl}/me/sendMail`,
        { message, saveToSentItems: params.saveToSentItems ?? true },
        this.getAuthHeaders()
      );

      const messageId = ulid();
      
      logger.info('Email sent successfully via Outlook', {
        messageId,
        subject: params.subject,
        recipientCount: params.to.length
      });

      return {
        success: true,
        messageId,
        sentDateTime: new Date()
      };
    } catch (error) {
      logger.error('Failed to send email via Outlook', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get inbox messages
   */
  async getInboxMessages(options: {
    readonly top?: number;
    readonly skip?: number;
    readonly filter?: string;
    readonly orderBy?: string;
    readonly select?: readonly string[];
  } = {}): Promise<readonly OutlookMessage[]> {
    try {
      await this.ensureAuthenticated();

      const queryParams = new URLSearchParams();
      if (options.top) queryParams.set('$top', options.top.toString());
      if (options.skip) queryParams.set('$skip', options.skip.toString());
      if (options.filter) queryParams.set('$filter', options.filter);
      if (options.orderBy) queryParams.set('$orderby', options.orderBy);
      if (options.select) queryParams.set('$select', options.select.join(','));

      const url = `${this.baseUrl}/me/mailFolders/inbox/messages?${queryParams.toString()}`;
      const response = await this.httpClient.get(url, this.getAuthHeaders());

      return response.value.map((msg: any) => this.mapToOutlookMessage(msg));
    } catch (error) {
      logger.error('Failed to get inbox messages', { error });
      throw new OutlookMailboxError('Failed to retrieve inbox messages', undefined, { originalError: error });
    }
  }

  /**
   * Get mail folders
   */
  async getMailFolders(): Promise<readonly OutlookFolder[]> {
    try {
      await this.ensureAuthenticated();

      const response = await this.httpClient.get(
        `${this.baseUrl}/me/mailFolders`,
        this.getAuthHeaders()
      );

      return response.value.map((folder: any) => this.mapToOutlookFolder(folder));
    } catch (error) {
      logger.error('Failed to get mail folders', { error });
      throw new OutlookMailboxError('Failed to retrieve mail folders', undefined, { originalError: error });
    }
  }

  // ============================================================================
  // Calendar Operations
  // ============================================================================

  /**
   * Create a calendar event
   */
  async createCalendarEvent(event: Omit<OutlookCalendarEvent, 'id' | 'webLink'>): Promise<OutlookCalendarEvent> {
    try {
      await this.ensureAuthenticated();

      const eventData = this.buildCalendarEventData(event);
      
      const response = await this.httpClient.post(
        `${this.baseUrl}/me/events`,
        eventData,
        this.getAuthHeaders()
      );

      logger.info('Calendar event created successfully', {
        eventId: response.id,
        subject: event.subject
      });

      return this.mapToOutlookCalendarEvent(response);
    } catch (error) {
      logger.error('Failed to create calendar event', { error, event });
      throw new OutlookIntegrationError('Failed to create calendar event', { originalError: error });
    }
  }

  /**
   * Get calendar events
   */
  async getCalendarEvents(options: {
    readonly startTime?: Date;
    readonly endTime?: Date;
    readonly top?: number;
    readonly filter?: string;
  } = {}): Promise<readonly OutlookCalendarEvent[]> {
    try {
      await this.ensureAuthenticated();

      const queryParams = new URLSearchParams();
      if (options.startTime) queryParams.set('startDateTime', options.startTime.toISOString());
      if (options.endTime) queryParams.set('endDateTime', options.endTime.toISOString());
      if (options.top) queryParams.set('$top', options.top.toString());
      if (options.filter) queryParams.set('$filter', options.filter);

      const url = `${this.baseUrl}/me/calendar/calendarView?${queryParams.toString()}`;
      const response = await this.httpClient.get(url, this.getAuthHeaders());

      return response.value.map((event: any) => this.mapToOutlookCalendarEvent(event));
    } catch (error) {
      logger.error('Failed to get calendar events', { error });
      throw new OutlookIntegrationError('Failed to retrieve calendar events', { originalError: error });
    }
  }

  // ============================================================================
  // Contact Operations
  // ============================================================================

  /**
   * Get contacts
   */
  async getContacts(options: {
    readonly top?: number;
    readonly skip?: number;
    readonly filter?: string;
    readonly orderBy?: string;
  } = {}): Promise<readonly OutlookContact[]> {
    try {
      await this.ensureAuthenticated();

      const queryParams = new URLSearchParams();
      if (options.top) queryParams.set('$top', options.top.toString());
      if (options.skip) queryParams.set('$skip', options.skip.toString());
      if (options.filter) queryParams.set('$filter', options.filter);
      if (options.orderBy) queryParams.set('$orderby', options.orderBy);

      const url = `${this.baseUrl}/me/contacts?${queryParams.toString()}`;
      const response = await this.httpClient.get(url, this.getAuthHeaders());

      return response.value.map((contact: any) => this.mapToOutlookContact(contact));
    } catch (error) {
      logger.error('Failed to get contacts', { error });
      throw new OutlookIntegrationError('Failed to retrieve contacts', { originalError: error });
    }
  }

  /**
   * Create a contact
   */
  async createContact(contact: Omit<OutlookContact, 'id'>): Promise<OutlookContact> {
    try {
      await this.ensureAuthenticated();

      const contactData = this.buildContactData(contact);
      
      const response = await this.httpClient.post(
        `${this.baseUrl}/me/contacts`,
        contactData,
        this.getAuthHeaders()
      );

      logger.info('Contact created successfully', {
        contactId: response.id,
        displayName: contact.displayName
      });

      return this.mapToOutlookContact(response);
    } catch (error) {
      logger.error('Failed to create contact', { error, contact });
      throw new OutlookIntegrationError('Failed to create contact', { originalError: error });
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private validateConfig(): void {
    const required = ['clientId', 'clientSecret', 'tenantId', 'redirectUri'];
    const missing = required.filter(key => !this.config[key as keyof OutlookConfig]);
    
    if (missing.length > 0) {
      throw new WorkflowValidationError(
        'outlook-config-validation',
        [`Missing required Outlook configuration: ${missing.join(', ')}`]
      );
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiresAt || this.tokenExpiresAt <= new Date()) {
      await this.authenticate();
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.accessToken) {
      throw new OutlookAuthenticationError('No access token available');
    }
    
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  private validateEmailParams(params: OutlookEmailParams): void {
    if (!params.to || params.to.length === 0) {
      throw new WorkflowValidationError('outlook-email-validation', ['Email must have at least one recipient']);
    }

    if (!params.subject?.trim()) {
      throw new WorkflowValidationError('outlook-email-validation', ['Email subject cannot be empty']);
    }

    if (!params.body?.trim()) {
      throw new WorkflowValidationError('outlook-email-validation', ['Email body cannot be empty']);
    }

    // Validate email addresses
    const allRecipients = [...params.to, ...(params.cc || []), ...(params.bcc || [])];
    for (const email of allRecipients) {
      if (!this.isValidEmail(email)) {
        throw new WorkflowValidationError('outlook-email-validation', [`Invalid email address: ${email}`]);
      }
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private buildEmailMessage(params: OutlookEmailParams): any {
    return {
      subject: params.subject,
      body: {
        contentType: params.bodyType,
        content: params.body
      },
      toRecipients: params.to.map(email => ({ emailAddress: { address: email } })),
      ccRecipients: params.cc?.map(email => ({ emailAddress: { address: email } })) || [],
      bccRecipients: params.bcc?.map(email => ({ emailAddress: { address: email } })) || [],
      importance: params.importance,
      isDeliveryReceiptRequested: params.isDeliveryReceiptRequested || false,
      isReadReceiptRequested: params.isReadReceiptRequested || false,
      categories: params.categories || [],
      attachments: params.attachments?.map(att => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.name,
        contentType: att.contentType,
        contentBytes: att.contentBytes,
        size: att.size,
        isInline: att.isInline || false,
        contentId: att.contentId
      })) || []
    };
  }

  private buildCalendarEventData(event: Omit<OutlookCalendarEvent, 'id' | 'webLink'>): any {
    return {
      subject: event.subject,
      body: {
        contentType: 'html',
        content: event.bodyPreview
      },
      start: {
        dateTime: event.start.dateTime.toISOString(),
        timeZone: event.start.timeZone
      },
      end: {
        dateTime: event.end.dateTime.toISOString(),
        timeZone: event.end.timeZone
      },
      location: event.location ? {
        displayName: event.location.displayName,
        address: event.location.address ? {
          street: event.location.address
        } : undefined
      } : undefined,
      attendees: event.attendees.map(att => ({
        emailAddress: {
          address: att.emailAddress.address,
          name: att.emailAddress.name
        },
        type: att.type
      })),
      isAllDay: event.isAllDay,
      importance: event.importance,
      sensitivity: event.sensitivity,
      showAs: event.showAs,
      recurrence: event.recurrence ? {
        pattern: event.recurrence.pattern,
        range: {
          type: event.recurrence.range.type,
          startDate: event.recurrence.range.startDate.toISOString().split('T')[0],
          endDate: event.recurrence.range.endDate?.toISOString().split('T')[0],
          numberOfOccurrences: event.recurrence.range.numberOfOccurrences
        }
      } : undefined
    };
  }

  private buildContactData(contact: Omit<OutlookContact, 'id'>): any {
    return {
      displayName: contact.displayName,
      givenName: contact.givenName,
      surname: contact.surname,
      emailAddresses: contact.emailAddresses.map(email => ({
        address: email.address,
        name: email.name
      })),
      businessPhones: contact.businessPhones,
      homePhones: contact.homePhones,
      mobilePhone: contact.mobilePhone,
      jobTitle: contact.jobTitle,
      companyName: contact.companyName,
      department: contact.department,
      officeLocation: contact.officeLocation,
      businessAddress: contact.businessAddress,
      homeAddress: contact.homeAddress,
      birthday: contact.birthday?.toISOString(),
      categories: contact.categories
    };
  }

  private mapToOutlookMessage(data: any): OutlookMessage {
    return {
      id: data.id,
      subject: data.subject || '',
      bodyPreview: data.bodyPreview || '',
      body: {
        contentType: data.body?.contentType || 'text',
        content: data.body?.content || ''
      },
      from: {
        name: data.from?.emailAddress?.name || '',
        address: data.from?.emailAddress?.address || ''
      },
      toRecipients: data.toRecipients?.map((r: any) => ({
        name: r.emailAddress?.name || '',
        address: r.emailAddress?.address || ''
      })) || [],
      ccRecipients: data.ccRecipients?.map((r: any) => ({
        name: r.emailAddress?.name || '',
        address: r.emailAddress?.address || ''
      })) || [],
      bccRecipients: data.bccRecipients?.map((r: any) => ({
        name: r.emailAddress?.name || '',
        address: r.emailAddress?.address || ''
      })) || [],
      sentDateTime: new Date(data.sentDateTime),
      receivedDateTime: new Date(data.receivedDateTime),
      hasAttachments: data.hasAttachments || false,
      importance: data.importance || 'normal',
      isRead: data.isRead || false,
      isDraft: data.isDraft || false,
      conversationId: data.conversationId || '',
      internetMessageId: data.internetMessageId || '',
      categories: data.categories || [],
      webLink: data.webLink || ''
    };
  }

  private mapToOutlookFolder(data: any): OutlookFolder {
    return {
      id: data.id,
      displayName: data.displayName,
      parentFolderId: data.parentFolderId,
      childFolderCount: data.childFolderCount || 0,
      unreadItemCount: data.unreadItemCount || 0,
      totalItemCount: data.totalItemCount || 0,
      isHidden: data.isHidden || false,
      wellKnownName: data.wellKnownName
    };
  }

  private mapToOutlookCalendarEvent(data: any): OutlookCalendarEvent {
    return {
      id: data.id,
      subject: data.subject || '',
      bodyPreview: data.bodyPreview || '',
      start: {
        dateTime: new Date(data.start.dateTime),
        timeZone: data.start.timeZone || 'UTC'
      },
      end: {
        dateTime: new Date(data.end.dateTime),
        timeZone: data.end.timeZone || 'UTC'
      },
      location: data.location ? {
        displayName: data.location.displayName || '',
        address: data.location.address?.street
      } : undefined,
      attendees: data.attendees?.map((att: any) => ({
        emailAddress: {
          name: att.emailAddress?.name || '',
          address: att.emailAddress?.address || ''
        },
        status: {
          response: att.status?.response || 'none',
          time: att.status?.time ? new Date(att.status.time) : undefined
        },
        type: att.type || 'required'
      })) || [],
      organizer: {
        name: data.organizer?.emailAddress?.name || '',
        address: data.organizer?.emailAddress?.address || ''
      },
      isAllDay: data.isAllDay || false,
      isCancelled: data.isCancelled || false,
      importance: data.importance || 'normal',
      sensitivity: data.sensitivity || 'normal',
      showAs: data.showAs || 'busy',
      recurrence: data.recurrence ? {
        pattern: data.recurrence.pattern,
        range: {
          type: data.recurrence.range.type,
          startDate: new Date(data.recurrence.range.startDate),
          endDate: data.recurrence.range.endDate ? new Date(data.recurrence.range.endDate) : undefined,
          numberOfOccurrences: data.recurrence.range.numberOfOccurrences
        }
      } : undefined,
      webLink: data.webLink || ''
    };
  }

  private mapToOutlookContact(data: any): OutlookContact {
    return {
      id: data.id,
      displayName: data.displayName || '',
      givenName: data.givenName,
      surname: data.surname,
      emailAddresses: data.emailAddresses?.map((email: any) => ({
        name: email.name || '',
        address: email.address || ''
      })) || [],
      businessPhones: data.businessPhones || [],
      homePhones: data.homePhones || [],
      mobilePhone: data.mobilePhone,
      jobTitle: data.jobTitle,
      companyName: data.companyName,
      department: data.department,
      officeLocation: data.officeLocation,
      businessAddress: data.businessAddress,
      homeAddress: data.homeAddress,
      birthday: data.birthday ? new Date(data.birthday) : undefined,
      categories: data.categories || []
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMicrosoftOutlookIntegration(config: OutlookConfig): MicrosoftOutlookIntegration {
  return new MicrosoftOutlookIntegration(config);
} 