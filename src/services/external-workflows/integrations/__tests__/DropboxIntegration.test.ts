import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ulid } from 'ulid';
import {
  DropboxIntegration,
  DropboxConfig,
  DropboxFile,
  DropboxFolder,
  DropboxEntry,
  DropboxShareLink,
  DropboxSharedFolder,
  DropboxMetadata,
  DropboxSearchResult,
  DropboxBatchResult,
  DropboxAuthResult,
  FileData,
  BatchUploadItem,
  ShareSettings,
  SearchOptions,
  ThumbnailSize,
  DropboxIntegrationError,
  DropboxAuthenticationError,
  DropboxFileError,
  DropboxQuotaError,
  DropboxRateLimitError,
  DropboxNetworkError,
} from '../DropboxIntegration';

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
  headers.set('content-type', 'application/json');
  
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? 'OK',
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) || null,
    },
    json: vi.fn().mockResolvedValue(data),
    arrayBuffer: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

describe('DropboxIntegration', () => {
  let dropboxIntegration: DropboxIntegration;
  let mockConfig: DropboxConfig;
  let mockFileData: FileData;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://test.com/callback',
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
    };
    
    mockFileData = {
      name: 'test-file.txt',
      data: new ArrayBuffer(1024),
      mimeType: 'text/plain',
    };
    
    dropboxIntegration = new DropboxIntegration(mockConfig);
  });

  describe('Constructor and Configuration', () => {
    it('should create instance with valid config', () => {
      expect(dropboxIntegration).toBeInstanceOf(DropboxIntegration);
    });

    it('should throw error with missing client ID', () => {
      const invalidConfig = { ...mockConfig, clientId: '' };
      expect(() => new DropboxIntegration(invalidConfig)).toThrow(DropboxIntegrationError);
      expect(() => new DropboxIntegration(invalidConfig)).toThrow('Client ID is required');
    });

    it('should throw error with missing client secret', () => {
      const invalidConfig = { ...mockConfig, clientSecret: '' };
      expect(() => new DropboxIntegration(invalidConfig)).toThrow(DropboxIntegrationError);
      expect(() => new DropboxIntegration(invalidConfig)).toThrow('Client secret is required');
    });

    it('should throw error with missing redirect URI', () => {
      const invalidConfig = { ...mockConfig, redirectUri: '' };
      expect(() => new DropboxIntegration(invalidConfig)).toThrow(DropboxIntegrationError);
      expect(() => new DropboxIntegration(invalidConfig)).toThrow('Redirect URI is required');
    });
  });

  describe('Authentication', () => {
    describe('generateAuthUrl', () => {
      it('should generate correct OAuth URL without state', () => {
        const authUrl = dropboxIntegration.generateAuthUrl();
        
        expect(authUrl).toContain('https://www.dropbox.com/oauth2/authorize');
        expect(authUrl).toContain(`client_id=${mockConfig.clientId}`);
        expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(mockConfig.redirectUri)}`);
        expect(authUrl).toContain('response_type=code');
        expect(authUrl).toContain('token_access_type=offline');
      });

      it('should generate correct OAuth URL with state', () => {
        const state = 'test-state-123';
        const authUrl = dropboxIntegration.generateAuthUrl(state);
        
        expect(authUrl).toContain(`state=${state}`);
      });
    });

    describe('authenticate', () => {
      it('should successfully exchange code for tokens', async () => {
        const mockResponse = {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'files.metadata.write files.content.write',
          account_id: 'test-account-id',
        };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

        const result = await dropboxIntegration.authenticate('test-code');

        expect(result).toEqual({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
          scope: ['files.metadata.write', 'files.content.write'],
          accountId: 'test-account-id',
        });
      });

      it('should handle authentication failure', async () => {
        const mockErrorResponse = {
          error: 'invalid_grant',
          error_description: 'Invalid authorization code',
        };

        mockFetch
          .mockResolvedValueOnce(createMockResponse(mockErrorResponse, {
            ok: false,
            status: 400,
          }))
          .mockResolvedValueOnce(createMockResponse(mockErrorResponse, {
            ok: false,
            status: 400,
          }));

        await expect(dropboxIntegration.authenticate('invalid-code'))
          .rejects.toThrow(DropboxAuthenticationError);
        await expect(dropboxIntegration.authenticate('invalid-code'))
          .rejects.toThrow('Authentication failed: Invalid authorization code');
      });

      it('should handle network errors during authentication', async () => {
        mockFetch
          .mockRejectedValueOnce(new Error('Network error'))
          .mockRejectedValueOnce(new Error('Network error'));

        await expect(dropboxIntegration.authenticate('test-code'))
          .rejects.toThrow(DropboxAuthenticationError);
        await expect(dropboxIntegration.authenticate('test-code'))
          .rejects.toThrow('Authentication request failed: Network error');
      });
    });

    describe('refreshAccessToken', () => {
      it('should successfully refresh access token', async () => {
        const mockResponse = {
          access_token: 'refreshed-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          account_id: 'test-account-id',
        };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

        const result = await dropboxIntegration.refreshAccessToken('old-refresh-token');

        expect(result).toEqual({
          accessToken: 'refreshed-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
          scope: [],
          accountId: 'test-account-id',
        });
      });

      it('should keep old refresh token if new one not provided', async () => {
        const mockResponse = {
          access_token: 'refreshed-access-token',
          expires_in: 3600,
          token_type: 'Bearer',
          account_id: 'test-account-id',
        };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

        const result = await dropboxIntegration.refreshAccessToken('old-refresh-token');

        expect(result.refreshToken).toBe('old-refresh-token');
      });

      it('should handle token refresh failure', async () => {
        mockFetch.mockResolvedValueOnce(createMockResponse({
          error: 'invalid_grant',
          error_description: 'Invalid refresh token',
        }, {
          ok: false,
          status: 400,
        }));

        await expect(dropboxIntegration.refreshAccessToken('invalid-token'))
          .rejects.toThrow(DropboxAuthenticationError);
      });
    });
  });

  describe('File Operations', () => {
    describe('uploadFile', () => {
      it('should successfully upload a small file', async () => {
        const mockResponse = {
          id: 'file-id-123',
          name: 'test-file.txt',
          path_display: '/test-file.txt',
          size: 1024,
          server_modified: '2024-01-01T12:00:00Z',
          '.tag': 'file',
          content_hash: 'hash-123',
        };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

        const result = await dropboxIntegration.uploadFile(mockFileData, '/test-file.txt');

        expect(result).toMatchObject({
          id: 'file-id-123',
          name: 'test-file.txt',
          path: '/test-file.txt',
          size: 1024,
          isFolder: false,
          contentHash: 'hash-123',
        });
      });

      it('should handle upload with options', async () => {
        const mockResponse = {
          id: 'file-id-123',
          name: 'test-file (1).txt',
          path_display: '/test-file (1).txt',
          size: 1024,
          server_modified: '2024-01-01T12:00:00Z',
          '.tag': 'file',
        };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

        const result = await dropboxIntegration.uploadFile(mockFileData, '/test-file.txt', {
          autorename: true,
          mute: true,
        });

        expect(result.name).toBe('test-file (1).txt');
      });

      it('should throw error for missing access token', async () => {
        const configWithoutToken = { ...mockConfig, accessToken: undefined };
        const integration = new DropboxIntegration(configWithoutToken);

        await expect(integration.uploadFile(mockFileData, '/test.txt'))
          .rejects.toThrow(DropboxAuthenticationError);
        await expect(integration.uploadFile(mockFileData, '/test.txt'))
          .rejects.toThrow('Access token is required for API calls');
      });

      it('should validate file data', async () => {
        const invalidFileData = { name: '', data: new ArrayBuffer(0) };

        await expect(dropboxIntegration.uploadFile(invalidFileData as FileData, '/test.txt'))
          .rejects.toThrow(DropboxFileError);
      });

      it('should validate path', async () => {
        await expect(dropboxIntegration.uploadFile(mockFileData, ''))
          .rejects.toThrow(DropboxFileError);
        await expect(dropboxIntegration.uploadFile(mockFileData, ''))
          .rejects.toThrow('Valid path is required');
      });

      it('should handle upload failure', async () => {
        mockFetch.mockResolvedValueOnce(createMockResponse({
          error_summary: 'Invalid path',
        }, {
          ok: false,
          status: 400,
        }));

        await expect(dropboxIntegration.uploadFile(mockFileData, '/invalid/path'))
          .rejects.toThrow(DropboxIntegrationError);
      });
    });

    describe('downloadFile', () => {
      it('should successfully download a file', async () => {
        const mockArrayBuffer = new ArrayBuffer(1024);
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: {
            get: () => null,
          },
          arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        });

        const result = await dropboxIntegration.downloadFile('/test-file.txt');

        expect(result).toBe(mockArrayBuffer);
      });

      it('should handle download failure', async () => {
        mockFetch
          .mockResolvedValueOnce(createMockResponse({
            error_summary: 'File not found',
          }, {
            ok: false,
            status: 404,
          }))
          .mockResolvedValueOnce(createMockResponse({
            error_summary: 'File not found',
          }, {
            ok: false,
            status: 404,
          }));

        await expect(dropboxIntegration.downloadFile('/nonexistent.txt'))
          .rejects.toThrow(DropboxIntegrationError);
        await expect(dropboxIntegration.downloadFile('/nonexistent.txt'))
          .rejects.toThrow('API request failed: File not found');
      });

      it('should validate path', async () => {
        await expect(dropboxIntegration.downloadFile(''))
          .rejects.toThrow(DropboxFileError);
      });
    });

    describe('deleteFile', () => {
      it('should successfully delete a file', async () => {
        mockFetch.mockResolvedValueOnce(createMockResponse({}));

        const result = await dropboxIntegration.deleteFile('/test-file.txt');

        expect(result).toBe(true);
      });

      it('should handle delete failure', async () => {
        mockFetch.mockResolvedValueOnce(createMockResponse({
          error_summary: 'File not found',
        }, {
          ok: false,
          status: 404,
        }));

        await expect(dropboxIntegration.deleteFile('/nonexistent.txt'))
          .rejects.toThrow(DropboxIntegrationError);
      });
    });

    describe('moveFile', () => {
      it('should successfully move a file', async () => {
        const mockResponse = {
          metadata: {
            id: 'file-id-123',
            name: 'moved-file.txt',
            path_display: '/new/moved-file.txt',
            size: 1024,
            server_modified: '2024-01-01T12:00:00Z',
            '.tag': 'file',
          },
        };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

        const result = await dropboxIntegration.moveFile('/old/file.txt', '/new/moved-file.txt');

        expect(result).toMatchObject({
          id: 'file-id-123',
          name: 'moved-file.txt',
          path: '/new/moved-file.txt',
          size: 1024,
          isFolder: false,
        });
      });

      it('should validate both paths', async () => {
        await expect(dropboxIntegration.moveFile('', '/new/path.txt'))
          .rejects.toThrow(DropboxFileError);
        await expect(dropboxIntegration.moveFile('/old/path.txt', ''))
          .rejects.toThrow(DropboxFileError);
      });
    });

    describe('copyFile', () => {
      it('should successfully copy a file', async () => {
        const mockResponse = {
          metadata: {
            id: 'file-id-456',
            name: 'copied-file.txt',
            path_display: '/copy/copied-file.txt',
            size: 1024,
            server_modified: '2024-01-01T12:00:00Z',
            '.tag': 'file',
          },
        };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

        const result = await dropboxIntegration.copyFile('/original/file.txt', '/copy/copied-file.txt');

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
          metadata: {
            id: 'folder-id-123',
            name: 'new-folder',
            path_display: '/new-folder',
            server_modified: '2024-01-01T12:00:00Z',
            '.tag': 'folder',
          },
        };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

        const result = await dropboxIntegration.createFolder('/new-folder');

        expect(result).toMatchObject({
          id: 'folder-id-123',
          name: 'new-folder',
          path: '/new-folder',
          isFolder: true,
        });
      });

      it('should handle folder creation failure', async () => {
        mockFetch.mockResolvedValueOnce(createMockResponse({
          error_summary: 'Folder already exists',
        }, {
          ok: false,
          status: 409,
        }));

        await expect(dropboxIntegration.createFolder('/existing-folder'))
          .rejects.toThrow(DropboxIntegrationError);
      });
    });

    describe('listFolder', () => {
      it('should successfully list folder contents', async () => {
        const mockResponse = {
          entries: [
            {
              id: 'file-id-1',
              name: 'file1.txt',
              path_display: '/folder/file1.txt',
              size: 1024,
              server_modified: '2024-01-01T12:00:00Z',
              '.tag': 'file',
            },
            {
              id: 'folder-id-1',
              name: 'subfolder',
              path_display: '/folder/subfolder',
              server_modified: '2024-01-01T12:00:00Z',
              '.tag': 'folder',
            },
          ],
          has_more: false,
          cursor: 'cursor-123',
        };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

        const result = await dropboxIntegration.listFolder('/folder');

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
          id: 'file-id-1',
          name: 'file1.txt',
          path: '/folder/file1.txt',
          isFolder: false,
        });
        expect(result[1]).toMatchObject({
          id: 'folder-id-1',
          name: 'subfolder',
          path: '/folder/subfolder',
          isFolder: true,
        });
      });

      it('should handle pagination', async () => {
        const firstResponse = {
          entries: [
            {
              id: 'file-id-1',
              name: 'file1.txt',
              path_display: '/folder/file1.txt',
              size: 1024,
              server_modified: '2024-01-01T12:00:00Z',
              '.tag': 'file',
            },
          ],
          has_more: true,
          cursor: 'cursor-123',
        };

        const secondResponse = {
          entries: [
            {
              id: 'file-id-2',
              name: 'file2.txt',
              path_display: '/folder/file2.txt',
              size: 2048,
              server_modified: '2024-01-01T12:00:00Z',
              '.tag': 'file',
            },
          ],
          has_more: false,
          cursor: 'cursor-456',
        };

        mockFetch
          .mockResolvedValueOnce(createMockResponse(firstResponse))
          .mockResolvedValueOnce(createMockResponse(secondResponse));

        const result = await dropboxIntegration.listFolder('/folder');

        expect(result).toHaveLength(2);
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it('should list root folder when no path provided', async () => {
        const mockResponse = {
          entries: [],
          has_more: false,
          cursor: 'cursor-root',
        };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

        await dropboxIntegration.listFolder();

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.dropboxapi.com/2/files/list_folder',
          expect.objectContaining({
            body: JSON.stringify({
              path: '',
              recursive: false,
              include_deleted: false,
              limit: 2000,
            }),
          })
        );
      });

      it('should handle options correctly', async () => {
        const mockResponse = {
          entries: [],
          has_more: false,
          cursor: 'cursor-options',
        };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

        await dropboxIntegration.listFolder('/folder', {
          recursive: true,
          includeDeleted: true,
          limit: 100,
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.dropboxapi.com/2/files/list_folder',
          expect.objectContaining({
            body: JSON.stringify({
              path: '/folder',
              recursive: true,
              include_deleted: true,
              limit: 100,
            }),
          })
        );
      });
    });

    describe('deleteFolder', () => {
      it('should successfully delete a folder', async () => {
        mockFetch.mockResolvedValueOnce(createMockResponse({}));

        const result = await dropboxIntegration.deleteFolder('/test-folder');

        expect(result).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    describe('Rate Limiting', () => {
      it('should handle rate limit errors', async () => {
        mockFetch
          .mockResolvedValueOnce(createMockResponse({}, {
            ok: false,
            status: 429,
          }))
          .mockResolvedValueOnce(createMockResponse({}, {
            ok: false,
            status: 429,
          }));

        await expect(dropboxIntegration.downloadFile('/test.txt'))
          .rejects.toThrow(DropboxRateLimitError);
        await expect(dropboxIntegration.downloadFile('/test.txt'))
          .rejects.toThrow('Rate limit exceeded');
      });
    });

    describe('Quota Exceeded', () => {
      it('should handle quota exceeded errors', async () => {
        mockFetch
          .mockResolvedValueOnce(createMockResponse({}, {
            ok: false,
            status: 507,
          }))
          .mockResolvedValueOnce(createMockResponse({}, {
            ok: false,
            status: 507,
          }));

        await expect(dropboxIntegration.uploadFile(mockFileData, '/test.txt'))
          .rejects.toThrow(DropboxQuotaError);
        await expect(dropboxIntegration.uploadFile(mockFileData, '/test.txt'))
          .rejects.toThrow('Storage quota exceeded');
      });
    });

    describe('Authentication Errors', () => {
      it('should handle invalid access token', async () => {
        mockFetch
          .mockResolvedValueOnce(createMockResponse({}, {
            ok: false,
            status: 401,
          }))
          .mockResolvedValueOnce(createMockResponse({}, {
            ok: false,
            status: 401,
          }));

        await expect(dropboxIntegration.downloadFile('/test.txt'))
          .rejects.toThrow(DropboxAuthenticationError);
        await expect(dropboxIntegration.downloadFile('/test.txt'))
          .rejects.toThrow('Invalid or expired access token');
      });
    });

    describe('Network Errors', () => {
      it('should handle network failures', async () => {
        mockFetch
          .mockRejectedValueOnce(new Error('Network timeout'))
          .mockRejectedValueOnce(new Error('Network timeout'));

        await expect(dropboxIntegration.downloadFile('/test.txt'))
          .rejects.toThrow(DropboxNetworkError);
        await expect(dropboxIntegration.downloadFile('/test.txt'))
          .rejects.toThrow('Network request failed: Network timeout');
      });
    });
  });

  describe('Batch Operations', () => {
    describe('batchUpload', () => {
      it('should successfully upload multiple files', async () => {
        const batchItems: BatchUploadItem[] = [
          {
            file: { name: 'file1.txt', data: new ArrayBuffer(1024) },
            path: '/file1.txt',
          },
          {
            file: { name: 'file2.txt', data: new ArrayBuffer(2048) },
            path: '/file2.txt',
          },
        ];

        // Mock successful uploads
        mockFetch
          .mockResolvedValueOnce(createMockResponse({
            id: 'file-id-1',
            name: 'file1.txt',
            path_display: '/file1.txt',
            size: 1024,
            server_modified: '2024-01-01T12:00:00Z',
            '.tag': 'file',
          }))
          .mockResolvedValueOnce(createMockResponse({
            id: 'file-id-2',
            name: 'file2.txt',
            path_display: '/file2.txt',
            size: 2048,
            server_modified: '2024-01-01T12:00:00Z',
            '.tag': 'file',
          }));

        const result = await dropboxIntegration.batchUpload(batchItems);

        expect(result.status).toBe('complete');
        expect(result.entries).toHaveLength(2);
        expect(result.errorCount).toBe(0);
        expect(result.entries[0].status).toBe('success');
        expect(result.entries[1].status).toBe('success');
      });

      it('should handle partial failures in batch upload', async () => {
        const batchItems: BatchUploadItem[] = [
          {
            file: { name: 'file1.txt', data: new ArrayBuffer(1024) },
            path: '/file1.txt',
          },
          {
            file: { name: 'file2.txt', data: new ArrayBuffer(2048) },
            path: '/invalid/file2.txt',
          },
        ];

        // Mock one success, one failure
        mockFetch
          .mockResolvedValueOnce(createMockResponse({
            id: 'file-id-1',
            name: 'file1.txt',
            path_display: '/file1.txt',
            size: 1024,
            server_modified: '2024-01-01T12:00:00Z',
            '.tag': 'file',
          }))
          .mockResolvedValueOnce(createMockResponse({
            error_summary: 'Invalid path',
          }, {
            ok: false,
            status: 400,
          }));

        const result = await dropboxIntegration.batchUpload(batchItems);

        expect(result.status).toBe('complete'); // Mixed results still marked as complete
        expect(result.entries).toHaveLength(2);
        expect(result.errorCount).toBe(1);
        expect(result.entries[0].status).toBe('success');
        expect(result.entries[1].status).toBe('failed');
        expect(result.entries[1].error).toContain('Invalid path');
      });

      it('should validate batch upload items', async () => {
        const invalidItems: any[] = [
          {
            file: { name: '', data: new ArrayBuffer(0) },
            path: '/invalid.txt',
          },
        ];

        await expect(dropboxIntegration.batchUpload(invalidItems))
          .rejects.toThrow(DropboxFileError);
        await expect(dropboxIntegration.batchUpload(invalidItems))
          .rejects.toThrow('Invalid upload item at index 0');
      });
    });

    describe('batchDownload', () => {
      it('should successfully download multiple files', async () => {
        const paths = ['/file1.txt', '/file2.txt'];
        
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: {
              get: () => null,
            },
            arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: {
              get: () => null,
            },
            arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(2048)),
          });

        const result = await dropboxIntegration.batchDownload(paths);

        expect(result.status).toBe('complete');
        expect(result.entries).toHaveLength(2);
        expect(result.errorCount).toBe(0);
        expect(result.entries[0].status).toBe('success');
        expect(result.entries[1].status).toBe('success');
      });

      it('should validate paths array', async () => {
        await expect(dropboxIntegration.batchDownload([]))
          .rejects.toThrow(DropboxFileError);
        await expect(dropboxIntegration.batchDownload([]))
          .rejects.toThrow('Non-empty array of paths is required');
      });
    });
  });

  describe('Path Normalization', () => {
    it('should normalize paths correctly in various operations', async () => {
      // Test with uploadFile to verify path normalization
      mockFetch.mockResolvedValueOnce(createMockResponse({
        id: 'test-id',
        name: 'test.txt',
        path_display: '/normalized/test.txt',
        size: 1024,
        server_modified: '2024-01-01T12:00:00Z',
        '.tag': 'file',
      }));

      await dropboxIntegration.uploadFile(mockFileData, 'normalized/test.txt');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Dropbox-API-Arg': JSON.stringify({
              path: '/normalized/test.txt',
              mode: 'add',
              autorename: false,
              mute: false,
            }),
          }),
        })
      );
    });
  });

  describe('ULID Integration', () => {
    it('should generate ULID for batch operations', async () => {
      const batchItems: BatchUploadItem[] = [
        {
          file: { name: 'test.txt', data: new ArrayBuffer(1024) },
          path: '/test.txt',
        },
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        id: 'file-id-1',
        name: 'test.txt',
        path_display: '/test.txt',
        size: 1024,
        server_modified: '2024-01-01T12:00:00Z',
        '.tag': 'file',
      }));

      const result = await dropboxIntegration.batchUpload(batchItems);

      // Verify ULID format (26 characters, alphanumeric)
      expect(result.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });
  });
});
