import { ulid } from 'ulid';
import { ExternalWorkflowError } from '../errors/ExternalWorkflowErrors';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface DropboxConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly accessToken?: string;
  readonly refreshToken?: string;
}

export interface DropboxFile {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly size: number;
  readonly modifiedTime: Date;
  readonly isFolder: boolean;
  readonly contentHash?: string;
  readonly downloadUrl?: string;
}

export interface DropboxFolder {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly modifiedTime: Date;
  readonly isFolder: true;
}

export interface DropboxEntry {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly size?: number;
  readonly modifiedTime: Date;
  readonly isFolder: boolean;
  readonly contentHash?: string;
}

export interface DropboxShareLink {
  readonly id: string;
  readonly url: string;
  readonly path: string;
  readonly visibility: 'public' | 'team_only' | 'password';
  readonly expires?: Date;
  readonly settings: ShareSettings;
}

export interface DropboxSharedFolder {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly accessType: 'owner' | 'editor' | 'viewer';
  readonly members: DropboxMember[];
}

export interface DropboxMember {
  readonly email: string;
  readonly accessType: 'owner' | 'editor' | 'viewer';
  readonly status: 'active' | 'invited' | 'removed';
}

export interface ShareSettings {
  readonly allowDownload?: boolean;
  readonly allowComments?: boolean;
  readonly password?: string;
  readonly expires?: Date;
}

export interface DropboxMetadata {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly size: number;
  readonly contentHash: string;
  readonly modifiedTime: Date;
  readonly clientModifiedTime: Date;
  readonly mediaInfo?: DropboxMediaInfo;
  readonly sharingInfo?: DropboxSharingInfo;
}

export interface DropboxMediaInfo {
  readonly dimensions?: { width: number; height: number };
  readonly location?: { latitude: number; longitude: number };
  readonly timeTaken?: Date;
}

export interface DropboxSharingInfo {
  readonly readOnly: boolean;
  readonly parentSharedFolderId?: string;
  readonly modifiedBy?: string;
}

export interface DropboxSearchResult {
  readonly matches: DropboxSearchMatch[];
  readonly hasMore: boolean;
  readonly cursor?: string;
}

export interface DropboxSearchMatch {
  readonly matchType: 'filename' | 'content' | 'both';
  readonly metadata: DropboxEntry;
  readonly highlightSpans?: HighlightSpan[];
}

export interface HighlightSpan {
  readonly highlightStr: string;
  readonly isHighlighted: boolean;
}

export interface SearchOptions {
  readonly maxResults?: number;
  readonly fileExtensions?: string[];
  readonly fileCategories?: ('image' | 'document' | 'pdf' | 'spreadsheet' | 'presentation' | 'audio' | 'video' | 'folder' | 'others')[];
  readonly includeDeleted?: boolean;
}

export interface ThumbnailSize {
  readonly width: number;
  readonly height: number;
  readonly format: 'jpeg' | 'png';
}

export interface FileData {
  readonly name: string;
  readonly data: ArrayBuffer;
  readonly mimeType?: string;
}

export interface BatchUploadItem {
  readonly file: FileData;
  readonly path: string;
  readonly autorename?: boolean;
  readonly mute?: boolean;
}

export interface BatchDownloadItem {
  readonly path: string;
  readonly zipPath?: string;
}

export interface DropboxBatchResult {
  readonly id: string;
  readonly status: 'in_progress' | 'complete' | 'failed';
  readonly entries: DropboxBatchEntry[];
  readonly completedAt?: Date;
  readonly errorCount: number;
}

export interface DropboxBatchEntry {
  readonly path: string;
  readonly status: 'success' | 'failed';
  readonly result?: DropboxFile;
  readonly error?: string;
}

export interface DropboxAuthResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly tokenType: string;
  readonly scope: string[];
  readonly accountId: string;
}

// ============================================================================
// ERROR HIERARCHY
// ============================================================================

export class DropboxIntegrationError extends ExternalWorkflowError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `DROPBOX_${code}`, context);
    this.name = 'DropboxIntegrationError';
  }
}

export class DropboxAuthenticationError extends DropboxIntegrationError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'AUTHENTICATION_ERROR', context);
    this.name = 'DropboxAuthenticationError';
  }
}

