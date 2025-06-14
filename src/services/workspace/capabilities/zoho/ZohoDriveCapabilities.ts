import { IDriveCapabilities } from '../interfaces/IDriveCapabilities';
import { DriveFile, FileSearchCriteria, CreateFileParams } from '../DriveCapabilities';
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
        if (criteria.q) {
          files = files.filter((file: any) => 
            file.name?.toLowerCase().includes(criteria.q!.toLowerCase()) ||
            file.description?.toLowerCase().includes(criteria.q!.toLowerCase())
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
            file.type && file.type.toLowerCase().includes(criteria.mimeType.toLowerCase())
          );
        }

        return files.map((file: any) => this.convertToDriveFile(file));
      }

      return [];
    } catch (error) {
      console.error('Error searching Zoho WorkDrive files:', error);
      if (error.response) {
        console.error('Error response status:', error.response.status);
        console.error('Error response data:', error.response.data);
      }
      throw new Error(`Failed to search files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get file information from Zoho WorkDrive
   */
  async getFileInfo(fileId: string, connectionId: string, agentId: string): Promise<DriveFile> {
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
   * List files in a specific folder
   */
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
        return files.map(file => this.convertToDriveFile(file));
      }

      return [];
    } catch (error) {
      console.error('Zoho WorkDrive list files error:', error);
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * NOTE: File creation is not supported in WorkDrive directly.
   * Files are created through specific applications:
   * - Spreadsheets: Use ZohoSheetsCapabilities.createSpreadsheet()
   * - Documents: Use Zoho Writer API
   * - Other files: Upload through specific service APIs
   * 
   * WorkDrive is for file management, search, and organization only.
   */
  async createFile(params: CreateFileParams, connectionId: string, agentId: string): Promise<DriveFile> {
    throw new Error('File creation is not supported through WorkDrive. Use specific application APIs (Zoho Sheet, Writer, etc.) to create files.');
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