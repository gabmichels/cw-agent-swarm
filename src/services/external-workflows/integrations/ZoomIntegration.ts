import { ulid } from 'ulid';
import { 
  ExternalWorkflowError,
  WorkflowValidationError
} from '../errors/ExternalWorkflowErrors';
import { logger } from '../../../lib/logging';

// ============================================================================
// Type Definitions & Interfaces
// ============================================================================

export interface ZoomConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly scopes: readonly string[];
  readonly apiVersion?: string;
}

export interface ZoomMeetingParams {
  readonly topic: string;
  readonly type: 1 | 2 | 3 | 8; // Instant=1, Scheduled=2, Recurring-no-fixed=3, Recurring-fixed=8
  readonly startTime?: Date;
  readonly duration?: number; // minutes
  readonly timezone?: string;
  readonly password?: string;
  readonly agenda?: string;
  readonly settings?: ZoomMeetingSettings;
  readonly recurrence?: ZoomRecurrence;
  readonly trackingFields?: readonly ZoomTrackingField[];
}

export interface ZoomMeetingSettings {
  readonly hostVideo?: boolean;
  readonly participantVideo?: boolean;
  readonly cnMeeting?: boolean;
  readonly inMeeting?: boolean;
  readonly joinBeforeHost?: boolean;
  readonly muteUponEntry?: boolean;
  readonly watermark?: boolean;
  readonly usePmi?: boolean;
  readonly approvalType?: 0 | 1 | 2; // Automatically=0, Manually=1, No-registration=2
  readonly registrationType?: 1 | 2 | 3; // Once=1, Each-time=2, Each-occurrence=3
  readonly audio?: 'both' | 'telephony' | 'voip';
  readonly autoRecording?: 'local' | 'cloud' | 'none';
  readonly enforceLogin?: boolean;
  readonly enforceLoginDomains?: string;
  readonly alternativeHosts?: string;
  readonly closeRegistration?: boolean;
  readonly showShareButton?: boolean;
  readonly allowMultipleDevices?: boolean;
  readonly encryptionType?: 'enhanced_encryption' | 'e2ee';
}

export interface ZoomRecurrence {
  readonly type: 1 | 2 | 3; // Daily=1, Weekly=2, Monthly=3
  readonly repeatInterval: number;
  readonly weeklyDays?: string; // "1,2,3,4,5" for weekdays
  readonly monthlyDay?: number; // 1-31
  readonly monthlyWeek?: 1 | 2 | 3 | 4 | -1; // Last=-1
  readonly monthlyWeekDay?: 1 | 2 | 3 | 4 | 5 | 6 | 7; // Sunday=1
  readonly endTimes?: number;
  readonly endDateTime?: Date;
}

export interface ZoomTrackingField {
  readonly field: string;
  readonly value: string;
}

export interface ZoomMeeting {
  readonly id: string;
  readonly uuid: string;
  readonly hostId: string;
  readonly hostEmail: string;
  readonly topic: string;
  readonly type: number;
  readonly status: 'waiting' | 'started' | 'finished';
  readonly startTime: Date;
  readonly duration: number;
  readonly timezone: string;
  readonly agenda?: string;
  readonly createdAt: Date;
  readonly startUrl: string;
  readonly joinUrl: string;
  readonly password?: string;
  readonly h323Password?: string;
  readonly pstnPassword?: string;
  readonly encryptedPassword?: string;
  readonly settings: ZoomMeetingSettings;
  readonly recurrence?: ZoomRecurrence;
  readonly occurrences?: readonly ZoomOccurrence[];
  readonly trackingFields?: readonly ZoomTrackingField[];
}

export interface ZoomOccurrence {
  readonly occurrenceId: string;
  readonly startTime: Date;
  readonly duration: number;
  readonly status: 'available' | 'deleted';
}

