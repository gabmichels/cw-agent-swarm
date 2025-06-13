import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { DatabaseService } from '../../database/DatabaseService';
import { IDatabaseProvider } from '../../database/IDatabaseProvider';
import { WorkspaceConnection, WorkspaceCapabilityType } from '../../database/types';
import { AgentWorkspacePermissionService } from '../AgentWorkspacePermissionService';

// Drive data types
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime: Date;
  modifiedTime: Date;
  webViewLink?: string;
  webContentLink?: string;
  parents?: string[];
  owners?: FileOwner[];
  permissions?: FilePermission[];
  shared: boolean;
  starred: boolean;
  trashed: boolean;
  description?: string;
  thumbnailLink?: string;
}

export interface FileOwner {
  displayName: string;
  emailAddress: string;
  photoLink?: string;
}

export interface FilePermission {
  id: string;
  type: 'user' | 'group' | 'domain' | 'anyone';
  role: 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader';
  emailAddress?: string;
  displayName?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  createdTime: Date;
  modifiedTime: Date;
  webViewLink?: string;
  parents?: string[];
  childCount?: number;
  shared: boolean;
}

export interface FileSearchCriteria {
  name?: string;
  mimeType?: string;
  owner?: string;
  sharedWithMe?: boolean;
  starred?: boolean;
  trashed?: boolean;
  modifiedAfter?: Date;
  modifiedBefore?: Date;
  parentFolder?: string;
  maxResults?: number;
  orderBy?: 'name' | 'modifiedTime' | 'createdTime' | 'size';
}

export interface CreateFileParams {
  name: string;
  content?: string | Buffer;
  mimeType?: string;
  parents?: string[];
  description?: string;
}

export interface CreateFolderParams {
  name: string;
  parents?: string[];
  description?: string;
}

export interface ShareFileParams {
  fileId: string;
  permissions: {
    type: 'user' | 'group' | 'domain' | 'anyone';
    role: 'writer' | 'commenter' | 'reader';
    emailAddress?: string;
  }[];
  message?: string;
}

export interface MoveFileParams {
  fileId: string;
  newParents: string[];
  removeParents?: string[];
}

export interface FileActivity {
  time: Date;
  actor: string;
  action: string;
  target: string;
  details?: any;
}

export interface StorageQuota {
  limit: number;
  usage: number;
  usageInDrive: number;
  usageInDriveTrash: number;
  usageInGmail: number;
  usageInPhotos: number;
}

export interface FileOrganizationSuggestion {
  type: 'duplicate' | 'large_file' | 'old_file' | 'unorganized';
  files: DriveFile[];
  suggestion: string;
  potentialSavings?: number;
}

