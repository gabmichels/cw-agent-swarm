/**
 * Canva Integration - Phase 2 Strategic Integration
 * 
 * Provides comprehensive Canva design and content creation capabilities
 * including template management, design creation, asset management, and publishing.
 * 
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - ULID-based IDs for all entities
 * - Strict TypeScript interfaces
 * - Dependency injection pattern
 * - Comprehensive error handling
 * - Immutable data structures
 */

import { ulid } from 'ulid';
import { logger } from '../../../lib/logging';
import { 
  ExternalWorkflowError,
  WorkflowExecutionError,
  WorkflowValidationError,
  WorkflowConnectionError
} from '../errors/ExternalWorkflowErrors';

// ============================================================================
// Canva Integration Interfaces
// ============================================================================

export interface CanvaConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly scopes: readonly string[];
  readonly apiVersion?: string;
}

export interface CanvaDesignParams {
  readonly designType: 'presentation' | 'document' | 'whiteboard' | 'video' | 'website' | 'social-media-post' | 'logo' | 'poster' | 'flyer' | 'brochure' | 'card' | 'certificate' | 'resume' | 'infographic';
  readonly title: string;
  readonly width?: number;
  readonly height?: number;
  readonly templateId?: string;
  readonly folderId?: string;
  readonly brandTemplateId?: string;
  readonly elements?: readonly CanvaElement[];
  readonly pages?: readonly CanvaPage[];
}

export interface CanvaElement {
  readonly type: 'text' | 'image' | 'shape' | 'line' | 'chart' | 'table' | 'video' | 'audio' | 'embed';
  readonly id?: string;
  readonly position: {
    readonly x: number;
    readonly y: number;
  };
  readonly size: {
    readonly width: number;
    readonly height: number;
  };
  readonly rotation?: number;
  readonly opacity?: number;
  readonly zIndex?: number;
  readonly content?: CanvaElementContent;
  readonly style?: CanvaElementStyle;
  readonly animation?: CanvaAnimation;
  readonly link?: {
    readonly url: string;
    readonly target: '_blank' | '_self';
  };
}

export interface CanvaElementContent {
  readonly text?: {
    readonly content: string;
    readonly fontSize?: number;
    readonly fontFamily?: string;
    readonly fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
    readonly fontStyle?: 'normal' | 'italic';
    readonly textAlign?: 'left' | 'center' | 'right' | 'justify';
    readonly textDecoration?: 'none' | 'underline' | 'line-through';
    readonly lineHeight?: number;
    readonly letterSpacing?: number;
    readonly color?: string;
  };
  readonly image?: {
    readonly url: string;
    readonly altText?: string;
    readonly crop?: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };
    readonly filters?: readonly CanvaImageFilter[];
  };
  readonly shape?: {
    readonly type: 'rectangle' | 'circle' | 'triangle' | 'polygon' | 'star' | 'heart' | 'arrow';
    readonly fillColor?: string;
    readonly borderColor?: string;
    readonly borderWidth?: number;
    readonly borderStyle?: 'solid' | 'dashed' | 'dotted';
    readonly cornerRadius?: number;
  };
  readonly chart?: {
    readonly type: 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | 'scatter';
    readonly data: readonly CanvaChartDataPoint[];
    readonly labels?: readonly string[];
    readonly colors?: readonly string[];
    readonly title?: string;
    readonly legend?: {
      readonly show: boolean;
      readonly position: 'top' | 'bottom' | 'left' | 'right';
    };
  };
  readonly video?: {
    readonly url: string;
    readonly thumbnail?: string;
    readonly startTime?: number;
    readonly endTime?: number;
    readonly autoplay?: boolean;
    readonly loop?: boolean;
    readonly muted?: boolean;
  };
}

export interface CanvaElementStyle {
  readonly backgroundColor?: string;
  readonly borderColor?: string;
  readonly borderWidth?: number;
  readonly borderStyle?: 'solid' | 'dashed' | 'dotted';
  readonly borderRadius?: number;
  readonly boxShadow?: {
    readonly x: number;
    readonly y: number;
    readonly blur: number;
    readonly spread: number;
    readonly color: string;
  };
  readonly gradient?: {
    readonly type: 'linear' | 'radial';
    readonly angle?: number;
    readonly stops: readonly {
      readonly color: string;
      readonly position: number;
    }[];
  };
}

