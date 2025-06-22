/**
 * Microsoft Teams Integration - Phase 2 Strategic Integration
 * 
 * Provides comprehensive Microsoft Teams functionality including messaging,
 * channel management, meeting creation, and team collaboration features.
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
// Teams Integration Interfaces
// ============================================================================

export interface TeamsConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly tenantId: string;
  readonly redirectUri: string;
  readonly scopes: readonly string[];
}

export interface TeamsMessageParams {
  readonly channelId: string;
  readonly teamId: string;
  readonly content: string;
  readonly contentType: 'text' | 'html';
  readonly mentions?: readonly TeamsMention[];
  readonly attachments?: readonly TeamsAttachment[];
  readonly importance: 'normal' | 'high' | 'urgent';
  readonly subject?: string;
  readonly replyToId?: string;
}

export interface TeamsMention {
  readonly id: string;
  readonly mentionText: string;
  readonly mentioned: {
    readonly user?: {
      readonly displayName: string;
      readonly id: string;
      readonly userIdentityType: 'aadUser' | 'onPremiseAadUser' | 'anonymousGuest' | 'federatedUser';
    };
    readonly conversation?: {
      readonly id: string;
      readonly displayName: string;
      readonly conversationIdentityType: 'team' | 'channel';
    };
  };
}

export interface TeamsAttachment {
  readonly id: string;
  readonly contentType: string;
  readonly contentUrl?: string;
  readonly content?: any;
  readonly name?: string;
  readonly thumbnailUrl?: string;
}

export interface TeamsMessageResult {
  readonly success: boolean;
  readonly messageId?: string;
  readonly channelId?: string;
  readonly teamId?: string;
  readonly createdDateTime?: Date;
  readonly webUrl?: string;
  readonly error?: string;
}

export interface TeamsChannel {
  readonly id: string;
  readonly displayName: string;
  readonly description?: string;
  readonly email?: string;
  readonly webUrl: string;
  readonly membershipType: 'standard' | 'private' | 'unknownFutureValue';
  readonly moderationSettings?: {
    readonly userNewMessageRestriction: 'everyone' | 'everyoneExceptGuests' | 'moderators' | 'unknownFutureValue';
    readonly replyRestriction: 'everyone' | 'everyoneExceptGuests' | 'moderators' | 'unknownFutureValue';
    readonly allowNewMessageFromBots: boolean;
    readonly allowNewMessageFromConnectors: boolean;
  };
  readonly createdDateTime: Date;
}

export interface TeamsTeam {
  readonly id: string;
  readonly displayName: string;
  readonly description?: string;
  readonly internalId: string;
  readonly classification?: string;
  readonly specialization: 'none' | 'educationStandard' | 'educationClass' | 'educationProfessionalLearningCommunity' | 'educationStaff' | 'unknownFutureValue';
  readonly visibility: 'private' | 'public' | 'hiddenMembership' | 'unknownFutureValue';
  readonly webUrl: string;
  readonly isArchived: boolean;
  readonly isMembershipLimitedToOwners: boolean;
  readonly memberSettings: {
    readonly allowCreateUpdateChannels: boolean;
    readonly allowCreatePrivateChannels: boolean;
    readonly allowDeleteChannels: boolean;
    readonly allowAddRemoveApps: boolean;
    readonly allowCreateUpdateRemoveTabs: boolean;
    readonly allowCreateUpdateRemoveConnectors: boolean;
  };
  readonly guestSettings: {
    readonly allowCreateUpdateChannels: boolean;
    readonly allowDeleteChannels: boolean;
  };
  readonly messagingSettings: {
    readonly allowUserEditMessages: boolean;
    readonly allowUserDeleteMessages: boolean;
    readonly allowOwnerDeleteMessages: boolean;
    readonly allowTeamMentions: boolean;
    readonly allowChannelMentions: boolean;
  };
  readonly funSettings: {
    readonly allowGiphy: boolean;
    readonly giphyContentRating: 'strict' | 'moderate' | 'unknownFutureValue';
    readonly allowStickersAndMemes: boolean;
    readonly allowCustomMemes: boolean;
  };
  readonly createdDateTime: Date;
}

export interface TeamsMeeting {
  readonly id: string;
  readonly subject: string;
  readonly body?: {
    readonly contentType: 'text' | 'html';
    readonly content: string;
  };
  readonly start: {
    readonly dateTime: Date;
    readonly timeZone: string;
  };
  readonly end: {
    readonly dateTime: Date;
    readonly timeZone: string;
  };
  readonly attendees: readonly TeamsAttendee[];
  readonly organizer: {
    readonly emailAddress: {
      readonly name: string;
      readonly address: string;
    };
  };
  readonly onlineMeeting?: {
    readonly joinUrl: string;
    readonly conferenceId: string;
    readonly tollNumber?: string;
    readonly tollFreeNumber?: string;
  };
  readonly isOnlineMeeting: boolean;
  readonly onlineMeetingProvider: 'teamsForBusiness' | 'skypeForBusiness' | 'skypeForConsumer' | 'unknownFutureValue';
  readonly allowedPresenters: 'everyone' | 'organization' | 'roleIsPresenter' | 'organizer' | 'unknownFutureValue';
  readonly isEntryExitAnnounced: boolean;
  readonly lobbyBypassSettings: {
    readonly scope: 'organizer' | 'organization' | 'organizationAndFederated' | 'everyone' | 'unknownFutureValue';
    readonly isDialInBypassEnabled: boolean;
  };
  readonly audioConferencing?: {
    readonly tollNumber?: string;
    readonly tollFreeNumber?: string;
    readonly conferenceId?: string;
    readonly dialinUrl?: string;
  };
  readonly chatInfo?: {
    readonly threadId: string;
    readonly messageId: string;
    readonly replyChainMessageId?: string;
  };
  readonly joinMeetingIdSettings: {
    readonly isPasscodeRequired: boolean;
    readonly joinMeetingId?: string;
    readonly passcode?: string;
  };
  readonly createdDateTime: Date;
  readonly lastModifiedDateTime: Date;
}

export interface TeamsAttendee {
  readonly emailAddress: {
    readonly name: string;
    readonly address: string;
  };
  readonly status: {
    readonly response: 'none' | 'organizer' | 'tentativelyAccepted' | 'accepted' | 'declined' | 'notResponded';
    readonly time?: Date;
  };
  readonly type: 'required' | 'optional' | 'resource';
}

export interface TeamsUser {
  readonly id: string;
  readonly displayName: string;
  readonly givenName?: string;
  readonly surname?: string;
  readonly email?: string;
  readonly userPrincipalName: string;
  readonly jobTitle?: string;
  readonly mobilePhone?: string;
  readonly businessPhones: readonly string[];
  readonly officeLocation?: string;
  readonly preferredLanguage?: string;
  readonly userType?: string;
}

// ============================================================================
// Custom Error Types
// ============================================================================

export class TeamsIntegrationError extends ExternalWorkflowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'TEAMS_INTEGRATION_ERROR', context);
    this.name = 'TeamsIntegrationError';
  }
}

export class TeamsAuthenticationError extends TeamsIntegrationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(`Authentication failed: ${message}`, context);
    this.name = 'TeamsAuthenticationError';
  }
}

export class TeamsChannelError extends TeamsIntegrationError {
  constructor(message: string, channelId?: string, context?: Record<string, unknown>) {
    super(`Channel error: ${message}`, { ...context, channelId });
    this.name = 'TeamsChannelError';
  }
}

export class TeamsMeetingError extends TeamsIntegrationError {
  constructor(message: string, meetingId?: string, context?: Record<string, unknown>) {
    super(`Meeting error: ${message}`, { ...context, meetingId });
    this.name = 'TeamsMeetingError';
  }
}

// ============================================================================
// Microsoft Teams Integration Service
// ============================================================================

export class MicrosoftTeamsIntegration {
  private readonly baseUrl = 'https://graph.microsoft.com/v1.0';
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(
    private readonly config: TeamsConfig,
    private readonly httpClient: {
      get: (url: string, headers?: Record<string, string>) => Promise<any>;
      post: (url: string, data?: any, headers?: Record<string, string>) => Promise<any>;
      put: (url: string, data?: any, headers?: Record<string, string>) => Promise<any>;
      delete: (url: string, headers?: Record<string, string>) => Promise<any>;
      patch: (url: string, data?: any, headers?: Record<string, string>) => Promise<any>;
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
      },
      patch: async (url, data, headers) => {
        const response = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: data ? JSON.stringify(data) : undefined
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
      }
    }
  ) {
    this.validateConfig();
  }

  /**
   * Authenticate with Microsoft Graph API
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
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new TeamsAuthenticationError(
          `Token request failed: ${error.error_description || error.error}`,
          { statusCode: response.status, error }
        );
      }

      const tokenData = await response.json();
      this.accessToken = tokenData.access_token;
      this.tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      logger.info('Microsoft Teams authentication successful', {
        integrationId: ulid(),
        expiresAt: this.tokenExpiresAt
      });

      return true;
    } catch (error) {
      logger.error('Microsoft Teams authentication failed', { error });
      throw error instanceof TeamsAuthenticationError 
        ? error 
        : new TeamsAuthenticationError('Authentication process failed', { originalError: error });
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
      logger.error('Teams connection test failed', { error });
      return false;
    }
  }

  /**
   * Send a message to a Teams channel
   */
  async sendMessage(params: TeamsMessageParams): Promise<TeamsMessageResult> {
    try {
      await this.ensureAuthenticated();
      this.validateMessageParams(params);

      const messageData = this.buildMessageData(params);
      
      const url = params.replyToId 
        ? `${this.baseUrl}/teams/${params.teamId}/channels/${params.channelId}/messages/${params.replyToId}/replies`
        : `${this.baseUrl}/teams/${params.teamId}/channels/${params.channelId}/messages`;

      const response = await this.httpClient.post(url, messageData, this.getAuthHeaders());

      logger.info('Teams message sent successfully', {
        messageId: response.id,
        channelId: params.channelId,
        teamId: params.teamId
      });

      return {
        success: true,
        messageId: response.id,
        channelId: params.channelId,
        teamId: params.teamId,
        createdDateTime: new Date(response.createdDateTime),
        webUrl: response.webUrl
      };
    } catch (error) {
      logger.error('Failed to send Teams message', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get channels for a team
   */
  async getTeamChannels(teamId: string): Promise<readonly TeamsChannel[]> {
    try {
      await this.ensureAuthenticated();

      const response = await this.httpClient.get(
        `${this.baseUrl}/teams/${teamId}/channels`,
        this.getAuthHeaders()
      );

      return response.value.map((channel: any) => this.mapToTeamsChannel(channel));
    } catch (error) {
      logger.error('Failed to get team channels', { error, teamId });
      throw new TeamsChannelError('Failed to retrieve team channels', undefined, { teamId, originalError: error });
    }
  }

  /**
   * Get teams the user is a member of
   */
  async getJoinedTeams(): Promise<readonly TeamsTeam[]> {
    try {
      await this.ensureAuthenticated();

      const response = await this.httpClient.get(
        `${this.baseUrl}/me/joinedTeams`,
        this.getAuthHeaders()
      );

      return response.value.map((team: any) => this.mapToTeamsTeam(team));
    } catch (error) {
      logger.error('Failed to get joined teams', { error });
      throw new TeamsIntegrationError('Failed to retrieve joined teams', { originalError: error });
    }
  }

  /**
   * Create an online meeting
   */
  async createOnlineMeeting(meeting: Omit<TeamsMeeting, 'id' | 'createdDateTime' | 'lastModifiedDateTime'>): Promise<TeamsMeeting> {
    try {
      await this.ensureAuthenticated();

      const meetingData = this.buildMeetingData(meeting);
      
      const response = await this.httpClient.post(
        `${this.baseUrl}/me/onlineMeetings`,
        meetingData,
        this.getAuthHeaders()
      );

      logger.info('Teams online meeting created successfully', {
        meetingId: response.id,
        subject: meeting.subject
      });

      return this.mapToTeamsMeeting(response);
    } catch (error) {
      logger.error('Failed to create Teams online meeting', { error, meeting });
      throw new TeamsMeetingError('Failed to create online meeting', undefined, { originalError: error });
    }
  }

  /**
   * Get user information
   */
  async getUser(userId: string): Promise<TeamsUser> {
    try {
      await this.ensureAuthenticated();

      const response = await this.httpClient.get(
        `${this.baseUrl}/users/${userId}`,
        this.getAuthHeaders()
      );

      return this.mapToTeamsUser(response);
    } catch (error) {
      logger.error('Failed to get user information', { error, userId });
      throw new TeamsIntegrationError('Failed to retrieve user information', { userId, originalError: error });
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private validateConfig(): void {
    const required = ['clientId', 'clientSecret', 'tenantId', 'redirectUri'];
    const missing = required.filter(key => !this.config[key as keyof TeamsConfig]);
    
    if (missing.length > 0) {
      throw new WorkflowValidationError(
        'teams-config-validation',
        [`Missing required Teams configuration: ${missing.join(', ')}`]
      );
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiresAt || this.tokenExpiresAt <= new Date()) {
      throw new TeamsAuthenticationError('No valid access token available. Please authenticate first.');
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.accessToken) {
      throw new TeamsAuthenticationError('No access token available');
    }
    
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  private validateMessageParams(params: TeamsMessageParams): void {
    if (!params.teamId?.trim()) {
      throw new WorkflowValidationError('teams-message-validation', ['Team ID cannot be empty']);
    }

    if (!params.channelId?.trim()) {
      throw new WorkflowValidationError('teams-message-validation', ['Channel ID cannot be empty']);
    }

    if (!params.content?.trim()) {
      throw new WorkflowValidationError('teams-message-validation', ['Message content cannot be empty']);
    }
  }

  private buildMessageData(params: TeamsMessageParams): any {
    return {
      body: {
        contentType: params.contentType,
        content: params.content
      },
      importance: params.importance,
      subject: params.subject,
      mentions: params.mentions || [],
      attachments: params.attachments || []
    };
  }

  private buildMeetingData(meeting: Omit<TeamsMeeting, 'id' | 'createdDateTime' | 'lastModifiedDateTime'>): any {
    return {
      subject: meeting.subject,
      body: meeting.body,
      start: {
        dateTime: meeting.start.dateTime.toISOString(),
        timeZone: meeting.start.timeZone
      },
      end: {
        dateTime: meeting.end.dateTime.toISOString(),
        timeZone: meeting.end.timeZone
      },
      attendees: meeting.attendees.map(att => ({
        emailAddress: att.emailAddress,
        type: att.type
      })),
      isOnlineMeeting: meeting.isOnlineMeeting,
      onlineMeetingProvider: meeting.onlineMeetingProvider,
      allowedPresenters: meeting.allowedPresenters,
      isEntryExitAnnounced: meeting.isEntryExitAnnounced,
      lobbyBypassSettings: meeting.lobbyBypassSettings,
      audioConferencing: meeting.audioConferencing,
      joinMeetingIdSettings: meeting.joinMeetingIdSettings
    };
  }

  private mapToTeamsChannel(data: any): TeamsChannel {
    return {
      id: data.id,
      displayName: data.displayName || '',
      description: data.description,
      email: data.email,
      webUrl: data.webUrl || '',
      membershipType: data.membershipType || 'standard',
      moderationSettings: data.moderationSettings,
      createdDateTime: new Date(data.createdDateTime)
    };
  }

  private mapToTeamsTeam(data: any): TeamsTeam {
    return {
      id: data.id,
      displayName: data.displayName || '',
      description: data.description,
      internalId: data.internalId || '',
      classification: data.classification,
      specialization: data.specialization || 'none',
      visibility: data.visibility || 'private',
      webUrl: data.webUrl || '',
      isArchived: data.isArchived || false,
      isMembershipLimitedToOwners: data.isMembershipLimitedToOwners || false,
      memberSettings: data.memberSettings || {
        allowCreateUpdateChannels: false,
        allowCreatePrivateChannels: false,
        allowDeleteChannels: false,
        allowAddRemoveApps: false,
        allowCreateUpdateRemoveTabs: false,
        allowCreateUpdateRemoveConnectors: false
      },
      guestSettings: data.guestSettings || {
        allowCreateUpdateChannels: false,
        allowDeleteChannels: false
      },
      messagingSettings: data.messagingSettings || {
        allowUserEditMessages: false,
        allowUserDeleteMessages: false,
        allowOwnerDeleteMessages: false,
        allowTeamMentions: false,
        allowChannelMentions: false
      },
      funSettings: data.funSettings || {
        allowGiphy: false,
        giphyContentRating: 'strict',
        allowStickersAndMemes: false,
        allowCustomMemes: false
      },
      createdDateTime: new Date(data.createdDateTime)
    };
  }

  private mapToTeamsMeeting(data: any): TeamsMeeting {
    return {
      id: data.id,
      subject: data.subject || '',
      body: data.body,
      start: {
        dateTime: new Date(data.start.dateTime),
        timeZone: data.start.timeZone || 'UTC'
      },
      end: {
        dateTime: new Date(data.end.dateTime),
        timeZone: data.end.timeZone || 'UTC'
      },
      attendees: data.attendees?.map((att: any) => ({
        emailAddress: att.emailAddress,
        status: att.status || { response: 'none' },
        type: att.type || 'required'
      })) || [],
      organizer: data.organizer || { emailAddress: { name: '', address: '' } },
      onlineMeeting: data.onlineMeeting,
      isOnlineMeeting: data.isOnlineMeeting || false,
      onlineMeetingProvider: data.onlineMeetingProvider || 'teamsForBusiness',
      allowedPresenters: data.allowedPresenters || 'everyone',
      isEntryExitAnnounced: data.isEntryExitAnnounced || false,
      lobbyBypassSettings: data.lobbyBypassSettings || {
        scope: 'organizer',
        isDialInBypassEnabled: false
      },
      audioConferencing: data.audioConferencing,
      chatInfo: data.chatInfo,
      joinMeetingIdSettings: data.joinMeetingIdSettings || {
        isPasscodeRequired: false
      },
      createdDateTime: new Date(data.createdDateTime),
      lastModifiedDateTime: new Date(data.lastModifiedDateTime)
    };
  }

  private mapToTeamsUser(data: any): TeamsUser {
    return {
      id: data.id,
      displayName: data.displayName || '',
      givenName: data.givenName,
      surname: data.surname,
      email: data.mail,
      userPrincipalName: data.userPrincipalName || '',
      jobTitle: data.jobTitle,
      mobilePhone: data.mobilePhone,
      businessPhones: data.businessPhones || [],
      officeLocation: data.officeLocation,
      preferredLanguage: data.preferredLanguage,
      userType: data.userType
    };
  }
}

export function createMicrosoftTeamsIntegration(config: TeamsConfig): MicrosoftTeamsIntegration {
  return new MicrosoftTeamsIntegration(config);
} 