/**
 * Content Creation Integration Service
 * 
 * This service provides integrations with content creation platforms:
 * - Canva API for design automation
 * - YouTube API for video management
 * - Design variation generation
 * - Content optimization
 * 
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - ULID-based IDs for all operations
 * - Immutable data structures
 * - Comprehensive error handling
 * - Dependency injection
 * - Rate limiting and health monitoring
 */

import { ulid } from 'ulid';
import { createLogger } from '@/lib/logging/winston-logger';

/**
 * Canva design parameters
 */
export interface CanvaDesignParams {
  readonly templateId?: string;
  readonly designType: 'presentation' | 'poster' | 'logo' | 'social-media-post' | 'business-card' | 'flyer' | 'banner' | 'infographic';
  readonly title: string;
  readonly dimensions?: {
    readonly width: number;
    readonly height: number;
  };
  readonly elements?: readonly {
    readonly type: 'text' | 'image' | 'shape' | 'background';
    readonly content?: string;
    readonly imageUrl?: string;
    readonly position: {
      readonly x: number;
      readonly y: number;
    };
    readonly size?: {
      readonly width: number;
      readonly height: number;
    };
    readonly style?: Record<string, unknown>;
  }[];
  readonly brandKit?: {
    readonly colors: readonly string[];
    readonly fonts: readonly string[];
    readonly logoUrl?: string;
  };
  readonly tags?: readonly string[];
}

/**
 * Canva design result
 */
export interface CanvaDesign {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly url: string;
  readonly thumbnailUrl: string;
  readonly downloadUrls: {
    readonly pdf?: string;
    readonly png?: string;
    readonly jpg?: string;
    readonly svg?: string;
  };
  readonly dimensions: {
    readonly width: number;
    readonly height: number;
  };
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly isPublic: boolean;
  readonly tags: readonly string[];
  readonly elements: readonly {
    readonly id: string;
    readonly type: string;
    readonly content?: string;
    readonly position: {
      readonly x: number;
      readonly y: number;
    };
    readonly size: {
      readonly width: number;
      readonly height: number;
    };
  }[];
}

/**
 * YouTube video upload parameters
 */
export interface YouTubeUploadParams {
  readonly videoFile: Buffer | string; // Buffer or file path
  readonly title: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly categoryId?: string;
  readonly privacy: 'public' | 'private' | 'unlisted' | 'scheduled';
  readonly scheduledPublishTime?: Date;
  readonly thumbnail?: Buffer | string;
  readonly language?: string;
  readonly caption?: {
    readonly language: string;
    readonly file: Buffer | string;
  };
  readonly playlist?: string;
  readonly monetization?: {
    readonly enabled: boolean;
    readonly adTypes?: readonly ('display' | 'overlay' | 'skippable' | 'non-skippable')[];
  };
  readonly endScreen?: {
    readonly enabled: boolean;
    readonly elements?: readonly {
      readonly type: 'video' | 'playlist' | 'subscribe' | 'channel';
      readonly videoId?: string;
      readonly playlistId?: string;
      readonly startMs: number;
      readonly endMs: number;
    }[];
  };
}

/**
 * YouTube video result
 */
export interface YouTubeVideo {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly url: string;
  readonly thumbnailUrl: string;
  readonly duration: number; // seconds
  readonly status: 'uploaded' | 'processing' | 'live' | 'scheduled' | 'failed';
  readonly privacy: string;
  readonly publishedAt?: Date;
  readonly scheduledPublishTime?: Date;
  readonly statistics: {
    readonly viewCount: number;
    readonly likeCount: number;
    readonly dislikeCount: number;
    readonly commentCount: number;
    readonly favoriteCount: number;
  };
  readonly tags: readonly string[];
  readonly categoryId: string;
  readonly language: string;
  readonly monetizationEnabled: boolean;
}

/**
 * Design variation parameters
 */
export interface DesignVariationParams {
  readonly baseDesignId: string;
  readonly variationType: 'color' | 'text' | 'layout' | 'size' | 'style';
  readonly variations: readonly {
    readonly name: string;
    readonly changes: Record<string, unknown>;
  }[];
  readonly preserveElements?: readonly string[]; // Element IDs to keep unchanged
}

