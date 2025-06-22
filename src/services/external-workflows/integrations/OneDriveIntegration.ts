import { ulid } from 'ulid';
import { ExternalWorkflowError } from '../errors/ExternalWorkflowErrors';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

export interface OneDriveConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly tenantId?: string; // Optional for personal accounts
}

export interface OneDriveFile {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly size: number;
  readonly modifiedTime: Date;
  readonly createdTime: Date;
  readonly isFolder: boolean;
  readonly downloadUrl?: string;
  readonly webUrl?: string;
  readonly eTag?: string;
  readonly cTag?: string;
}

export interface OneDriveFolder {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly modifiedTime: Date;
  readonly createdTime: Date;
  readonly isFolder: true;
  readonly childCount?: number;
  readonly webUrl?: string;
}

export interface OneDriveEntry {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly size?: number;
  readonly modifiedTime: Date;
  readonly createdTime: Date;
  readonly isFolder: boolean;
  readonly webUrl?: string;
  readonly eTag?: string;
}

export interface OneDriveShareLink {
  readonly id: string;
  readonly url: string;
  readonly type: 'view' | 'edit' | 'embed';
  readonly scope: 'anonymous' | 'organization';
  readonly expirationDateTime?: Date;
  readonly password?: boolean;
}

export interface OneDrivePermission {
  readonly id: string;
  readonly roles: string[];
  readonly grantedTo?: OneDriveIdentity;
  readonly grantedToIdentities?: OneDriveIdentity[];
  readonly link?: OneDriveShareLink;
  readonly expirationDateTime?: Date;
}

export interface OneDriveIdentity {
  readonly id?: string;
  readonly displayName?: string;
  readonly email?: string;
}

export interface OneDriveSearchResult {
  readonly items: OneDriveEntry[];
  readonly nextLink?: string;
}

export interface OneDriveBatchResult {
  readonly id: string;
  readonly status: 'in_progress' | 'complete' | 'failed';
  readonly entries: OneDriveBatchEntry[];
  readonly completedAt?: Date;
  readonly errorCount: number;
}

export interface OneDriveBatchEntry {
  readonly path: string;
  readonly status: 'success' | 'failed';
  readonly result?: OneDriveFile;
  readonly error?: string;
}

export interface OneDriveAuthResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly tokenType: string;
  readonly scope: string[];
}

export interface FileData {
  readonly name: string;
  readonly data: ArrayBuffer;
  readonly mimeType?: string;
}

export interface BatchUploadItem {
  readonly file: FileData;
  readonly path: string;
  readonly conflictBehavior?: 'rename' | 'replace' | 'fail';
}

export interface ShareSettings {
  readonly type?: 'view' | 'edit' | 'embed';
  readonly scope?: 'anonymous' | 'organization';
  readonly password?: string;
  readonly expirationDateTime?: Date;
}

export interface SearchOptions {
  readonly top?: number;
  readonly orderBy?: string;
  readonly filter?: string;
  readonly expand?: string[];
  readonly select?: string[];
}

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class OneDriveIntegrationError extends ExternalWorkflowError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, code, context);
    this.name = 'OneDriveIntegrationError';
  }
}

export class OneDriveAuthenticationError extends OneDriveIntegrationError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'ONEDRIVE_AUTH_ERROR', context);
    this.name = 'OneDriveAuthenticationError';
  }
}

export class OneDriveFileError extends OneDriveIntegrationError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'ONEDRIVE_FILE_ERROR', context);
    this.name = 'OneDriveFileError';
  }
}

export class OneDriveQuotaError extends OneDriveIntegrationError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'ONEDRIVE_QUOTA_ERROR', context);
    this.name = 'OneDriveQuotaError';
  }
}

export class OneDriveRateLimitError extends OneDriveIntegrationError {
  constructor(message: string, retryAfter?: number, context: Record<string, unknown> = {}) {
    super(message, 'ONEDRIVE_RATE_LIMIT_ERROR', { ...context, retryAfter });
    this.name = 'OneDriveRateLimitError';
  }
}

