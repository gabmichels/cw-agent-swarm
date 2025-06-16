import { DatabaseService } from '../../database/DatabaseService';
import { IDatabaseProvider } from '../../database/IDatabaseProvider';
import { WorkspaceConnection, WorkspaceCapabilityType } from '../../database/types';
import { AgentWorkspacePermissionService } from '../AgentWorkspacePermissionService';

// Document data types
export interface Document {
  id: string;
  title: string;
  url: string;
  createdTime: Date;
  modifiedTime: Date;
  owner: string;
  permissions: DocumentPermission[];
  isPublic: boolean;
  mimeType: string;
  size?: number;
  thumbnailUrl?: string;
  webViewLink?: string;
  downloadUrl?: string;
  lastModifiedBy?: string;
  version?: string;
  starred?: boolean;
  trashed?: boolean;
}

export interface DocumentInfo extends Document {
  description?: string;
  tags?: string[];
  collaborators: DocumentCollaborator[];
  revisionHistory: DocumentRevision[];
  exportFormats: string[];
  shareSettings: ShareSettings;
}

export interface DocumentContent {
  documentId: string;
  content: string;
  contentType: 'text/plain' | 'text/html' | 'application/json';
  lastModified: Date;
  revisionId?: string;
  metadata?: Record<string, any>;
}

export interface CreateDocumentParams {
  title: string;
  content?: string;
  template?: DocumentTemplate;
  folderId?: string;
  isPublic?: boolean;
  description?: string;
  tags?: string[];
}

export interface UpdateDocumentParams {
  title?: string;
  content?: string;
  description?: string;
  tags?: string[];
}

export interface DocumentSearchCriteria {
  query?: string;
  title?: string;
  owner?: string;
  modifiedAfter?: Date;
  modifiedBefore?: Date;
  mimeType?: string;
  starred?: boolean;
  trashed?: boolean;
  maxResults?: number;
  pageToken?: string;
}

export interface DocumentPermission {
  id?: string;
  type: 'user' | 'group' | 'domain' | 'anyone';
  role: 'owner' | 'editor' | 'commenter' | 'reader';
  emailAddress?: string;
  displayName?: string;
  domain?: string;
  allowFileDiscovery?: boolean;
  expirationTime?: Date;
}

export interface DocumentCollaborator {
  userId: string;
  displayName: string;
  emailAddress: string;
  role: 'owner' | 'editor' | 'commenter' | 'reader';
  lastActive?: Date;
  profilePhoto?: string;
}

export interface DocumentRevision {
  id: string;
  modifiedTime: Date;
  lastModifyingUser: DocumentCollaborator;
  keepForever?: boolean;
  published?: boolean;
  size?: number;
  exportLinks?: Record<string, string>;
}

export interface DocumentActivity {
  id: string;
  type: 'create' | 'edit' | 'comment' | 'share' | 'rename' | 'move' | 'delete' | 'restore';
  timestamp: Date;
  user: DocumentCollaborator;
  description: string;
  details?: Record<string, any>;
}

export interface ShareSettings {
  linkShareEnabled: boolean;
  requireSignin: boolean;
  allowComments: boolean;
  allowDownload: boolean;
  allowCopy: boolean;
  allowEdit: boolean;
  viewersCanComment: boolean;
  viewersCanSuggest: boolean;
  commentersCanSuggest: boolean;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  previewUrl?: string;
  category: 'business' | 'personal' | 'education' | 'creative' | 'other';
}

export interface DocumentSearchResult {
  documents: Document[];
  totalCount?: number;
  nextPageToken?: string;
  hasMore: boolean;
}

export interface DocumentStats {
  totalDocuments: number;
  ownedDocuments: number;
  sharedWithMe: number;
  recentlyModified: number;
  storageUsed: number;
  collaborators: number;
}

/**
 * Base Document Capabilities class
 * Provides common functionality for document operations across different workspace providers
 */
export class DocumentCapabilities {
  protected db: IDatabaseProvider;
  protected permissionService: AgentWorkspacePermissionService;

  constructor(connectionId: string) {
    this.db = DatabaseService.getInstance();
    this.permissionService = new AgentWorkspacePermissionService();
  }