/**
 * Content optimization parameters
 */
export interface ContentOptimizationParams {
  readonly contentType: 'design' | 'video' | 'image';
  readonly platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin' | 'youtube' | 'tiktok';
  readonly purpose: 'engagement' | 'conversion' | 'awareness' | 'education';
  readonly targetAudience?: {
    readonly ageRange?: string;
    readonly interests?: readonly string[];
    readonly location?: string;
  };
}

/**
 * Health status for content creation service
 */
export interface ContentCreationHealthStatus {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly services: {
    readonly canva: boolean;
    readonly youtube: boolean;
    readonly optimization: boolean;
  };
  readonly apiLimits: {
    readonly canva: {
      readonly remaining: number;
      readonly resetTime: Date;
    };
    readonly youtube: {
      readonly remaining: number;
      readonly resetTime: Date;
    };
  };
  readonly lastHealthCheck: Date;
}

/**
 * Content Creation Service Errors
 */
export class ContentCreationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ContentCreationError';
  }
}

/**
 * Content Creation Service
 */
export class ContentCreationService {
  private readonly logger = createLogger({ context: 'ContentCreationService' });
  private readonly rateLimiter = new Map<string, { count: number; resetTime: Date }>();
  
  constructor(
    private readonly canvaApiKey: string,
    private readonly youtubeApiKey: string,
    private readonly youtubeClientId: string,
    private readonly youtubeClientSecret: string
  ) {
    this.logger.info('Content Creation Service initialized');
  }