export class DropboxFileError extends DropboxIntegrationError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'FILE_ERROR', context);
    this.name = 'DropboxFileError';
  }
}

export class DropboxQuotaError extends DropboxIntegrationError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'QUOTA_EXCEEDED', context);
    this.name = 'DropboxQuotaError';
  }
}

export class DropboxRateLimitError extends DropboxIntegrationError {
  constructor(message: string, retryAfter?: number, context: Record<string, unknown> = {}) {
    super(message, 'RATE_LIMIT_EXCEEDED', { ...context, retryAfter });
    this.name = 'DropboxRateLimitError';
  }
}

export class DropboxNetworkError extends DropboxIntegrationError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'NETWORK_ERROR', context);
    this.name = 'DropboxNetworkError';
  }
}

// ============================================================================
// DROPBOX INTEGRATION SERVICE
// ============================================================================

export class DropboxIntegration {
  private readonly baseUrl = 'https://api.dropboxapi.com/2';
  private readonly contentUrl = 'https://content.dropboxapi.com/2';
  private readonly authUrl = 'https://www.dropbox.com/oauth2';
  
  constructor(private readonly config: DropboxConfig) {
    this.validateConfig(config);
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  /**
   * Generate OAuth 2.0 authorization URL
   */
  generateAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      token_access_type: 'offline',
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.authUrl}/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async authenticate(code: string): Promise<DropboxAuthResult> {
    try {
      const response = await fetch(`${this.authUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri,
        }),
      });

      if (!response.ok) {
        const errorData = await this.safeJsonParse(response);
        throw new DropboxAuthenticationError(
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
        scope: data.scope?.split(' ') || [],
        accountId: data.account_id,
      };
    } catch (error) {
      if (error instanceof DropboxIntegrationError) {
        throw error;
      }
      throw new DropboxAuthenticationError(
        `Authentication request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error }
      );
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<DropboxAuthResult> {
    try {
      const response = await fetch(`${this.authUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        const errorData = await this.safeJsonParse(response);
        throw new DropboxAuthenticationError(
          `Token refresh failed: ${errorData.error_description || errorData.error || 'Unknown error'}`,
          { statusCode: response.status, errorData }
        );
      }

      const data = await response.json();
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope?.split(' ') || [],
        accountId: data.account_id,
      };
    } catch (error) {
      if (error instanceof DropboxIntegrationError) {
        throw error;
      }
      throw new DropboxAuthenticationError(
        `Token refresh request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error }
      );
    }
  }

  // ============================================================================
  // FILE OPERATIONS
  // ============================================================================