export interface CanvaImageFilter {
  readonly type: 'brightness' | 'contrast' | 'saturation' | 'hue' | 'blur' | 'sepia' | 'grayscale' | 'invert';
  readonly value: number;
}

export interface CanvaChartDataPoint {
  readonly label: string;
  readonly value: number;
  readonly color?: string;
}

export interface CanvaAnimation {
  readonly type: 'fade' | 'slide' | 'zoom' | 'rotate' | 'bounce' | 'pulse' | 'shake';
  readonly duration: number;
  readonly delay?: number;
  readonly easing?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
  readonly direction?: 'up' | 'down' | 'left' | 'right' | 'in' | 'out';
  readonly loop?: boolean;
}

export interface CanvaPage {
  readonly id?: string;
  readonly title?: string;
  readonly duration?: number; // For video/presentation pages
  readonly background?: {
    readonly color?: string;
    readonly image?: {
      readonly url: string;
      readonly opacity?: number;
      readonly blur?: number;
    };
    readonly gradient?: CanvaElementStyle['gradient'];
  };
  readonly elements: readonly CanvaElement[];
  readonly transitions?: {
    readonly type: 'fade' | 'slide' | 'zoom' | 'flip' | 'cube' | 'dissolve';
    readonly duration: number;
    readonly direction?: 'up' | 'down' | 'left' | 'right';
  };
}

export interface CanvaDesign {
  readonly id: string;
  readonly title: string;
  readonly designType: CanvaDesignParams['designType'];
  readonly status: 'draft' | 'published' | 'archived';
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly owner: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
  };
  readonly collaborators: readonly {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly role: 'owner' | 'editor' | 'viewer';
  }[];
  readonly size: {
    readonly width: number;
    readonly height: number;
  };
  readonly pageCount: number;
  readonly folderId?: string;
  readonly brandId?: string;
  readonly thumbnailUrl?: string;
  readonly editUrl: string;
  readonly viewUrl: string;
  readonly tags: readonly string[];
  readonly isPublic: boolean;
  readonly exportFormats: readonly ('pdf' | 'png' | 'jpg' | 'gif' | 'mp4' | 'pptx' | 'docx')[];
}

export interface CanvaTemplate {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly designType: CanvaDesignParams['designType'];
  readonly category: string;
  readonly subcategory?: string;
  readonly tags: readonly string[];
  readonly thumbnailUrl: string;
  readonly previewUrl?: string;
  readonly isPremium: boolean;
  readonly isAnimated: boolean;
  readonly size: {
    readonly width: number;
    readonly height: number;
  };
  readonly colorPalette: readonly string[];
  readonly createdBy: {
    readonly id: string;
    readonly name: string;
    readonly isVerified: boolean;
  };
  readonly usageCount: number;
  readonly rating: {
    readonly average: number;
    readonly count: number;
  };
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CanvaFolder {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly parentId?: string;
  readonly ownerId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly itemCount: number;
  readonly isShared: boolean;
  readonly permissions: {
    readonly canEdit: boolean;
    readonly canShare: boolean;
    readonly canDelete: boolean;
  };
}

export interface CanvaAsset {
  readonly id: string;
  readonly name: string;
  readonly type: 'image' | 'video' | 'audio' | 'font' | 'template' | 'brand-kit';
  readonly url: string;
  readonly thumbnailUrl?: string;
  readonly size: {
    readonly width?: number;
    readonly height?: number;
    readonly fileSize: number;
  };
  readonly format: string;
  readonly uploadedAt: Date;
  readonly uploadedBy: {
    readonly id: string;
    readonly name: string;
  };
  readonly tags: readonly string[];
  readonly isPublic: boolean;
  readonly usageRights: {
    readonly canUseCommercially: boolean;
    readonly canModify: boolean;
    readonly attribution?: string;
  };
  readonly metadata?: Record<string, unknown>;
}

export interface CanvaExportParams {
  readonly designId: string;
  readonly format: 'pdf' | 'png' | 'jpg' | 'gif' | 'mp4' | 'pptx' | 'docx';
  readonly quality?: 'low' | 'medium' | 'high' | 'ultra';
  readonly pages?: readonly number[];
  readonly transparent?: boolean; // For PNG
  readonly compression?: number; // For JPG (0-100)
  readonly fps?: number; // For GIF/MP4
  readonly duration?: number; // For MP4
  readonly includeBleedArea?: boolean; // For PDF
  readonly includeMarks?: boolean; // For PDF
  readonly colorProfile?: 'sRGB' | 'CMYK' | 'RGB';
}

export interface CanvaExportResult {
  readonly success: boolean;
  readonly exportId?: string;
  readonly downloadUrl?: string;
  readonly fileSize?: number;
  readonly format: CanvaExportParams['format'];
  readonly quality?: CanvaExportParams['quality'];
  readonly expiresAt?: Date;
  readonly error?: string;
}

export interface CanvaBrandKit {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly colors: readonly {
    readonly id: string;
    readonly name: string;
    readonly hex: string;
    readonly rgb: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
    };
    readonly isPrimary: boolean;
  }[];
  readonly fonts: readonly {
    readonly id: string;
    readonly name: string;
    readonly family: string;
    readonly weight: string;
    readonly style: string;
    readonly isPrimary: boolean;
  }[];
  readonly logos: readonly {
    readonly id: string;
    readonly name: string;
    readonly url: string;
    readonly thumbnailUrl: string;
    readonly type: 'primary' | 'secondary' | 'icon' | 'watermark';
    readonly backgroundColor?: string;
  }[];
  readonly templates: readonly string[]; // Template IDs
  readonly ownerId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly isActive: boolean;
}