  /**
   * Create a Canva design
   */
  async createCanvaDesign(params: CanvaDesignParams): Promise<CanvaDesign> {
    const operationId = ulid();
    this.logger.info('Creating Canva design', { operationId, designType: params.designType, title: params.title });

    try {
      // Check rate limits
      await this.checkRateLimit('canva');

      // Prepare design data
      const designData = {
        design_type: params.designType,
        title: params.title,
        dimensions: params.dimensions,
        elements: params.elements?.map(element => ({
          id: ulid(),
          type: element.type,
          content: element.content,
          image_url: element.imageUrl,
          position: element.position,
          size: element.size,
          style: element.style
        })),
        brand_kit: params.brandKit ? {
          colors: params.brandKit.colors,
          fonts: params.brandKit.fonts,
          logo_url: params.brandKit.logoUrl
        } : undefined,
        tags: params.tags
      };

      // Make API call to Canva
      const response = await this.makeCanvaApiCall('/designs', 'POST', designData);
      
      if (!response.design) {
        throw new ContentCreationError(
          'Failed to create Canva design',
          'CANVA_DESIGN_CREATION_FAILED',
          { operationId, response }
        );
      }

      const design = response.design;
      const result: CanvaDesign = Object.freeze({
        id: design.id,
        title: design.title,
        type: design.design_type,
        url: design.urls.view_url,
        thumbnailUrl: design.thumbnail.url,
        downloadUrls: Object.freeze({
          pdf: design.urls.download_urls?.pdf,
          png: design.urls.download_urls?.png,
          jpg: design.urls.download_urls?.jpg,
          svg: design.urls.download_urls?.svg
        }),
        dimensions: Object.freeze({
          width: design.dimensions.width,
          height: design.dimensions.height
        }),
        createdAt: new Date(design.created_at),
        updatedAt: new Date(design.updated_at),
        isPublic: design.is_public || false,
        tags: Object.freeze(design.tags || []),
        elements: Object.freeze(design.elements?.map((element: any) => Object.freeze({
          id: element.id,
          type: element.type,
          content: element.content,
          position: Object.freeze(element.position),
          size: Object.freeze(element.size)
        })) || [])
      });

      this.logger.info('Canva design created successfully', { operationId, designId: result.id });
      return result;
    } catch (error) {
      this.logger.error('Canva design creation failed', { error, operationId });
      throw error instanceof ContentCreationError ? error : new ContentCreationError(
        'Failed to create Canva design',
        'CANVA_DESIGN_CREATION_FAILED',
        { operationId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Upload video to YouTube
   */
  async uploadYouTubeVideo(params: YouTubeUploadParams): Promise<YouTubeVideo> {
    const operationId = ulid();
    this.logger.info('Uploading YouTube video', { operationId, title: params.title, privacy: params.privacy });

    try {
      // Check rate limits
      await this.checkRateLimit('youtube');

      // Prepare video metadata
      const videoMetadata = {
        snippet: {
          title: params.title,
          description: params.description || '',
          tags: params.tags || [],
          categoryId: params.categoryId || '22', // People & Blogs
          defaultLanguage: params.language || 'en',
          defaultAudioLanguage: params.language || 'en'
        },
        status: {
          privacyStatus: params.privacy,
          publishAt: params.scheduledPublishTime?.toISOString(),
          selfDeclaredMadeForKids: false
        },
        monetizationDetails: params.monetization ? {
          access: {
            allowed: params.monetization.enabled,
            exception: []
          }
        } : undefined
      };

      // Upload video file
      const uploadResponse = await this.makeYouTubeApiCall(
        '/youtube/v3/videos',
        'POST',
        videoMetadata,
        params.videoFile
      );

      if (!uploadResponse.id) {
        throw new ContentCreationError(
          'Failed to upload YouTube video',
          'YOUTUBE_UPLOAD_FAILED',
          { operationId, response: uploadResponse }
        );
      }

      // Upload thumbnail if provided
      if (params.thumbnail) {
        await this.uploadYouTubeThumbnail(uploadResponse.id, params.thumbnail);
      }

      // Add to playlist if specified
      if (params.playlist) {
        await this.addVideoToPlaylist(uploadResponse.id, params.playlist);
      }

      // Set up end screen if specified
      if (params.endScreen?.enabled && params.endScreen.elements) {
        await this.setupEndScreen(uploadResponse.id, [...params.endScreen.elements]);
      }

      const video = uploadResponse;
      const result: YouTubeVideo = Object.freeze({
        id: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        thumbnailUrl: video.snippet.thumbnails?.default?.url || '',
        duration: this.parseDuration(video.contentDetails?.duration || 'PT0S'),
        status: this.mapYouTubeStatus(video.status?.uploadStatus),
        privacy: video.status?.privacyStatus || params.privacy,
        publishedAt: video.snippet.publishedAt ? new Date(video.snippet.publishedAt) : undefined,
        scheduledPublishTime: params.scheduledPublishTime,
        statistics: Object.freeze({
          viewCount: parseInt(video.statistics?.viewCount || '0'),
          likeCount: parseInt(video.statistics?.likeCount || '0'),
          dislikeCount: parseInt(video.statistics?.dislikeCount || '0'),
          commentCount: parseInt(video.statistics?.commentCount || '0'),
          favoriteCount: parseInt(video.statistics?.favoriteCount || '0')
        }),
        tags: Object.freeze(video.snippet.tags || []),
        categoryId: video.snippet.categoryId,
        language: video.snippet.defaultLanguage || 'en',
        monetizationEnabled: params.monetization?.enabled || false
      });

      this.logger.info('YouTube video uploaded successfully', { operationId, videoId: result.id });
      return result;
    } catch (error) {
      this.logger.error('YouTube video upload failed', { error, operationId });
      throw error instanceof ContentCreationError ? error : new ContentCreationError(
        'Failed to upload YouTube video',
        'YOUTUBE_UPLOAD_FAILED',
        { operationId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Generate design variations
   */
  async generateDesignVariations(
    designId: string,
    variationParams: DesignVariationParams
  ): Promise<readonly CanvaDesign[]> {
    const operationId = ulid();
    this.logger.info('Generating design variations', { operationId, designId, variationType: variationParams.variationType });

    try {
      // Check rate limits
      await this.checkRateLimit('canva');

      // Get original design
      const originalDesign = await this.getCanvaDesign(designId);
      
      // Generate variations
      const variations = [];
      
      for (const variation of variationParams.variations) {
        try {
          // Create variation based on type
          const variationData = await this.createDesignVariation(
            originalDesign,
            variationParams.variationType,
            variation,
            variationParams.preserveElements
          );

          const variationDesign = await this.createCanvaDesign({
            designType: originalDesign.type as any,
            title: `${originalDesign.title} - ${variation.name}`,
            dimensions: originalDesign.dimensions,
            elements: variationData.elements,
            tags: [...originalDesign.tags, 'variation', variationParams.variationType]
          });

          variations.push(variationDesign);
        } catch (error) {
          this.logger.warn(`Failed to create variation: ${variation.name}`, { error, operationId });
        }
      }

      this.logger.info('Design variations generated', { 
        operationId, 
        originalDesignId: designId,
        variationsCreated: variations.length 
      });

      return Object.freeze(variations);
    } catch (error) {
      this.logger.error('Design variation generation failed', { error, operationId });
      throw new ContentCreationError(
        'Failed to generate design variations',
        'DESIGN_VARIATION_FAILED',
        { operationId, designId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Optimize content for specific platform
   */
  async optimizeContent(
    contentId: string,
    contentType: 'design' | 'video',
    optimizationParams: ContentOptimizationParams
  ): Promise<{
    readonly originalContent: any;
    readonly optimizedContent: any;
    readonly optimizations: readonly string[];
    readonly recommendations: readonly string[];
  }> {
    const operationId = ulid();
    this.logger.info('Optimizing content', { operationId, contentId, contentType, platform: optimizationParams.platform });

    try {
      let originalContent: any;
      let optimizedContent: any;
      const optimizations: string[] = [];
      const recommendations: string[] = [];

      if (contentType === 'design') {
        originalContent = await this.getCanvaDesign(contentId);
        
        // Platform-specific design optimizations
        const platformSpecs = this.getPlatformDesignSpecs(optimizationParams.platform);
        
        if (originalContent.dimensions.width !== platformSpecs.width || 
            originalContent.dimensions.height !== platformSpecs.height) {
          optimizations.push(`Resized design to ${platformSpecs.width}x${platformSpecs.height} for ${optimizationParams.platform}`);
        }

        // Create optimized version
        optimizedContent = await this.createCanvaDesign({
          designType: this.mapPlatformToDesignType(optimizationParams.platform),
          title: `${originalContent.title} - ${optimizationParams.platform} Optimized`,
          dimensions: platformSpecs,
          elements: this.optimizeDesignElements(originalContent.elements, optimizationParams),
          tags: [...originalContent.tags, 'optimized', optimizationParams.platform]
        });

        // Generate recommendations
        recommendations.push(...this.generateDesignRecommendations(optimizationParams));
        
      } else if (contentType === 'video') {
        // Video optimization would be implemented here
        // For now, return placeholder
        originalContent = { id: contentId, type: 'video' };
        optimizedContent = originalContent;
        recommendations.push('Video optimization coming soon');
      }

      const result = Object.freeze({
        originalContent,
        optimizedContent,
        optimizations: Object.freeze(optimizations),
        recommendations: Object.freeze(recommendations)
      });

      this.logger.info('Content optimization completed', { operationId, optimizations: optimizations.length });
      return result;
    } catch (error) {
      this.logger.error('Content optimization failed', { error, operationId });
      throw new ContentCreationError(
        'Failed to optimize content',
        'CONTENT_OPTIMIZATION_FAILED',
        { operationId, contentId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<ContentCreationHealthStatus> {
    try {
      // Check Canva API health
      const canvaHealth = await this.checkCanvaHealth();
      
      // Check YouTube API health
      const youtubeHealth = await this.checkYouTubeHealth();

      // Get rate limit status
      const canvaLimit = this.rateLimiter.get('canva') || { count: 0, resetTime: new Date() };
      const youtubeLimit = this.rateLimiter.get('youtube') || { count: 0, resetTime: new Date() };

      return Object.freeze({
        status: (canvaHealth && youtubeHealth) ? 'healthy' : 'degraded',
        services: Object.freeze({
          canva: canvaHealth,
          youtube: youtubeHealth,
          optimization: true
        }),
        apiLimits: Object.freeze({
          canva: Object.freeze({
            remaining: Math.max(0, 1000 - canvaLimit.count),
            resetTime: canvaLimit.resetTime
          }),
          youtube: Object.freeze({
            remaining: Math.max(0, 10000 - youtubeLimit.count),
            resetTime: youtubeLimit.resetTime
          })
        }),
        lastHealthCheck: new Date()
      });
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return Object.freeze({
        status: 'unhealthy',
        services: Object.freeze({
          canva: false,
          youtube: false,
          optimization: false
        }),
        apiLimits: Object.freeze({
          canva: Object.freeze({
            remaining: 0,
            resetTime: new Date()
          }),
          youtube: Object.freeze({
            remaining: 0,
            resetTime: new Date()
          })
        }),
        lastHealthCheck: new Date()
      });
    }
  }

  /**
   * Private helper methods
   */
  private async makeCanvaApiCall(endpoint: string, method: string, data?: any): Promise<any> {
    // Placeholder for Canva API integration
    // In a real implementation, this would make HTTP requests to Canva's API
    this.logger.info(`Canva API call: ${method} ${endpoint}`, { data });
    
    // Simulate API response
    if (endpoint === '/designs' && method === 'POST') {
      return {
        design: {
          id: ulid(),
          title: data.title,
          design_type: data.design_type,
          urls: {
            view_url: `https://canva.com/design/${ulid()}`,
            download_urls: {
              png: `https://canva.com/download/${ulid()}.png`,
              pdf: `https://canva.com/download/${ulid()}.pdf`
            }
          },
          thumbnail: {
            url: `https://canva.com/thumb/${ulid()}.jpg`
          },
          dimensions: data.dimensions || { width: 1080, height: 1080 },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_public: false,
          tags: data.tags || [],
          elements: data.elements || []
        }
      };
    }
    
    throw new ContentCreationError('Canva API endpoint not implemented', 'API_NOT_IMPLEMENTED');
  }

  private async makeYouTubeApiCall(endpoint: string, method: string, data?: any, file?: Buffer | string): Promise<any> {
    // Placeholder for YouTube API integration
    // In a real implementation, this would make HTTP requests to YouTube's API
    this.logger.info(`YouTube API call: ${method} ${endpoint}`, { data: { ...data, file: file ? '[FILE_DATA]' : undefined } });
    
    // Simulate API response
    if (endpoint === '/youtube/v3/videos' && method === 'POST') {
      return {
        id: ulid(),
        snippet: {
          title: data.snippet.title,
          description: data.snippet.description,
          tags: data.snippet.tags,
          categoryId: data.snippet.categoryId,
          defaultLanguage: data.snippet.defaultLanguage,
          publishedAt: new Date().toISOString(),
          thumbnails: {
            default: {
              url: `https://img.youtube.com/vi/${ulid()}/default.jpg`
            }
          }
        },
        status: {
          uploadStatus: 'uploaded',
          privacyStatus: data.status.privacyStatus
        },
        contentDetails: {
          duration: 'PT5M30S'
        },
        statistics: {
          viewCount: '0',
          likeCount: '0',
          dislikeCount: '0',
          commentCount: '0',
          favoriteCount: '0'
        }
      };
    }
    
    throw new ContentCreationError('YouTube API endpoint not implemented', 'API_NOT_IMPLEMENTED');
  }

  private async checkRateLimit(service: 'canva' | 'youtube'): Promise<void> {
    const now = new Date();
    const limit = this.rateLimiter.get(service);
    const maxRequests = service === 'canva' ? 1000 : 10000;
    
    if (limit && limit.resetTime > now) {
      if (limit.count >= maxRequests) {
        throw new ContentCreationError(
          `Rate limit exceeded for ${service}`,
          'RATE_LIMIT_EXCEEDED',
          { service, resetTime: limit.resetTime }
        );
      }
      limit.count++;
    } else {
      this.rateLimiter.set(service, {
        count: 1,
        resetTime: new Date(now.getTime() + 60 * 60 * 1000) // 1 hour
      });
    }
  }

  private async getCanvaDesign(designId: string): Promise<CanvaDesign> {
    // Placeholder - would fetch design from Canva API
    return {
      id: designId,
      title: 'Sample Design',
      type: 'social-media-post',
      url: `https://canva.com/design/${designId}`,
      thumbnailUrl: `https://canva.com/thumb/${designId}.jpg`,
      downloadUrls: {},
      dimensions: { width: 1080, height: 1080 },
      createdAt: new Date(),
      updatedAt: new Date(),
      isPublic: false,
      tags: [],
      elements: []
    };
  }

  private async createDesignVariation(
    originalDesign: CanvaDesign,
    variationType: string,
    variation: any,
    preserveElements?: readonly string[]
  ): Promise<{ elements: any[] }> {
    // Placeholder for design variation logic
    return {
      elements: originalDesign.elements.map(element => ({
        type: element.type,
        content: variationType === 'text' ? variation.changes.text || element.content : element.content,
        position: element.position,
        size: element.size,
        style: variationType === 'color' ? { ...element, color: variation.changes.color } : element
      }))
    };
  }

  private getPlatformDesignSpecs(platform: string): { width: number; height: number } {
    const specs: Record<string, { width: number; height: number }> = {
      instagram: { width: 1080, height: 1080 },
      facebook: { width: 1200, height: 630 },
      twitter: { width: 1024, height: 512 },
      linkedin: { width: 1200, height: 627 },
      youtube: { width: 1280, height: 720 },
      tiktok: { width: 1080, height: 1920 }
    };
    
    return specs[platform] || { width: 1080, height: 1080 };
  }

  private mapPlatformToDesignType(platform: string): CanvaDesignParams['designType'] {
    const mapping: Record<string, CanvaDesignParams['designType']> = {
      instagram: 'social-media-post',
      facebook: 'social-media-post',
      twitter: 'social-media-post',
      linkedin: 'social-media-post',
      youtube: 'banner',
      tiktok: 'social-media-post'
    };
    
    return mapping[platform] || 'social-media-post';
  }

  private optimizeDesignElements(elements: any[], params: ContentOptimizationParams): any[] {
    // Placeholder for element optimization logic
    return elements.map(element => {
      if (element.type === 'text') {
        return {
          ...element,
          style: {
            ...element.style,
            fontSize: params.platform === 'tiktok' ? 'large' : 'medium'
          }
        };
      }
      return element;
    });
  }

  private generateDesignRecommendations(params: ContentOptimizationParams): string[] {
    const recommendations = [];
    
    switch (params.platform) {
      case 'instagram':
        recommendations.push('Use bright, high-contrast colors for better mobile visibility');
        recommendations.push('Keep text minimal and use large, readable fonts');
        break;
      case 'linkedin':
        recommendations.push('Use professional colors and fonts');
        recommendations.push('Include your company logo for brand recognition');
        break;
      case 'tiktok':
        recommendations.push('Use bold, eye-catching visuals');
        recommendations.push('Consider vertical orientation for full-screen impact');
        break;
    }
    
    if (params.purpose === 'engagement') {
      recommendations.push('Include a clear call-to-action');
      recommendations.push('Use questions or interactive elements');
    }
    
    return recommendations;
  }

  private async uploadYouTubeThumbnail(videoId: string, thumbnail: Buffer | string): Promise<void> {
    // Placeholder for thumbnail upload
    this.logger.info('Uploading YouTube thumbnail', { videoId });
  }

  private async addVideoToPlaylist(videoId: string, playlistId: string): Promise<void> {
    // Placeholder for playlist addition
    this.logger.info('Adding video to playlist', { videoId, playlistId });
  }

  private async setupEndScreen(videoId: string, elements: any[]): Promise<void> {
    // Placeholder for end screen setup
    this.logger.info('Setting up end screen', { videoId, elements: elements.length });
  }

  private parseDuration(duration: string): number {
    // Parse ISO 8601 duration (e.g., "PT5M30S" = 5 minutes 30 seconds)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
    return hours * 3600 + minutes * 60 + seconds;
  }

  private mapYouTubeStatus(uploadStatus: string): YouTubeVideo['status'] {
    const statusMap: Record<string, YouTubeVideo['status']> = {
      uploaded: 'uploaded',
      processed: 'live',
      failed: 'failed',
      rejected: 'failed'
    };
    
    return statusMap[uploadStatus] || 'processing';
  }

  private async checkCanvaHealth(): Promise<boolean> {
    try {
      // Placeholder health check - would ping Canva API
      return true;
    } catch {
      return false;
    }
  }

  private async checkYouTubeHealth(): Promise<boolean> {
    try {
      // Placeholder health check - would ping YouTube API
      return true;
    } catch {
      return false;
    }
  }
}