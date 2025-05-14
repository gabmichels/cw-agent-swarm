/**
 * CodaIntegration.interface.ts
 * Interface defining the contract for Coda document management integrations
 */

/**
 * Represents a document in Coda
 */
export interface CodaDoc {
  id: string;
  type: string;
  href: string;
  browserLink: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Response format for listing documents
 */
export interface CodaListResponse {
  items: CodaDoc[];
  nextPageToken?: string;
  nextPageLink?: string;
}

/**
 * Represents a resolved resource in Coda
 */
export interface ResolvedResource {
  type: string;
  id: string;
  name: string;
  href: string;
}

/**
 * Response format for browser link resolution
 */
export interface BrowserLinkResponse {
  type: string;
  href: string;
  browserLink: string;
  resource: ResolvedResource;
}

/**
 * Configuration options for Coda integration
 */
export interface CodaIntegrationOptions {
  apiKey?: string;
  folderId?: string;
  timezone?: string;
}

/**
 * Interface defining the contract for Coda document management integrations
 */
export interface ICodaIntegration {
  /**
   * Check if the integration is enabled
   */
  isEnabled(): boolean;

  /**
   * Resolves a browser link to get the resource details
   * This converts a URL like https://coda.io/d/_dXXXXXX/PageName_sYYYYYY
   * into the proper resource IDs that can be used with the API
   * 
   * @param url The browser URL to resolve
   * @returns The resolved resource details
   * @throws Error if resolution fails or integration is disabled
   */
  resolveBrowserLink(url: string): Promise<ResolvedResource>;

  /**
   * List all docs in the workspace
   * 
   * @returns Array of documents
   * @throws Error if listing fails
   */
  listDocs(): Promise<CodaDoc[]>;

  /**
   * Read the content of a specific doc or page
   * 
   * @param docId Document or page ID
   * @returns Document content as a string
   * @throws Error if reading fails or integration is disabled
   */
  readDoc(docId: string): Promise<string>;

  /**
   * Create a new doc with specified title and content
   * 
   * @param title Document title
   * @param content Initial document content
   * @returns The created document
   * @throws Error if creation fails or integration is disabled
   */
  createDoc(title: string, content: string): Promise<CodaDoc>;

  /**
   * Update the content of a specific doc or page
   * 
   * @param docId Document or page ID
   * @param content New content
   * @throws Error if update fails or integration is disabled
   */
  updateDoc(docId: string, content: string): Promise<void>;
} 