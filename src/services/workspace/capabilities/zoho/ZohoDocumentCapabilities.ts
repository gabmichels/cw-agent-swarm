import { IDocumentCapabilities } from '../interfaces/IDocumentCapabilities';
import { 
  DocumentCapabilities, 
  Document, 
  DocumentInfo, 
  DocumentContent, 
  CreateDocumentParams, 
  UpdateDocumentParams, 
  DocumentSearchCriteria, 
  DocumentPermission, 
  DocumentActivity, 
  DocumentTemplate 
} from '../DocumentCapabilities';
import { ZohoWorkspaceProvider } from '../../providers/ZohoWorkspaceProvider';
import { AxiosInstance } from 'axios';

/**
 * Zoho Writer Implementation
 * Handles document operations using Zoho Writer API
 * Based on the official Zoho Writer API documentation
 */
export class ZohoDocumentCapabilities extends DocumentCapabilities implements IDocumentCapabilities {
  private zohoProvider: ZohoWorkspaceProvider;
  private connectionId: string;

  constructor(connectionId: string, zohoProvider: ZohoWorkspaceProvider) {
    super(connectionId);
    this.connectionId = connectionId;
    this.zohoProvider = zohoProvider;
  }

  /**
   * Search for documents using Zoho Writer Search API
   * Reference: https://www.zoho.com/writer/help/api/v1/search-document.html
   */
  async searchDocuments(criteria: DocumentSearchCriteria, connectionId: string, agentId: string): Promise<Document[]> {
    // Call parent for permission validation
    await super.searchDocuments(criteria, connectionId, agentId);

    try {
      const client = await this.zohoProvider.getServiceClient(connectionId, 'drive');
      
      // Build search parameters based on Zoho Writer Search API
      const params: any = {
        query: criteria.query || criteria.title || '',
        limit: criteria.maxResults || 50,
        offset: criteria.pageToken ? parseInt(criteria.pageToken) : 0
      };

      console.log('Searching Zoho documents with params:', params);
      
      // Use Zoho Writer search endpoint
      const response = await client.get('/documents/search', { params });

      if (!response.data.documents) {
        return [];
      }

      return response.data.documents.map((doc: any) => this.convertZohoDocumentToDocument(doc));
    } catch (error) {
      console.error('Zoho search documents error:', error);
      throw new Error(`Failed to search documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all documents using Zoho Writer List API
   * Reference: https://www.zoho.com/writer/help/api/v1/get-list-of-documents.html
   */
  async listDocuments(connectionId: string, agentId: string, limit: number = 50, offset: number = 0): Promise<Document[]> {
    // Call parent for permission validation
    await super.listDocuments(connectionId, agentId, limit, offset);

    try {
      const client = await this.zohoProvider.getServiceClient(connectionId, 'drive');
      
      console.log('Listing Zoho documents with limit:', limit, 'offset:', offset);
      
      // Use Zoho Writer list documents endpoint
      const response = await client.get('/documents', {
        params: {
          limit,
          offset
        }
      });

      if (!response.data.documents) {
        return [];
      }

      return response.data.documents.map((doc: any) => this.convertZohoDocumentToDocument(doc));
    } catch (error) {
      console.error('Zoho list documents error:', error);
      throw new Error(`Failed to list documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get detailed document information
   */
  async getDocument(documentId: string, connectionId: string, agentId: string): Promise<DocumentInfo> {
    // Call parent for permission validation
    await super.getDocument(documentId, connectionId, agentId);

    try {
      const client = await this.zohoProvider.getServiceClient(connectionId, 'drive');
      
      console.log('Getting Zoho document:', documentId);
      
      // Get document details
      const response = await client.get(`/documents/${documentId}`);
      const doc = response.data;

      const baseDocument = this.convertZohoDocumentToDocument(doc);
      
      return {
        ...baseDocument,
        description: doc.description || '',
        tags: doc.tags || [],
        collaborators: [], // Would need additional API call to get collaborators
        revisionHistory: [], // Would need additional API call to get revision history
        exportFormats: ['pdf', 'docx', 'html', 'txt'], // Zoho Writer standard export formats
        shareSettings: {
          linkShareEnabled: doc.is_public || false,
          requireSignin: true,
          allowComments: true,
          allowDownload: true,
          allowCopy: true,
          allowEdit: true,
          viewersCanComment: true,
          viewersCanSuggest: true,
          commentersCanSuggest: true
        }
      };
    } catch (error) {
      console.error('Zoho get document error:', error);
      throw new Error(`Failed to get document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document content
   */
  async getDocumentContent(documentId: string, connectionId: string, agentId: string): Promise<DocumentContent> {
    // Call parent for permission validation
    await super.getDocumentContent(documentId, connectionId, agentId);

    try {
      const client = await this.zohoProvider.getServiceClient(connectionId, 'drive');
      
      console.log('Getting Zoho document content:', documentId);
      
      // Download document content (Zoho Writer API doesn't have direct content endpoint)
      // We'll export as plain text to get the content
      const response = await client.get(`/documents/${documentId}/export`, {
        params: {
          format: 'txt'
        }
      });

      return {
        documentId,
        content: response.data || '',
        contentType: 'text/plain',
        lastModified: new Date(),
        metadata: {
          documentId,
          exportFormat: 'txt'
        }
      };
    } catch (error) {
      console.error('Zoho get document content error:', error);
      throw new Error(`Failed to get document content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new document using Zoho Writer Create API
   * Reference: https://www.zoho.com/writer/help/api/v1/create-upload-documents.html
   */
  async createDocument(params: CreateDocumentParams, connectionId: string, agentId: string): Promise<Document> {
    // Call parent for permission validation
    await super.createDocument(params, connectionId, agentId);

    try {
      const client = await this.zohoProvider.getServiceClient(connectionId, 'drive');
      
      console.log('Creating Zoho document with params:', params);
      
      // Create document using Zoho Writer API
      const response = await client.post('/documents', {
        filename: params.title,
        content: params.content || '',
        resource_type: 'fillable' // Default resource type
      });

      const doc = response.data;
      return this.convertZohoDocumentToDocument(doc);
    } catch (error) {
      console.error('Zoho create document error:', error);
      throw new Error(`Failed to create document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create document from template
   */
  async createFromTemplate(template: DocumentTemplate, params: CreateDocumentParams, connectionId: string, agentId: string): Promise<Document> {
    // For Zoho Writer, we'll create a regular document with template information
    const enhancedParams = {
      ...params,
      content: `Template: ${template.name}\n\n${params.content || ''}`
    };
    
    return this.createDocument(enhancedParams, connectionId, agentId);
  }

  /**
   * Update document content
   */
  async updateDocument(documentId: string, params: UpdateDocumentParams, connectionId: string, agentId: string): Promise<Document> {
    // Call parent for permission validation
    await super.updateDocument(documentId, params, connectionId, agentId);

    try {
      const client = await this.zohoProvider.getServiceClient(connectionId, 'drive');
      
      console.log('Updating Zoho document:', documentId, 'with params:', params);
      
      // Update document using Zoho Writer API
      const updateData: any = {};
      
      if (params.title) {
        updateData.filename = params.title;
      }
      
      if (params.content) {
        updateData.content = params.content;
      }
      
      if (params.description) {
        updateData.description = params.description;
      }

      const response = await client.put(`/documents/${documentId}`, updateData);
      const doc = response.data;
      
      return this.convertZohoDocumentToDocument(doc);
    } catch (error) {
      console.error('Zoho update document error:', error);
      throw new Error(`Failed to update document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload a document
   */
  async uploadDocument(file: Buffer, filename: string, connectionId: string, agentId: string): Promise<Document> {
    // Call parent for permission validation
    await super.uploadDocument(file, filename, connectionId, agentId);

    try {
      const client = await this.zohoProvider.getServiceClient(connectionId, 'drive');
      
      console.log('Uploading Zoho document:', filename);
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', new Blob([new Uint8Array(file)]), filename);
      formData.append('filename', filename);

      const response = await client.post('/documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const doc = response.data;
      return this.convertZohoDocumentToDocument(doc);
    } catch (error) {
      console.error('Zoho upload document error:', error);
      throw new Error(`Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Share a document
   */
  async shareDocument(documentId: string, permissions: DocumentPermission[], connectionId: string, agentId: string): Promise<void> {
    // Call parent for permission validation
    await super.shareDocument(documentId, permissions, connectionId, agentId);

    try {
      const client = await this.zohoProvider.getServiceClient(connectionId, 'drive');
      
      console.log('Sharing Zoho document:', documentId, 'with permissions:', permissions);
      
      // Zoho Writer sharing API (implementation depends on specific API structure)
      for (const permission of permissions) {
        await client.post(`/documents/${documentId}/share`, {
          email: permission.emailAddress,
          role: permission.role,
          type: permission.type
        });
      }
    } catch (error) {
      console.error('Zoho share document error:', error);
      throw new Error(`Failed to share document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Move document to trash using Zoho Writer Trash API
   * Reference: https://www.zoho.com/writer/help/api/v1/trash-document.html
   */
  async trashDocument(documentId: string, connectionId: string, agentId: string): Promise<void> {
    // Call parent for permission validation
    await super.trashDocument(documentId, connectionId, agentId);

    try {
      const client = await this.zohoProvider.getServiceClient(connectionId, 'drive');
      
      console.log('Trashing Zoho document:', documentId);
      
      // Use Zoho Writer trash endpoint
      const response = await client.delete(`/documents/${documentId}/trash`);
      
      if (response.data.result !== 'success') {
        throw new Error(response.data.message || 'Failed to trash document');
      }
    } catch (error) {
      console.error('Zoho trash document error:', error);
      throw new Error(`Failed to trash document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Permanently delete a document
   */
  async deleteDocument(documentId: string, connectionId: string, agentId: string): Promise<void> {
    // Call parent for permission validation
    await super.deleteDocument(documentId, connectionId, agentId);

    try {
      const client = await this.zohoProvider.getServiceClient(connectionId, 'drive');
      
      console.log('Deleting Zoho document:', documentId);
      
      // Use Zoho Writer delete endpoint
      await client.delete(`/documents/${documentId}`);
    } catch (error) {
      console.error('Zoho delete document error:', error);
      throw new Error(`Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restore document from trash
   */
  async restoreDocument(documentId: string, connectionId: string, agentId: string): Promise<Document> {
    try {
      const client = await this.zohoProvider.getServiceClient(connectionId, 'drive');
      
      console.log('Restoring Zoho document:', documentId);
      
      // Use Zoho Writer restore endpoint
      const response = await client.post(`/documents/${documentId}/restore`);
      const doc = response.data;
      
      return this.convertZohoDocumentToDocument(doc);
    } catch (error) {
      console.error('Zoho restore document error:', error);
      throw new Error(`Failed to restore document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document activity
   */
  async getDocumentActivity(documentId: string, connectionId: string, agentId: string): Promise<DocumentActivity[]> {
    try {
      const client = await this.zohoProvider.getServiceClient(connectionId, 'drive');
      
      console.log('Getting Zoho document activity:', documentId);
      
      // Get document activity (this endpoint may not exist in Zoho Writer API)
      const response = await client.get(`/documents/${documentId}/activity`);
      const activities = response.data.activities || [];
      
      return activities.map((activity: any) => ({
        id: activity.id || 'unknown',
        type: activity.type || 'edit',
        timestamp: new Date(activity.timestamp || Date.now()),
        user: {
          userId: activity.user?.id || 'unknown',
          displayName: activity.user?.display_name || 'Unknown User',
          emailAddress: activity.user?.email || 'unknown@example.com',
          role: 'editor' as const
        },
        description: activity.description || 'Document activity',
        details: activity.details || {}
      }));
    } catch (error) {
      console.error('Zoho get document activity error:', error);
      // Return empty array if activity endpoint doesn't exist
      return [];
    }
  }

  /**
   * Export document
   */
  async exportDocument(documentId: string, format: 'pdf' | 'docx' | 'html' | 'txt', connectionId: string, agentId: string): Promise<Buffer> {
    // Call parent for permission validation
    await super.exportDocument(documentId, format, connectionId, agentId);

    try {
      const client = await this.zohoProvider.getServiceClient(connectionId, 'drive');
      
      console.log('Exporting Zoho document:', documentId, 'as', format);
      
      // Use Zoho Writer export endpoint
      const response = await client.get(`/documents/${documentId}/export`, {
        params: { format },
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Zoho export document error:', error);
      throw new Error(`Failed to export document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document permissions
   */
  async getDocumentPermissions(documentId: string, connectionId: string, agentId: string): Promise<DocumentPermission[]> {
    try {
      const client = await this.zohoProvider.getServiceClient(connectionId, 'drive');
      
      console.log('Getting Zoho document permissions:', documentId);
      
      // Get document permissions
      const response = await client.get(`/documents/${documentId}/permissions`);
      const permissions = response.data.permissions || [];
      
      return permissions.map((permission: any) => ({
        id: permission.id,
        type: permission.type || 'user',
        role: permission.role || 'reader',
        emailAddress: permission.email,
        displayName: permission.display_name,
        domain: permission.domain
      }));
    } catch (error) {
      console.error('Zoho get document permissions error:', error);
      // Return empty array if permissions endpoint doesn't exist
      return [];
    }
  }

  // Helper method to convert Zoho document format to our standard Document interface
  private convertZohoDocumentToDocument(zohoDoc: any): Document {
    return {
      id: zohoDoc.document_id || zohoDoc.id || 'unknown',
      title: zohoDoc.document_name || zohoDoc.name || 'Untitled Document',
      url: zohoDoc.open_url || zohoDoc.preview_url || '',
      createdTime: new Date(zohoDoc.created_time || zohoDoc.created_time_ms || Date.now()),
      modifiedTime: new Date(zohoDoc.modified_time || Date.now()),
      owner: zohoDoc.created_by || 'Unknown',
      permissions: [], // Would need additional API call to populate
      isPublic: zohoDoc.is_favourite || false,
      mimeType: 'application/vnd.zoho-writer',
      size: zohoDoc.size || undefined,
      thumbnailUrl: zohoDoc.thumbnail_url,
      webViewLink: zohoDoc.open_url,
      downloadUrl: zohoDoc.download_url,
      lastModifiedBy: zohoDoc.lastmodified_by?.[0]?.display_name || 'Unknown',
      version: zohoDoc.version || '1.0',
      starred: zohoDoc.is_favourite || false,
      trashed: false // Zoho API doesn't seem to indicate trash status in list
    };
  }
} 