// ============================================================================
// Custom Error Types
// ============================================================================

export class CanvaIntegrationError extends ExternalWorkflowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CANVA_INTEGRATION_ERROR', context);
    this.name = 'CanvaIntegrationError';
  }
}

export class CanvaAuthenticationError extends CanvaIntegrationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(`Authentication failed: ${message}`, context);
    this.name = 'CanvaAuthenticationError';
  }
}

export class CanvaDesignError extends CanvaIntegrationError {
  constructor(message: string, designId?: string, context?: Record<string, unknown>) {
    super(`Design error: ${message}`, { ...context, designId });
    this.name = 'CanvaDesignError';
  }
}

export class CanvaExportError extends CanvaIntegrationError {
  constructor(message: string, exportId?: string, context?: Record<string, unknown>) {
    super(`Export error: ${message}`, { ...context, exportId });
    this.name = 'CanvaExportError';
  }
}

export class CanvaRateLimitError extends CanvaIntegrationError {
  constructor(retryAfter: number, context?: Record<string, unknown>) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds`, { ...context, retryAfter });
    this.name = 'CanvaRateLimitError';
  }
}

// ============================================================================
// Canva Integration Service
// ============================================================================

export class CanvaIntegration {
  private readonly baseUrl = 'https://api.canva.com/rest/v1';
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(
    private readonly config: CanvaConfig,
    private readonly httpClient: {
      get: (url: string, headers?: Record<string, string>) => Promise<any>;
      post: (url: string, data?: any, headers?: Record<string, string>) => Promise<any>;
      put: (url: string, data?: any, headers?: Record<string, string>) => Promise<any>;
      delete: (url: string, headers?: Record<string, string>) => Promise<any>;
      patch: (url: string, data?: any, headers?: Record<string, string>) => Promise<any>;
    } = {
      get: async (url, headers) => {
        const response = await fetch(url, { headers });
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '60');
            throw new CanvaRateLimitError(retryAfter);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      },
      post: async (url, data, headers) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: data ? JSON.stringify(data) : undefined
        });
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '60');
            throw new CanvaRateLimitError(retryAfter);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      },
      put: async (url, data, headers) => {
        const response = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: data ? JSON.stringify(data) : undefined
        });
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '60');
            throw new CanvaRateLimitError(retryAfter);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      },
      delete: async (url, headers) => {
        const response = await fetch(url, { method: 'DELETE', headers });
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '60');
            throw new CanvaRateLimitError(retryAfter);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.ok;
      },
      patch: async (url, data, headers) => {
        const response = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: data ? JSON.stringify(data) : undefined
        });
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '60');
            throw new CanvaRateLimitError(retryAfter);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      }
    }
  ) {
    this.validateConfig();
  }

  /**
   * Authenticate with Canva API using OAuth 2.0
   */
  async authenticate(authorizationCode: string): Promise<boolean> {
    try {
      const tokenUrl = 'https://api.canva.com/rest/v1/oauth/token';
      
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: authorizationCode,
        redirect_uri: this.config.redirectUri
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new CanvaAuthenticationError(
          `Token request failed: ${error.error_description || error.error}`,
          { statusCode: response.status, error }
        );
      }

      const tokenData = await response.json();
      this.accessToken = tokenData.access_token;
      this.tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      logger.info('Canva authentication successful', {
        integrationId: ulid(),
        expiresAt: this.tokenExpiresAt
      });

      return true;
    } catch (error) {
      logger.error('Canva authentication failed', { error });
      throw error instanceof CanvaAuthenticationError 
        ? error 
        : new CanvaAuthenticationError('Authentication process failed', { originalError: error });
    }
  }

  /**
   * Test connection to Canva API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.ensureAuthenticated();
      
      const response = await this.httpClient.get(
        `${this.baseUrl}/me`,
        this.getAuthHeaders()
      );

      return response && response.id !== undefined;
    } catch (error) {
      logger.error('Canva connection test failed', { error });
      return false;
    }
  }

  /**
   * Create a new design
   */
  async createDesign(params: CanvaDesignParams): Promise<CanvaDesign> {
    try {
      await this.ensureAuthenticated();
      this.validateDesignParams(params);

      const designData = this.buildDesignData(params);
      
      const response = await this.httpClient.post(
        `${this.baseUrl}/designs`,
        designData,
        this.getAuthHeaders()
      );

      logger.info('Canva design created successfully', {
        designId: response.id,
        title: params.title,
        designType: params.designType
      });

      return this.mapToCanvaDesign(response);
    } catch (error) {
      logger.error('Failed to create Canva design', { error, params });
      throw new CanvaDesignError('Failed to create design', undefined, { originalError: error });
    }
  }

  /**
   * Get design by ID
   */
  async getDesign(designId: string): Promise<CanvaDesign> {
    try {
      await this.ensureAuthenticated();

      const response = await this.httpClient.get(
        `${this.baseUrl}/designs/${designId}`,
        this.getAuthHeaders()
      );

      return this.mapToCanvaDesign(response);
    } catch (error) {
      logger.error('Failed to get Canva design', { error, designId });
      throw new CanvaDesignError('Failed to retrieve design', designId, { originalError: error });
    }
  }

  /**
   * Update design
   */
  async updateDesign(designId: string, updates: Partial<CanvaDesignParams>): Promise<CanvaDesign> {
    try {
      await this.ensureAuthenticated();

      const updateData = this.buildDesignUpdateData(updates);
      
      const response = await this.httpClient.patch(
        `${this.baseUrl}/designs/${designId}`,
        updateData,
        this.getAuthHeaders()
      );

      logger.info('Canva design updated successfully', {
        designId,
        updates: Object.keys(updates)
      });

      return this.mapToCanvaDesign(response);
    } catch (error) {
      logger.error('Failed to update Canva design', { error, designId, updates });
      throw new CanvaDesignError('Failed to update design', designId, { originalError: error });
    }
  }

  /**
   * Export design
   */
  async exportDesign(params: CanvaExportParams): Promise<CanvaExportResult> {
    try {
      await this.ensureAuthenticated();
      this.validateExportParams(params);

      const exportData = this.buildExportData(params);
      
      const response = await this.httpClient.post(
        `${this.baseUrl}/designs/${params.designId}/export`,
        exportData,
        this.getAuthHeaders()
      );

      // Poll for export completion
      const exportResult = await this.pollExportStatus(response.job.id);

      logger.info('Canva design exported successfully', {
        designId: params.designId,
        format: params.format,
        exportId: response.job.id
      });

      return {
        success: true,
        exportId: response.job.id,
        downloadUrl: exportResult.download_url,
        fileSize: exportResult.file_size,
        format: params.format,
        quality: params.quality,
        expiresAt: exportResult.expires_at ? new Date(exportResult.expires_at) : undefined
      };
    } catch (error) {
      logger.error('Failed to export Canva design', { error, params });
      return {
        success: false,
        format: params.format,
        quality: params.quality,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Search templates
   */
  async searchTemplates(query: {
    readonly query?: string;
    readonly designType?: CanvaDesignParams['designType'];
    readonly category?: string;
    readonly isPremium?: boolean;
    readonly isAnimated?: boolean;
    readonly limit?: number;
    readonly offset?: number;
  } = {}): Promise<{
    readonly templates: readonly CanvaTemplate[];
    readonly total: number;
    readonly hasMore: boolean;
  }> {
    try {
      await this.ensureAuthenticated();

      const queryParams = new URLSearchParams();
      if (query.query) queryParams.set('query', query.query);
      if (query.designType) queryParams.set('design_type', query.designType);
      if (query.category) queryParams.set('category', query.category);
      if (query.isPremium !== undefined) queryParams.set('is_premium', query.isPremium.toString());
      if (query.isAnimated !== undefined) queryParams.set('is_animated', query.isAnimated.toString());
      if (query.limit) queryParams.set('limit', query.limit.toString());
      if (query.offset) queryParams.set('offset', query.offset.toString());

      const url = `${this.baseUrl}/templates?${queryParams.toString()}`;
      const response = await this.httpClient.get(url, this.getAuthHeaders());

      return {
        templates: response.items.map((template: any) => this.mapToCanvaTemplate(template)),
        total: response.total,
        hasMore: response.has_more
      };
    } catch (error) {
      logger.error('Failed to search Canva templates', { error, query });
      throw new CanvaIntegrationError('Failed to search templates', { originalError: error });
    }
  }

  /**
   * Get user's designs
   */
  async getUserDesigns(options: {
    readonly folderId?: string;
    readonly designType?: CanvaDesignParams['designType'];
    readonly limit?: number;
    readonly offset?: number;
    readonly sortBy?: 'created_at' | 'updated_at' | 'title';
    readonly sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    readonly designs: readonly CanvaDesign[];
    readonly total: number;
    readonly hasMore: boolean;
  }> {
    try {
      await this.ensureAuthenticated();

      const queryParams = new URLSearchParams();
      if (options.folderId) queryParams.set('folder_id', options.folderId);
      if (options.designType) queryParams.set('design_type', options.designType);
      if (options.limit) queryParams.set('limit', options.limit.toString());
      if (options.offset) queryParams.set('offset', options.offset.toString());
      if (options.sortBy) queryParams.set('sort_by', options.sortBy);
      if (options.sortOrder) queryParams.set('sort_order', options.sortOrder);

      const url = `${this.baseUrl}/designs?${queryParams.toString()}`;
      const response = await this.httpClient.get(url, this.getAuthHeaders());

      return {
        designs: response.items.map((design: any) => this.mapToCanvaDesign(design)),
        total: response.total,
        hasMore: response.has_more
      };
    } catch (error) {
      logger.error('Failed to get user designs', { error, options });
      throw new CanvaIntegrationError('Failed to retrieve user designs', { originalError: error });
    }
  }

  /**
   * Create folder
   */
  async createFolder(name: string, parentId?: string): Promise<CanvaFolder> {
    try {
      await this.ensureAuthenticated();

      const folderData = {
        name,
        parent_id: parentId
      };
      
      const response = await this.httpClient.post(
        `${this.baseUrl}/folders`,
        folderData,
        this.getAuthHeaders()
      );

      logger.info('Canva folder created successfully', {
        folderId: response.id,
        name,
        parentId
      });

      return this.mapToCanvaFolder(response);
    } catch (error) {
      logger.error('Failed to create Canva folder', { error, name, parentId });
      throw new CanvaIntegrationError('Failed to create folder', { originalError: error });
    }
  }

  /**
   * Upload asset
   */
  async uploadAsset(file: {
    readonly name: string;
    readonly data: Buffer;
    readonly contentType: string;
  }, options: {
    readonly folderId?: string;
    readonly tags?: readonly string[];
    readonly isPublic?: boolean;
  } = {}): Promise<CanvaAsset> {
    try {
      await this.ensureAuthenticated();

      // First, get upload URL
      const uploadUrlResponse = await this.httpClient.post(
        `${this.baseUrl}/assets/upload`,
        {
          name: file.name,
          content_type: file.contentType,
          folder_id: options.folderId,
          tags: options.tags,
          is_public: options.isPublic
        },
        this.getAuthHeaders()
      );

      // Upload file to the provided URL
      const uploadResponse = await fetch(uploadUrlResponse.upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.contentType
        },
        body: new Uint8Array(file.data)
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      // Confirm upload completion
      const confirmResponse = await this.httpClient.post(
        `${this.baseUrl}/assets/${uploadUrlResponse.asset_id}/confirm`,
        {},
        this.getAuthHeaders()
      );

      logger.info('Canva asset uploaded successfully', {
        assetId: uploadUrlResponse.asset_id,
        name: file.name,
        size: file.data.length
      });

      return this.mapToCanvaAsset(confirmResponse);
    } catch (error) {
      logger.error('Failed to upload Canva asset', { error, fileName: file.name });
      throw new CanvaIntegrationError('Failed to upload asset', { originalError: error });
    }
  }

  /**
   * Get brand kits
   */
  async getBrandKits(): Promise<readonly CanvaBrandKit[]> {
    try {
      await this.ensureAuthenticated();

      const response = await this.httpClient.get(
        `${this.baseUrl}/brand-kits`,
        this.getAuthHeaders()
      );

      return response.items.map((brandKit: any) => this.mapToCanvaBrandKit(brandKit));
    } catch (error) {
      logger.error('Failed to get Canva brand kits', { error });
      throw new CanvaIntegrationError('Failed to retrieve brand kits', { originalError: error });
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private validateConfig(): void {
    const required = ['clientId', 'clientSecret', 'redirectUri'];
    const missing = required.filter(key => !this.config[key as keyof CanvaConfig]);
    
    if (missing.length > 0) {
      throw new WorkflowValidationError(
        'canva-config-validation',
        [`Missing required Canva configuration: ${missing.join(', ')}`]
      );
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiresAt || this.tokenExpiresAt <= new Date()) {
      throw new CanvaAuthenticationError('No valid access token available. Please authenticate first.');
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.accessToken) {
      throw new CanvaAuthenticationError('No access token available');
    }
    
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  private validateDesignParams(params: CanvaDesignParams): void {
    if (!params.title?.trim()) {
      throw new WorkflowValidationError('canva-design-validation', ['Design title cannot be empty']);
    }

    if (!params.designType) {
      throw new WorkflowValidationError('canva-design-validation', ['Design type is required']);
    }
  }

  private validateExportParams(params: CanvaExportParams): void {
    if (!params.designId?.trim()) {
      throw new WorkflowValidationError('canva-export-validation', ['Design ID cannot be empty']);
    }

    if (!params.format) {
      throw new WorkflowValidationError('canva-export-validation', ['Export format is required']);
    }

    const validFormats = ['pdf', 'png', 'jpg', 'gif', 'mp4', 'pptx'];
    if (!validFormats.includes(params.format.toLowerCase())) {
      throw new WorkflowValidationError('canva-export-validation', [`Invalid export format: ${params.format}`]);
    }
  }

  private buildDesignData(params: CanvaDesignParams): any {
    return {
      design_type: params.designType,
      title: params.title,
      width: params.width,
      height: params.height,
      template_id: params.templateId,
      folder_id: params.folderId,
      brand_template_id: params.brandTemplateId,
      elements: params.elements,
      pages: params.pages
    };
  }

  private buildDesignUpdateData(updates: Partial<CanvaDesignParams>): any {
    const data: any = {};
    
    if (updates.title) data.title = updates.title;
    if (updates.folderId) data.folder_id = updates.folderId;
    if (updates.elements) data.elements = updates.elements;
    if (updates.pages) data.pages = updates.pages;

    return data;
  }

  private buildExportData(params: CanvaExportParams): any {
    return {
      format: params.format,
      quality: params.quality,
      pages: params.pages,
      transparent: params.transparent,
      compression: params.compression,
      fps: params.fps,
      duration: params.duration,
      include_bleed_area: params.includeBleedArea,
      include_marks: params.includeMarks,
      color_profile: params.colorProfile
    };
  }

  private async pollExportStatus(jobId: string, maxAttempts: number = 30): Promise<any> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.httpClient.get(
          `${this.baseUrl}/export-jobs/${jobId}`,
          this.getAuthHeaders()
        );

        if (response.status === 'success') {
          return response;
        } else if (response.status === 'failed') {
          throw new CanvaExportError(`Export failed: ${response.error || 'Unknown error'}`);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }
    }

    throw new CanvaExportError('Export timeout - job did not complete within expected time');
  }

  private mapToCanvaDesign(data: any): CanvaDesign {
    return {
      id: data.id,
      title: data.title,
      designType: data.design_type,
      status: data.status,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      owner: {
        id: data.owner.id,
        name: data.owner.name,
        email: data.owner.email
      },
      collaborators: data.collaborators?.map((collab: any) => ({
        id: collab.id,
        name: collab.name,
        email: collab.email,
        role: collab.role
      })) || [],
      size: {
        width: data.size.width,
        height: data.size.height
      },
      pageCount: data.page_count,
      folderId: data.folder_id,
      brandId: data.brand_id,
      thumbnailUrl: data.thumbnail_url,
      editUrl: data.edit_url,
      viewUrl: data.view_url,
      tags: data.tags || [],
      isPublic: data.is_public || false,
      exportFormats: data.export_formats || []
    };
  }

  private mapToCanvaTemplate(data: any): CanvaTemplate {
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      designType: data.design_type,
      category: data.category,
      subcategory: data.subcategory,
      tags: data.tags || [],
      thumbnailUrl: data.thumbnail_url,
      previewUrl: data.preview_url,
      isPremium: data.is_premium || false,
      isAnimated: data.is_animated || false,
      size: {
        width: data.size.width,
        height: data.size.height
      },
      colorPalette: data.color_palette || [],
      createdBy: {
        id: data.created_by.id,
        name: data.created_by.name,
        isVerified: data.created_by.is_verified || false
      },
      usageCount: data.usage_count || 0,
      rating: {
        average: data.rating?.average || 0,
        count: data.rating?.count || 0
      },
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private mapToCanvaFolder(data: any): CanvaFolder {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      parentId: data.parent_id,
      ownerId: data.owner_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      itemCount: data.item_count || 0,
      isShared: data.is_shared || false,
      permissions: {
        canEdit: data.permissions?.can_edit || false,
        canShare: data.permissions?.can_share || false,
        canDelete: data.permissions?.can_delete || false
      }
    };
  }

  private mapToCanvaAsset(data: any): CanvaAsset {
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      url: data.url,
      thumbnailUrl: data.thumbnail_url,
      size: {
        width: data.size?.width,
        height: data.size?.height,
        fileSize: data.size?.file_size || 0
      },
      format: data.format,
      uploadedAt: new Date(data.uploaded_at),
      uploadedBy: {
        id: data.uploaded_by.id,
        name: data.uploaded_by.name
      },
      tags: data.tags || [],
      isPublic: data.is_public || false,
      usageRights: {
        canUseCommercially: data.usage_rights?.can_use_commercially || false,
        canModify: data.usage_rights?.can_modify || false,
        attribution: data.usage_rights?.attribution
      },
      metadata: data.metadata
    };
  }

  private mapToCanvaBrandKit(data: any): CanvaBrandKit {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      colors: data.colors?.map((color: any) => ({
        id: color.id,
        name: color.name,
        hex: color.hex,
        rgb: {
          r: color.rgb.r,
          g: color.rgb.g,
          b: color.rgb.b
        },
        isPrimary: color.is_primary || false
      })) || [],
      fonts: data.fonts?.map((font: any) => ({
        id: font.id,
        name: font.name,
        family: font.family,
        weight: font.weight,
        style: font.style,
        isPrimary: font.is_primary || false
      })) || [],
      logos: data.logos?.map((logo: any) => ({
        id: logo.id,
        name: logo.name,
        url: logo.url,
        thumbnailUrl: logo.thumbnail_url,
        type: logo.type,
        backgroundColor: logo.background_color
      })) || [],
      templates: data.templates || [],
      ownerId: data.owner_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      isActive: data.is_active || false
    };
  }
}

export function createCanvaIntegration(config: CanvaConfig): CanvaIntegration {
  return new CanvaIntegration(config);
} 