export class OneDriveNetworkError extends OneDriveIntegrationError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'ONEDRIVE_NETWORK_ERROR', context);
    this.name = 'OneDriveNetworkError';
  }
}

// ============================================================================
// MAIN INTEGRATION CLASS
// ============================================================================

export class OneDriveIntegration {
  private readonly baseUrl = 'https://graph.microsoft.com/v1.0';
  private readonly authUrl = 'https://login.microsoftonline.com';
  private readonly scope = 'Files.ReadWrite.All offline_access';

  constructor(private readonly config: OneDriveConfig) {
    this.validateConfig(config);
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  /**
   * Generate OAuth 2.0 authorization URL
   */
  generateAuthUrl(state?: string): string {
    const tenantId = this.config.tenantId || 'common';
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: this.scope,
      response_mode: 'query',
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.authUrl}/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async authenticate(code: string): Promise<OneDriveAuthResult> {
    try {
      const tenantId = this.config.tenantId || 'common';
      const response = await fetch(`${this.authUrl}/${tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: this.config.redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        const errorData = await this.safeJsonParse(response);
        throw new OneDriveAuthenticationError(
          `Authentication failed: ${errorData.error_description || errorData.error || 'Unknown error'}`,
          { statusCode: response.status, errorData }
        );
      }

      const data = await response.json();
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope ? data.scope.split(' ') : [],
      };
    } catch (error) {
      if (error instanceof OneDriveIntegrationError) {
        throw error;
      }
      throw new OneDriveAuthenticationError(
        `Authentication request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error }
      );
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<OneDriveAuthResult> {
    try {
      const tenantId = this.config.tenantId || 'common';
      const response = await fetch(`${this.authUrl}/${tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const errorData = await this.safeJsonParse(response);
        throw new OneDriveAuthenticationError(
          `Token refresh failed: ${errorData.error_description || errorData.error || 'Unknown error'}`,
          { statusCode: response.status, errorData }
        );
      }

      const data = await response.json();
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Keep old refresh token if new one not provided
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope ? data.scope.split(' ') : [],
      };
    } catch (error) {
      if (error instanceof OneDriveIntegrationError) {
        throw error;
      }
      throw new OneDriveAuthenticationError(
        `Token refresh request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error }
      );
    }
  }

  // ============================================================================
  // FILE OPERATIONS
  // ============================================================================

  /**
   * Upload a file to OneDrive
   */
  async uploadFile(file: FileData, path: string, options: {
    conflictBehavior?: 'rename' | 'replace' | 'fail';
  } = {}): Promise<OneDriveFile> {
    this.validateAccessToken();
    this.validateFileData(file);
    this.validatePath(path);

    try {
      const uploadPath = this.normalizePath(path);
      const conflictBehavior = options.conflictBehavior || 'rename';

      // For files larger than 4MB, use resumable upload
      if (file.data.byteLength > 4 * 1024 * 1024) {
        return await this.uploadLargeFile(file, uploadPath, { conflictBehavior });
      }

      // Simple upload for smaller files
      const response = await this.makeRequest(
        `${this.baseUrl}/me/drive/root:${uploadPath}:/content`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': file.mimeType || 'application/octet-stream',
            '@microsoft.graph.conflictBehavior': conflictBehavior,
          },
          body: file.data,
        }
      );

      return this.mapToOneDriveFile(response);
    } catch (error) {
      if (error instanceof OneDriveIntegrationError) {
        throw error;
      }
      throw new OneDriveFileError(
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  /**
   * Download a file from OneDrive
   */
  async downloadFile(path: string): Promise<ArrayBuffer> {
    this.validateAccessToken();
    this.validatePath(path);

    try {
      const downloadPath = this.normalizePath(path);
      
      // For file downloads, we need the raw response, not JSON
      const response = await fetch(
        `${this.baseUrl}/me/drive/root:${downloadPath}:/content`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
          },
        }
      );

      // Handle errors using the same logic as makeRequest
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new OneDriveRateLimitError(
          'Rate limit exceeded',
          retryAfter ? parseInt(retryAfter, 10) : undefined,
          { path, statusCode: response.status }
        );
      }

      if (response.status === 507) {
        throw new OneDriveQuotaError('Storage quota exceeded', { path, statusCode: response.status });
      }

      if (response.status === 401) {
        throw new OneDriveAuthenticationError('Invalid or expired access token', { path, statusCode: response.status });
      }

      if (!response.ok) {
        const errorData = await this.safeJsonParse(response);
        throw new OneDriveIntegrationError(
          `API request failed: ${errorData.error?.message || errorData.error_description || 'Unknown error'}`,
          'API_ERROR',
          { path, statusCode: response.status, errorData }
        );
      }

      return await response.arrayBuffer();
    } catch (error) {
      if (error instanceof OneDriveIntegrationError) {
        throw error;
      }
      throw new OneDriveNetworkError(
        `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  /**
   * Delete a file from OneDrive
   */
  async deleteFile(path: string): Promise<boolean> {
    this.validateAccessToken();
    this.validatePath(path);

    try {
      const deletePath = this.normalizePath(path);
      
      await this.makeRequest(`${this.baseUrl}/me/drive/root:${deletePath}`, {
        method: 'DELETE',
      });

      return true;
    } catch (error) {
      if (error instanceof OneDriveIntegrationError) {
        throw error;
      }
      throw new OneDriveFileError(
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  /**
   * Move a file in OneDrive
   */
  async moveFile(fromPath: string, toPath: string): Promise<OneDriveFile> {
    this.validateAccessToken();
    this.validatePath(fromPath);
    this.validatePath(toPath);

    try {
      const normalizedFromPath = this.normalizePath(fromPath);
      const normalizedToPath = this.normalizePath(toPath);
      
      const toPathParts = normalizedToPath.split('/');
      const fileName = toPathParts.pop();
      const parentPath = toPathParts.join('/') || '/';

      const response = await this.makeRequest(
        `${this.baseUrl}/me/drive/root:${normalizedFromPath}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: fileName,
            parentReference: {
              path: `/drive/root:${parentPath}`,
            },
          }),
        }
      );

      return this.mapToOneDriveFile(response);
    } catch (error) {
      if (error instanceof OneDriveIntegrationError) {
        throw error;
      }
      throw new OneDriveFileError(
        `Failed to move file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { fromPath, toPath, originalError: error }
      );
    }
  }

  /**
   * Copy a file in OneDrive
   */
  async copyFile(fromPath: string, toPath: string): Promise<OneDriveFile> {
    this.validateAccessToken();
    this.validatePath(fromPath);
    this.validatePath(toPath);

    try {
      const normalizedFromPath = this.normalizePath(fromPath);
      const normalizedToPath = this.normalizePath(toPath);
      
      const toPathParts = normalizedToPath.split('/');
      const fileName = toPathParts.pop();
      const parentPath = toPathParts.join('/') || '/';

      const response = await this.makeRequest(
        `${this.baseUrl}/me/drive/root:${normalizedFromPath}:/copy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: fileName,
            parentReference: {
              path: `/drive/root:${parentPath}`,
            },
          }),
        }
      );

      // OneDrive copy is asynchronous, so we need to poll for completion
      const location = response.headers.get('Location');
      if (location) {
        return await this.pollCopyOperation(location);
      }

      return this.mapToOneDriveFile(response);
    } catch (error) {
      if (error instanceof OneDriveIntegrationError) {
        throw error;
      }
      throw new OneDriveFileError(
        `Failed to copy file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { fromPath, toPath, originalError: error }
      );
    }
  }

  // ============================================================================
  // FOLDER OPERATIONS
  // ============================================================================

  /**
   * Create a folder in OneDrive
   */
  async createFolder(path: string): Promise<OneDriveFolder> {
    this.validateAccessToken();
    this.validatePath(path);

    try {
      const folderPath = this.normalizePath(path);
      const pathParts = folderPath.split('/');
      const folderName = pathParts.pop();
      const parentPath = pathParts.join('/') || '/';
      
      const response = await this.makeRequest(
        `${this.baseUrl}/me/drive/root:${parentPath}:/children`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: folderName,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'fail',
          }),
        }
      );

      return this.mapToOneDriveFolder(response);
    } catch (error) {
      if (error instanceof OneDriveIntegrationError) {
        throw error;
      }
      throw new OneDriveFileError(
        `Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  /**
   * List contents of a folder
   */
  async listFolder(path: string = '', options: {
    top?: number;
    orderBy?: string;
    filter?: string;
    expand?: string[];
    select?: string[];
  } = {}): Promise<OneDriveEntry[]> {
    this.validateAccessToken();

    try {
      const folderPath = path ? this.normalizePath(path) : '';
      const endpoint = folderPath 
        ? `${this.baseUrl}/me/drive/root:${folderPath}:/children`
        : `${this.baseUrl}/me/drive/root/children`;
      
      const params = new URLSearchParams();
      
      if (options.top) params.append('$top', options.top.toString());
      if (options.orderBy) params.append('$orderby', options.orderBy);
      if (options.filter) params.append('$filter', options.filter);
      if (options.expand) params.append('$expand', options.expand.join(','));
      if (options.select) params.append('$select', options.select.join(','));

      const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;
      const response = await this.makeRequest(url, { method: 'GET' });

      return response.value.map((item: any) => this.mapToOneDriveEntry(item));
    } catch (error) {
      if (error instanceof OneDriveIntegrationError) {
        throw error;
      }
      throw new OneDriveFileError(
        `Failed to list folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  /**
   * Delete a folder from OneDrive
   */
  async deleteFolder(path: string): Promise<boolean> {
    this.validateAccessToken();
    this.validatePath(path);

    try {
      const folderPath = this.normalizePath(path);
      
      await this.makeRequest(`${this.baseUrl}/me/drive/root:${folderPath}`, {
        method: 'DELETE',
      });

      return true;
    } catch (error) {
      if (error instanceof OneDriveIntegrationError) {
        throw error;
      }
      throw new OneDriveFileError(
        `Failed to delete folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  // ============================================================================
  // SHARING AND COLLABORATION
  // ============================================================================

  /**
   * Create a sharing link for a file or folder
   */
  async createShareLink(path: string, settings: ShareSettings = {}): Promise<OneDriveShareLink> {
    this.validateAccessToken();
    this.validatePath(path);

    try {
      const itemPath = this.normalizePath(path);
      
      const response = await this.makeRequest(
        `${this.baseUrl}/me/drive/root:${itemPath}:/createLink`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: settings.type || 'view',
            scope: settings.scope || 'anonymous',
            password: settings.password,
            expirationDateTime: settings.expirationDateTime?.toISOString(),
          }),
        }
      );

      return this.mapToOneDriveShareLink(response);
    } catch (error) {
      if (error instanceof OneDriveIntegrationError) {
        throw error;
      }
      throw new OneDriveFileError(
        `Failed to create share link: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  /**
   * Get permissions for a file or folder
   */
  async getPermissions(path: string): Promise<OneDrivePermission[]> {
    this.validateAccessToken();
    this.validatePath(path);

    try {
      const itemPath = this.normalizePath(path);
      
      const response = await this.makeRequest(
        `${this.baseUrl}/me/drive/root:${itemPath}:/permissions`,
        { method: 'GET' }
      );

      return response.value.map((permission: any) => this.mapToOneDrivePermission(permission));
    } catch (error) {
      if (error instanceof OneDriveIntegrationError) {
        throw error;
      }
      throw new OneDriveFileError(
        `Failed to get permissions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  // ============================================================================
  // SEARCH AND METADATA
  // ============================================================================

  /**
   * Search for files and folders
   */
  async searchFiles(query: string, options: SearchOptions = {}): Promise<OneDriveSearchResult> {
    this.validateAccessToken();
    this.validateSearchQuery(query);

    try {
      const params = new URLSearchParams({ q: query });
      
      if (options.top) params.append('$top', options.top.toString());
      if (options.orderBy) params.append('$orderby', options.orderBy);
      if (options.filter) params.append('$filter', options.filter);
      if (options.expand) params.append('$expand', options.expand.join(','));
      if (options.select) params.append('$select', options.select.join(','));

      const response = await this.makeRequest(
        `${this.baseUrl}/me/drive/search(q='${encodeURIComponent(query)}')?${params.toString()}`,
        { method: 'GET' }
      );

      return {
        items: response.value.map((item: any) => this.mapToOneDriveEntry(item)),
        nextLink: response['@odata.nextLink'],
      };
    } catch (error) {
      if (error instanceof OneDriveIntegrationError) {
        throw error;
      }
      throw new OneDriveFileError(
        `Failed to search files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { query, originalError: error }
      );
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(path: string): Promise<OneDriveFile> {
    this.validateAccessToken();
    this.validatePath(path);

    try {
      const itemPath = this.normalizePath(path);
      
      const response = await this.makeRequest(
        `${this.baseUrl}/me/drive/root:${itemPath}`,
        { method: 'GET' }
      );

      return this.mapToOneDriveFile(response);
    } catch (error) {
      if (error instanceof OneDriveIntegrationError) {
        throw error;
      }
      throw new OneDriveFileError(
        `Failed to get file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  /**
   * Upload multiple files in parallel
   */
  async batchUpload(files: BatchUploadItem[]): Promise<OneDriveBatchResult> {
    this.validateAccessToken();
    this.validateBatchUploadItems(files);

    const batchId = ulid();
    const entries: OneDriveBatchEntry[] = [];
    let errorCount = 0;

    // Process uploads in parallel with concurrency limit
    const concurrency = 5;
    const chunks = this.chunkArray(files, concurrency);

    for (const chunk of chunks) {
      const promises = chunk.map(async (item) => {
        try {
          const result = await this.uploadFile(item.file, item.path, {
            conflictBehavior: item.conflictBehavior,
          });
          return {
            path: item.path,
            status: 'success' as const,
            result,
          };
        } catch (error) {
          errorCount++;
          return {
            path: item.path,
            status: 'failed' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      const results = await Promise.all(promises);
      entries.push(...results);
    }

    return {
      id: batchId,
      status: 'complete',
      entries,
      completedAt: new Date(),
      errorCount,
    };
  }

  /**
   * Download multiple files in parallel
   */
  async batchDownload(paths: string[]): Promise<OneDriveBatchResult> {
    this.validateAccessToken();
    this.validatePaths(paths);

    const batchId = ulid();
    const entries: OneDriveBatchEntry[] = [];
    let errorCount = 0;

    // Process downloads in parallel with concurrency limit
    const concurrency = 5;
    const chunks = this.chunkArray(paths, concurrency);

    for (const chunk of chunks) {
      const promises = chunk.map(async (path) => {
        try {
          await this.downloadFile(path);
          return {
            path,
            status: 'success' as const,
          };
        } catch (error) {
          errorCount++;
          return {
            path,
            status: 'failed' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      const results = await Promise.all(promises);
      entries.push(...results);
    }

    return {
      id: batchId,
      status: errorCount === 0 ? 'complete' : 'complete',
      entries,
      completedAt: new Date(),
      errorCount,
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private validateConfig(config: OneDriveConfig): void {
    if (!config.clientId) {
      throw new OneDriveIntegrationError('Client ID is required', 'INVALID_CONFIG');
    }
    if (!config.clientSecret) {
      throw new OneDriveIntegrationError('Client secret is required', 'INVALID_CONFIG');
    }
    if (!config.redirectUri) {
      throw new OneDriveIntegrationError('Redirect URI is required', 'INVALID_CONFIG');
    }
  }

  private validateAccessToken(): void {
    if (!this.config.accessToken) {
      throw new OneDriveAuthenticationError('Access token is required for API calls');
    }
  }

  private validatePath(path: string): void {
    if (!path || typeof path !== 'string' || path.trim() === '') {
      throw new OneDriveFileError('Valid path is required');
    }
  }

  private validatePaths(paths: string[]): void {
    if (!Array.isArray(paths) || paths.length === 0) {
      throw new OneDriveFileError('Non-empty array of paths is required');
    }
    paths.forEach((path, index) => {
      if (!path || typeof path !== 'string' || path.trim() === '') {
        throw new OneDriveFileError(`Invalid path at index ${index}`);
      }
    });
  }

  private validateFileData(file: FileData): void {
    if (!file || !file.name || !file.data) {
      throw new OneDriveFileError('Valid file data is required');
    }
    if (file.name.trim() === '') {
      throw new OneDriveFileError('File name cannot be empty');
    }
    if (file.data.byteLength === 0) {
      throw new OneDriveFileError('File data cannot be empty');
    }
  }

  private validateSearchQuery(query: string): void {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      throw new OneDriveFileError('Valid search query is required');
    }
  }

  private validateBatchUploadItems(items: BatchUploadItem[]): void {
    if (!Array.isArray(items) || items.length === 0) {
      throw new OneDriveFileError('Non-empty array of upload items is required');
    }
    
    items.forEach((item, index) => {
      if (!item || !item.file || !item.path) {
        throw new OneDriveFileError(`Invalid upload item at index ${index}`);
      }
      try {
        this.validateFileData(item.file);
        this.validatePath(item.path);
      } catch (error) {
        throw new OneDriveFileError(`Invalid upload item at index ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  private normalizePath(path: string): string {
    // Ensure path starts with / and doesn't end with / (unless it's just "/")
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return normalized === '/' ? normalized : normalized.replace(/\/$/, '');
  }

  private async makeRequest(url: string, options: RequestInit): Promise<any> {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${this.config.accessToken}`,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new OneDriveRateLimitError(
          'Rate limit exceeded',
          retryAfter ? parseInt(retryAfter, 10) : undefined,
          { url, statusCode: response.status }
        );
      }

      // Handle quota exceeded
      if (response.status === 507) {
        throw new OneDriveQuotaError('Storage quota exceeded', { url, statusCode: response.status });
      }

      // Handle authentication errors
      if (response.status === 401) {
        throw new OneDriveAuthenticationError('Invalid or expired access token', { url, statusCode: response.status });
      }

      if (!response.ok) {
        const errorData = await this.safeJsonParse(response);
        throw new OneDriveIntegrationError(
          `API request failed: ${errorData.error?.message || errorData.error_description || 'Unknown error'}`,
          'API_ERROR',
          { url, statusCode: response.status, errorData }
        );
      }

      // Handle responses that should return JSON
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }

      return response;
    } catch (error) {
      if (error instanceof OneDriveIntegrationError) {
        throw error;
      }
      
      // Network or other errors
      throw new OneDriveNetworkError(
        `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { url, originalError: error }
      );
    }
  }

  private async safeJsonParse(response: Response): Promise<any> {
    try {
      return await response.json();
    } catch {
      return { error: 'Unable to parse error response' };
    }
  }

  private async uploadLargeFile(file: FileData, path: string, options: {
    conflictBehavior?: 'rename' | 'replace' | 'fail';
  }): Promise<OneDriveFile> {
    const chunkSize = 10 * 1024 * 1024; // 10MB chunks
    const totalSize = file.data.byteLength;

    // Create upload session
    const sessionResponse = await this.makeRequest(
      `${this.baseUrl}/me/drive/root:${path}:/createUploadSession`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          item: {
            '@microsoft.graph.conflictBehavior': options.conflictBehavior || 'rename',
            name: file.name,
          },
        }),
      }
    );

    const uploadUrl = sessionResponse.uploadUrl;
    let offset = 0;

    // Upload chunks
    while (offset < totalSize) {
      const chunkEnd = Math.min(offset + chunkSize, totalSize);
      const chunk = file.data.slice(offset, chunkEnd);

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Range': `bytes ${offset}-${chunkEnd - 1}/${totalSize}`,
          'Content-Length': chunk.byteLength.toString(),
        },
        body: chunk,
      });

      if (response.status === 202) {
        // Continue uploading
        offset = chunkEnd;
      } else if (response.status === 201 || response.status === 200) {
        // Upload complete
        const result = await response.json();
        return this.mapToOneDriveFile(result);
      } else {
        throw new OneDriveFileError(
          `Upload failed with status ${response.status}`,
          { path, statusCode: response.status }
        );
      }
    }

    throw new OneDriveFileError('Upload completed but no result received', { path });
  }

  private async pollCopyOperation(location: string): Promise<OneDriveFile> {
    const maxAttempts = 30;
    const delay = 1000; // 1 second

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(location, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'completed') {
          return this.mapToOneDriveFile(result.resourceId);
        }
        if (result.status === 'failed') {
          throw new OneDriveFileError('Copy operation failed', { location });
        }
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    throw new OneDriveFileError('Copy operation timed out', { location });
  }

  private mapToOneDriveFile(data: any): OneDriveFile {
    return {
      id: data.id || ulid(),
      name: data.name,
      path: data.parentReference?.path?.replace('/drive/root:', '') + '/' + data.name || `/${data.name}`,
      size: data.size || 0,
      modifiedTime: new Date(data.lastModifiedDateTime || data.createdDateTime),
      createdTime: new Date(data.createdDateTime),
      isFolder: !!data.folder,
      downloadUrl: data['@microsoft.graph.downloadUrl'],
      webUrl: data.webUrl,
      eTag: data.eTag,
      cTag: data.cTag,
    };
  }

  private mapToOneDriveFolder(data: any): OneDriveFolder {
    return {
      id: data.id || ulid(),
      name: data.name,
      path: data.parentReference?.path?.replace('/drive/root:', '') + '/' + data.name || `/${data.name}`,
      modifiedTime: new Date(data.lastModifiedDateTime || data.createdDateTime),
      createdTime: new Date(data.createdDateTime),
      isFolder: true,
      childCount: data.folder?.childCount,
      webUrl: data.webUrl,
    };
  }

  private mapToOneDriveEntry(data: any): OneDriveEntry {
    return {
      id: data.id || ulid(),
      name: data.name,
      path: data.parentReference?.path?.replace('/drive/root:', '') + '/' + data.name || `/${data.name}`,
      size: data.size,
      modifiedTime: new Date(data.lastModifiedDateTime || data.createdDateTime),
      createdTime: new Date(data.createdDateTime),
      isFolder: !!data.folder,
      webUrl: data.webUrl,
      eTag: data.eTag,
    };
  }

  private mapToOneDriveShareLink(data: any): OneDriveShareLink {
    return {
      id: data.id || ulid(),
      url: data.link.webUrl,
      type: data.link.type,
      scope: data.link.scope,
      expirationDateTime: data.expirationDateTime ? new Date(data.expirationDateTime) : undefined,
      password: !!data.hasPassword,
    };
  }

  private mapToOneDrivePermission(data: any): OneDrivePermission {
    return {
      id: data.id || ulid(),
      roles: data.roles || [],
      grantedTo: data.grantedTo ? {
        id: data.grantedTo.user?.id,
        displayName: data.grantedTo.user?.displayName,
        email: data.grantedTo.user?.email,
      } : undefined,
      grantedToIdentities: data.grantedToIdentities?.map((identity: any) => ({
        id: identity.user?.id,
        displayName: identity.user?.displayName,
        email: identity.user?.email,
      })),
      link: data.link ? {
        id: ulid(),
        url: data.link.webUrl,
        type: data.link.type,
        scope: data.link.scope,
        expirationDateTime: data.expirationDateTime ? new Date(data.expirationDateTime) : undefined,
        password: !!data.hasPassword,
      } : undefined,
      expirationDateTime: data.expirationDateTime ? new Date(data.expirationDateTime) : undefined,
    };
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
