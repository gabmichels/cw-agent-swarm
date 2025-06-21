/**
 * GoogleWorkspaceService.ts
 * Enhanced Google Workspace Integration Service
 * Following IMPLEMENTATION_GUIDELINES.md principles
 */

import { ulid } from 'ulid';
import { google, Auth, sheets_v4, drive_v3, calendar_v3 } from 'googleapis';
import { logger } from '../../../lib/logging';
import {
  Spreadsheet,
  DriveFile,
  CalendarEvent,
  CalendarEventParams,
  SpreadsheetCreationParams,
  DriveFileCreationParams,
  SharingPermissions,
  SharingResult,
  TimeRange,
  Availability,
  UpdateResult,
  SheetsUpdateParams,
  SheetsReadParams,
  SearchFilters,
  GoogleWorkspaceServiceResponse,
  GoogleWorkspaceHealthStatus,
  GoogleWorkspaceConfig,
  GoogleCredentials,
  createGoogleWorkspaceServiceResponse,
  createGoogleWorkspaceServiceError,
  createCalendarEventParams,
  createSpreadsheetCreationParams,
  createDriveFileCreationParams,
  createSharingPermissions,
  GoogleWorkspaceService as ServiceType,
  ServiceHealthStatus
} from './interfaces/GoogleWorkspaceInterfaces';
import {
  GoogleWorkspaceError,
  GoogleWorkspaceApiError,
  GoogleWorkspaceAuthenticationError,
  GoogleWorkspaceAuthorizationError,
  GoogleWorkspaceValidationError,
  GoogleWorkspaceQuotaExceededError,
  GoogleWorkspaceResourceNotFoundError,
  GoogleWorkspaceConfigurationError,
  GoogleWorkspaceNetworkError,
  GoogleWorkspaceTimeoutError,
  GoogleSheetsError,
  GoogleDriveError,
  GoogleCalendarError,
  createGoogleWorkspaceApiError,
  createGoogleWorkspaceValidationError,
  createGoogleWorkspaceResourceNotFoundError,
  createGoogleSheetsError,
  createGoogleDriveError,
  createGoogleCalendarError,
  shouldRetryGoogleWorkspaceError,
  getRetryDelayForGoogleWorkspaceError,
  categorizeGoogleWorkspaceError
} from './errors/GoogleWorkspaceErrors';

// Rate limiting and quota management
interface QuotaState {
  readonly sheets: QuotaTracker;
  readonly drive: QuotaTracker;
  readonly calendar: QuotaTracker;
}

interface QuotaTracker {
  readonly requests: number;
  readonly resetTime: Date;
  readonly remaining: number;
  readonly dailyLimit: number;
}

// Request retry configuration
interface RetryConfig {
  readonly maxAttempts: number;
  readonly baseDelay: number;
  readonly maxDelay: number;
  readonly backoffMultiplier: number;
}

/**
 * Enhanced Google Workspace Service for comprehensive integration
 * Implements dependency injection, immutable data structures, and comprehensive error handling
 */
export class GoogleWorkspaceService {
  private readonly config: GoogleWorkspaceConfig;
  private readonly retryConfig: RetryConfig;
  private readonly auth: Auth.GoogleAuth;
  private readonly sheetsClient: sheets_v4.Sheets;
  private readonly driveClient: drive_v3.Drive;
  private readonly calendarClient: calendar_v3.Calendar;
  private quotaState: QuotaState;
  private healthStatus: GoogleWorkspaceHealthStatus;

