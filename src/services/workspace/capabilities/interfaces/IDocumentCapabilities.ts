import {
  Document,
  CreateDocumentParams,
  UpdateDocumentParams,
  DocumentSearchCriteria,
  DocumentContent,
  DocumentInfo,
  DocumentPermission,
  DocumentActivity,
  DocumentTemplate
} from '../DocumentCapabilities';

/**
 * Abstract interface for document capabilities across all workspace providers
 * This ensures consistent functionality regardless of the underlying provider (Google, Microsoft, Zoho)
 */
export interface IDocumentCapabilities {
  /**
   * Search for documents
   */
  searchDocuments(criteria: DocumentSearchCriteria, connectionId: string, agentId: string): Promise<Document[]>;

  /**
   * List all documents (with optional pagination)
   */
  listDocuments(connectionId: string, agentId: string, limit?: number, offset?: number): Promise<Document[]>;

  /**
   * Get detailed information about a specific document
   */
  getDocument(documentId: string, connectionId: string, agentId: string): Promise<DocumentInfo>;

  /**
   * Get document content for reading
   */
  getDocumentContent(documentId: string, connectionId: string, agentId: string): Promise<DocumentContent>;

  /**
   * Create a new document
   */
  createDocument(params: CreateDocumentParams, connectionId: string, agentId: string): Promise<Document>;

  /**
   * Create document from template
   */
  createFromTemplate(template: DocumentTemplate, params: CreateDocumentParams, connectionId: string, agentId: string): Promise<Document>;

  /**
   * Update document content
   */
  updateDocument(documentId: string, params: UpdateDocumentParams, connectionId: string, agentId: string): Promise<Document>;

  /**
   * Upload/Import a document file
   */
  uploadDocument(file: Buffer, filename: string, connectionId: string, agentId: string): Promise<Document>;

  /**
   * Share a document with specific permissions
   */
  shareDocument(documentId: string, permissions: DocumentPermission[], connectionId: string, agentId: string): Promise<void>;

  /**
   * Move document to trash
   */
  trashDocument(documentId: string, connectionId: string, agentId: string): Promise<void>;

  /**
   * Permanently delete a document
   */
  deleteDocument(documentId: string, connectionId: string, agentId: string): Promise<void>;

  /**
   * Restore document from trash
   */
  restoreDocument(documentId: string, connectionId: string, agentId: string): Promise<Document>;

  /**
   * Get document activity/revision history
   */
  getDocumentActivity(documentId: string, connectionId: string, agentId: string): Promise<DocumentActivity[]>;

  /**
   * Export document in different formats
   */
  exportDocument(documentId: string, format: 'pdf' | 'docx' | 'html' | 'txt', connectionId: string, agentId: string): Promise<Buffer>;

  /**
   * Get document permissions
   */
  getDocumentPermissions(documentId: string, connectionId: string, agentId: string): Promise<DocumentPermission[]>;
} 