  /**
   * Search for documents with specified criteria
   */
  async searchDocuments(criteria: DocumentSearchCriteria, connectionId: string, agentId: string): Promise<Document[]> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DOCUMENT_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    // Implementation will be provided by specific provider classes
    throw new Error('searchDocuments must be implemented by provider-specific class');
  }

  /**
   * List all documents
   */
  async listDocuments(connectionId: string, agentId: string, limit: number = 50, offset: number = 0): Promise<Document[]> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DOCUMENT_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    // Implementation will be provided by specific provider classes
    throw new Error('listDocuments must be implemented by provider-specific class');
  }

  /**
   * Get document information
   */
  async getDocument(documentId: string, connectionId: string, agentId: string): Promise<DocumentInfo> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DOCUMENT_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    // Implementation will be provided by specific provider classes
    throw new Error('getDocument must be implemented by provider-specific class');
  }

  /**
   * Get document content
   */
  async getDocumentContent(documentId: string, connectionId: string, agentId: string): Promise<DocumentContent> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DOCUMENT_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    // Implementation will be provided by specific provider classes
    throw new Error('getDocumentContent must be implemented by provider-specific class');
  }

  /**
   * Create a new document
   */
  async createDocument(params: CreateDocumentParams, connectionId: string, agentId: string): Promise<Document> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DOCUMENT_CREATE, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    // Implementation will be provided by specific provider classes
    throw new Error('createDocument must be implemented by provider-specific class');
  }

  /**
   * Update document content
   */
  async updateDocument(documentId: string, params: UpdateDocumentParams, connectionId: string, agentId: string): Promise<Document> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DOCUMENT_EDIT, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    // Implementation will be provided by specific provider classes
    throw new Error('updateDocument must be implemented by provider-specific class');
  }

  /**
   * Upload a document
   */
  async uploadDocument(file: Buffer, filename: string, connectionId: string, agentId: string): Promise<Document> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DOCUMENT_CREATE, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    // Implementation will be provided by specific provider classes
    throw new Error('uploadDocument must be implemented by provider-specific class');
  }

  /**
   * Move document to trash
   */
  async trashDocument(documentId: string, connectionId: string, agentId: string): Promise<void> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DOCUMENT_EDIT, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    // Implementation will be provided by specific provider classes
    throw new Error('trashDocument must be implemented by provider-specific class');
  }

  /**
   * Permanently delete a document
   */
  async deleteDocument(documentId: string, connectionId: string, agentId: string): Promise<void> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DOCUMENT_EDIT, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    // Implementation will be provided by specific provider classes
    throw new Error('deleteDocument must be implemented by provider-specific class');
  }

  /**
   * Share a document
   */
  async shareDocument(documentId: string, permissions: DocumentPermission[], connectionId: string, agentId: string): Promise<void> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DOCUMENT_EDIT, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    // Implementation will be provided by specific provider classes
    throw new Error('shareDocument must be implemented by provider-specific class');
  }

  /**
   * Export document in specified format
   */
  async exportDocument(documentId: string, format: 'pdf' | 'docx' | 'html' | 'txt', connectionId: string, agentId: string): Promise<Buffer> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DOCUMENT_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    // Implementation will be provided by specific provider classes
    throw new Error('exportDocument must be implemented by provider-specific class');
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(connectionId: string, agentId: string): Promise<DocumentStats> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.DOCUMENT_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    // Implementation will be provided by specific provider classes
    throw new Error('getDocumentStats must be implemented by provider-specific class');
  }

  // Helper methods for converting between different document formats
  protected convertHtmlToText(html: string): string {
    // Simple HTML to text conversion
    return html.replace(/<[^>]*>/g, '').trim();
  }

  protected convertTextToHtml(text: string): string {
    // Simple text to HTML conversion
    return text.replace(/\n/g, '<br>').replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
  }

  protected sanitizeHtml(html: string): string {
    // Basic HTML sanitization (in production, use a proper sanitizer like DOMPurify)
    return html.replace(/<script[^>]*>.*?<\/script>/gi, '')
               .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
               .replace(/<object[^>]*>.*?<\/object>/gi, '');
  }
} 