  /**
   * Upload a file to Dropbox
   */
  async uploadFile(file: FileData, path: string, options: {
    autorename?: boolean;
    mute?: boolean;
  } = {}): Promise<DropboxFile> {
    this.validateAccessToken();
    this.validatePath(path);
    this.validateFileData(file);

    try {
      const uploadPath = this.normalizePath(path);
      
      // Use upload session for files larger than 150MB
      if (file.data.byteLength > 150 * 1024 * 1024) {
        return await this.uploadLargeFile(file, uploadPath, options);
      }

      const response = await this.makeRequest(`${this.contentUrl}/files/upload`, {
        method: 'POST',
        headers: {
          'Dropbox-API-Arg': JSON.stringify({
            path: uploadPath,
            mode: 'add',
            autorename: options.autorename || false,
            mute: options.mute || false,
          }),
          'Content-Type': 'application/octet-stream',
        },
        body: file.data,
      });

      return this.mapToDropboxFile(response);
    } catch (error) {
      if (error instanceof DropboxIntegrationError) {
        throw error;
      }
      throw new DropboxFileError(
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, fileName: file.name, originalError: error }
      );
    }
  }

  /**
   * Download a file from Dropbox
   */
  async downloadFile(path: string): Promise<ArrayBuffer> {
    this.validateAccessToken();
    this.validatePath(path);

    try {
      const downloadPath = this.normalizePath(path);
      
      const response = await this.makeRequest(`${this.contentUrl}/files/download`, {
        method: 'POST',
        headers: {
          'Dropbox-API-Arg': JSON.stringify({
            path: downloadPath,
          }),
        },
      });

      if (!response.ok) {
        const errorData = await this.safeJsonParse(response);
        throw new DropboxFileError(
          `Download failed: ${errorData.error_summary || 'Unknown error'}`,
          { path: downloadPath, statusCode: response.status }
        );
      }

      return await response.arrayBuffer();
    } catch (error) {
      if (error instanceof DropboxIntegrationError) {
        throw error;
      }
      throw new DropboxFileError(
        `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  /**
   * Delete a file from Dropbox
   */
  async deleteFile(path: string): Promise<boolean> {
    this.validateAccessToken();
    this.validatePath(path);

    try {
      const deletePath = this.normalizePath(path);
      
      await this.makeRequest(`${this.baseUrl}/files/delete_v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: deletePath,
        }),
      });

      return true;
    } catch (error) {
      if (error instanceof DropboxIntegrationError) {
        throw error;
      }
      throw new DropboxFileError(
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  /**
   * Move a file in Dropbox
   */
  async moveFile(fromPath: string, toPath: string): Promise<DropboxFile> {
    this.validateAccessToken();
    this.validatePath(fromPath);
    this.validatePath(toPath);

    try {
      const normalizedFromPath = this.normalizePath(fromPath);
      const normalizedToPath = this.normalizePath(toPath);
      
      const response = await this.makeRequest(`${this.baseUrl}/files/move_v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_path: normalizedFromPath,
          to_path: normalizedToPath,
          autorename: false,
        }),
      });

      return this.mapToDropboxFile(response.metadata);
    } catch (error) {
      if (error instanceof DropboxIntegrationError) {
        throw error;
      }
      throw new DropboxFileError(
        `Failed to move file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { fromPath, toPath, originalError: error }
      );
    }
  }

  /**
   * Copy a file in Dropbox
   */
  async copyFile(fromPath: string, toPath: string): Promise<DropboxFile> {
    this.validateAccessToken();
    this.validatePath(fromPath);
    this.validatePath(toPath);

    try {
      const normalizedFromPath = this.normalizePath(fromPath);
      const normalizedToPath = this.normalizePath(toPath);
      
      const response = await this.makeRequest(`${this.baseUrl}/files/copy_v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_path: normalizedFromPath,
          to_path: normalizedToPath,
          autorename: false,
        }),
      });

      return this.mapToDropboxFile(response.metadata);
    } catch (error) {
      if (error instanceof DropboxIntegrationError) {
        throw error;
      }
      throw new DropboxFileError(
        `Failed to copy file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { fromPath, toPath, originalError: error }
      );
    }
  }

  // ============================================================================
  // FOLDER OPERATIONS
  // ============================================================================

  /**
   * Create a folder in Dropbox
   */
  async createFolder(path: string): Promise<DropboxFolder> {
    this.validateAccessToken();
    this.validatePath(path);

    try {
      const folderPath = this.normalizePath(path);
      
      const response = await this.makeRequest(`${this.baseUrl}/files/create_folder_v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: folderPath,
          autorename: false,
        }),
      });

      return this.mapToDropboxFolder(response.metadata);
    } catch (error) {
      if (error instanceof DropboxIntegrationError) {
        throw error;
      }
      throw new DropboxFileError(
        `Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  /**
   * List contents of a folder
   */
  async listFolder(path: string = '', options: {
    recursive?: boolean;
    includeDeleted?: boolean;
    limit?: number;
  } = {}): Promise<DropboxEntry[]> {
    this.validateAccessToken();

    try {
      const folderPath = path ? this.normalizePath(path) : '';
      
      const response = await this.makeRequest(`${this.baseUrl}/files/list_folder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: folderPath,
          recursive: options.recursive || false,
          include_deleted: options.includeDeleted || false,
          limit: options.limit || 2000,
        }),
      });

      const entries = response.entries.map((entry: any) => this.mapToDropboxEntry(entry));
      
      // Handle pagination if there are more entries
      let hasMore = response.has_more;
      let cursor = response.cursor;
      
      while (hasMore) {
        const continueResponse = await this.makeRequest(`${this.baseUrl}/files/list_folder/continue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cursor,
          }),
        });

        entries.push(...continueResponse.entries.map((entry: any) => this.mapToDropboxEntry(entry)));
        hasMore = continueResponse.has_more;
        cursor = continueResponse.cursor;
      }

      return entries;
    } catch (error) {
      if (error instanceof DropboxIntegrationError) {
        throw error;
      }
      throw new DropboxFileError(
        `Failed to list folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  /**
   * Delete a folder from Dropbox
   */
  async deleteFolder(path: string): Promise<boolean> {
    this.validateAccessToken();
    this.validatePath(path);

    try {
      const folderPath = this.normalizePath(path);
      
      await this.makeRequest(`${this.baseUrl}/files/delete_v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: folderPath,
        }),
      });

      return true;
    } catch (error) {
      if (error instanceof DropboxIntegrationError) {
        throw error;
      }
      throw new DropboxFileError(
        `Failed to delete folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  // ============================================================================
  // SHARING & COLLABORATION
  // ============================================================================

  /**
   * Create a share link for a file or folder
   */
  async createShareLink(path: string, settings: ShareSettings = {}): Promise<DropboxShareLink> {
    this.validateAccessToken();
    this.validatePath(path);

    try {
      const sharePath = this.normalizePath(path);
      
      const response = await this.makeRequest(`${this.baseUrl}/sharing/create_shared_link_with_settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: sharePath,
          settings: {
            requested_visibility: settings.password ? 'password' : 'public',
            link_password: settings.password,
            expires: settings.expires?.toISOString(),
            allow_download: settings.allowDownload !== false,
          },
        }),
      });

      return this.mapToDropboxShareLink(response);
    } catch (error) {
      if (error instanceof DropboxIntegrationError) {
        throw error;
      }
      throw new DropboxFileError(
        `Failed to create share link: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  /**
   * Share a folder with specific users
   */
  async shareFolder(path: string, emails: string[], accessType: 'editor' | 'viewer' = 'viewer'): Promise<DropboxSharedFolder> {
    this.validateAccessToken();
    this.validatePath(path);
    this.validateEmails(emails);

    try {
      const folderPath = this.normalizePath(path);
      
      // First, share the folder
      const shareResponse = await this.makeRequest(`${this.baseUrl}/sharing/share_folder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: folderPath,
          member_policy: 'anyone',
          acl_update_policy: 'editors',
          shared_link_policy: 'anyone',
        }),
      });

      const sharedFolderId = shareResponse.shared_folder_id;

      // Then add members
      const members = emails.map(email => ({
        member: { '.tag': 'email', email },
        access_level: { '.tag': accessType },
      }));

      await this.makeRequest(`${this.baseUrl}/sharing/add_folder_member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shared_folder_id: sharedFolderId,
          members,
          quiet: false,
        }),
      });

      return this.mapToDropboxSharedFolder(shareResponse, emails, accessType);
    } catch (error) {
      if (error instanceof DropboxIntegrationError) {
        throw error;
      }
      throw new DropboxFileError(
        `Failed to share folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, emails, originalError: error }
      );
    }
  }

  /**
   * Get existing share links for a path
   */
  async getSharedLinks(path?: string): Promise<DropboxShareLink[]> {
    this.validateAccessToken();

    try {
      const requestBody: any = {};
      if (path) {
        requestBody.path = this.normalizePath(path);
      }

      const response = await this.makeRequest(`${this.baseUrl}/sharing/list_shared_links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      return response.links.map((link: any) => this.mapToDropboxShareLink(link));
    } catch (error) {
      if (error instanceof DropboxIntegrationError) {
        throw error;
      }
      throw new DropboxFileError(
        `Failed to get shared links: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  // ============================================================================
  // SEARCH & METADATA
  // ============================================================================

  /**
   * Search for files in Dropbox
   */
  async searchFiles(query: string, options: SearchOptions = {}): Promise<DropboxSearchResult[]> {
    this.validateAccessToken();
    this.validateSearchQuery(query);

    try {
      const searchOptions: any = {
        query,
        max_results: options.maxResults || 100,
        mode: { '.tag': 'filename_and_content' },
      };

      if (options.fileExtensions?.length) {
        searchOptions.file_extensions = options.fileExtensions;
      }

      if (options.fileCategories?.length) {
        searchOptions.file_categories = options.fileCategories.map(cat => ({ '.tag': cat }));
      }

      const response = await this.makeRequest(`${this.baseUrl}/files/search_v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchOptions),
      });

      const matches = response.matches.map((match: any) => ({
        matchType: match.match_type['.tag'] as 'filename' | 'content' | 'both',
        metadata: this.mapToDropboxEntry(match.metadata),
        highlightSpans: match.highlight_spans?.map((span: any) => ({
          highlightStr: span.highlight_str,
          isHighlighted: span.is_highlighted,
        })),
      }));

      return [{
        matches,
        hasMore: response.has_more,
        cursor: response.cursor,
      }];
    } catch (error) {
      if (error instanceof DropboxIntegrationError) {
        throw error;
      }
      throw new DropboxFileError(
        `Failed to search files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { query, originalError: error }
      );
    }
  }

  /**
   * Get detailed metadata for a file
   */
  async getFileMetadata(path: string): Promise<DropboxMetadata> {
    this.validateAccessToken();
    this.validatePath(path);

    try {
      const filePath = this.normalizePath(path);
      
      const response = await this.makeRequest(`${this.baseUrl}/files/get_metadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: filePath,
          include_media_info: true,
          include_deleted: false,
          include_has_explicit_shared_members: true,
        }),
      });

      return this.mapToDropboxMetadata(response);
    } catch (error) {
      if (error instanceof DropboxIntegrationError) {
        throw error;
      }
      throw new DropboxFileError(
        `Failed to get file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  /**
   * Get thumbnail for an image file
   */
  async getThumbnail(path: string, size: ThumbnailSize = { width: 128, height: 128, format: 'jpeg' }): Promise<ArrayBuffer> {
    this.validateAccessToken();
    this.validatePath(path);

    try {
      const thumbnailPath = this.normalizePath(path);
      
      const response = await this.makeRequest(`${this.contentUrl}/files/get_thumbnail_v2`, {
        method: 'POST',
        headers: {
          'Dropbox-API-Arg': JSON.stringify({
            resource: {
              '.tag': 'path',
              path: thumbnailPath,
            },
            format: size.format,
            size: `w${size.width}h${size.height}`,
          }),
        },
      });

      if (!response.ok) {
        const errorData = await this.safeJsonParse(response);
        throw new DropboxFileError(
          `Thumbnail generation failed: ${errorData.error_summary || 'Unknown error'}`,
          { path: thumbnailPath, statusCode: response.status }
        );
      }

      return await response.arrayBuffer();
    } catch (error) {
      if (error instanceof DropboxIntegrationError) {
        throw error;
      }
      throw new DropboxFileError(
        `Failed to get thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { path, originalError: error }
      );
    }
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  /**
   * Upload multiple files in batch
   */
  async batchUpload(files: BatchUploadItem[]): Promise<DropboxBatchResult> {
    this.validateAccessToken();
    this.validateBatchUploadItems(files);

    const batchId = ulid();
    const entries: DropboxBatchEntry[] = [];
    let errorCount = 0;

    try {
      // Process files in parallel with concurrency limit
      const concurrencyLimit = 5;
      const chunks = this.chunkArray(files, concurrencyLimit);

      for (const chunk of chunks) {
        const promises = chunk.map(async (item) => {
          try {
            const result = await this.uploadFile(item.file, item.path, {
              autorename: item.autorename,
              mute: item.mute,
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

        const chunkResults = await Promise.all(promises);
        entries.push(...chunkResults);
      }

      return {
        id: batchId,
        status: errorCount === 0 ? 'complete' : (errorCount === files.length ? 'failed' : 'complete'),
        entries,
        completedAt: new Date(),
        errorCount,
      };
    } catch (error) {
      throw new DropboxFileError(
        `Batch upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { batchId, totalFiles: files.length, originalError: error }
      );
    }
  }

  /**
   * Download multiple files in batch
   */
  async batchDownload(paths: string[]): Promise<DropboxBatchResult> {
    this.validateAccessToken();
    this.validatePaths(paths);

    const batchId = ulid();
    const entries: DropboxBatchEntry[] = [];
    let errorCount = 0;

    try {
      // Process downloads in parallel with concurrency limit
      const concurrencyLimit = 5;
      const chunks = this.chunkArray(paths, concurrencyLimit);

      for (const chunk of chunks) {
        const promises = chunk.map(async (path) => {
          try {
            const data = await this.downloadFile(path);
            
            // Create a mock DropboxFile for the result
            const result: DropboxFile = {
              id: ulid(),
              name: path.split('/').pop() || path,
              path,
              size: data.byteLength,
              modifiedTime: new Date(),
              isFolder: false,
            };
            
            return {
              path,
              status: 'success' as const,
              result,
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

        const chunkResults = await Promise.all(promises);
        entries.push(...chunkResults);
      }

      return {
        id: batchId,
        status: errorCount === 0 ? 'complete' : (errorCount === paths.length ? 'failed' : 'complete'),
        entries,
        completedAt: new Date(),
        errorCount,
      };
    } catch (error) {
      throw new DropboxFileError(
        `Batch download failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { batchId, totalFiles: paths.length, originalError: error }
      );
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private validateConfig(config: DropboxConfig): void {
    if (!config.clientId) {
      throw new DropboxIntegrationError('Client ID is required', 'INVALID_CONFIG');
    }
    if (!config.clientSecret) {
      throw new DropboxIntegrationError('Client secret is required', 'INVALID_CONFIG');
    }
    if (!config.redirectUri) {
      throw new DropboxIntegrationError('Redirect URI is required', 'INVALID_CONFIG');
    }
  }

  private validateAccessToken(): void {
    if (!this.config.accessToken) {
      throw new DropboxAuthenticationError('Access token is required for API calls');
    }
  }

  private validatePath(path: string): void {
    if (!path || typeof path !== 'string') {
      throw new DropboxFileError('Valid path is required', { path });
    }
  }

  private validatePaths(paths: string[]): void {
    if (!Array.isArray(paths) || paths.length === 0) {
      throw new DropboxFileError('Non-empty array of paths is required', { paths });
    }
    paths.forEach(path => this.validatePath(path));
  }

  private validateFileData(file: FileData): void {
    if (!file.name || !file.data) {
      throw new DropboxFileError('File must have name and data', { fileName: file.name });
    }
    if (!(file.data instanceof ArrayBuffer)) {
      throw new DropboxFileError('File data must be ArrayBuffer', { fileName: file.name });
    }
  }

  private validateEmails(emails: string[]): void {
    if (!Array.isArray(emails) || emails.length === 0) {
      throw new DropboxFileError('Non-empty array of emails is required', { emails });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    emails.forEach(email => {
      if (!emailRegex.test(email)) {
        throw new DropboxFileError('Invalid email address', { email });
      }
    });
  }

  private validateSearchQuery(query: string): void {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new DropboxFileError('Valid search query is required', { query });
    }
  }

  private validateBatchUploadItems(items: BatchUploadItem[]): void {
    if (!Array.isArray(items) || items.length === 0) {
      throw new DropboxFileError('Non-empty array of upload items is required', { items });
    }
    
    items.forEach((item, index) => {
      try {
        this.validateFileData(item.file);
        this.validatePath(item.path);
      } catch (error) {
        throw new DropboxFileError(
          `Invalid upload item at index ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { index, item }
        );
      }
    });
  }

  private normalizePath(path: string): string {
    // Ensure path starts with / and doesn't end with / (unless root)
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return normalized === '/' ? '' : normalized.replace(/\/$/, '');
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
        throw new DropboxRateLimitError(
          'Rate limit exceeded',
          retryAfter ? parseInt(retryAfter, 10) : undefined,
          { url, statusCode: response.status }
        );
      }

      // Handle quota exceeded
      if (response.status === 507) {
        throw new DropboxQuotaError('Storage quota exceeded', { url, statusCode: response.status });
      }

      // Handle authentication errors
      if (response.status === 401) {
        throw new DropboxAuthenticationError('Invalid or expired access token', { url, statusCode: response.status });
      }

      if (!response.ok) {
        const errorData = await this.safeJsonParse(response);
        throw new DropboxIntegrationError(
          `API request failed: ${errorData.error_summary || errorData.error || 'Unknown error'}`,
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
      if (error instanceof DropboxIntegrationError) {
        throw error;
      }
      
      // Network or other errors
      throw new DropboxNetworkError(
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
    autorename?: boolean;
    mute?: boolean;
  }): Promise<DropboxFile> {
    const chunkSize = 8 * 1024 * 1024; // 8MB chunks
    const totalSize = file.data.byteLength;
    let offset = 0;

    // Start upload session
    const startResponse = await this.makeRequest(`${this.contentUrl}/files/upload_session/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: file.data.slice(0, Math.min(chunkSize, totalSize)),
    });

    const sessionId = startResponse.session_id;
    offset += Math.min(chunkSize, totalSize);

    // Upload remaining chunks
    while (offset < totalSize) {
      const chunkEnd = Math.min(offset + chunkSize, totalSize);
      const chunk = file.data.slice(offset, chunkEnd);

      await this.makeRequest(`${this.contentUrl}/files/upload_session/append_v2`, {
        method: 'POST',
        headers: {
          'Dropbox-API-Arg': JSON.stringify({
            cursor: {
              session_id: sessionId,
              offset,
            },
          }),
          'Content-Type': 'application/octet-stream',
        },
        body: chunk,
      });

      offset = chunkEnd;
    }

    // Finish upload session
    const finishResponse = await this.makeRequest(`${this.contentUrl}/files/upload_session/finish`, {
      method: 'POST',
      headers: {
        'Dropbox-API-Arg': JSON.stringify({
          cursor: {
            session_id: sessionId,
            offset: totalSize,
          },
          commit: {
            path,
            mode: 'add',
            autorename: options.autorename || false,
            mute: options.mute || false,
          },
        }),
        'Content-Type': 'application/octet-stream',
      },
      body: new ArrayBuffer(0),
    });

    return this.mapToDropboxFile(finishResponse);
  }

  private mapToDropboxFile(data: any): DropboxFile {
    return {
      id: data.id || ulid(),
      name: data.name,
      path: data.path_display || data.path_lower,
      size: data.size,
      modifiedTime: new Date(data.server_modified || data.client_modified),
      isFolder: data['.tag'] === 'folder',
      contentHash: data.content_hash,
    };
  }

  private mapToDropboxFolder(data: any): DropboxFolder {
    return {
      id: data.id || ulid(),
      name: data.name,
      path: data.path_display || data.path_lower,
      modifiedTime: new Date(data.server_modified || Date.now()),
      isFolder: true,
    };
  }

  private mapToDropboxEntry(data: any): DropboxEntry {
    return {
      id: data.id || ulid(),
      name: data.name,
      path: data.path_display || data.path_lower,
      size: data.size,
      modifiedTime: new Date(data.server_modified || data.client_modified || Date.now()),
      isFolder: data['.tag'] === 'folder',
      contentHash: data.content_hash,
    };
  }

  private mapToDropboxShareLink(data: any): DropboxShareLink {
    return {
      id: data.id || ulid(),
      url: data.url,
      path: data.path_display || data.path_lower,
      visibility: data.visibility?.['.tag'] || 'public',
      expires: data.expires ? new Date(data.expires) : undefined,
      settings: {
        allowDownload: data.link_permissions?.allow_download !== false,
        allowComments: data.link_permissions?.allow_comments === true,
      },
    };
  }

  private mapToDropboxSharedFolder(data: any, emails: string[], accessType: string): DropboxSharedFolder {
    return {
      id: data.shared_folder_id || ulid(),
      name: data.name,
      path: data.path_display || data.path_lower,
      accessType: 'owner',
      members: emails.map(email => ({
        email,
        accessType: accessType as 'owner' | 'editor' | 'viewer',
        status: 'invited',
      })),
    };
  }

  private mapToDropboxMetadata(data: any): DropboxMetadata {
    return {
      id: data.id || ulid(),
      name: data.name,
      path: data.path_display || data.path_lower,
      size: data.size,
      contentHash: data.content_hash,
      modifiedTime: new Date(data.server_modified),
      clientModifiedTime: new Date(data.client_modified),
      mediaInfo: data.media_info ? {
        dimensions: data.media_info.dimensions ? {
          width: data.media_info.dimensions.width,
          height: data.media_info.dimensions.height,
        } : undefined,
        location: data.media_info.location ? {
          latitude: data.media_info.location.latitude,
          longitude: data.media_info.location.longitude,
        } : undefined,
        timeTaken: data.media_info.time_taken ? new Date(data.media_info.time_taken) : undefined,
      } : undefined,
      sharingInfo: data.sharing_info ? {
        readOnly: data.sharing_info.read_only,
        parentSharedFolderId: data.sharing_info.parent_shared_folder_id,
        modifiedBy: data.sharing_info.modified_by,
      } : undefined,
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