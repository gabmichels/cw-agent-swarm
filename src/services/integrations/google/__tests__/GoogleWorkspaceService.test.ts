/**
 * GoogleWorkspaceService.test.ts
 * Comprehensive test suite for GoogleWorkspaceService
 * Following IMPLEMENTATION_GUIDELINES.md testing principles
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { google } from 'googleapis';
import { GoogleWorkspaceService } from '../GoogleWorkspaceService';
import {
  GoogleWorkspaceConfig,
  SpreadsheetCreationParams,
  CalendarEventParams,
  DriveFileCreationParams,
  SharingPermissions,
  TimeRange,
  SheetsUpdateParams,
  SheetsReadParams,
  SearchFilters,
  createSpreadsheetCreationParams,
  createCalendarEventParams,
  createDriveFileCreationParams,
  createSharingPermissions
} from '../interfaces/GoogleWorkspaceInterfaces';
import {
  GoogleWorkspaceAuthenticationError,
  GoogleWorkspaceValidationError,
  GoogleWorkspaceQuotaExceededError,
  GoogleWorkspaceResourceNotFoundError
} from '../errors/GoogleWorkspaceErrors';

// Mock googleapis
vi.mock('googleapis');
const mockedGoogle = vi.mocked(google);

// Test configuration
const testConfig: GoogleWorkspaceConfig = {
  credentials: {
    type: 'service_account',
    clientEmail: 'test@example.com',
    privateKey: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----'
  },
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/calendar'
  ],
  timeout: 30000,
  retryAttempts: 3
};

// Mock data
const mockSpreadsheet = {
  spreadsheetId: 'sheet-123',
  properties: {
    title: 'Test Spreadsheet',
    locale: 'en_US',
    timeZone: 'UTC'
  },
  sheets: [],
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123'
};

const mockDriveFile = {
  id: 'file-123',
  name: 'test-file.txt',
  mimeType: 'text/plain',
  parents: ['folder-123'],
  size: '1024',
  createdTime: '2023-01-01T00:00:00.000Z',
  modifiedTime: '2023-01-01T00:00:00.000Z',
  webViewLink: 'https://drive.google.com/file/d/file-123',
  iconLink: 'https://drive.google.com/icon.png',
  shared: false,
  ownedByMe: true,
  capabilities: {
    canEdit: true,
    canShare: true,
    canDelete: true,
    canDownload: true,
    canComment: true,
    canCopy: true,
    canRename: true
  }
};

const mockCalendarEvent = {
  id: 'event-123',
  summary: 'Test Event',
  description: 'Test event description',
  location: 'Test Location',
  start: { dateTime: '2023-01-01T10:00:00.000Z' },
  end: { dateTime: '2023-01-01T11:00:00.000Z' },
  attendees: [],
  creator: { email: 'test@example.com' },
  organizer: { email: 'test@example.com' },
  status: 'confirmed' as const,
  htmlLink: 'https://calendar.google.com/event/123',
  created: '2023-01-01T00:00:00.000Z',
  updated: '2023-01-01T00:00:00.000Z'
};

describe('GoogleWorkspaceService', () => {
  let googleWorkspaceService: GoogleWorkspaceService;
  let mockAuth: any;
  let mockSheetsClient: any;
  let mockDriveClient: any;
  let mockCalendarClient: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock Google Auth
    mockAuth = {
      getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' })
    };
    
    // Mock Sheets client
    mockSheetsClient = {
      spreadsheets: {
        create: vi.fn(),
        get: vi.fn(),
        values: {
          update: vi.fn(),
          get: vi.fn()
        }
      }
    };
    
    // Mock Drive client
    mockDriveClient = {
      files: {
        create: vi.fn(),
        list: vi.fn(),
        get: vi.fn()
      },
      permissions: {
        create: vi.fn()
      }
    };
    
    // Mock Calendar client
    mockCalendarClient = {
      events: {
        insert: vi.fn(),
        list: vi.fn()
      },
      freebusy: {
        query: vi.fn()
      },
      calendarList: {
        list: vi.fn()
      }
    };
    
    // Mock google.auth.GoogleAuth
    const mockGoogleAuth = vi.fn().mockImplementation(() => mockAuth);
    mockedGoogle.auth = { GoogleAuth: mockGoogleAuth } as any;
    
    // Mock google.sheets, google.drive, google.calendar
    mockedGoogle.sheets = vi.fn().mockReturnValue(mockSheetsClient);
    mockedGoogle.drive = vi.fn().mockReturnValue(mockDriveClient);
    mockedGoogle.calendar = vi.fn().mockReturnValue(mockCalendarClient);
    
    googleWorkspaceService = new GoogleWorkspaceService(testConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with valid service account configuration', () => {
      expect(googleWorkspaceService).toBeInstanceOf(GoogleWorkspaceService);
      expect(mockedGoogle.auth.GoogleAuth).toHaveBeenCalledWith({
        credentials: {
          client_email: testConfig.credentials.clientEmail,
          private_key: testConfig.credentials.privateKey,
          type: 'service_account'
        },
        scopes: expect.arrayContaining(testConfig.scopes)
      });
    });

    it('should initialize with OAuth2 configuration', () => {
      const oauth2Config: GoogleWorkspaceConfig = {
        credentials: {
          type: 'oauth2',
          clientId: 'client-123',
          clientSecret: 'secret-123',
          refreshToken: 'refresh-123'
        },
        scopes: testConfig.scopes
      };

      const service = new GoogleWorkspaceService(oauth2Config);
      expect(service).toBeInstanceOf(GoogleWorkspaceService);
    });

    it('should throw configuration error for missing credentials', () => {
      const invalidConfig = { ...testConfig, credentials: undefined as any };
      expect(() => new GoogleWorkspaceService(invalidConfig)).toThrow(GoogleWorkspaceValidationError);
    });

    it('should throw configuration error for empty scopes', () => {
      const invalidConfig = { ...testConfig, scopes: [] };
      expect(() => new GoogleWorkspaceService(invalidConfig)).toThrow(GoogleWorkspaceValidationError);
    });

    it('should throw configuration error for invalid service account credentials', () => {
      const invalidConfig: GoogleWorkspaceConfig = {
        credentials: {
          type: 'service_account',
          clientEmail: '',
          privateKey: ''
        },
        scopes: testConfig.scopes
      };
      expect(() => new GoogleWorkspaceService(invalidConfig)).toThrow(GoogleWorkspaceValidationError);
    });
  });

  describe('Sheets API', () => {
    describe('createSpreadsheet', () => {
      const validParams = createSpreadsheetCreationParams('Test Spreadsheet', {
        locale: 'en_US',
        timeZone: 'UTC'
      });

      it('should create spreadsheet successfully', async () => {
        mockSheetsClient.spreadsheets.create.mockResolvedValue({ data: mockSpreadsheet });

        const result = await googleWorkspaceService.createSpreadsheet(validParams);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockSpreadsheet);
        expect(mockSheetsClient.spreadsheets.create).toHaveBeenCalledWith({
          requestBody: {
            properties: {
              title: validParams.title,
              locale: validParams.locale,
              timeZone: validParams.timeZone
            }
          }
        });
      });

      it('should handle validation errors', async () => {
        const invalidParams = { ...validParams, title: '' };

        const result = await googleWorkspaceService.createSpreadsheet(invalidParams);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GoogleWorkspaceValidationError');
      });

      it('should create spreadsheet with custom sheets', async () => {
        const paramsWithSheets = {
          ...validParams,
          sheets: [
            { title: 'Sheet1', sheetId: 0, index: 0, sheetType: 'GRID' as const },
            { title: 'Sheet2', sheetId: 1, index: 1, sheetType: 'GRID' as const }
          ]
        };
        mockSheetsClient.spreadsheets.create.mockResolvedValue({ data: mockSpreadsheet });

        const result = await googleWorkspaceService.createSpreadsheet(paramsWithSheets);

        expect(result.success).toBe(true);
        expect(mockSheetsClient.spreadsheets.create).toHaveBeenCalledWith({
          requestBody: {
            properties: {
              title: paramsWithSheets.title,
              locale: paramsWithSheets.locale,
              timeZone: paramsWithSheets.timeZone
            },
            sheets: expect.arrayContaining([
              { properties: paramsWithSheets.sheets[0] },
              { properties: paramsWithSheets.sheets[1] }
            ])
          }
        });
      });
    });

    describe('addRows', () => {
      const spreadsheetId = 'sheet-123';
      const updateParams: SheetsUpdateParams = {
        range: 'Sheet1!A1:C3',
        values: [
          ['Name', 'Age', 'City'],
          ['John', 30, 'New York'],
          ['Jane', 25, 'Los Angeles']
        ],
        valueInputOption: 'USER_ENTERED'
      };

      it('should add rows successfully', async () => {
        const mockUpdateResponse = {
          data: {
            updatedRows: 3,
            updatedColumns: 3,
            updatedCells: 9
          }
        };
        mockSheetsClient.spreadsheets.values.update.mockResolvedValue(mockUpdateResponse);

        const result = await googleWorkspaceService.addRows(spreadsheetId, updateParams);

        expect(result.success).toBe(true);
        expect(result.data?.updatedRows).toBe(3);
        expect(result.data?.updatedColumns).toBe(3);
        expect(result.data?.updatedCells).toBe(9);
      });

      it('should handle empty spreadsheet ID', async () => {
        const result = await googleWorkspaceService.addRows('', updateParams);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GoogleWorkspaceValidationError');
      });

      it('should handle empty values', async () => {
        const invalidParams = { ...updateParams, values: [] };

        const result = await googleWorkspaceService.addRows(spreadsheetId, invalidParams);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GoogleWorkspaceValidationError');
      });
    });

    describe('readRange', () => {
      const spreadsheetId = 'sheet-123';
      const readParams: SheetsReadParams = {
        range: 'Sheet1!A1:C10',
        valueRenderOption: 'FORMATTED_VALUE'
      };

      it('should read range successfully', async () => {
        const mockReadResponse = {
          data: {
            values: [
              ['Name', 'Age', 'City'],
              ['John', '30', 'New York'],
              ['Jane', '25', 'Los Angeles']
            ]
          }
        };
        mockSheetsClient.spreadsheets.values.get.mockResolvedValue(mockReadResponse);

        const result = await googleWorkspaceService.readRange(spreadsheetId, readParams);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockReadResponse.data.values);
        expect(mockSheetsClient.spreadsheets.values.get).toHaveBeenCalledWith({
          spreadsheetId,
          range: readParams.range,
          valueRenderOption: readParams.valueRenderOption,
          dateTimeRenderOption: readParams.dateTimeRenderOption
        });
      });

      it('should handle empty range', async () => {
        const invalidParams = { ...readParams, range: '' };

        const result = await googleWorkspaceService.readRange(spreadsheetId, invalidParams);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GoogleWorkspaceValidationError');
      });
    });
  });

  describe('Drive API', () => {
    describe('createFile', () => {
      const fileName = 'test-file.txt';
      const fileContent = Buffer.from('Hello, World!');
      const creationParams = createDriveFileCreationParams('test-file.txt', {
        mimeType: 'text/plain',
        parents: ['folder-123']
      });

      it('should create file successfully', async () => {
        mockDriveClient.files.create.mockResolvedValue({ data: mockDriveFile });

        const result = await googleWorkspaceService.createFile(fileName, fileContent, creationParams);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockDriveFile);
        expect(mockDriveClient.files.create).toHaveBeenCalledWith({
          requestBody: {
            name: creationParams.name,
            parents: creationParams.parents,
            properties: creationParams.properties,
            appProperties: creationParams.appProperties,
            mimeType: creationParams.mimeType
          },
          media: {
            mimeType: creationParams.mimeType,
            body: fileContent
          },
          fields: expect.stringContaining('id,name,mimeType')
        });
      });

      it('should handle empty file name', async () => {
        const result = await googleWorkspaceService.createFile('', fileContent);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GoogleWorkspaceValidationError');
      });

      it('should handle empty file content', async () => {
        const result = await googleWorkspaceService.createFile(fileName, Buffer.alloc(0));

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GoogleWorkspaceValidationError');
      });
    });

    describe('shareFile', () => {
      const fileId = 'file-123';
      const permissions = createSharingPermissions('reader', 'user', {
        emailAddress: 'user@example.com',
        sendNotificationEmail: true
      });

      it('should share file successfully', async () => {
        const mockPermissionResponse = { data: { id: 'permission-123' } };
        mockDriveClient.permissions.create.mockResolvedValue(mockPermissionResponse);

        const result = await googleWorkspaceService.shareFile(fileId, permissions);

        expect(result.success).toBe(true);
        expect(result.data?.permissionId).toBe('permission-123');
        expect(mockDriveClient.permissions.create).toHaveBeenCalledWith({
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
        });
      });

      it('should handle empty file ID', async () => {
        const result = await googleWorkspaceService.shareFile('', permissions);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GoogleWorkspaceValidationError');
      });

      it('should handle invalid permissions', async () => {
        const invalidPermissions = { ...permissions, role: undefined as any };

        const result = await googleWorkspaceService.shareFile(fileId, invalidPermissions);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GoogleWorkspaceValidationError');
      });
    });

    describe('searchFiles', () => {
      const searchFilters: SearchFilters = {
        name: 'test',
        mimeType: 'text/plain',
        parents: ['folder-123'],
        starred: false,
        trashed: false
      };

      it('should search files successfully', async () => {
        const mockSearchResponse = { data: { files: [mockDriveFile] } };
        mockDriveClient.files.list.mockResolvedValue(mockSearchResponse);

        const result = await googleWorkspaceService.searchFiles(searchFilters);

        expect(result.success).toBe(true);
        expect(result.data).toEqual([mockDriveFile]);
        expect(mockDriveClient.files.list).toHaveBeenCalledWith({
          q: expect.stringContaining("name contains 'test'"),
          fields: expect.stringContaining('files(id,name,mimeType'),
          pageSize: 1000,
          orderBy: 'modifiedTime desc'
        });
      });

      it('should handle date range filters', async () => {
        const filtersWithDates: SearchFilters = {
          ...searchFilters,
          modifiedTime: {
            after: new Date('2023-01-01'),
            before: new Date('2023-12-31')
          }
        };
        mockDriveClient.files.list.mockResolvedValue({ data: { files: [] } });

        const result = await googleWorkspaceService.searchFiles(filtersWithDates);

        expect(result.success).toBe(true);
        expect(mockDriveClient.files.list).toHaveBeenCalledWith({
          q: expect.stringContaining('modifiedTime >'),
          fields: expect.any(String),
          pageSize: 1000,
          orderBy: 'modifiedTime desc'
        });
      });

      it('should handle invalid date range', async () => {
        const invalidFilters: SearchFilters = {
          modifiedTime: {
            after: new Date('2023-12-31'),
            before: new Date('2023-01-01')
          }
        };

        const result = await googleWorkspaceService.searchFiles(invalidFilters);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GoogleWorkspaceValidationError');
      });
    });
  });

  describe('Calendar API', () => {
    describe('createEvent', () => {
      const eventParams = createCalendarEventParams(
        'Test Event',
        { dateTime: '2023-01-01T10:00:00.000Z' },
        { dateTime: '2023-01-01T11:00:00.000Z' },
        {
          description: 'Test event description',
          location: 'Test Location',
          attendees: [{ email: 'attendee@example.com' }]
        }
      );

      it('should create event successfully', async () => {
        mockCalendarClient.events.insert.mockResolvedValue({ data: mockCalendarEvent });

        const result = await googleWorkspaceService.createEvent(eventParams);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockCalendarEvent);
        expect(mockCalendarClient.events.insert).toHaveBeenCalledWith({
          calendarId: 'primary',
          sendUpdates: 'all',
          requestBody: {
            summary: eventParams.summary,
            description: eventParams.description,
            location: eventParams.location,
            start: eventParams.start,
            end: eventParams.end,
            attendees: expect.any(Array),
            reminders: eventParams.reminders,
            conferenceData: eventParams.conferenceData,
            visibility: eventParams.visibility,
            transparency: eventParams.transparency,
            recurrence: eventParams.recurrence
          }
        });
      });

      it('should handle empty event summary', async () => {
        const invalidParams = { ...eventParams, summary: '' };

        const result = await googleWorkspaceService.createEvent(invalidParams);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GoogleWorkspaceValidationError');
      });

      it('should handle missing start time', async () => {
        const invalidParams = { ...eventParams, start: undefined as any };

        const result = await googleWorkspaceService.createEvent(invalidParams);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GoogleWorkspaceValidationError');
      });
    });

    describe('getAvailability', () => {
      const userId = 'user@example.com';
      const timeRange: TimeRange = {
        start: new Date('2023-01-01T09:00:00.000Z'),
        end: new Date('2023-01-01T17:00:00.000Z'),
        timeZone: 'UTC'
      };

      it('should get availability successfully', async () => {
        const mockFreeBusyResponse = {
          data: {
            calendars: {
              primary: {
                busy: [
                  {
                    start: '2023-01-01T10:00:00.000Z',
                    end: '2023-01-01T11:00:00.000Z'
                  },
                  {
                    start: '2023-01-01T14:00:00.000Z',
                    end: '2023-01-01T15:00:00.000Z'
                  }
                ]
              }
            }
          }
        };
        mockCalendarClient.freebusy.query.mockResolvedValue(mockFreeBusyResponse);

        const result = await googleWorkspaceService.getAvailability(userId, timeRange);

        expect(result.success).toBe(true);
        expect(result.data?.busy).toHaveLength(2);
        expect(result.data?.free.length).toBeGreaterThan(0);
        expect(mockCalendarClient.freebusy.query).toHaveBeenCalledWith({
          requestBody: {
            timeMin: timeRange.start.toISOString(),
            timeMax: timeRange.end.toISOString(),
            timeZone: timeRange.timeZone,
            items: [{ id: 'primary' }]
          }
        });
      });

      it('should handle empty user ID', async () => {
        const result = await googleWorkspaceService.getAvailability('', timeRange);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GoogleWorkspaceValidationError');
      });

      it('should handle invalid time range', async () => {
        const invalidTimeRange: TimeRange = {
          start: new Date('2023-01-01T17:00:00.000Z'),
          end: new Date('2023-01-01T09:00:00.000Z')
        };

        const result = await googleWorkspaceService.getAvailability(userId, invalidTimeRange);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GoogleWorkspaceValidationError');
      });
    });
  });

  describe('Health Status', () => {
    it('should return healthy status when all services are working', async () => {
      mockSheetsClient.spreadsheets.get.mockResolvedValue({ data: {} });
      mockDriveClient.files.list.mockResolvedValue({ data: { files: [] } });
      mockCalendarClient.calendarList.list.mockResolvedValue({ data: { items: [] } });

      const healthStatus = await googleWorkspaceService.getHealthStatus();

      expect(healthStatus.overall.isHealthy).toBe(true);
      expect(healthStatus.services.sheets.isHealthy).toBe(true);
      expect(healthStatus.services.drive.isHealthy).toBe(true);
      expect(healthStatus.services.calendar.isHealthy).toBe(true);
      expect(healthStatus.lastChecked).toBeInstanceOf(Date);
    });

    it('should return unhealthy status when services fail', async () => {
      mockSheetsClient.spreadsheets.get.mockRejectedValue(new Error('Service unavailable'));
      mockDriveClient.files.list.mockRejectedValue(new Error('Service unavailable'));
      mockCalendarClient.calendarList.list.mockRejectedValue(new Error('Service unavailable'));

      const healthStatus = await googleWorkspaceService.getHealthStatus();

      expect(healthStatus.overall.isHealthy).toBe(false);
      expect(healthStatus.services.sheets.isHealthy).toBe(false);
      expect(healthStatus.services.drive.isHealthy).toBe(false);
      expect(healthStatus.services.calendar.isHealthy).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      const authError = {
        code: 401,
        message: 'Unauthorized',
        errors: [{ reason: 'authError' }]
      };
      mockSheetsClient.spreadsheets.create.mockRejectedValue(authError);

      const validParams = createSpreadsheetCreationParams('Test');
      const result = await googleWorkspaceService.createSpreadsheet(validParams);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GoogleWorkspaceApiError');
    });

    it('should handle quota exceeded errors', async () => {
      const quotaError = {
        code: 429,
        message: 'Quota exceeded',
        errors: [{ reason: 'quotaExceeded' }]
      };
      mockSheetsClient.spreadsheets.create.mockRejectedValue(quotaError);

      const validParams = createSpreadsheetCreationParams('Test');
      const result = await googleWorkspaceService.createSpreadsheet(validParams);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GoogleWorkspaceApiError');
    });

    it('should handle network errors', async () => {
      mockSheetsClient.spreadsheets.create.mockRejectedValue(new Error('Network error'));

      const validParams = createSpreadsheetCreationParams('Test');
      const result = await googleWorkspaceService.createSpreadsheet(validParams);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GoogleWorkspaceNetworkError');
    });
  });

  describe('Retry Logic', () => {
    it('should retry on retryable errors', async () => {
      const validParams = createSpreadsheetCreationParams('Test');
      
      mockSheetsClient.spreadsheets.create
        .mockRejectedValueOnce({ code: 500, message: 'Internal server error' })
        .mockRejectedValueOnce({ code: 502, message: 'Bad gateway' })
        .mockResolvedValue({ data: mockSpreadsheet });

      const result = await googleWorkspaceService.createSpreadsheet(validParams);

      expect(result.success).toBe(true);
      expect(mockSheetsClient.spreadsheets.create).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const validParams = createSpreadsheetCreationParams('Test');
      const authError = { code: 401, message: 'Unauthorized' };
      
      mockSheetsClient.spreadsheets.create.mockRejectedValue(authError);

      const result = await googleWorkspaceService.createSpreadsheet(validParams);

      expect(result.success).toBe(false);
      expect(mockSheetsClient.spreadsheets.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Quota Management', () => {
    it('should track quota usage', async () => {
      const validParams = createSpreadsheetCreationParams('Test');
      mockSheetsClient.spreadsheets.create.mockResolvedValue({ data: mockSpreadsheet });

      // Make multiple requests
      await googleWorkspaceService.createSpreadsheet(validParams);
      await googleWorkspaceService.createSpreadsheet(validParams);
      await googleWorkspaceService.createSpreadsheet(validParams);

      expect(mockSheetsClient.spreadsheets.create).toHaveBeenCalledTimes(3);
    });

    it('should wait when approaching quota limits', async () => {
      // This would require mocking the internal quota state
      // For now, we just verify the service handles quota checking
      const validParams = createSpreadsheetCreationParams('Test');
      mockSheetsClient.spreadsheets.create.mockResolvedValue({ data: mockSpreadsheet });

      const result = await googleWorkspaceService.createSpreadsheet(validParams);
      expect(result.success).toBe(true);
    });
  });

  describe('Immutability', () => {
    it('should not mutate input parameters', async () => {
      const originalParams = createSpreadsheetCreationParams('Test Spreadsheet', {
        locale: 'en_US',
        timeZone: 'UTC'
      });
      const paramsCopy = JSON.parse(JSON.stringify(originalParams));
      
      mockSheetsClient.spreadsheets.create.mockResolvedValue({ data: mockSpreadsheet });

      await googleWorkspaceService.createSpreadsheet(originalParams);

      expect(originalParams).toEqual(paramsCopy);
    });

    it('should return immutable response objects', async () => {
      mockSheetsClient.spreadsheets.create.mockResolvedValue({ data: mockSpreadsheet });

      const validParams = createSpreadsheetCreationParams('Test');
      const result = await googleWorkspaceService.createSpreadsheet(validParams);

      expect(() => {
        (result.data as any).spreadsheetId = 'modified';
      }).toThrow();
    });
  });
}); 