export class DriveCapabilities {
  private db: IDatabaseProvider;
  private permissionService: AgentWorkspacePermissionService;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.permissionService = new AgentWorkspacePermissionService();
  }

  /**
   * Search for files and folders
   */
  async searchFiles(criteria: FileSearchCriteria, connectionId: string, agentId: string): Promise<DriveFile[]> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DRIVE_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      const query = this.buildSearchQuery(criteria);
      
      const response = await drive.files.list({
        q: query,
        pageSize: criteria.maxResults || 20,
        orderBy: criteria.orderBy || 'modifiedTime desc',
        fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,owners,shared,starred,trashed,description,thumbnailLink)'
      });

      const files = response.data.files || [];
      return files.map(file => this.convertToDriveFile(file));
    } catch (error) {
      throw new Error(`Failed to search files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get file details
   */
  async getFile(fileId: string, connectionId: string, agentId: string): Promise<DriveFile> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DRIVE_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      const response = await drive.files.get({
        fileId,
        fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,owners,shared,starred,trashed,description,thumbnailLink'
      });

      return this.convertToDriveFile(response.data);
    } catch (error) {
      throw new Error(`Failed to get file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download file content
   */
  async downloadFile(fileId: string, connectionId: string, agentId: string): Promise<Buffer> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DRIVE_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      const response = await drive.files.get({
        fileId,
        alt: 'media'
      }, { responseType: 'arraybuffer' });

      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new file
   */
  async createFile(params: CreateFileParams, connectionId: string, agentId: string): Promise<DriveFile> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DRIVE_UPLOAD, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      const fileMetadata = {
        name: params.name,
        parents: params.parents,
        description: params.description
      };

      let response;
      
      if (params.content) {
        // Upload with content
        response = await drive.files.create({
          requestBody: fileMetadata,
          media: {
            mimeType: params.mimeType || 'text/plain',
            body: params.content
          },
          fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents'
        });
      } else {
        // Create empty file
        response = await drive.files.create({
          requestBody: fileMetadata,
          fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents'
        });
      }

      return this.convertToDriveFile(response.data);
    } catch (error) {
      throw new Error(`Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new folder
   */
  async createFolder(params: CreateFolderParams, connectionId: string, agentId: string): Promise<DriveFolder> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DRIVE_MANAGE, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      const folderMetadata = {
        name: params.name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: params.parents,
        description: params.description
      };

      const response = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id,name,createdTime,modifiedTime,webViewLink,parents'
      });

      return {
        id: response.data.id!,
        name: response.data.name!,
        createdTime: new Date(response.data.createdTime!),
        modifiedTime: new Date(response.data.modifiedTime!),
        webViewLink: response.data.webViewLink,
        parents: response.data.parents,
        shared: false
      };
    } catch (error) {
      throw new Error(`Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update file content
   */
  async updateFile(fileId: string, content: string | Buffer, connectionId: string, agentId: string): Promise<DriveFile> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DRIVE_MANAGE, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      const response = await drive.files.update({
        fileId,
        media: {
          body: content
        },
        fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink'
      });

      return this.convertToDriveFile(response.data);
    } catch (error) {
      throw new Error(`Failed to update file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Move file to different folder
   */
  async moveFile(params: MoveFileParams, connectionId: string, agentId: string): Promise<DriveFile> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DRIVE_MANAGE, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      // Get current parents if removeParents not specified
      let removeParents = params.removeParents;
      if (!removeParents) {
        const file = await this.getFile(params.fileId, connectionId, agentId);
        removeParents = file.parents || [];
      }

      const response = await drive.files.update({
        fileId: params.fileId,
        addParents: params.newParents.join(','),
        removeParents: removeParents.join(','),
        fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents'
      });

      return this.convertToDriveFile(response.data);
    } catch (error) {
      throw new Error(`Failed to move file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Share file with users
   */
  async shareFile(params: ShareFileParams, connectionId: string, agentId: string): Promise<void> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DRIVE_MANAGE, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      for (const permission of params.permissions) {
        await drive.permissions.create({
          fileId: params.fileId,
          requestBody: {
            type: permission.type,
            role: permission.role,
            emailAddress: permission.emailAddress
          },
          sendNotificationEmail: true,
          emailMessage: params.message
        });
      }
    } catch (error) {
      throw new Error(`Failed to share file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete file (move to trash)
   */
  async deleteFile(fileId: string, connectionId: string, agentId: string): Promise<void> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DRIVE_MANAGE, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      await drive.files.update({
        fileId,
        requestBody: {
          trashed: true
        }
      });
    } catch (error) {
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get storage quota information
   */
  async getStorageQuota(connectionId: string, agentId: string): Promise<StorageQuota> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DRIVE_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      const response = await drive.about.get({
        fields: 'storageQuota'
      });

      const quota = response.data.storageQuota;
      
      return {
        limit: parseInt(quota?.limit || '0'),
        usage: parseInt(quota?.usage || '0'),
        usageInDrive: parseInt(quota?.usageInDrive || '0'),
        usageInDriveTrash: parseInt(quota?.usageInDriveTrash || '0'),
        usageInGmail: parseInt(quota?.usageInGmail || '0'),
        usageInPhotos: parseInt(quota?.usageInPhotos || '0')
      };
    } catch (error) {
      throw new Error(`Failed to get storage quota: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get file organization suggestions
   */
  async getOrganizationSuggestions(connectionId: string, agentId: string): Promise<FileOrganizationSuggestion[]> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DRIVE_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const suggestions: FileOrganizationSuggestion[] = [];

    try {
      // Find large files
      const largeFiles = await this.searchFiles({
        maxResults: 50,
        orderBy: 'size'
      }, connectionId, agentId);

      const reallyLargeFiles = largeFiles.filter(f => f.size && f.size > 100 * 1024 * 1024); // > 100MB
      if (reallyLargeFiles.length > 0) {
        suggestions.push({
          type: 'large_file',
          files: reallyLargeFiles,
          suggestion: 'Consider archiving or deleting large files to free up space',
          potentialSavings: reallyLargeFiles.reduce((sum, f) => sum + (f.size || 0), 0)
        });
      }

      // Find old files
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const oldFiles = await this.searchFiles({
        modifiedBefore: oneYearAgo,
        maxResults: 50
      }, connectionId, agentId);

      if (oldFiles.length > 0) {
        suggestions.push({
          type: 'old_file',
          files: oldFiles,
          suggestion: 'Consider archiving files that haven\'t been modified in over a year',
          potentialSavings: oldFiles.reduce((sum, f) => sum + (f.size || 0), 0)
        });
      }

      // Find potential duplicates (simplified - by name similarity)
      const allFiles = await this.searchFiles({
        maxResults: 100
      }, connectionId, agentId);

      const duplicateGroups = this.findPotentialDuplicates(allFiles);
      for (const group of duplicateGroups) {
        if (group.length > 1) {
          suggestions.push({
            type: 'duplicate',
            files: group,
            suggestion: `Found ${group.length} files with similar names - check for duplicates`,
            potentialSavings: group.slice(1).reduce((sum, f) => sum + (f.size || 0), 0)
          });
        }
      }

      return suggestions;
    } catch (error) {
      throw new Error(`Failed to get organization suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get recent file activity
   */
  async getRecentActivity(connectionId: string, agentId: string, maxResults: number = 20): Promise<FileActivity[]> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DRIVE_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    try {
      // Get recently modified files as a proxy for activity
      const recentFiles = await this.searchFiles({
        maxResults,
        orderBy: 'modifiedTime'
      }, connectionId, agentId);

      return recentFiles.map(file => ({
        time: file.modifiedTime,
        actor: file.owners?.[0]?.displayName || 'Unknown',
        action: 'modified',
        target: file.name,
        details: {
          fileId: file.id,
          mimeType: file.mimeType
        }
      }));
    } catch (error) {
      throw new Error(`Failed to get recent activity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods
  private async getDriveClient(connection: WorkspaceConnection) {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken
    });

    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  private buildSearchQuery(criteria: FileSearchCriteria): string {
    const queryParts: string[] = [];

    if (criteria.name) {
      queryParts.push(`name contains '${criteria.name}'`);
    }

    if (criteria.mimeType) {
      queryParts.push(`mimeType='${criteria.mimeType}'`);
    }

    if (criteria.owner) {
      queryParts.push(`'${criteria.owner}' in owners`);
    }

    if (criteria.sharedWithMe) {
      queryParts.push('sharedWithMe');
    }

    if (criteria.starred) {
      queryParts.push('starred');
    }

    if (criteria.trashed !== undefined) {
      queryParts.push(`trashed=${criteria.trashed}`);
    }

    if (criteria.modifiedAfter) {
      queryParts.push(`modifiedTime > '${criteria.modifiedAfter.toISOString()}'`);
    }

    if (criteria.modifiedBefore) {
      queryParts.push(`modifiedTime < '${criteria.modifiedBefore.toISOString()}'`);
    }

    if (criteria.parentFolder) {
      queryParts.push(`'${criteria.parentFolder}' in parents`);
    }

    return queryParts.length > 0 ? queryParts.join(' and ') : '';
  }

  private convertToDriveFile(googleFile: any): DriveFile {
    return {
      id: googleFile.id,
      name: googleFile.name,
      mimeType: googleFile.mimeType,
      size: googleFile.size ? parseInt(googleFile.size) : undefined,
      createdTime: new Date(googleFile.createdTime),
      modifiedTime: new Date(googleFile.modifiedTime),
      webViewLink: googleFile.webViewLink,
      webContentLink: googleFile.webContentLink,
      parents: googleFile.parents,
      owners: googleFile.owners?.map((owner: any) => ({
        displayName: owner.displayName,
        emailAddress: owner.emailAddress,
        photoLink: owner.photoLink
      })),
      shared: googleFile.shared || false,
      starred: googleFile.starred || false,
      trashed: googleFile.trashed || false,
      description: googleFile.description,
      thumbnailLink: googleFile.thumbnailLink
    };
  }

  private findPotentialDuplicates(files: DriveFile[]): DriveFile[][] {
    const groups: { [key: string]: DriveFile[] } = {};
    
    for (const file of files) {
      // Group by similar names (remove extensions and normalize)
      const baseName = file.name.replace(/\.[^/.]+$/, '').toLowerCase().trim();
      const normalizedName = baseName.replace(/[^a-z0-9]/g, '');
      
      if (!groups[normalizedName]) {
        groups[normalizedName] = [];
      }
      groups[normalizedName].push(file);
    }
    
    return Object.values(groups).filter(group => group.length > 1);
  }
} 