export interface ZoomUser {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly type: 1 | 2 | 3; // Basic=1, Licensed=2, On-prem=3
  readonly roleName?: string;
  readonly pmi: string;
  readonly usePmi: boolean;
  readonly personalMeetingUrl: string;
  readonly timezone: string;
  readonly verified: boolean;
  readonly createdAt: Date;
  readonly lastLoginTime?: Date;
  readonly lastClientVersion?: string;
  readonly picUrl?: string;
  readonly hostKey?: string;
  readonly jid?: string;
  readonly groupIds?: readonly string[];
  readonly imGroupIds?: readonly string[];
  readonly accountId?: string;
  readonly language?: string;
  readonly phoneCountry?: string;
  readonly phoneNumber?: string;
  readonly status?: 'active' | 'inactive' | 'pending';
}

export interface ZoomRecording {
  readonly id: string;
  readonly uuid: string;
  readonly accountId: string;
  readonly hostId: string;
  readonly topic: string;
  readonly type: 1 | 2 | 3 | 4 | 8 | 99; // Meeting types
  readonly startTime: Date;
  readonly timezone: string;
  readonly duration: number;
  readonly totalSize: number;
  readonly recordingCount: number;
  readonly shareUrl?: string;
  readonly recordingFiles: readonly ZoomRecordingFile[];
  readonly downloadAccessToken?: string;
  readonly password?: string;
  readonly participantAudioFiles?: readonly ZoomRecordingFile[];
}

export interface ZoomRecordingFile {
  readonly id: string;
  readonly meetingId: string;
  readonly recordingStart: Date;
  readonly recordingEnd: Date;
  readonly fileType: 'MP4' | 'M4A' | 'TIMELINE' | 'TRANSCRIPT' | 'CHAT' | 'CC' | 'CSV';
  readonly fileExtension: string;
  readonly fileSize: number;
  readonly playUrl?: string;
  readonly downloadUrl?: string;
  readonly status: 'completed' | 'processing';
  readonly recordingType: 'shared_screen_with_speaker_view' | 'shared_screen_with_gallery_view' | 'speaker_view' | 'gallery_view' | 'shared_screen' | 'audio_only' | 'audio_transcript' | 'chat_file' | 'active_speaker' | 'poll' | 'timeline' | 'closed_caption';
}

export interface ZoomAnalytics {
  readonly meetingId: string;
  readonly uuid: string;
  readonly topic: string;
  readonly hostId: string;
  readonly hostName: string;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly duration: number;
  readonly participantsCount: number;
  readonly participants: readonly ZoomParticipant[];
  readonly polls?: readonly ZoomPoll[];
  readonly qa?: readonly ZoomQA[];
}

export interface ZoomParticipant {
  readonly id: string;
  readonly userId?: string;
  readonly name: string;
  readonly userEmail?: string;
  readonly joinTime: Date;
  readonly leaveTime: Date;
  readonly duration: number;
  readonly attentiveness?: number;
  readonly status: 'in_meeting' | 'in_waiting_room';
  readonly role: 'host' | 'co_host' | 'panelist' | 'attendee';
  readonly participantUserId?: string;
  readonly registrantId?: string;
  readonly customerKey?: string;
}

export interface ZoomPoll {
  readonly id: string;
  readonly title: string;
  readonly status: 'notstart' | 'started' | 'ended' | 'sharing';
  readonly anonymous: boolean;
  readonly pollType: 1 | 2 | 3; // Poll=1, Quiz=2, Advanced-poll=3
  readonly questions: readonly ZoomPollQuestion[];
}

export interface ZoomPollQuestion {
  readonly name: string;
  readonly type: 'single' | 'multiple' | 'matching' | 'rank_order' | 'short_answer' | 'long_answer' | 'fill_in_the_blank' | 'rating_scale';
  readonly prompts: readonly ZoomPollPrompt[];
  readonly answers?: readonly string[];
  readonly rightAnswers?: readonly string[];
  readonly caseSensitive?: boolean;
}

export interface ZoomPollPrompt {
  readonly prompt: string;
  readonly type: 'single' | 'multiple';
}

export interface ZoomQA {
  readonly name: string;
  readonly email: string;
  readonly questionDetails: readonly {
    readonly question: string;
    readonly answer: string;
  }[];
}

// ============================================================================
// Error Classes
// ============================================================================

