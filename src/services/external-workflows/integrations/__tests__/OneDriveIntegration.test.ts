import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { ulid } from 'ulid';
import {
  OneDriveIntegration,
  OneDriveConfig,
  OneDriveFile,
  OneDriveFolder,
  OneDriveEntry,
  OneDriveShareLink,
  OneDrivePermission,
  OneDriveSearchResult,
  OneDriveBatchResult,
  OneDriveAuthResult,
  FileData,
  BatchUploadItem,
  ShareSettings,
  SearchOptions,
  OneDriveIntegrationError,
  OneDriveAuthenticationError,
  OneDriveFileError,
  OneDriveQuotaError,
  OneDriveRateLimitError,
  OneDriveNetworkError,
} from '../OneDriveIntegration';

// Mock fetch globally
const mockFetch = vi.fn() as Mock;
global.fetch = mockFetch;

// Helper function to create proper Response mock
function createMockResponse(data: any, options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
} = {}) {
  const headers = new Map(Object.entries(options.headers || {}));
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  
  const isArrayBuffer = data instanceof ArrayBuffer;
  
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? 'OK',
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) || null,
    },
    json: vi.fn().mockResolvedValue(isArrayBuffer ? {} : data),
    arrayBuffer: vi.fn().mockResolvedValue(isArrayBuffer ? data : new ArrayBuffer(data?.size || 1024)),
    text: vi.fn().mockResolvedValue(isArrayBuffer ? '' : JSON.stringify(data)),
  };
}

