import {
  DriveFile,
  DriveFolder,
  CreateFileParams,
  CreateFolderParams,
  ShareFileParams,
  FileSearchCriteria,
  StorageQuota,
  FileOrganizationSuggestion,
  MoveFileParams,
  FileActivity
} from '../DriveCapabilities';

/**
 * Abstract interface for drive capabilities across all workspace providers
 * This ensures consistent functionality regardless of the underlying provider (Google, Microsoft, Zoho)
 */
export interface IDriveCapabilities {
  /**
   * Search for files and folders
   */
  searchFiles(criteria: FileSearchCriteria, connectionId: string, agentId: string): Promise<DriveFile[]>;

  /**
   * Get detailed information about a specific file
   */
  getFile(fileId: string, connectionId: string, agentId: string): Promise<DriveFile>;

  /**
   * Create a new file
   */
  createFile(params: CreateFileParams, connectionId: string, agentId: string): Promise<DriveFile>;

  /**
   * Create a new folder
   */
  createFolder(params: CreateFolderParams, connectionId: string, agentId: string): Promise<DriveFolder>;

  /**
   * Share a file with specific permissions
   */
  shareFile(params: ShareFileParams, connectionId: string, agentId: string): Promise<void>;

  /**
   * Get storage quota information
   */
  getStorageQuota(connectionId: string, agentId: string): Promise<StorageQuota>;

  /**
   * Get file organization suggestions
   */
  getOrganizationSuggestions(connectionId: string, agentId: string): Promise<FileOrganizationSuggestion[]>;

  /**
   * Download a file
   */
  downloadFile(fileId: string, connectionId: string, agentId: string): Promise<Buffer>;

  /**
   * Update file content
   */
  updateFile(fileId: string, content: string | Buffer, connectionId: string, agentId: string): Promise<DriveFile>;

  /**
   * Move file to folder
   */
  moveFile(params: MoveFileParams, connectionId: string, agentId: string): Promise<DriveFile>;

  /**
   * Delete a file
   */
  deleteFile(fileId: string, connectionId: string, agentId: string): Promise<void>;

  /**
   * Get recent file activity
   */
  getRecentActivity(connectionId: string, agentId: string, maxResults?: number): Promise<FileActivity[]>;
} 