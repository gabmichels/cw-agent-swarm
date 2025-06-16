import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
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
  DocumentTemplate, 
  DocumentStats,
  DocumentCollaborator,
  DocumentRevision,
  ShareSettings
} from '../DocumentCapabilities';
import { WorkspaceCapabilityType } from '../../../database/types';
import { WorkspaceConnection } from '../../../database/types';
import { DatabaseService } from '../../../database/DatabaseService';

/**
 * Google Docs Implementation
 * Handles document operations using Google Docs API
 */
export class GoogleDocumentCapabilities extends DocumentCapabilities implements IDocumentCapabilities {
  constructor(connectionId: string) {
    super(connectionId);
  }

  /**
   * Search for documents using Google Drive API
   */
  async searchDocuments(criteria: DocumentSearchCriteria, connectionId: string, agentId: string): Promise<Document[]> {
    // Validate permissions directly
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DOCUMENT_READ, 
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
      // Build search query for Google Docs
      let query = "mimeType='application/vnd.google-apps.document'";
      
      if (criteria.query) {
        query += ` and fullText contains '${criteria.query.replace(/'/g, "\\'")}'`;
      }
      
      if (criteria.title) {
        query += ` and name contains '${criteria.title.replace(/'/g, "\\'")}'`;
      }
      
      if (criteria.trashed !== undefined) {
        query += ` and trashed = ${criteria.trashed}`;
      }

      const response = await drive.files.list({
        q: query,
        pageSize: criteria.maxResults || 50,
        pageToken: criteria.pageToken,
        fields: 'nextPageToken, files(id, name, webViewLink, createdTime, modifiedTime, owners, permissions, starred, trashed, size, thumbnailLink, exportLinks, lastModifyingUser, version)',
        orderBy: 'modifiedTime desc'
      });

      const files = response.data.files || [];
      return files.map(file => this.convertGoogleFileToDocument(file));
    } catch (error) {
      throw new Error(`Failed to search documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all documents
   */
  async listDocuments(connectionId: string, agentId: string, limit: number = 50, offset: number = 0): Promise<Document[]> {
    // Call parent for permission validation
    await super.listDocuments(connectionId, agentId, limit, offset);

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.document' and trashed = false",
        pageSize: limit,
        fields: 'files(id, name, webViewLink, createdTime, modifiedTime, owners, permissions, starred, trashed, size, thumbnailLink, exportLinks, lastModifyingUser, version)',
        orderBy: 'modifiedTime desc'
      });

      const files = response.data.files || [];
      return files.slice(offset, offset + limit).map(file => this.convertGoogleFileToDocument(file));
    } catch (error) {
      throw new Error(`Failed to list documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get detailed document information
   */
  async getDocument(documentId: string, connectionId: string, agentId: string): Promise<DocumentInfo> {
    // Call parent for permission validation
    await super.getDocument(documentId, connectionId, agentId);

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      const response = await drive.files.get({
        fileId: documentId,
        fields: 'id, name, description, webViewLink, createdTime, modifiedTime, owners, permissions, starred, trashed, size, thumbnailLink, exportLinks, lastModifyingUser, version, parents'
      });

      const file = response.data;
      const baseDocument = this.convertGoogleFileToDocument(file);
      
      return {
        ...baseDocument,
        description: file.description || '',
        tags: [], // Google Docs doesn't have built-in tags
        collaborators: [],
        revisionHistory: [],
        exportFormats: Object.keys(file.exportLinks || {}),
        shareSettings: {
          linkShareEnabled: file.permissions?.some(p => p.type === 'anyone') || false,
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
      throw new Error(`Failed to get document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document content
   */
  async getDocumentContent(documentId: string, connectionId: string, agentId: string): Promise<DocumentContent> {
    // Call parent for permission validation
    await super.getDocumentContent(documentId, connectionId, agentId);

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const docs = await this.getDocsClient(connection);
    
    try {
      const response = await docs.documents.get({
        documentId: documentId
      });

      const document = response.data;
      let content = '';
      
      // Extract text content from document structure
      if (document.body?.content) {
        content = this.extractTextFromGoogleDoc(document.body.content);
      }

      return {
        documentId,
        content,
        contentType: 'text/plain',
        lastModified: new Date(document.revisionId || Date.now()),
        revisionId: document.revisionId || undefined,
        metadata: {
          title: document.title,
          documentId: document.documentId
        }
      };
    } catch (error) {
      throw new Error(`Failed to get document content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new document
   */
  async createDocument(params: CreateDocumentParams, connectionId: string, agentId: string): Promise<Document> {
    // Validate permissions directly (don't call super.createDocument as it throws an error)
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DOCUMENT_CREATE, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const docs = await this.getDocsClient(connection);
    
    try {
      // Create the document
      const response = await docs.documents.create({
        requestBody: {
          title: params.title
        }
      });

      const documentId = response.data.documentId!;
      
      // Add content if provided
      if (params.content) {
        await docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [{
              insertText: {
                location: { index: 1 },
                text: params.content
              }
            }]
          }
        });
      }

      // Get the created document info
      const drive = await this.getDriveClient(connection);
      const fileResponse = await drive.files.get({
        fileId: documentId,
        fields: 'id, name, webViewLink, createdTime, modifiedTime, owners, permissions, starred, trashed, size, thumbnailLink, exportLinks, lastModifyingUser, version'
      });

      return this.convertGoogleFileToDocument(fileResponse.data);
    } catch (error) {
      throw new Error(`Failed to create document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create document from template
   */
  async createFromTemplate(template: DocumentTemplate, params: CreateDocumentParams, connectionId: string, agentId: string): Promise<Document> {
    // For Google Docs, we'll create a regular document
    return this.createDocument(params, connectionId, agentId);
  }

  /**
   * Update document content
   */
  async updateDocument(documentId: string, params: UpdateDocumentParams, connectionId: string, agentId: string): Promise<Document> {
    // Validate permissions directly (don't call super.updateDocument as it throws an error)
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DOCUMENT_EDIT, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const docs = await this.getDocsClient(connection);
    const drive = await this.getDriveClient(connection);
    
    try {
      const requests: any[] = [];
      
      // Update title if provided
      if (params.title) {
        await drive.files.update({
          fileId: documentId,
          requestBody: {
            name: params.title
          }
        });
      }
      
      // Update content if provided
      if (params.content) {
        // First, get the current document to know its length
        const docResponse = await docs.documents.get({
          documentId: documentId
        });
        
        const endIndex = docResponse.data.body?.content?.reduce((max, element) => {
          return Math.max(max, element.endIndex || 0);
        }, 0) || 1;
        
        // Delete all existing content except the first character (which is required)
        if (endIndex > 1) {
          requests.push({
            deleteContentRange: {
              range: {
                startIndex: 1,
                endIndex: endIndex - 1
              }
            }
          });
        }
        
        // Insert new content
        requests.push({
          insertText: {
            location: { index: 1 },
            text: params.content
          }
        });
      }
      
      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests
          }
        });
      }

      // Get updated document info
      const fileResponse = await drive.files.get({
        fileId: documentId,
        fields: 'id, name, webViewLink, createdTime, modifiedTime, owners, permissions, starred, trashed, size, thumbnailLink, exportLinks, lastModifyingUser, version'
      });

      return this.convertGoogleFileToDocument(fileResponse.data);
    } catch (error) {
      throw new Error(`Failed to update document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload a document
   */
  async uploadDocument(file: Buffer, filename: string, connectionId: string, agentId: string): Promise<Document> {
    // Call parent for permission validation
    await super.uploadDocument(file, filename, connectionId, agentId);

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      const response = await drive.files.create({
        requestBody: {
          name: filename,
          mimeType: 'application/vnd.google-apps.document'
        },
        media: {
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          body: file
        },
        fields: 'id, name, webViewLink, createdTime, modifiedTime, owners, permissions, starred, trashed, size, thumbnailLink, exportLinks, lastModifyingUser, version'
      });

      return this.convertGoogleFileToDocument(response.data);
    } catch (error) {
      throw new Error(`Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Share a document
   */
  async shareDocument(documentId: string, permissions: DocumentPermission[], connectionId: string, agentId: string): Promise<void> {
    // Call parent for permission validation
    await super.shareDocument(documentId, permissions, connectionId, agentId);

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      for (const permission of permissions) {
        await drive.permissions.create({
          fileId: documentId,
          requestBody: {
            type: permission.type,
            role: permission.role,
            emailAddress: permission.emailAddress,
            domain: permission.domain,
            allowFileDiscovery: permission.allowFileDiscovery ?? undefined,
            expirationTime: permission.expirationTime?.toISOString()
          }
        });
      }
    } catch (error) {
      throw new Error(`Failed to share document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Move document to trash
   */
  async trashDocument(documentId: string, connectionId: string, agentId: string): Promise<void> {
    // Call parent for permission validation
    await super.trashDocument(documentId, connectionId, agentId);

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      await drive.files.update({
        fileId: documentId,
        requestBody: {
          trashed: true
        }
      });
    } catch (error) {
      throw new Error(`Failed to trash document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Permanently delete a document
   */
  async deleteDocument(documentId: string, connectionId: string, agentId: string): Promise<void> {
    // Call parent for permission validation
    await super.deleteDocument(documentId, connectionId, agentId);

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      await drive.files.delete({
        fileId: documentId
      });
    } catch (error) {
      throw new Error(`Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restore document from trash
   */
  async restoreDocument(documentId: string, connectionId: string, agentId: string): Promise<Document> {
    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      const response = await drive.files.update({
        fileId: documentId,
        requestBody: {
          trashed: false
        },
        fields: 'id, name, webViewLink, createdTime, modifiedTime, owners, permissions, starred, trashed, size, thumbnailLink, exportLinks, lastModifyingUser, version'
      });

      return this.convertGoogleFileToDocument(response.data);
    } catch (error) {
      throw new Error(`Failed to restore document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document activity
   */
  async getDocumentActivity(documentId: string, connectionId: string, agentId: string): Promise<DocumentActivity[]> {
    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      const response = await drive.revisions.list({
        fileId: documentId,
        fields: 'revisions(id, modifiedTime, lastModifyingUser, keepForever, published, size, exportLinks)'
      });

      const revisions = response.data.revisions || [];
      return revisions.map(revision => ({
        id: revision.id!,
        type: 'edit' as const,
        timestamp: new Date(revision.modifiedTime!),
        user: {
          userId: revision.lastModifyingUser?.permissionId || 'unknown',
          displayName: revision.lastModifyingUser?.displayName || 'Unknown User',
          emailAddress: revision.lastModifyingUser?.emailAddress || 'unknown@example.com',
          role: 'editor' as const,
          profilePhoto: revision.lastModifyingUser?.photoLink || undefined
        },
        description: `Document edited by ${revision.lastModifyingUser?.displayName || 'Unknown User'}`,
        details: {
          revisionId: revision.id,
          size: revision.size,
          published: revision.published,
          keepForever: revision.keepForever
        }
      }));
    } catch (error) {
      throw new Error(`Failed to get document activity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export document
   */
  async exportDocument(documentId: string, format: 'pdf' | 'docx' | 'html' | 'txt', connectionId: string, agentId: string): Promise<Buffer> {
    // Call parent for permission validation
    await super.exportDocument(documentId, format, connectionId, agentId);

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      const mimeTypeMap = {
        'pdf': 'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'html': 'text/html',
        'txt': 'text/plain'
      };

      const response = await drive.files.export({
        fileId: documentId,
        mimeType: mimeTypeMap[format]
      }, {
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      throw new Error(`Failed to export document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document permissions
   */
  async getDocumentPermissions(documentId: string, connectionId: string, agentId: string): Promise<DocumentPermission[]> {
    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      const response = await drive.permissions.list({
        fileId: documentId,
        fields: 'permissions(id, type, role, emailAddress, displayName, domain, allowFileDiscovery, expirationTime)'
      });

      const permissions = response.data.permissions || [];
      return permissions.map(permission => ({
        id: permission.id || undefined,
        type: permission.type as 'user' | 'group' | 'domain' | 'anyone',
        role: permission.role as 'owner' | 'editor' | 'commenter' | 'reader',
        emailAddress: permission.emailAddress || undefined,
        displayName: permission.displayName || undefined,
        domain: permission.domain || undefined,
        allowFileDiscovery: permission.allowFileDiscovery ?? undefined,
        expirationTime: permission.expirationTime ? new Date(permission.expirationTime) : undefined
      }));
    } catch (error) {
      throw new Error(`Failed to get document permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper methods
  private async getDriveClient(connection: WorkspaceConnection) {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken
    });

    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  private async getDocsClient(connection: WorkspaceConnection) {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken
    });

    return google.docs({ version: 'v1', auth: oauth2Client });
  }

  private convertGoogleFileToDocument(file: any): Document {
    return {
      id: file.id,
      title: file.name || 'Untitled Document',
      url: file.webViewLink || '',
      createdTime: new Date(file.createdTime || Date.now()),
      modifiedTime: new Date(file.modifiedTime || Date.now()),
      owner: file.owners?.[0]?.displayName || 'Unknown',
      permissions: file.permissions?.map((p: any) => ({
        id: p.id,
        type: p.type,
        role: p.role,
        emailAddress: p.emailAddress,
        displayName: p.displayName,
        domain: p.domain,
        allowFileDiscovery: p.allowFileDiscovery,
        expirationTime: p.expirationTime ? new Date(p.expirationTime) : undefined
      })) || [],
      isPublic: file.permissions?.some((p: any) => p.type === 'anyone') || false,
      mimeType: 'application/vnd.google-apps.document',
      size: file.size ? parseInt(file.size) : undefined,
      thumbnailUrl: file.thumbnailLink,
      webViewLink: file.webViewLink,
      downloadUrl: file.exportLinks?.['application/pdf'],
      lastModifiedBy: file.lastModifyingUser?.displayName,
      version: file.version,
      starred: file.starred || false,
      trashed: file.trashed || false
    };
  }

  private extractTextFromGoogleDoc(content: any[]): string {
    let text = '';
    
    for (const element of content) {
      if (element.paragraph) {
        const paragraph = element.paragraph;
        if (paragraph.elements) {
          for (const elem of paragraph.elements) {
            if (elem.textRun) {
              text += elem.textRun.content || '';
            }
          }
        }
      } else if (element.table) {
        // Handle table content
        const table = element.table;
        if (table.tableRows) {
          for (const row of table.tableRows) {
            if (row.tableCells) {
              for (const cell of row.tableCells) {
                if (cell.content) {
                  text += this.extractTextFromGoogleDoc(cell.content) + '\t';
                }
              }
              text += '\n';
            }
          }
        }
      }
    }
    
    return text;
  }
} 