  constructor(
    config: GoogleWorkspaceConfig,
    retryConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2
    }
  ) {
    this.validateConfig(config);
    this.config = Object.freeze({ ...config });
    this.retryConfig = Object.freeze({ ...retryConfig });
    
    this.auth = this.createGoogleAuth();
    this.sheetsClient = google.sheets({ version: 'v4', auth: this.auth });
    this.driveClient = google.drive({ version: 'v3', auth: this.auth });
    this.calendarClient = google.calendar({ version: 'v3', auth: this.auth });
    
    this.quotaState = this.initializeQuotaState();
    this.healthStatus = this.initializeHealthStatus();

    logger.info('GoogleWorkspaceService initialized', { 
      serviceId: ulid(),
      scopes: config.scopes,
      credentialType: config.credentials.type
    });
  }

  // Sheets API Methods

  /**
   * Create a new spreadsheet
   */
  async createSpreadsheet(params: SpreadsheetCreationParams): Promise<GoogleWorkspaceServiceResponse<Spreadsheet>> {
    const requestId = ulid();
    
    try {
      this.validateSpreadsheetCreationParams(params);
      await this.checkQuota('sheets');

      const createRequest: sheets_v4.Params$Resource$Spreadsheets$Create = {
        requestBody: {
          properties: {
            title: params.title,
            locale: params.locale || 'en_US',
            timeZone: params.timeZone || 'UTC'
          },
          ...(params.sheets && {
            sheets: params.sheets.map(sheet => ({
              properties: sheet
            }))
          })
        }
      };

      const response = await this.executeWithRetry(
        () => this.sheetsClient.spreadsheets.create(createRequest),
        'sheets'
      );

      const spreadsheet = response.data as Spreadsheet;
      this.updateQuotaState('sheets');
      this.updateServiceHealth('sheets', true);

      logger.info('Spreadsheet created successfully', {
        requestId,
        spreadsheetId: spreadsheet.spreadsheetId,
        title: params.title
      });

      return createGoogleWorkspaceServiceResponse(true, spreadsheet);
    } catch (error) {
      return this.handleError(error, requestId, 'createSpreadsheet', 'sheets', { params });
    }
  }

  /**
   * Add rows to a spreadsheet
   */
  async addRows(
    spreadsheetId: string,
    params: SheetsUpdateParams
  ): Promise<GoogleWorkspaceServiceResponse<UpdateResult>> {
    const requestId = ulid();
    
    try {
      this.validateSpreadsheetId(spreadsheetId);
      this.validateSheetsUpdateParams(params);
      await this.checkQuota('sheets');

      const updateRequest: sheets_v4.Params$Resource$Spreadsheets$Values$Update = {
        spreadsheetId,
        range: params.range,
        valueInputOption: params.valueInputOption || 'USER_ENTERED',
        includeValuesInResponse: params.includeValuesInResponse || false,
        responseValueRenderOption: params.valueRenderOption,
        requestBody: {
          values: params.values as any[][]
        }
      };

      const response = await this.executeWithRetry(
        () => this.sheetsClient.spreadsheets.values.update(updateRequest),
        'sheets'
      );

      const updateResult: UpdateResult = {
        updatedRows: response.data.updatedRows || 0,
        updatedColumns: response.data.updatedColumns || 0,
        updatedCells: response.data.updatedCells || 0,
        updatedData: response.data.updatedData as any // Google API schema compatibility
      };

      this.updateQuotaState('sheets');
      this.updateServiceHealth('sheets', true);

      logger.info('Spreadsheet rows added successfully', {
        requestId,
        spreadsheetId,
        range: params.range,
        updatedCells: updateResult.updatedCells
      });

      return createGoogleWorkspaceServiceResponse(true, updateResult);
    } catch (error) {
      return this.handleError(error, requestId, 'addRows', 'sheets', { spreadsheetId, params });
    }
  }

  /**
   * Read data from a spreadsheet range
   */
  async readRange(
    spreadsheetId: string,
    params: SheetsReadParams
  ): Promise<GoogleWorkspaceServiceResponse<readonly (readonly unknown[])[]>> {
    const requestId = ulid();
    
    try {
      this.validateSpreadsheetId(spreadsheetId);
      this.validateSheetsReadParams(params);
      await this.checkQuota('sheets');

      const readRequest: sheets_v4.Params$Resource$Spreadsheets$Values$Get = {
        spreadsheetId,
        range: params.range,
        valueRenderOption: params.valueRenderOption,
        dateTimeRenderOption: params.dateTimeRenderOption
      };

      const response = await this.executeWithRetry(
        () => this.sheetsClient.spreadsheets.values.get(readRequest),
        'sheets'
      );

      const values = (response.data.values || []) as readonly (readonly unknown[])[];
      this.updateQuotaState('sheets');
      this.updateServiceHealth('sheets', true);

      logger.info('Spreadsheet range read successfully', {
        requestId,
        spreadsheetId,
        range: params.range,
        rowCount: values.length
      });

      return createGoogleWorkspaceServiceResponse(true, values);
    } catch (error) {
      return this.handleError(error, requestId, 'readRange', 'sheets', { spreadsheetId, params });
    }
  }

  // Drive API Methods

  /**
   * Create a file in Google Drive
   */
  async createFile(
    name: string,
    content: Buffer,
    params?: DriveFileCreationParams
  ): Promise<GoogleWorkspaceServiceResponse<DriveFile>> {
    const requestId = ulid();
    
    try {
      this.validateFileName(name);
      this.validateFileContent(content);
      await this.checkQuota('drive');

      const fileMetadata: drive_v3.Schema$File = {
        name: params?.name || name,
        parents: params?.parents ? [...params.parents] : undefined,
        properties: params?.properties,
        appProperties: params?.appProperties,
        mimeType: params?.mimeType
      };

      const media = {
        mimeType: params?.mimeType || 'application/octet-stream',
        body: content
      };

      const createRequest: drive_v3.Params$Resource$Files$Create = {
        requestBody: fileMetadata,
        media,
        fields: 'id,name,mimeType,parents,size,createdTime,modifiedTime,webViewLink,webContentLink,iconLink,thumbnailLink,shared,ownedByMe,capabilities,properties,appProperties,exportLinks'
      };

      const response = await this.executeWithRetry(
        () => this.driveClient.files.create(createRequest),
        'drive'
      );

      const file = response.data as DriveFile;
      this.updateQuotaState('drive');
      this.updateServiceHealth('drive', true);

      logger.info('Drive file created successfully', {
        requestId,
        fileId: file.id,
        name: file.name,
        mimeType: file.mimeType
      });

      return createGoogleWorkspaceServiceResponse(true, file);
    } catch (error) {
      return this.handleError(error, requestId, 'createFile', 'drive', { name, params });
    }
  }

  /**
   * Share a file with specific permissions
   */
  async shareFile(
    fileId: string,
    permissions: SharingPermissions
  ): Promise<GoogleWorkspaceServiceResponse<SharingResult>> {
    const requestId = ulid();
    
    try {
      this.validateFileId(fileId);
      this.validateSharingPermissions(permissions);
      await this.checkQuota('drive');

      const permissionRequest: drive_v3.Params$Resource$Permissions$Create = {
        fileId,
        sendNotificationEmail: permissions.sendNotificationEmail,
        emailMessage: permissions.emailMessage,
        requestBody: {
          role: permissions.role,
          type: permissions.type,
          emailAddress: permissions.emailAddress,
          domain: permissions.domain,
          allowFileDiscovery: permissions.allowFileDiscovery
        }
      };

      const response = await this.executeWithRetry(
        () => this.driveClient.permissions.create(permissionRequest),
        'drive'
      );

      const sharingResult: SharingResult = {
        permissionId: response.data.id || '',
        success: true,
        message: 'File shared successfully'
      };

      this.updateQuotaState('drive');
      this.updateServiceHealth('drive', true);

      logger.info('Drive file shared successfully', {
        requestId,
        fileId,
        permissionId: sharingResult.permissionId,
        role: permissions.role,
        type: permissions.type
      });

      return createGoogleWorkspaceServiceResponse(true, sharingResult);
    } catch (error) {
      return this.handleError(error, requestId, 'shareFile', 'drive', { fileId, permissions });
    }
  }

  /**
   * Search for files in Google Drive
   */
  async searchFiles(filters: SearchFilters): Promise<GoogleWorkspaceServiceResponse<readonly DriveFile[]>> {
    const requestId = ulid();
    
    try {
      this.validateSearchFilters(filters);
      await this.checkQuota('drive');

      const query = this.buildSearchQuery(filters);
      const searchRequest: drive_v3.Params$Resource$Files$List = {
        q: query,
        fields: 'files(id,name,mimeType,parents,size,createdTime,modifiedTime,webViewLink,webContentLink,iconLink,thumbnailLink,shared,ownedByMe,capabilities,properties,appProperties,exportLinks)',
        pageSize: 1000,
        orderBy: 'modifiedTime desc'
      };

      const response = await this.executeWithRetry(
        () => this.driveClient.files.list(searchRequest),
        'drive'
      );

      const files = (response.data.files || []) as readonly DriveFile[];
      this.updateQuotaState('drive');
      this.updateServiceHealth('drive', true);

      logger.info('Drive files searched successfully', {
        requestId,
        query,
        resultCount: files.length
      });

      return createGoogleWorkspaceServiceResponse(true, files);
    } catch (error) {
      return this.handleError(error, requestId, 'searchFiles', 'drive', { filters });
    }
  }

  // Calendar API Methods

  /**
   * Create a calendar event
   */
  async createEvent(params: CalendarEventParams): Promise<GoogleWorkspaceServiceResponse<CalendarEvent>> {
    const requestId = ulid();
    
    try {
      this.validateCalendarEventParams(params);
      await this.checkQuota('calendar');

      const eventRequest: calendar_v3.Params$Resource$Events$Insert = {
        calendarId: 'primary',
        sendUpdates: 'all',
        requestBody: {
          summary: params.summary,
          description: params.description,
          location: params.location,
          start: params.start,
          end: params.end,
          attendees: params.attendees ? [...params.attendees] as any : undefined,
          reminders: params.reminders ? {
            useDefault: params.reminders.useDefault,
            overrides: params.reminders.overrides ? [...params.reminders.overrides] : undefined
          } : undefined,
          conferenceData: params.conferenceData ? {
            ...params.conferenceData,
            entryPoints: params.conferenceData.entryPoints ? [...params.conferenceData.entryPoints] : []
          } as any : undefined,
          visibility: params.visibility,
          transparency: params.transparency,
          recurrence: params.recurrence ? [...params.recurrence] : undefined
        }
      };

      const response = await this.executeWithRetry(
        () => this.calendarClient.events.insert(eventRequest),
        'calendar'
      );

      const event = response.data as CalendarEvent;
      this.updateQuotaState('calendar');
      this.updateServiceHealth('calendar', true);

      logger.info('Calendar event created successfully', {
        requestId,
        eventId: event.id,
        summary: event.summary,
        start: event.start,
        end: event.end
      });

      return createGoogleWorkspaceServiceResponse(true, event);
    } catch (error) {
      return this.handleError(error, requestId, 'createEvent', 'calendar', { params });
    }
  }

  /**
   * Get availability for a time range
   */
  async getAvailability(
    userId: string,
    timeRange: TimeRange
  ): Promise<GoogleWorkspaceServiceResponse<Availability>> {
    const requestId = ulid();
    
    try {
      this.validateUserId(userId);
      this.validateTimeRange(timeRange);
      await this.checkQuota('calendar');

      const freeBusyRequest: calendar_v3.Params$Resource$Freebusy$Query = {
        requestBody: {
          timeMin: timeRange.start.toISOString(),
          timeMax: timeRange.end.toISOString(),
          timeZone: timeRange.timeZone || 'UTC',
          items: [{ id: 'primary' }]
        }
      };

      const response = await this.executeWithRetry(
        () => this.calendarClient.freebusy.query(freeBusyRequest),
        'calendar'
      );

      const calendar = response.data.calendars?.['primary'];
      const busyTimes = calendar?.busy || [];
      
      const availability: Availability = {
        busy: busyTimes.map(busy => ({
          start: new Date(busy.start!),
          end: new Date(busy.end!),
          timeZone: timeRange.timeZone
        })),
        free: this.calculateFreeTimes(timeRange, busyTimes),
        tentative: [], // Would need additional API call to get tentative events
        unavailable: []
      };

      this.updateQuotaState('calendar');
      this.updateServiceHealth('calendar', true);

      logger.info('Calendar availability retrieved successfully', {
        requestId,
        userId,
        timeRange,
        busySlots: availability.busy.length,
        freeSlots: availability.free.length
      });

      return createGoogleWorkspaceServiceResponse(true, availability);
    } catch (error) {
      return this.handleError(error, requestId, 'getAvailability', 'calendar', { userId, timeRange });
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<GoogleWorkspaceHealthStatus> {
    const startTime = Date.now();
    
    try {
      // Perform lightweight health checks for each service
      const [sheetsHealth, driveHealth, calendarHealth] = await Promise.allSettled([
        this.checkServiceHealth('sheets'),
        this.checkServiceHealth('drive'),
        this.checkServiceHealth('calendar')
      ]);

      const services = {
        sheets: this.getServiceHealthFromResult(sheetsHealth),
        drive: this.getServiceHealthFromResult(driveHealth),
        calendar: this.getServiceHealthFromResult(calendarHealth),
        gmail: { isHealthy: true, errorCount: 0, rateLimitStatus: { quotaRemaining: 1000 } } as ServiceHealthStatus,
        docs: { isHealthy: true, errorCount: 0, rateLimitStatus: { quotaRemaining: 1000 } } as ServiceHealthStatus
      };

      const overallHealth = Object.values(services).every(service => service.isHealthy);
      const responseTime = Date.now() - startTime;

      this.healthStatus = {
        services,
        overall: {
          isHealthy: overallHealth,
          responseTime,
          errorCount: Object.values(services).reduce((sum, service) => sum + service.errorCount, 0),
          rateLimitStatus: {
            quotaRemaining: Math.min(...Object.values(services).map(s => s.rateLimitStatus.quotaRemaining || 0))
          }
        },
        lastChecked: new Date()
      };
    } catch (error) {
      logger.error('Health check failed', { error });
      this.healthStatus = {
        ...this.healthStatus,
        overall: {
          ...this.healthStatus.overall,
          isHealthy: false,
          errorCount: this.healthStatus.overall.errorCount + 1
        },
        lastChecked: new Date()
      };
    }

    return Object.freeze({ ...this.healthStatus });
  }

  // Private helper methods

  private createGoogleAuth(): Auth.GoogleAuth {
    const credentials = this.config.credentials;
    
    if (credentials.type === 'service_account') {
      return new google.auth.GoogleAuth({
        credentials: {
          client_email: credentials.clientEmail,
          private_key: credentials.privateKey,
          type: 'service_account'
        },
        scopes: [...this.config.scopes]
      });
    } else {
      return new google.auth.GoogleAuth({
        credentials: {
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          refresh_token: credentials.refreshToken,
          type: 'authorized_user'
        },
        scopes: [...this.config.scopes]
      });
    }
  }

  private initializeQuotaState(): QuotaState {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return {
      sheets: {
        requests: 0,
        resetTime: tomorrow,
        remaining: 100000, // Default Google Sheets quota
        dailyLimit: 100000
      },
      drive: {
        requests: 0,
        resetTime: tomorrow,
        remaining: 20000, // Default Google Drive quota
        dailyLimit: 20000
      },
      calendar: {
        requests: 0,
        resetTime: tomorrow,
        remaining: 1000000, // Default Google Calendar quota
        dailyLimit: 1000000
      }
    };
  }

  private initializeHealthStatus(): GoogleWorkspaceHealthStatus {
    return {
      services: {
        sheets: { isHealthy: true, errorCount: 0, rateLimitStatus: { quotaRemaining: 100000 } },
        drive: { isHealthy: true, errorCount: 0, rateLimitStatus: { quotaRemaining: 20000 } },
        calendar: { isHealthy: true, errorCount: 0, rateLimitStatus: { quotaRemaining: 1000000 } },
        gmail: { isHealthy: true, errorCount: 0, rateLimitStatus: { quotaRemaining: 1000 } },
        docs: { isHealthy: true, errorCount: 0, rateLimitStatus: { quotaRemaining: 1000 } }
      },
      overall: {
        isHealthy: true,
        errorCount: 0,
        rateLimitStatus: { quotaRemaining: 1000 }
      },
      lastChecked: new Date()
    };
  }

  private async checkQuota(service: keyof Pick<QuotaState, 'sheets' | 'drive' | 'calendar'>): Promise<void> {
    const quota = this.quotaState[service];
    
    if (quota.remaining <= 10) {
      const waitTime = Math.max(0, quota.resetTime.getTime() - Date.now());
      if (waitTime > 0) {
        logger.warn(`${service} quota approaching limit, waiting`, { waitTime, remaining: quota.remaining });
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  private updateQuotaState(service: keyof Pick<QuotaState, 'sheets' | 'drive' | 'calendar'>): void {
    const quota = this.quotaState[service];
    this.quotaState = {
      ...this.quotaState,
      [service]: {
        ...quota,
        requests: quota.requests + 1,
        remaining: Math.max(0, quota.remaining - 1)
      }
    };
  }

  private updateServiceHealth(service: keyof Pick<QuotaState, 'sheets' | 'drive' | 'calendar'>, success: boolean): void {
    const serviceHealth = this.healthStatus.services[service];
    if (!success) {
      this.healthStatus = {
        ...this.healthStatus,
        services: {
          ...this.healthStatus.services,
          [service]: {
            ...serviceHealth,
            errorCount: serviceHealth.errorCount + 1,
            isHealthy: serviceHealth.errorCount < 5 // Mark unhealthy after 5 errors
          }
        }
      };
    }
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    service: ServiceType
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.retryConfig.maxAttempts) {
          break;
        }

        const workspaceError = this.convertToWorkspaceError(error, service);
        if (shouldRetryGoogleWorkspaceError(workspaceError, attempt, this.retryConfig.maxAttempts)) {
          const delay = getRetryDelayForGoogleWorkspaceError(workspaceError, attempt);
          
          logger.warn('Retrying Google Workspace API request', { 
            service,
            attempt, 
            delay, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    throw lastError!;
  }

  private convertToWorkspaceError(error: unknown, service: ServiceType): GoogleWorkspaceError {
    if (error instanceof GoogleWorkspaceError) {
      return error;
    }

    // Handle Google API errors
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const apiError = error as any;
      return createGoogleWorkspaceApiError(
        apiError.message || 'Google API error',
        service,
        apiError.code,
        apiError.errors?.[0]?.reason
      );
    }

    return new GoogleWorkspaceNetworkError(
      error instanceof Error ? error.message : 'Unknown error',
      service
    );
  }

  private buildSearchQuery(filters: SearchFilters): string {
    const queryParts: string[] = [];
    
    if (filters.name) {
      queryParts.push(`name contains '${filters.name.replace(/'/g, "\\'")}'`);
    }
    
    if (filters.mimeType) {
      queryParts.push(`mimeType='${filters.mimeType}'`);
    }
    
    if (filters.parents?.length) {
      const parentQuery = filters.parents.map(parent => `'${parent}' in parents`).join(' or ');
      queryParts.push(`(${parentQuery})`);
    }
    
    if (filters.starred !== undefined) {
      queryParts.push(`starred=${filters.starred}`);
    }
    
    if (filters.trashed !== undefined) {
      queryParts.push(`trashed=${filters.trashed}`);
    }
    
    if (filters.modifiedTime?.after) {
      queryParts.push(`modifiedTime > '${filters.modifiedTime.after.toISOString()}'`);
    }
    
    if (filters.modifiedTime?.before) {
      queryParts.push(`modifiedTime < '${filters.modifiedTime.before.toISOString()}'`);
    }
    
    return queryParts.join(' and ') || 'trashed=false';
  }

  private calculateFreeTimes(timeRange: TimeRange, busyTimes: any[]): TimeRange[] {
    const freeTimes: TimeRange[] = [];
    let currentTime = timeRange.start;
    
    const sortedBusyTimes = busyTimes
      .map(busy => ({
        start: new Date(busy.start!),
        end: new Date(busy.end!)
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    
    for (const busyTime of sortedBusyTimes) {
      if (currentTime < busyTime.start) {
        freeTimes.push({
          start: currentTime,
          end: busyTime.start,
          timeZone: timeRange.timeZone
        });
      }
      currentTime = new Date(Math.max(currentTime.getTime(), busyTime.end.getTime()));
    }
    
    if (currentTime < timeRange.end) {
      freeTimes.push({
        start: currentTime,
        end: timeRange.end,
        timeZone: timeRange.timeZone
      });
    }
    
    return freeTimes;
  }

  private async checkServiceHealth(service: 'sheets' | 'drive' | 'calendar'): Promise<ServiceHealthStatus> {
    const startTime = Date.now();
    
    try {
      switch (service) {
        case 'sheets':
          // Simple health check - list first spreadsheet
          await this.sheetsClient.spreadsheets.get({ spreadsheetId: '1' });
          break;
        case 'drive':
          // Simple health check - list files with limit 1
          await this.driveClient.files.list({ pageSize: 1 });
          break;
        case 'calendar':
          // Simple health check - list calendars
          await this.calendarClient.calendarList.list({ maxResults: 1 });
          break;
      }
      
      return {
        isHealthy: true,
        responseTime: Date.now() - startTime,
        errorCount: 0,
        rateLimitStatus: {
          quotaRemaining: this.quotaState[service].remaining
        }
      };
    } catch (error) {
      return {
        isHealthy: false,
        responseTime: Date.now() - startTime,
        errorCount: 1,
        rateLimitStatus: {
          quotaRemaining: this.quotaState[service].remaining
        }
      };
    }
  }

  private getServiceHealthFromResult(result: PromiseSettledResult<ServiceHealthStatus>): ServiceHealthStatus {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        isHealthy: false,
        errorCount: 1,
        rateLimitStatus: { quotaRemaining: 0 }
      };
    }
  }

  private handleError(
    error: unknown,
    requestId: string,
    operation: string,
    service: ServiceType,
    context?: Record<string, unknown>
  ): GoogleWorkspaceServiceResponse<any> {
    const workspaceError = this.convertToWorkspaceError(error, service);
    this.updateServiceHealth(service as any, false);
    
    logger.error('Google Workspace service operation failed', {
      requestId,
      operation,
      service,
      errorId: workspaceError.id,
      errorType: workspaceError.constructor.name,
      message: workspaceError.message,
      context
    });

    return createGoogleWorkspaceServiceResponse(
      false,
      undefined,
      createGoogleWorkspaceServiceError(
        service,
        workspaceError.constructor.name,
        workspaceError.message,
        { errorId: workspaceError.id, context }
      )
    );
  }

  // Validation methods
  private validateConfig(config: GoogleWorkspaceConfig): void {
    if (!config.credentials) {
      throw new GoogleWorkspaceConfigurationError('Credentials are required');
    }
    
    if (!config.scopes || config.scopes.length === 0) {
      throw new GoogleWorkspaceConfigurationError('At least one scope is required');
    }
    
    const credentials = config.credentials;
    if (credentials.type === 'service_account') {
      if (!credentials.clientEmail || !credentials.privateKey) {
        throw new GoogleWorkspaceConfigurationError('Service account credentials require clientEmail and privateKey');
      }
    } else if (credentials.type === 'oauth2') {
      if (!credentials.clientId || !credentials.clientSecret) {
        throw new GoogleWorkspaceConfigurationError('OAuth2 credentials require clientId and clientSecret');
      }
    } else {
      throw new GoogleWorkspaceConfigurationError('Invalid credential type');
    }
  }

  private validateSpreadsheetCreationParams(params: SpreadsheetCreationParams): void {
    if (!params.title?.trim()) {
      throw createGoogleWorkspaceValidationError('Spreadsheet title is required', 'sheets', 'title');
    }
  }

  private validateSpreadsheetId(spreadsheetId: string): void {
    if (!spreadsheetId?.trim()) {
      throw createGoogleWorkspaceValidationError('Spreadsheet ID is required', 'sheets', 'spreadsheetId');
    }
  }

  private validateSheetsUpdateParams(params: SheetsUpdateParams): void {
    if (!params.range?.trim()) {
      throw createGoogleWorkspaceValidationError('Range is required', 'sheets', 'range');
    }
    if (!params.values || params.values.length === 0) {
      throw createGoogleWorkspaceValidationError('Values are required', 'sheets', 'values');
    }
  }

  private validateSheetsReadParams(params: SheetsReadParams): void {
    if (!params.range?.trim()) {
      throw createGoogleWorkspaceValidationError('Range is required', 'sheets', 'range');
    }
  }

  private validateFileName(name: string): void {
    if (!name?.trim()) {
      throw createGoogleWorkspaceValidationError('File name is required', 'drive', 'name');
    }
  }

  private validateFileContent(content: Buffer): void {
    if (!content || content.length === 0) {
      throw createGoogleWorkspaceValidationError('File content is required', 'drive', 'content');
    }
  }

  private validateFileId(fileId: string): void {
    if (!fileId?.trim()) {
      throw createGoogleWorkspaceValidationError('File ID is required', 'drive', 'fileId');
    }
  }

  private validateSharingPermissions(permissions: SharingPermissions): void {
    if (!permissions.role) {
      throw createGoogleWorkspaceValidationError('Permission role is required', 'drive', 'role');
    }
    if (!permissions.type) {
      throw createGoogleWorkspaceValidationError('Permission type is required', 'drive', 'type');
    }
  }

  private validateSearchFilters(filters: SearchFilters): void {
    // Search filters are optional, but we can validate specific constraints
    if (filters.modifiedTime?.after && filters.modifiedTime?.before) {
      if (filters.modifiedTime.after >= filters.modifiedTime.before) {
        throw createGoogleWorkspaceValidationError('Modified time after must be before modified time before', 'drive', 'modifiedTime');
      }
    }
  }

  private validateCalendarEventParams(params: CalendarEventParams): void {
    if (!params.summary?.trim()) {
      throw createGoogleWorkspaceValidationError('Event summary is required', 'calendar', 'summary');
    }
    if (!params.start) {
      throw createGoogleWorkspaceValidationError('Event start time is required', 'calendar', 'start');
    }
    if (!params.end) {
      throw createGoogleWorkspaceValidationError('Event end time is required', 'calendar', 'end');
    }
  }

  private validateUserId(userId: string): void {
    if (!userId?.trim()) {
      throw createGoogleWorkspaceValidationError('User ID is required', 'calendar', 'userId');
    }
  }

  private validateTimeRange(timeRange: TimeRange): void {
    if (!timeRange.start || !timeRange.end) {
      throw createGoogleWorkspaceValidationError('Time range start and end are required', 'calendar', 'timeRange');
    }
    if (timeRange.start >= timeRange.end) {
      throw createGoogleWorkspaceValidationError('Time range start must be before end', 'calendar', 'timeRange');
    }
  }
} 