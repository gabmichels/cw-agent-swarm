import { IDriveCapabilities } from '../interfaces/IDriveCapabilities';
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
import { ZohoWorkspaceProvider } from '../../providers/ZohoWorkspaceProvider';
import { AxiosInstance } from 'axios';

/**
 * Zoho WorkDrive Capabilities Implementation
 * Implements file operations using Zoho WorkDrive API
 */
export class ZohoDriveCapabilities implements IDriveCapabilities {
  private zohoProvider: ZohoWorkspaceProvider;
  private connectionId: string;

  constructor(connectionId: string, zohoProvider: ZohoWorkspaceProvider) {
    this.connectionId = connectionId;
    this.zohoProvider = zohoProvider;
  }

  /**
   * Search files in Zoho WorkDrive
   */
  async searchFiles(criteria: FileSearchCriteria, connectionId: string, agentId: string): Promise<DriveFile[]> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'drive');
      
      console.log('Searching Zoho WorkDrive files with criteria:', criteria);

      // FIXED: WorkDrive API is extremely restrictive - use minimal request
      console.log('WorkDrive search - using minimal request');

      // FIXED: Remove all headers and parameters - use bare minimum request
      const response = await client.get('/files');

      console.log('WorkDrive search response:', response.data);

      if (response.data && response.data.data) {
        let files = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
        
        // Apply client-side filtering if needed
        if (criteria.name) {
          files = files.filter((file: any) => 
            file.name?.toLowerCase().includes(criteria.name!.toLowerCase()) ||
            file.description?.toLowerCase().includes(criteria.name!.toLowerCase())
          );
        }

        if (criteria.name) {
          files = files.filter((file: any) => 
            file.name?.toLowerCase().includes(criteria.name!.toLowerCase())
          );
        }

        // Filter by criteria if needed
        if (criteria.mimeType) {
          files = files.filter((file: any) => 
            file.type && file.type.toLowerCase().includes(criteria.mimeType!.toLowerCase())
          );
        }

        return files.map((file: any) => this.convertToDriveFile(file));
      }

      return [];
    } catch (error) {
      console.error('Error searching Zoho WorkDrive files:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.error('Error response status:', axiosError.response?.status);
        console.error('Error response data:', axiosError.response?.data);
      }
      throw new Error(`Failed to search files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get detailed information about a specific file
   */
  async getFile(fileId: string, connectionId: string, agentId: string): Promise<DriveFile> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'drive');
      
      console.log('Getting Zoho WorkDrive file info:', fileId);

      const response = await client.get(`/files/${fileId}`, {
        headers: {
          'Accept': 'application/vnd.api+json'
        }
      });

      if (response.data && response.data.data) {
        return this.convertToDriveFile(response.data.data);
      }

      throw new Error('File not found in Zoho WorkDrive');
    } catch (error) {
      console.error('Zoho WorkDrive get file info error:', error);
      throw new Error(`Failed to get file info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new file
   */
  async createFile(params: CreateFileParams, connectionId: string, agentId: string): Promise<DriveFile> {
    throw new Error('File creation is not supported through WorkDrive. Use specific application APIs (Zoho Sheet, Writer, etc.) to create files.');
  }

  /**
   * Create a new folder
   */
  async createFolder(params: CreateFolderParams, connectionId: string, agentId: string): Promise<DriveFolder> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'drive');
      
      const folderData = {
        data: {
          type: 'folders',
          attributes: {
            name: params.name,
            parent_id: params.parents?.[0] || null
          }
        }
      };

      const response = await client.post('/folders', folderData, {
        headers: {
          'Content-Type': 'application/vnd.api+json'
        }
      });

      return {
        id: response.data.data.id,
        name: response.data.data.attributes.name,
        createdTime: new Date(response.data.data.attributes.created_time || Date.now()),
        modifiedTime: new Date(response.data.data.attributes.modified_time || Date.now()),
        parents: response.data.data.attributes.parent_id ? [response.data.data.attributes.parent_id] : undefined,
        webViewLink: response.data.data.attributes.permalink,
        shared: false
      };
    } catch (error) {
      throw new Error(`Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Share a file with specific permissions
   */
  async shareFile(params: ShareFileParams, connectionId: string, agentId: string): Promise<void> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'drive');
      
      for (const permission of params.permissions) {
        const shareData = {
          data: {
            type: 'permissions',
            attributes: {
              email_id: permission.emailAddress,
              role_id: permission.role === 'writer' ? 2 : 1, // 2 = editor, 1 = viewer
              operation_type: 'add'
            }
          }
        };

        await client.post(`/files/${params.fileId}/permissions`, shareData, {
          headers: {
            'Content-Type': 'application/vnd.api+json'
          }
        });
      }
    } catch (error) {
      throw new Error(`Failed to share file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get storage quota information
   */
  async getStorageQuota(connectionId: string, agentId: string): Promise<StorageQuota> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'drive');
      
      const response = await client.get('/user/storage');
      
      return {
        limit: response.data.quota || 15000000000, // Default 15GB
        usage: response.data.used || 0,
        usageInDrive: response.data.used || 0,
        usageInDriveTrash: 0,
        usageInGmail: 0,
        usageInPhotos: 0
      };
    } catch (error) {
      // Return default values if quota endpoint doesn't exist
      return {
        limit: 15000000000, // 15GB default
        usage: 0,
        usageInDrive: 0,
        usageInDriveTrash: 0,
        usageInGmail: 0,
        usageInPhotos: 0
      };
    }
  }

  /**
   * Get file organization suggestions
   */
  async getOrganizationSuggestions(connectionId: string, agentId: string): Promise<FileOrganizationSuggestion[]> {
    // For Zoho, provide basic organization suggestions
    try {
      const files = await this.searchFiles({}, connectionId, agentId);
      
      const suggestions: FileOrganizationSuggestion[] = [];
      
      // Group by file type
      const filesByType = files.reduce((acc, file) => {
        const type = file.mimeType || 'unknown';
        if (!acc[type]) acc[type] = [];
        acc[type].push(file);
        return acc;
      }, {} as Record<string, DriveFile[]>);

      Object.entries(filesByType).forEach(([type, typeFiles]) => {
        if (typeFiles.length > 3) {
          suggestions.push({
            type: 'unorganized',
            files: typeFiles,
            suggestion: `Create a folder for ${typeFiles.length} ${type} files to better organize them`,
            potentialSavings: 0
          });
        }
      });

      return suggestions;
    } catch (error) {
      throw new Error(`Failed to get organization suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download a file
   */
  async downloadFile(fileId: string, connectionId: string, agentId: string): Promise<Buffer> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'drive');
      
      const response = await client.get(`/files/${fileId}/download`, {
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update file content
   */
  async updateFile(fileId: string, content: string | Buffer, connectionId: string, agentId: string): Promise<DriveFile> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'drive');
      
      const formData = new FormData();
      const blob = typeof content === 'string' ? new Blob([content]) : new Blob([new Uint8Array(content)]);
      formData.append('file', blob);

      const response = await client.put(`/files/${fileId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return this.convertToDriveFile(response.data.data);
    } catch (error) {
      throw new Error(`Failed to update file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Move file to folder
   */
  async moveFile(params: MoveFileParams, connectionId: string, agentId: string): Promise<DriveFile> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'drive');
      
      const moveData = {
        data: {
          type: 'files',
          attributes: {
            parent_id: params.newParents[0] // Use first parent from newParents array
          }
        }
      };

      const response = await client.patch(`/files/${params.fileId}`, moveData, {
        headers: {
          'Content-Type': 'application/vnd.api+json'
        }
      });

      return this.convertToDriveFile(response.data.data);
    } catch (error) {
      throw new Error(`Failed to move file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string, connectionId: string, agentId: string): Promise<void> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'drive');
      
      await client.delete(`/files/${fileId}`);
    } catch (error) {
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get recent file activity
   */
  async getRecentActivity(connectionId: string, agentId: string, maxResults?: number): Promise<FileActivity[]> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'drive');
      
      const response = await client.get('/files/recent', {
        params: {
          limit: maxResults || 50
        }
      });

      return (response.data.data || []).map((activity: any) => ({
        time: new Date(activity.timestamp || Date.now()),
        actor: activity.user_name || 'Unknown User',
        action: activity.action || 'modified',
        target: activity.file_name || 'Unknown File',
        details: activity.details || {}
      }));
    } catch (error) {
      // Return empty array if activity endpoint doesn't exist
      return [];
    }
  }

  // Legacy method for backward compatibility
  async getFileInfo(fileId: string, connectionId: string, agentId: string): Promise<DriveFile> {
    return this.getFile(fileId, connectionId, agentId);
  }

  async listFiles(folderId?: string, connectionId?: string, agentId?: string): Promise<DriveFile[]> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'drive');
      
      console.log('Listing Zoho WorkDrive files in folder:', folderId || 'root');

      const params: any = {
        'filter[type]': 'files',
        'page[limit]': 100
      };

      if (folderId) {
        params['filter[parent_id]'] = folderId;
      }

      const response = await client.get('/files', {
        params,
        headers: {
          'Accept': 'application/vnd.api+json'
        }
      });

      if (response.data && response.data.data) {
        const files = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
        return files.map((file: any) => this.convertToDriveFile(file));
      }

      return [];
    } catch (error) {
      console.error('Zoho WorkDrive list files error:', error);
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert Zoho WorkDrive file to DriveFile format
   */
  private convertToDriveFile(zohoFile: any): DriveFile {
    return {
      id: zohoFile.id || zohoFile.resource_id,
      name: zohoFile.name || zohoFile.display_name,
      mimeType: zohoFile.type || 'application/octet-stream',
      size: zohoFile.size ? parseInt(zohoFile.size) : undefined,
      createdTime: zohoFile.created_time ? new Date(zohoFile.created_time) : new Date(),
      modifiedTime: zohoFile.modified_time ? new Date(zohoFile.modified_time) : new Date(),
      webViewLink: zohoFile.permalink,
      webContentLink: zohoFile.download_url,
      parents: zohoFile.parent_id ? [zohoFile.parent_id] : undefined,
      shared: zohoFile.is_shared || false,
      starred: zohoFile.is_starred || false,
      trashed: zohoFile.is_trashed || false,
      description: zohoFile.description,
      thumbnailLink: zohoFile.thumbnail_url
    };
  }

  /**
   * Helper method to get file extension from MIME type
   */
  private getMimeTypeExtension(mimeType: string): string {
    const mimeToExt: { [key: string]: string } = {
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif'
    };
    return mimeToExt[mimeType] || '';
  }
} 