describe('OneDriveIntegration', () => {
  let oneDriveIntegration: OneDriveIntegration;
  let mockConfig: OneDriveConfig;
  let mockFileData: FileData;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://test.com/callback',
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      tenantId: 'test-tenant-id',
    };
    
    mockFileData = {
      name: 'test-file.txt',
      data: new ArrayBuffer(1024),
      mimeType: 'text/plain',
    };
    
    oneDriveIntegration = new OneDriveIntegration(mockConfig);
  });

  describe('Constructor and Configuration', () => {
    it('should create instance with valid config', () => {
      expect(oneDriveIntegration).toBeInstanceOf(OneDriveIntegration);
    });

    it('should throw error with missing client ID', () => {
      const invalidConfig = { ...mockConfig, clientId: '' };
      expect(() => new OneDriveIntegration(invalidConfig)).toThrow(OneDriveIntegrationError);
      expect(() => new OneDriveIntegration(invalidConfig)).toThrow('Client ID is required');
    });

    it('should throw error with missing client secret', () => {
      const invalidConfig = { ...mockConfig, clientSecret: '' };
      expect(() => new OneDriveIntegration(invalidConfig)).toThrow(OneDriveIntegrationError);
      expect(() => new OneDriveIntegration(invalidConfig)).toThrow('Client secret is required');
    });

    it('should throw error with missing redirect URI', () => {
      const invalidConfig = { ...mockConfig, redirectUri: '' };
      expect(() => new OneDriveIntegration(invalidConfig)).toThrow(OneDriveIntegrationError);
      expect(() => new OneDriveIntegration(invalidConfig)).toThrow('Redirect URI is required');
    });
  });

  describe('Authentication', () => {
    describe('generateAuthUrl', () => {
      it('should generate correct OAuth URL without state', () => {
        const authUrl = oneDriveIntegration.generateAuthUrl();
        
        expect(authUrl).toContain('https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/authorize');
        expect(authUrl).toContain(`client_id=${mockConfig.clientId}`);
        expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(mockConfig.redirectUri)}`);
        expect(authUrl).toContain('response_type=code');
        expect(authUrl).toContain('scope=Files.ReadWrite.All+offline_access');
      });

      it('should generate correct OAuth URL with state', () => {
        const state = 'test-state-123';
        const authUrl = oneDriveIntegration.generateAuthUrl(state);
        
        expect(authUrl).toContain(`state=${state}`);
      });

      it('should use common tenant when tenantId not provided', () => {
        const configWithoutTenant = { ...mockConfig, tenantId: undefined };
        const integration = new OneDriveIntegration(configWithoutTenant);
        const authUrl = integration.generateAuthUrl();
        
        expect(authUrl).toContain('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      });
    });

    describe('authenticate', () => {
      it('should successfully exchange code for tokens', async () => {
        const mockResponse = {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'Files.ReadWrite.All offline_access',
        };

        const mockResponseWithHeaders = createMockResponse(mockResponse);
        mockFetch.mockResolvedValueOnce(mockResponseWithHeaders);

        const result = await oneDriveIntegration.authenticate('test-code');

        expect(result).toEqual({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
          scope: ['Files.ReadWrite.All', 'offline_access'],
        });
      });

      it('should handle authentication failure', async () => {
        const mockErrorResponse = {
          error: 'invalid_grant',
          error_description: 'Invalid authorization code',
        };

        const mockErrorResponseWithHeaders = createMockResponse(mockErrorResponse, {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
        });

        mockFetch.mockResolvedValueOnce(mockErrorResponseWithHeaders);

        await expect(oneDriveIntegration.authenticate('invalid-code'))
          .rejects.toThrow(OneDriveAuthenticationError);
      });

      it('should handle network errors during authentication', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(oneDriveIntegration.authenticate('test-code'))
          .rejects.toThrow(OneDriveAuthenticationError);
      });
    });

    describe('refreshAccessToken', () => {
      it('should successfully refresh access token', async () => {
        const mockResponse = {
          access_token: 'refreshed-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'Files.ReadWrite.All offline_access',
        };

        const mockResponseWithHeaders = createMockResponse(mockResponse);
        mockFetch.mockResolvedValueOnce(mockResponseWithHeaders);

        const result = await oneDriveIntegration.refreshAccessToken('old-refresh-token');

        expect(result).toEqual({
          accessToken: 'refreshed-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
          scope: ['Files.ReadWrite.All', 'offline_access'],
        });
      });

      it('should keep old refresh token if new one not provided', async () => {
        const mockResponse = {
          access_token: 'refreshed-access-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'Files.ReadWrite.All offline_access',
        };

        const mockResponseWithHeaders = createMockResponse(mockResponse);
        mockFetch.mockResolvedValueOnce(mockResponseWithHeaders);

        const result = await oneDriveIntegration.refreshAccessToken('old-refresh-token');

        expect(result.refreshToken).toBe('old-refresh-token');
      });

      it('should handle token refresh failure', async () => {
        const mockErrorResponse = {
          error: 'invalid_grant',
          error_description: 'Refresh token expired',
        };

        const mockErrorResponseWithHeaders = createMockResponse(mockErrorResponse, {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
        });

        mockFetch.mockResolvedValueOnce(mockErrorResponseWithHeaders);

        await expect(oneDriveIntegration.refreshAccessToken('invalid-token'))
          .rejects.toThrow(OneDriveAuthenticationError);
      });
    });
  });

  describe('File Operations', () => {
    describe('uploadFile', () => {
      it('should successfully upload a small file', async () => {
        const mockResponse = {
          id: 'file-id-123',
          name: 'test-file.txt',
          parentReference: { path: '/drive/root:' },
          size: 1024,
          lastModifiedDateTime: '2024-01-01T12:00:00Z',
          createdDateTime: '2024-01-01T12:00:00Z',
          webUrl: 'https://onedrive.com/test-file.txt',
          eTag: 'etag-123',
          cTag: 'ctag-123',
        };

        const mockResponseWithHeaders = createMockResponse(mockResponse);
        mockFetch.mockResolvedValueOnce(mockResponseWithHeaders);

        const result = await oneDriveIntegration.uploadFile(mockFileData, '/test-file.txt');

        expect(result).toMatchObject({
          id: 'file-id-123',
          name: 'test-file.txt',
          path: '/test-file.txt',
          size: 1024,
          isFolder: false,
          webUrl: 'https://onedrive.com/test-file.txt',
          eTag: 'etag-123',
          cTag: 'ctag-123',
        });
      });

      it('should handle upload with conflict behavior', async () => {
        const mockResponse = {
          id: 'file-id-123',
          name: 'test-file (1).txt',
          parentReference: { path: '/drive/root:' },
          size: 1024,
          lastModifiedDateTime: '2024-01-01T12:00:00Z',
          createdDateTime: '2024-01-01T12:00:00Z',
        };

        const mockResponseWithHeaders = createMockResponse(mockResponse);
        mockFetch.mockResolvedValueOnce(mockResponseWithHeaders);

        const result = await oneDriveIntegration.uploadFile(mockFileData, '/test-file.txt', {
          conflictBehavior: 'rename',
        });

        expect(result.name).toBe('test-file (1).txt');
      });

      it('should throw error for missing access token', async () => {
        const configWithoutToken = { ...mockConfig, accessToken: undefined };
        const integration = new OneDriveIntegration(configWithoutToken);

        await expect(integration.uploadFile(mockFileData, '/test.txt'))
          .rejects.toThrow(OneDriveAuthenticationError);
      });

      it('should validate file data', async () => {
        const invalidFileData = { name: '', data: new ArrayBuffer(0) };

        await expect(oneDriveIntegration.uploadFile(invalidFileData as FileData, '/test.txt'))
          .rejects.toThrow(OneDriveFileError);
      });

      it('should validate path', async () => {
        await expect(oneDriveIntegration.uploadFile(mockFileData, ''))
          .rejects.toThrow(OneDriveFileError);
      });

      it('should handle upload failure', async () => {
        const mockErrorResponse = {
          error: { message: 'Invalid path' },
        };

        const mockErrorResponseWithHeaders = createMockResponse(mockErrorResponse, {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
        });

        mockFetch.mockResolvedValueOnce(mockErrorResponseWithHeaders);

        await expect(oneDriveIntegration.uploadFile(mockFileData, '/invalid/path'))
          .rejects.toThrow(OneDriveIntegrationError);
      });
    });

    describe('downloadFile', () => {
      it('should successfully download a file', async () => {
        const mockArrayBuffer = new ArrayBuffer(1024);
        
        // Create a special response that returns the raw Response object for download operations
        const mockResponse = {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: {
            get: (name: string) => name === 'content-type' ? 'application/octet-stream' : null,
          },
          json: vi.fn().mockResolvedValue({}),
          arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
          text: vi.fn().mockResolvedValue(''),
        };
        
        mockFetch.mockResolvedValueOnce(mockResponse);

        const result = await oneDriveIntegration.downloadFile('/test-file.txt');

        expect(result).toBeInstanceOf(ArrayBuffer);
        expect(result.byteLength).toBe(1024);
      });

      it('should handle download failure', async () => {
        const mockErrorResponse = {
          error: { message: 'File not found' },
        };

        const mockErrorResponseWithHeaders = createMockResponse(mockErrorResponse, {
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

        mockFetch.mockResolvedValueOnce(mockErrorResponseWithHeaders);

        await expect(oneDriveIntegration.downloadFile('/nonexistent.txt'))
          .rejects.toThrow(OneDriveIntegrationError);
      });

      it('should validate path', async () => {
        await expect(oneDriveIntegration.downloadFile(''))
          .rejects.toThrow(OneDriveFileError);
      });
    });

    describe('deleteFile', () => {
      it('should successfully delete a file', async () => {
        const mockResponseWithHeaders = createMockResponse({}, { status: 204 });
        mockFetch.mockResolvedValueOnce(mockResponseWithHeaders);

        const result = await oneDriveIntegration.deleteFile('/test-file.txt');

        expect(result).toBe(true);
      });

      it('should handle delete failure', async () => {
        const mockErrorResponse = {
          error: { message: 'File not found' },
        };

        const mockErrorResponseWithHeaders = createMockResponse(mockErrorResponse, {
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

        mockFetch.mockResolvedValueOnce(mockErrorResponseWithHeaders);

        await expect(oneDriveIntegration.deleteFile('/nonexistent.txt'))
          .rejects.toThrow(OneDriveIntegrationError);
      });
    });

    describe('moveFile', () => {
      it('should successfully move a file', async () => {
        const mockResponse = {
          id: 'file-id-123',
          name: 'moved-file.txt',
          parentReference: { path: '/drive/root:/new' },
          size: 1024,
          lastModifiedDateTime: '2024-01-01T12:00:00Z',
          createdDateTime: '2024-01-01T12:00:00Z',
        };

        const mockResponseWithHeaders = createMockResponse(mockResponse);
        mockFetch.mockResolvedValueOnce(mockResponseWithHeaders);

        const result = await oneDriveIntegration.moveFile('/old/file.txt', '/new/moved-file.txt');

        expect(result).toMatchObject({
          id: 'file-id-123',
          name: 'moved-file.txt',
          path: '/new/moved-file.txt',
          size: 1024,
          isFolder: false,
        });
      });

      it('should validate both paths', async () => {
        await expect(oneDriveIntegration.moveFile('', '/new/path'))
          .rejects.toThrow(OneDriveFileError);
        await expect(oneDriveIntegration.moveFile('/old/path', ''))
          .rejects.toThrow(OneDriveFileError);
      });
    });

    describe('copyFile', () => {
      it('should successfully copy a file', async () => {
        const mockResponse = {
          id: 'file-id-456',
          name: 'copied-file.txt',
          parentReference: { path: '/drive/root:/copy' },
          size: 1024,
          lastModifiedDateTime: '2024-01-01T12:00:00Z',
          createdDateTime: '2024-01-01T12:00:00Z',
        };

        const mockLocationResponse = {
          ok: true,
          status: 202,
          statusText: 'Accepted',
          headers: {
            get: (name: string) => name.toLowerCase() === 'location' ? 'https://api.onedrive.com/monitor/copy-operation' : null,
          },
          json: vi.fn().mockResolvedValue({}),
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
          text: vi.fn().mockResolvedValue(''),
        };

        const mockPollResponse = {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: {
            get: (name: string) => name === 'content-type' ? 'application/json' : null,
          },
          json: vi.fn().mockResolvedValue({
            status: 'completed',
            resourceId: mockResponse,
          }),
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
          text: vi.fn().mockResolvedValue(''),
        };

        mockFetch
          .mockResolvedValueOnce(mockLocationResponse)
          .mockResolvedValueOnce(mockPollResponse);

        const result = await oneDriveIntegration.copyFile('/original/file.txt', '/copy/copied-file.txt');

        expect(result).toMatchObject({
          id: 'file-id-456',
          name: 'copied-file.txt',
          path: '/copy/copied-file.txt',
          size: 1024,
          isFolder: false,
        });
      });
    });
  });

  describe('Folder Operations', () => {
    describe('createFolder', () => {
      it('should successfully create a folder', async () => {
        const mockResponse = {
          id: 'folder-id-123',
          name: 'new-folder',
          parentReference: { path: '/drive/root:' },
          lastModifiedDateTime: '2024-01-01T12:00:00Z',
          createdDateTime: '2024-01-01T12:00:00Z',
          folder: { childCount: 0 },
          webUrl: 'https://onedrive.com/new-folder',
        };

        const mockResponseWithHeaders = createMockResponse(mockResponse);
        mockFetch.mockResolvedValueOnce(mockResponseWithHeaders);

        const result = await oneDriveIntegration.createFolder('/new-folder');

        expect(result).toMatchObject({
          id: 'folder-id-123',
          name: 'new-folder',
          path: '/new-folder',
          isFolder: true,
          childCount: 0,
          webUrl: 'https://onedrive.com/new-folder',
        });
      });

      it('should handle folder creation failure', async () => {
        const mockErrorResponse = {
          error: { message: 'Folder already exists' },
        };

        const mockErrorResponseWithHeaders = createMockResponse(mockErrorResponse, {
          ok: false,
          status: 409,
          statusText: 'Conflict',
        });

        mockFetch.mockResolvedValueOnce(mockErrorResponseWithHeaders);

        await expect(oneDriveIntegration.createFolder('/existing-folder'))
          .rejects.toThrow(OneDriveIntegrationError);
      });
    });

    describe('listFolder', () => {
      it('should successfully list folder contents', async () => {
        const mockResponse = {
          value: [
            {
              id: 'file-id-1',
              name: 'file1.txt',
              parentReference: { path: '/drive/root:/folder' },
              size: 1024,
              lastModifiedDateTime: '2024-01-01T12:00:00Z',
              createdDateTime: '2024-01-01T12:00:00Z',
            },
            {
              id: 'folder-id-1',
              name: 'subfolder',
              parentReference: { path: '/drive/root:/folder' },
              lastModifiedDateTime: '2024-01-01T12:00:00Z',
              createdDateTime: '2024-01-01T12:00:00Z',
              folder: { childCount: 2 },
            },
          ],
        };

        const mockResponseWithHeaders = createMockResponse(mockResponse);
        mockFetch.mockResolvedValueOnce(mockResponseWithHeaders);

        const result = await oneDriveIntegration.listFolder('/folder');

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
          id: 'file-id-1',
          name: 'file1.txt',
          isFolder: false,
        });
        expect(result[1]).toMatchObject({
          id: 'folder-id-1',
          name: 'subfolder',
          isFolder: true,
        });
      });

      it('should handle options correctly', async () => {
        const mockResponse = { value: [] };
        const mockResponseWithHeaders = createMockResponse(mockResponse);
        mockFetch.mockResolvedValueOnce(mockResponseWithHeaders);

        await oneDriveIntegration.listFolder('/folder', {
          top: 10,
          orderBy: 'name',
          filter: "name eq 'test'",
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('%24top=10'),
          expect.any(Object)
        );
      });

      it('should list root folder when no path provided', async () => {
        const mockResponse = { value: [] };
        const mockResponseWithHeaders = createMockResponse(mockResponse);
        mockFetch.mockResolvedValueOnce(mockResponseWithHeaders);

        await oneDriveIntegration.listFolder();

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/me/drive/root/children'),
          expect.any(Object)
        );
      });
    });

    describe('deleteFolder', () => {
      it('should successfully delete a folder', async () => {
        const mockResponseWithHeaders = createMockResponse({}, { status: 204 });
        mockFetch.mockResolvedValueOnce(mockResponseWithHeaders);

        const result = await oneDriveIntegration.deleteFolder('/test-folder');

        expect(result).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    describe('Rate Limiting', () => {
      it('should handle rate limit errors', async () => {
        vi.clearAllMocks(); // Clear previous mocks to avoid confusion
        
        const mockErrorResponseWithHeaders = {
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: {
            get: (name: string) => {
              if (name.toLowerCase() === 'retry-after') return '60';
              if (name.toLowerCase() === 'content-type') return 'application/json';
              return null;
            },
          },
          json: vi.fn().mockResolvedValue({}),
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
          text: vi.fn().mockResolvedValue(''),
        };

        mockFetch.mockResolvedValueOnce(mockErrorResponseWithHeaders);

        await expect(oneDriveIntegration.downloadFile('/test.txt'))
          .rejects.toThrow(OneDriveRateLimitError);
      });
    });

    describe('Quota Exceeded', () => {
      it('should handle quota exceeded errors', async () => {
        vi.clearAllMocks(); // Clear previous mocks to avoid confusion
        
        const mockErrorResponseWithHeaders = {
          ok: false,
          status: 507,
          statusText: 'Insufficient Storage',
          headers: {
            get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null,
          },
          json: vi.fn().mockResolvedValue({}),
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
          text: vi.fn().mockResolvedValue(''),
        };

        mockFetch.mockResolvedValueOnce(mockErrorResponseWithHeaders);

        await expect(oneDriveIntegration.uploadFile(mockFileData, '/test.txt'))
          .rejects.toThrow(OneDriveQuotaError);
      });
    });

    describe('Authentication Errors', () => {
      it('should handle invalid access token', async () => {
        vi.clearAllMocks(); // Clear previous mocks to avoid confusion
        
        const mockErrorResponseWithHeaders = {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          headers: {
            get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null,
          },
          json: vi.fn().mockResolvedValue({}),
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
          text: vi.fn().mockResolvedValue(''),
        };

        mockFetch.mockResolvedValueOnce(mockErrorResponseWithHeaders);

        await expect(oneDriveIntegration.downloadFile('/test.txt'))
          .rejects.toThrow(OneDriveAuthenticationError);
      });
    });

    describe('Network Errors', () => {
      it('should handle network failures', async () => {
        vi.clearAllMocks(); // Clear previous mocks to avoid confusion
        
        mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

        await expect(oneDriveIntegration.downloadFile('/test.txt'))
          .rejects.toThrow(OneDriveNetworkError);
      });
    });
  });

  describe('Batch Operations', () => {
    describe('batchUpload', () => {
      it('should successfully upload multiple files', async () => {
        const mockResponse1 = {
          id: 'file-id-1',
          name: 'file1.txt',
          parentReference: { path: '/drive/root:' },
          size: 1024,
          lastModifiedDateTime: '2024-01-01T12:00:00Z',
          createdDateTime: '2024-01-01T12:00:00Z',
        };

        const mockResponse2 = {
          id: 'file-id-2',
          name: 'file2.txt',
          parentReference: { path: '/drive/root:' },
          size: 2048,
          lastModifiedDateTime: '2024-01-01T12:00:00Z',
          createdDateTime: '2024-01-01T12:00:00Z',
        };

        const mockResponseWithHeaders1 = createMockResponse(mockResponse1);
        const mockResponseWithHeaders2 = createMockResponse(mockResponse2);

        mockFetch
          .mockResolvedValueOnce(mockResponseWithHeaders1)
          .mockResolvedValueOnce(mockResponseWithHeaders2);

        const files: BatchUploadItem[] = [
          { file: { name: 'file1.txt', data: new ArrayBuffer(1024) }, path: '/file1.txt' },
          { file: { name: 'file2.txt', data: new ArrayBuffer(2048) }, path: '/file2.txt' },
        ];

        const result = await oneDriveIntegration.batchUpload(files);

        expect(result.status).toBe('complete');
        expect(result.entries).toHaveLength(2);
        expect(result.errorCount).toBe(0);
        expect(result.entries[0].status).toBe('success');
        expect(result.entries[1].status).toBe('success');
      });

      it('should handle partial failures in batch upload', async () => {
        const mockResponse1 = {
          id: 'file-id-1',
          name: 'file1.txt',
          parentReference: { path: '/drive/root:' },
          size: 1024,
          lastModifiedDateTime: '2024-01-01T12:00:00Z',
          createdDateTime: '2024-01-01T12:00:00Z',
        };

        const mockErrorResponse = {
          error: { message: 'Invalid path' },
        };

        const mockResponseWithHeaders1 = createMockResponse(mockResponse1);
        const mockErrorResponseWithHeaders = createMockResponse(mockErrorResponse, {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
        });

        mockFetch
          .mockResolvedValueOnce(mockResponseWithHeaders1)
          .mockResolvedValueOnce(mockErrorResponseWithHeaders);

        const files: BatchUploadItem[] = [
          { file: { name: 'file1.txt', data: new ArrayBuffer(1024) }, path: '/file1.txt' },
          { file: { name: 'file2.txt', data: new ArrayBuffer(2048) }, path: '/invalid/file2.txt' },
        ];

        const result = await oneDriveIntegration.batchUpload(files);

        expect(result.status).toBe('complete');
        expect(result.entries).toHaveLength(2);
        expect(result.errorCount).toBe(1);
        expect(result.entries[0].status).toBe('success');
        expect(result.entries[1].status).toBe('failed');
      });

      it('should validate batch upload items', async () => {
        const invalidItems: BatchUploadItem[] = [];

        await expect(oneDriveIntegration.batchUpload(invalidItems))
          .rejects.toThrow(OneDriveFileError);
      });
    });

    describe('batchDownload', () => {
      it('should successfully download multiple files', async () => {
        const mockArrayBuffer1 = new ArrayBuffer(1024);
        const mockArrayBuffer2 = new ArrayBuffer(2048);

        const mockResponseWithHeaders1 = createMockResponse(mockArrayBuffer1);
        const mockResponseWithHeaders2 = createMockResponse(mockArrayBuffer2);

        mockFetch
          .mockResolvedValueOnce(mockResponseWithHeaders1)
          .mockResolvedValueOnce(mockResponseWithHeaders2);

        const paths = ['/file1.txt', '/file2.txt'];
        const result = await oneDriveIntegration.batchDownload(paths);

        expect(result.status).toBe('complete');
        expect(result.entries).toHaveLength(2);
        expect(result.errorCount).toBe(0);
        expect(result.entries[0].status).toBe('success');
        expect(result.entries[1].status).toBe('success');
      });

      it('should validate paths array', async () => {
        await expect(oneDriveIntegration.batchDownload([]))
          .rejects.toThrow(OneDriveFileError);
      });
    });
  });

  describe('Path Normalization', () => {
    it('should normalize paths correctly in various operations', async () => {
      const mockResponse = {
        id: 'file-id-123',
        name: 'test-file.txt',
        parentReference: { path: '/drive/root:' },
        size: 1024,
        lastModifiedDateTime: '2024-01-01T12:00:00Z',
        createdDateTime: '2024-01-01T12:00:00Z',
      };

      const mockResponseWithHeaders = createMockResponse(mockResponse);
      mockFetch.mockResolvedValueOnce(mockResponseWithHeaders);

      // Test with various path formats
      await oneDriveIntegration.uploadFile(mockFileData, 'test-file.txt');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-file.txt'),
        expect.any(Object)
      );
    });
  });

  describe('ULID Integration', () => {
    it('should generate ULID for batch operations', async () => {
      const mockResponse = {
        id: 'file-id-123',
        name: 'test-file.txt',
        parentReference: { path: '/drive/root:' },
        size: 1024,
        lastModifiedDateTime: '2024-01-01T12:00:00Z',
        createdDateTime: '2024-01-01T12:00:00Z',
      };

      const mockResponseWithHeaders = createMockResponse(mockResponse);
      mockFetch.mockResolvedValueOnce(mockResponseWithHeaders);

      const files: BatchUploadItem[] = [
        { file: { name: 'test.txt', data: new ArrayBuffer(1024) }, path: '/test.txt' },
      ];

      const result = await oneDriveIntegration.batchUpload(files);

      expect(result.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID format
    });
  });
});