export class ZoomIntegrationError extends ExternalWorkflowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'ZOOM_INTEGRATION_ERROR', context);
    this.name = 'ZoomIntegrationError';
  }
}

export class ZoomAuthenticationError extends ZoomIntegrationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { ...context, subType: 'AUTHENTICATION_ERROR' });
    this.name = 'ZoomAuthenticationError';
  }
}

export class ZoomMeetingError extends ZoomIntegrationError {
  constructor(message: string, meetingId?: string, context?: Record<string, unknown>) {
    super(message, { ...context, meetingId, subType: 'MEETING_ERROR' });
    this.name = 'ZoomMeetingError';
  }
}

export class ZoomRateLimitError extends ZoomIntegrationError {
  constructor(retryAfter: number, context?: Record<string, unknown>) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds.`, { 
      ...context, 
      retryAfter, 
      subType: 'RATE_LIMIT_ERROR' 
    });
    this.name = 'ZoomRateLimitError';
  }
}

// ============================================================================
// Main Integration Class
// ============================================================================

export class ZoomIntegration {
  private readonly baseUrl = 'https://api.zoom.us/v2';
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(
    private readonly config: ZoomConfig,
    private readonly httpClient: {
      get: (url: string, headers?: Record<string, string>) => Promise<any>;
      post: (url: string, data?: any, headers?: Record<string, string>) => Promise<any>;
      put: (url: string, data?: any, headers?: Record<string, string>) => Promise<any>;
      delete: (url: string, headers?: Record<string, string>) => Promise<any>;
      patch: (url: string, data?: any, headers?: Record<string, string>) => Promise<any>;
    } = {
      get: async (url, headers) => {
        const response = await fetch(url, { headers });
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '60');
            throw new ZoomRateLimitError(retryAfter);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      },
      post: async (url, data, headers) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: data ? JSON.stringify(data) : undefined
        });
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '60');
            throw new ZoomRateLimitError(retryAfter);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      },
      put: async (url, data, headers) => {
        const response = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: data ? JSON.stringify(data) : undefined
        });
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '60');
            throw new ZoomRateLimitError(retryAfter);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      },
      delete: async (url, headers) => {
        const response = await fetch(url, { method: 'DELETE', headers });
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '60');
            throw new ZoomRateLimitError(retryAfter);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.ok;
      },
      patch: async (url, data, headers) => {
        const response = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: data ? JSON.stringify(data) : undefined
        });
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '60');
            throw new ZoomRateLimitError(retryAfter);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      }
    }
  ) {
    this.validateConfig();
  }

  // ============================================================================
  // Authentication Methods
  // ============================================================================

  async authenticate(authorizationCode: string): Promise<boolean> {
    try {
      const tokenData = {
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: this.config.redirectUri
      };

      const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
      
      const response = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(tokenData)
      });

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '60');
          throw new ZoomRateLimitError(retryAfter);
        }
        throw new ZoomAuthenticationError(`Authentication failed: ${response.statusText}`);
      }

      const tokens = await response.json();
      
      this.accessToken = tokens.access_token;
      this.refreshToken = tokens.refresh_token;
      this.tokenExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

      logger.info('Zoom authentication successful', {
        expiresAt: this.tokenExpiresAt,
        scopes: tokens.scope
      });

      return true;
    } catch (error) {
      // Re-throw rate limit errors as-is
      if (error instanceof ZoomRateLimitError) {
        throw error;
      }
      
      logger.error('Failed to authenticate with Zoom', { error });
      throw new ZoomAuthenticationError('Failed to authenticate with Zoom', { originalError: error });
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.ensureAuthenticated();
      
      const response = await this.httpClient.get(
        `${this.baseUrl}/users/me`,
        this.getAuthHeaders()
      );

      logger.info('Zoom connection test successful', {
        userId: response.id,
        email: response.email
      });

      return true;
    } catch (error) {
      // Re-throw authentication errors as-is
      if (error instanceof ZoomAuthenticationError) {
        throw error;
      }
      
      logger.error('Zoom connection test failed', { error });
      throw new ZoomIntegrationError('Connection test failed', { originalError: error });
    }
  }

  // ============================================================================
  // Meeting Management
  // ============================================================================

  async createMeeting(params: ZoomMeetingParams): Promise<ZoomMeeting> {
    try {
      await this.ensureAuthenticated();
      this.validateMeetingParams(params);

      const meetingData = this.buildMeetingData(params);

      const response = await this.httpClient.post(
        `${this.baseUrl}/users/me/meetings`,
        meetingData,
        this.getAuthHeaders()
      );

      logger.info('Zoom meeting created successfully', {
        meetingId: response.id,
        topic: response.topic,
        startTime: response.start_time
      });

      return this.mapToZoomMeeting(response);
    } catch (error) {
      // Re-throw validation errors and rate limit errors as-is
      if (error instanceof WorkflowValidationError || error instanceof ZoomRateLimitError || error instanceof ZoomAuthenticationError) {
        throw error;
      }
      
      logger.error('Failed to create Zoom meeting', { error, params });
      throw new ZoomMeetingError('Failed to create meeting', undefined, { originalError: error });
    }
  }

  async getMeeting(meetingId: string): Promise<ZoomMeeting> {
    try {
      await this.ensureAuthenticated();

      const response = await this.httpClient.get(
        `${this.baseUrl}/meetings/${meetingId}`,
        this.getAuthHeaders()
      );

      return this.mapToZoomMeeting(response);
    } catch (error) {
      logger.error('Failed to get Zoom meeting', { error, meetingId });
      throw new ZoomMeetingError('Failed to retrieve meeting', meetingId, { originalError: error });
    }
  }

  async updateMeeting(meetingId: string, updates: Partial<ZoomMeetingParams>): Promise<ZoomMeeting> {
    try {
      await this.ensureAuthenticated();

      const updateData = this.buildMeetingUpdateData(updates);

      await this.httpClient.patch(
        `${this.baseUrl}/meetings/${meetingId}`,
        updateData,
        this.getAuthHeaders()
      );

      logger.info('Zoom meeting updated successfully', {
        meetingId,
        updates: Object.keys(updates)
      });

      return this.getMeeting(meetingId);
    } catch (error) {
      logger.error('Failed to update Zoom meeting', { error, meetingId, updates });
      throw new ZoomMeetingError('Failed to update meeting', meetingId, { originalError: error });
    }
  }

  async deleteMeeting(meetingId: string): Promise<boolean> {
    try {
      await this.ensureAuthenticated();

      await this.httpClient.delete(
        `${this.baseUrl}/meetings/${meetingId}`,
        this.getAuthHeaders()
      );

      logger.info('Zoom meeting deleted successfully', { meetingId });

      return true;
    } catch (error) {
      logger.error('Failed to delete Zoom meeting', { error, meetingId });
      throw new ZoomMeetingError('Failed to delete meeting', meetingId, { originalError: error });
    }
  }

  async listMeetings(options: {
    readonly type?: 'scheduled' | 'live' | 'upcoming';
    readonly pageSize?: number;
    readonly pageNumber?: number;
  } = {}): Promise<{
    readonly meetings: readonly ZoomMeeting[];
    readonly pageCount: number;
    readonly pageNumber: number;
    readonly pageSize: number;
    readonly totalRecords: number;
  }> {
    try {
      await this.ensureAuthenticated();

      const params = new URLSearchParams();
      if (options.type) params.append('type', options.type);
      if (options.pageSize) params.append('page_size', options.pageSize.toString());
      if (options.pageNumber) params.append('page_number', options.pageNumber.toString());

      const response = await this.httpClient.get(
        `${this.baseUrl}/users/me/meetings?${params.toString()}`,
        this.getAuthHeaders()
      );

      return {
        meetings: response.meetings.map((meeting: any) => this.mapToZoomMeeting(meeting)),
        pageCount: response.page_count,
        pageNumber: response.page_number,
        pageSize: response.page_size,
        totalRecords: response.total_records
      };
    } catch (error) {
      logger.error('Failed to list Zoom meetings', { error, options });
      throw new ZoomMeetingError('Failed to list meetings', undefined, { originalError: error });
    }
  }

  // ============================================================================
  // User Management
  // ============================================================================

  async getCurrentUser(): Promise<ZoomUser> {
    try {
      await this.ensureAuthenticated();

      const response = await this.httpClient.get(
        `${this.baseUrl}/users/me`,
        this.getAuthHeaders()
      );

      return this.mapToZoomUser(response);
    } catch (error) {
      logger.error('Failed to get current Zoom user', { error });
      throw new ZoomIntegrationError('Failed to get current user', { originalError: error });
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private validateConfig(): void {
    const required = ['clientId', 'clientSecret', 'redirectUri'];
    const missing = required.filter(key => !this.config[key as keyof ZoomConfig]);
    
    if (missing.length > 0) {
      throw new WorkflowValidationError(
        'zoom-config-validation',
        [`Missing required Zoom configuration: ${missing.join(', ')}`]
      );
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiresAt || this.tokenExpiresAt <= new Date()) {
      throw new ZoomAuthenticationError('No valid access token available. Please authenticate first.');
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.accessToken) {
      throw new ZoomAuthenticationError('No access token available');
    }
    
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  private validateMeetingParams(params: ZoomMeetingParams): void {
    if (!params.topic?.trim()) {
      throw new WorkflowValidationError('zoom-meeting-validation', ['Meeting topic cannot be empty']);
    }

    if (params.type === 2 && !params.startTime) {
      throw new WorkflowValidationError('zoom-meeting-validation', ['Start time is required for scheduled meetings']);
    }

    if (params.duration && (params.duration < 1 || params.duration > 1440)) {
      throw new WorkflowValidationError('zoom-meeting-validation', ['Duration must be between 1 and 1440 minutes']);
    }
  }

  private buildMeetingData(params: ZoomMeetingParams): any {
    return {
      topic: params.topic,
      type: params.type,
      start_time: params.startTime?.toISOString(),
      duration: params.duration,
      timezone: params.timezone || 'UTC',
      password: params.password,
      agenda: params.agenda,
      settings: params.settings ? this.buildMeetingSettings(params.settings) : undefined,
      recurrence: params.recurrence ? this.buildRecurrenceData(params.recurrence) : undefined,
      tracking_fields: params.trackingFields?.map(field => ({
        field: field.field,
        value: field.value
      }))
    };
  }

  private buildMeetingSettings(settings: ZoomMeetingSettings): any {
    return {
      host_video: settings.hostVideo,
      participant_video: settings.participantVideo,
      cn_meeting: settings.cnMeeting,
      in_meeting: settings.inMeeting,
      join_before_host: settings.joinBeforeHost,
      mute_upon_entry: settings.muteUponEntry,
      watermark: settings.watermark,
      use_pmi: settings.usePmi,
      approval_type: settings.approvalType,
      registration_type: settings.registrationType,
      audio: settings.audio,
      auto_recording: settings.autoRecording,
      enforce_login: settings.enforceLogin,
      enforce_login_domains: settings.enforceLoginDomains,
      alternative_hosts: settings.alternativeHosts,
      close_registration: settings.closeRegistration,
      show_share_button: settings.showShareButton,
      allow_multiple_devices: settings.allowMultipleDevices,
      encryption_type: settings.encryptionType
    };
  }

  private buildRecurrenceData(recurrence: ZoomRecurrence): any {
    return {
      type: recurrence.type,
      repeat_interval: recurrence.repeatInterval,
      weekly_days: recurrence.weeklyDays,
      monthly_day: recurrence.monthlyDay,
      monthly_week: recurrence.monthlyWeek,
      monthly_week_day: recurrence.monthlyWeekDay,
      end_times: recurrence.endTimes,
      end_date_time: recurrence.endDateTime?.toISOString()
    };
  }

  private buildMeetingUpdateData(updates: Partial<ZoomMeetingParams>): any {
    const data: any = {};
    
    if (updates.topic) data.topic = updates.topic;
    if (updates.startTime) data.start_time = updates.startTime.toISOString();
    if (updates.duration) data.duration = updates.duration;
    if (updates.timezone) data.timezone = updates.timezone;
    if (updates.password) data.password = updates.password;
    if (updates.agenda) data.agenda = updates.agenda;
    if (updates.settings) data.settings = this.buildMeetingSettings(updates.settings);
    if (updates.recurrence) data.recurrence = this.buildRecurrenceData(updates.recurrence);
    if (updates.trackingFields) {
      data.tracking_fields = updates.trackingFields.map(field => ({
        field: field.field,
        value: field.value
      }));
    }

    return data;
  }

  private mapToZoomMeeting(data: any): ZoomMeeting {
    return {
      id: data.id.toString(),
      uuid: data.uuid,
      hostId: data.host_id,
      hostEmail: data.host_email,
      topic: data.topic,
      type: data.type,
      status: data.status,
      startTime: new Date(data.start_time),
      duration: data.duration,
      timezone: data.timezone,
      agenda: data.agenda,
      createdAt: new Date(data.created_at),
      startUrl: data.start_url,
      joinUrl: data.join_url,
      password: data.password,
      h323Password: data.h323_password,
      pstnPassword: data.pstn_password,
      encryptedPassword: data.encrypted_password,
      settings: this.mapToMeetingSettings(data.settings || {}),
      recurrence: data.recurrence ? this.mapToRecurrence(data.recurrence) : undefined,
      occurrences: data.occurrences?.map((occ: any) => this.mapToOccurrence(occ)),
      trackingFields: data.tracking_fields?.map((field: any) => ({
        field: field.field,
        value: field.value
      }))
    };
  }

  private mapToMeetingSettings(data: any): ZoomMeetingSettings {
    return {
      hostVideo: data.host_video,
      participantVideo: data.participant_video,
      cnMeeting: data.cn_meeting,
      inMeeting: data.in_meeting,
      joinBeforeHost: data.join_before_host,
      muteUponEntry: data.mute_upon_entry,
      watermark: data.watermark,
      usePmi: data.use_pmi,
      approvalType: data.approval_type,
      registrationType: data.registration_type,
      audio: data.audio,
      autoRecording: data.auto_recording,
      enforceLogin: data.enforce_login,
      enforceLoginDomains: data.enforce_login_domains,
      alternativeHosts: data.alternative_hosts,
      closeRegistration: data.close_registration,
      showShareButton: data.show_share_button,
      allowMultipleDevices: data.allow_multiple_devices,
      encryptionType: data.encryption_type
    };
  }

  private mapToRecurrence(data: any): ZoomRecurrence {
    return {
      type: data.type,
      repeatInterval: data.repeat_interval,
      weeklyDays: data.weekly_days,
      monthlyDay: data.monthly_day,
      monthlyWeek: data.monthly_week,
      monthlyWeekDay: data.monthly_week_day,
      endTimes: data.end_times,
      endDateTime: data.end_date_time ? new Date(data.end_date_time) : undefined
    };
  }

  private mapToOccurrence(data: any): ZoomOccurrence {
    return {
      occurrenceId: data.occurrence_id,
      startTime: new Date(data.start_time),
      duration: data.duration,
      status: data.status
    };
  }

  private mapToZoomUser(data: any): ZoomUser {
    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      type: data.type,
      roleName: data.role_name,
      pmi: data.pmi.toString(),
      usePmi: data.use_pmi,
      personalMeetingUrl: data.personal_meeting_url,
      timezone: data.timezone,
      verified: data.verified,
      createdAt: new Date(data.created_at),
      lastLoginTime: data.last_login_time ? new Date(data.last_login_time) : undefined,
      lastClientVersion: data.last_client_version,
      picUrl: data.pic_url,
      hostKey: data.host_key,
      jid: data.jid,
      groupIds: data.group_ids,
      imGroupIds: data.im_group_ids,
      accountId: data.account_id,
      language: data.language,
      phoneCountry: data.phone_country,
      phoneNumber: data.phone_number,
      status: data.status
    };
  }
}

export function createZoomIntegration(config: ZoomConfig): ZoomIntegration {
  return new ZoomIntegration(config);
} 