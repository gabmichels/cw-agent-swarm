/**
 * YouTube Integration - Phase 2 Strategic Integration
 * 
 * Provides comprehensive YouTube content management capabilities including
 * video upload, channel management, analytics, live streaming, and community features.
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
// YouTube Integration Interfaces
// ============================================================================

export interface YouTubeConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly scopes: readonly string[];
  readonly apiKey?: string;
  readonly apiVersion?: string;
}

export interface YouTubeVideoUploadParams {
  readonly title: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly categoryId?: string;
  readonly privacy: 'private' | 'unlisted' | 'public';
  readonly publishAt?: Date;
  readonly thumbnail?: {
    readonly data: Buffer;
    readonly contentType: string;
  };
  readonly video: {
    readonly data: Buffer;
    readonly filename: string;
    readonly contentType: string;
  };
  readonly playlistId?: string;
  readonly location?: {
    readonly latitude: number;
    readonly longitude: number;
    readonly locationDescription?: string;
  };
  readonly recordingDate?: Date;
  readonly license?: 'youtube' | 'creativeCommon';
  readonly embeddable?: boolean;
  readonly publicStatsViewable?: boolean;
  readonly madeForKids?: boolean;
  readonly selfDeclaredMadeForKids?: boolean;
  readonly defaultLanguage?: string;
  readonly defaultAudioLanguage?: string;
}

export interface YouTubeVideo {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly thumbnails: {
    readonly default?: YouTubeThumbnail;
    readonly medium?: YouTubeThumbnail;
    readonly high?: YouTubeThumbnail;
    readonly standard?: YouTubeThumbnail;
    readonly maxres?: YouTubeThumbnail;
  };
  readonly channelId: string;
  readonly channelTitle: string;
  readonly tags: readonly string[];
  readonly categoryId: string;
  readonly liveBroadcastContent: 'none' | 'upcoming' | 'live';
  readonly defaultLanguage?: string;
  readonly defaultAudioLanguage?: string;
  readonly duration: string; // ISO 8601 format
  readonly dimension: '2d' | '3d';
  readonly definition: 'hd' | 'sd';
  readonly caption: boolean;
  readonly licensedContent: boolean;
  readonly projection: 'rectangular' | '360';
  readonly uploadStatus: 'uploaded' | 'processed' | 'failed' | 'rejected' | 'deleted';
  readonly privacyStatus: 'private' | 'unlisted' | 'public';
  readonly license: 'youtube' | 'creativeCommon';
  readonly embeddable: boolean;
  readonly publicStatsViewable: boolean;
  readonly madeForKids: boolean;
  readonly publishedAt?: Date;
  readonly viewCount: number;
  readonly likeCount: number;
  readonly dislikeCount: number;
  readonly favoriteCount: number;
  readonly commentCount: number;
  readonly player: {
    readonly embedHtml: string;
  };
  readonly topicDetails?: {
    readonly topicIds: readonly string[];
    readonly relevantTopicIds: readonly string[];
    readonly topicCategories: readonly string[];
  };
  readonly recordingDetails?: {
    readonly recordingDate?: Date;
    readonly location?: {
      readonly latitude: number;
      readonly longitude: number;
      readonly altitude?: number;
      readonly locationDescription?: string;
    };
  };
  readonly fileDetails?: {
    readonly fileName: string;
    readonly fileSize: number;
    readonly fileType: string;
    readonly container: string;
    readonly videoStreams: readonly YouTubeVideoStream[];
    readonly audioStreams: readonly YouTubeAudioStream[];
    readonly durationMs: number;
    readonly bitrateBps: number;
    readonly creationTime?: string;
  };
  readonly processingDetails?: {
    readonly processingStatus: 'processing' | 'succeeded' | 'failed' | 'terminated';
    readonly processingProgress?: {
      readonly partsTotal: number;
      readonly partsProcessed: number;
      readonly timeLeftMs: number;
    };
    readonly processingFailureReason?: 'uploadFailed' | 'transcodeFailed' | 'streamingFailed' | 'other';
    readonly fileDetailsAvailability: 'processing' | 'available' | 'unavailable';
    readonly processingIssuesAvailability: 'processing' | 'available' | 'unavailable';
    readonly tagSuggestionsAvailability: 'processing' | 'available' | 'unavailable';
    readonly editorSuggestionsAvailability: 'processing' | 'available' | 'unavailable';
    readonly thumbnailsAvailability: 'processing' | 'available' | 'unavailable';
  };
}

export interface YouTubeThumbnail {
  readonly url: string;
  readonly width: number;
  readonly height: number;
}

export interface YouTubeVideoStream {
  readonly widthPixels: number;
  readonly heightPixels: number;
  readonly frameRateFps: number;
  readonly aspectRatio: number;
  readonly codec: string;
  readonly bitrateBps: number;
  readonly rotation: 'none' | 'clockwise' | 'upsideDown' | 'counterClockwise' | 'other';
  readonly vendor: string;
}

export interface YouTubeAudioStream {
  readonly channelCount: number;
  readonly codec: string;
  readonly bitrateBps: number;
  readonly vendor: string;
}

export interface YouTubeChannel {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly customUrl?: string;
  readonly publishedAt: Date;
  readonly thumbnails: {
    readonly default?: YouTubeThumbnail;
    readonly medium?: YouTubeThumbnail;
    readonly high?: YouTubeThumbnail;
  };
  readonly defaultLanguage?: string;
  readonly country?: string;
  readonly viewCount: number;
  readonly subscriberCount: number;
  readonly hiddenSubscriberCount: boolean;
  readonly videoCount: number;
  readonly keywords?: string;
  readonly trackingAnalyticsAccountId?: string;
  readonly moderateComments: boolean;
  readonly showRelatedChannels: boolean;
  readonly showBrowseView: boolean;
  readonly featuredChannelsTitle?: string;
  readonly featuredChannelsUrls: readonly string[];
  readonly unsubscribedTrailer?: string;
  readonly profileColor?: string;
  readonly defaultTab?: string;
  readonly brandingSettings?: {
    readonly channel?: {
      readonly title: string;
      readonly description: string;
      readonly keywords: string;
      readonly defaultTab: string;
      readonly trackingAnalyticsAccountId: string;
      readonly moderateComments: boolean;
      readonly showRelatedChannels: boolean;
      readonly showBrowseView: boolean;
      readonly featuredChannelsTitle: string;
      readonly featuredChannelsUrls: readonly string[];
      readonly unsubscribedTrailer: string;
      readonly profileColor: string;
      readonly defaultLanguage: string;
      readonly country: string;
    };
    readonly watch?: {
      readonly textColor: string;
      readonly backgroundColor: string;
      readonly featuredPlaylistId: string;
    };
    readonly image?: {
      readonly bannerImageUrl: string;
      readonly bannerMobileImageUrl: string;
      readonly watchIconImageUrl: string;
      readonly trackingImageUrl: string;
      readonly bannerTabletLowImageUrl: string;
      readonly bannerTabletImageUrl: string;
      readonly bannerTabletHdImageUrl: string;
      readonly bannerTabletExtraHdImageUrl: string;
      readonly bannerMobileLowImageUrl: string;
      readonly bannerMobileMediumHdImageUrl: string;
      readonly bannerMobileHdImageUrl: string;
      readonly bannerMobileExtraHdImageUrl: string;
      readonly bannerTvImageUrl: string;
      readonly bannerTvLowImageUrl: string;
      readonly bannerTvMediumImageUrl: string;
      readonly bannerTvHighImageUrl: string;
    };
    readonly hints?: readonly {
      readonly property: string;
      readonly value: string;
    }[];
  };
}

export interface YouTubePlaylist {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly thumbnails: {
    readonly default?: YouTubeThumbnail;
    readonly medium?: YouTubeThumbnail;
    readonly high?: YouTubeThumbnail;
    readonly standard?: YouTubeThumbnail;
    readonly maxres?: YouTubeThumbnail;
  };
  readonly channelId: string;
  readonly channelTitle: string;
  readonly defaultLanguage?: string;
  readonly publishedAt: Date;
  readonly privacyStatus: 'private' | 'unlisted' | 'public';
  readonly itemCount: number;
  readonly tags: readonly string[];
  readonly localizations?: Record<string, {
    readonly title: string;
    readonly description: string;
  }>;
}

export interface YouTubePlaylistItem {
  readonly id: string;
  readonly playlistId: string;
  readonly videoId: string;
  readonly position: number;
  readonly videoOwnerChannelTitle?: string;
  readonly videoOwnerChannelId?: string;
  readonly note?: string;
  readonly publishedAt: Date;
  readonly videoPublishedAt?: Date;
}

export interface YouTubeComment {
  readonly id: string;
  readonly videoId?: string;
  readonly channelId?: string;
  readonly parentId?: string;
  readonly authorDisplayName: string;
  readonly authorProfileImageUrl: string;
  readonly authorChannelUrl?: string;
  readonly authorChannelId?: string;
  readonly textDisplay: string;
  readonly textOriginal: string;
  readonly canRate: boolean;
  readonly totalReplyCount: number;
  readonly likeCount: number;
  readonly moderationStatus?: 'heldForReview' | 'likelySpam' | 'published' | 'rejected';
  readonly publishedAt: Date;
  readonly updatedAt: Date;
}

export interface YouTubeLiveBroadcast {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly thumbnails: {
    readonly default?: YouTubeThumbnail;
    readonly medium?: YouTubeThumbnail;
    readonly high?: YouTubeThumbnail;
    readonly standard?: YouTubeThumbnail;
    readonly maxres?: YouTubeThumbnail;
  };
  readonly scheduledStartTime?: Date;
  readonly scheduledEndTime?: Date;
  readonly actualStartTime?: Date;
  readonly actualEndTime?: Date;
  readonly isDefaultBroadcast: boolean;
  readonly lifeCycleStatus: 'complete' | 'created' | 'live' | 'liveStarting' | 'ready' | 'revoked' | 'testStarting' | 'testing';
  readonly liveChatId?: string;
  readonly privacyStatus: 'private' | 'unlisted' | 'public';
  readonly recordingStatus: 'notRecording' | 'recorded' | 'recording';
  readonly enableAutoStart: boolean;
  readonly enableAutoStop: boolean;
  readonly enableDvr: boolean;
  readonly enableContentEncryption: boolean;
  readonly enableEmbed: boolean;
  readonly recordFromStart: boolean;
  readonly enableClosedCaptions: boolean;
  readonly closedCaptionsType?: 'closedCaptionsDisabled' | 'closedCaptionsEmbedded' | 'closedCaptionsHttpPost';
  readonly enableLowLatency: boolean;
  readonly latencyPreference?: 'low' | 'normal' | 'ultraLow';
  readonly projection: 'rectangular' | '360' | 'mesh';
  readonly ingestionInfo?: {
    readonly streamName: string;
    readonly ingestionAddress: string;
    readonly rtmpsIngestionAddress: string;
    readonly rtmpsBackupIngestionAddress: string;
  };
}

export interface YouTubeAnalyticsReport {
  readonly kind: string;
  readonly columnHeaders: readonly {
    readonly name: string;
    readonly columnType: 'DIMENSION' | 'METRIC';
    readonly dataType: 'STRING' | 'INTEGER' | 'FLOAT';
  }[];
  readonly rows: readonly (string | number)[][];
}

// ============================================================================
// Custom Error Types
// ============================================================================

export class YouTubeIntegrationError extends ExternalWorkflowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'YOUTUBE_INTEGRATION_ERROR', context);
    this.name = 'YouTubeIntegrationError';
  }
}

export class YouTubeAuthenticationError extends YouTubeIntegrationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(`Authentication failed: ${message}`, context);
    this.name = 'YouTubeAuthenticationError';
  }
}

export class YouTubeUploadError extends YouTubeIntegrationError {
  constructor(message: string, videoId?: string, context?: Record<string, unknown>) {
    super(`Upload error: ${message}`, { ...context, videoId });
    this.name = 'YouTubeUploadError';
  }
}

export class YouTubeQuotaExceededError extends YouTubeIntegrationError {
  constructor(quotaUser?: string, context?: Record<string, unknown>) {
    super('YouTube API quota exceeded', { ...context, quotaUser });
    this.name = 'YouTubeQuotaExceededError';
  }
}

export class YouTubeContentError extends YouTubeIntegrationError {
  constructor(message: string, contentId?: string, context?: Record<string, unknown>) {
    super(`Content error: ${message}`, { ...context, contentId });
    this.name = 'YouTubeContentError';
  }
}

// ============================================================================
// YouTube Integration Service
// ============================================================================

export class YouTubeIntegration {
  private readonly baseUrl = 'https://www.googleapis.com/youtube/v3';
  private readonly uploadUrl = 'https://www.googleapis.com/upload/youtube/v3';
  private readonly analyticsUrl = 'https://youtubeanalytics.googleapis.com/v2';
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(
    private readonly config: YouTubeConfig,
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
          if (response.status === 403) {
            const error = await response.json();
            if (error.error?.errors?.[0]?.reason === 'quotaExceeded') {
              throw new YouTubeQuotaExceededError();
            }
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
          if (response.status === 403) {
            const error = await response.json();
            if (error.error?.errors?.[0]?.reason === 'quotaExceeded') {
              throw new YouTubeQuotaExceededError();
            }
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      },
      put: async (url, data, headers) => {
        const response = await fetch(url, {
          method: 'PUT',
          headers,
          body: data
        });
        if (!response.ok) {
          if (response.status === 403) {
            const error = await response.json();
            if (error.error?.errors?.[0]?.reason === 'quotaExceeded') {
              throw new YouTubeQuotaExceededError();
            }
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      },
      delete: async (url, headers) => {
        const response = await fetch(url, { method: 'DELETE', headers });
        if (!response.ok) {
          if (response.status === 403) {
            const error = await response.json();
            if (error.error?.errors?.[0]?.reason === 'quotaExceeded') {
              throw new YouTubeQuotaExceededError();
            }
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
          if (response.status === 403) {
            const error = await response.json();
            if (error.error?.errors?.[0]?.reason === 'quotaExceeded') {
              throw new YouTubeQuotaExceededError();
            }
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
   * Authenticate with YouTube API using OAuth 2.0
   */
  async authenticate(authorizationCode: string): Promise<boolean> {
    try {
      const tokenUrl = 'https://oauth2.googleapis.com/token';
      
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
        throw new YouTubeAuthenticationError(
          `Token request failed: ${error.error_description || error.error}`,
          { statusCode: response.status, error }
        );
      }

      const tokenData = await response.json();
      this.accessToken = tokenData.access_token;
      this.refreshToken = tokenData.refresh_token;
      this.tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      logger.info('YouTube authentication successful', {
        integrationId: ulid(),
        expiresAt: this.tokenExpiresAt
      });

      return true;
    } catch (error) {
      logger.error('YouTube authentication failed', { error });
      throw error instanceof YouTubeAuthenticationError 
        ? error 
        : new YouTubeAuthenticationError('Authentication process failed', { originalError: error });
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<boolean> {
    try {
      if (!this.refreshToken) {
        throw new YouTubeAuthenticationError('No refresh token available');
      }

      const tokenUrl = 'https://oauth2.googleapis.com/token';
      
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.refreshToken
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new YouTubeAuthenticationError(
          `Token refresh failed: ${error.error_description || error.error}`,
          { statusCode: response.status, error }
        );
      }

      const tokenData = await response.json();
      this.accessToken = tokenData.access_token;
      this.tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
      
      // Update refresh token if provided
      if (tokenData.refresh_token) {
        this.refreshToken = tokenData.refresh_token;
      }

      logger.info('YouTube token refreshed successfully', {
        integrationId: ulid(),
        expiresAt: this.tokenExpiresAt
      });

      return true;
    } catch (error) {
      logger.error('YouTube token refresh failed', { error });
      throw error instanceof YouTubeAuthenticationError 
        ? error 
        : new YouTubeAuthenticationError('Token refresh failed', { originalError: error });
    }
  }

  /**
   * Test connection to YouTube API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.ensureAuthenticated();
      
      const response = await this.httpClient.get(
        `${this.baseUrl}/channels?part=id&mine=true`,
        this.getAuthHeaders()
      );

      return response && response.items && response.items.length > 0;
    } catch (error) {
      logger.error('YouTube connection test failed', { error });
      return false;
    }
  }

  /**
   * Upload a video to YouTube
   */
  async uploadVideo(params: YouTubeVideoUploadParams): Promise<YouTubeVideo> {
    try {
      await this.ensureAuthenticated();
      this.validateVideoUploadParams(params);

      // Step 1: Create video metadata
      const metadata = this.buildVideoMetadata(params);
      
      // Step 2: Initiate resumable upload
      const uploadResponse = await this.initiateUpload(metadata);
      const uploadUrl = uploadResponse.headers.get('location');
      
      if (!uploadUrl) {
        throw new YouTubeUploadError('Failed to get upload URL');
      }

      // Step 3: Upload video file
      const videoResponse = await this.uploadVideoFile(uploadUrl, params.video.data);
      
      // Step 4: Upload thumbnail if provided
      if (params.thumbnail) {
        await this.uploadThumbnail(videoResponse.id, params.thumbnail);
      }

      // Step 5: Add to playlist if specified
      if (params.playlistId) {
        await this.addVideoToPlaylist(videoResponse.id, params.playlistId);
      }

      logger.info('YouTube video uploaded successfully', {
        videoId: videoResponse.id,
        title: params.title,
        privacy: params.privacy
      });

      return this.mapToYouTubeVideo(videoResponse);
    } catch (error) {
      logger.error('Failed to upload YouTube video', { error, params });
      throw new YouTubeUploadError('Failed to upload video', undefined, { originalError: error });
    }
  }

  /**
   * Get video by ID
   */
  async getVideo(videoId: string, parts: readonly string[] = ['snippet', 'statistics', 'status']): Promise<YouTubeVideo> {
    try {
      await this.ensureAuthenticated();

      const response = await this.httpClient.get(
        `${this.baseUrl}/videos?part=${parts.join(',')}&id=${videoId}`,
        this.getAuthHeaders()
      );

      if (!response.items || response.items.length === 0) {
        throw new YouTubeContentError('Video not found', videoId);
      }

      return this.mapToYouTubeVideo(response.items[0]);
    } catch (error) {
      logger.error('Failed to get YouTube video', { error, videoId });
      throw new YouTubeContentError('Failed to retrieve video', videoId, { originalError: error });
    }
  }

  /**
   * Update video metadata
   */
  async updateVideo(videoId: string, updates: Partial<Pick<YouTubeVideoUploadParams, 'title' | 'description' | 'tags' | 'categoryId' | 'privacy'>>): Promise<YouTubeVideo> {
    try {
      await this.ensureAuthenticated();

      const updateData = this.buildVideoUpdateData(videoId, updates);
      
      const response = await this.httpClient.put(
        `${this.baseUrl}/videos?part=snippet,status`,
        updateData,
        this.getAuthHeaders()
      );

      logger.info('YouTube video updated successfully', {
        videoId,
        updates: Object.keys(updates)
      });

      return this.mapToYouTubeVideo(response);
    } catch (error) {
      logger.error('Failed to update YouTube video', { error, videoId, updates });
      throw new YouTubeContentError('Failed to update video', videoId, { originalError: error });
    }
  }

  /**
   * Delete video
   */
  async deleteVideo(videoId: string): Promise<boolean> {
    try {
      await this.ensureAuthenticated();

      await this.httpClient.delete(
        `${this.baseUrl}/videos?id=${videoId}`,
        this.getAuthHeaders()
      );

      logger.info('YouTube video deleted successfully', { videoId });
      return true;
    } catch (error) {
      logger.error('Failed to delete YouTube video', { error, videoId });
      throw new YouTubeContentError('Failed to delete video', videoId, { originalError: error });
    }
  }

  /**
   * Get channel information
   */
  async getChannel(channelId?: string): Promise<YouTubeChannel> {
    try {
      await this.ensureAuthenticated();

      const url = channelId 
        ? `${this.baseUrl}/channels?part=snippet,statistics,brandingSettings&id=${channelId}`
        : `${this.baseUrl}/channels?part=snippet,statistics,brandingSettings&mine=true`;

      const response = await this.httpClient.get(url, this.getAuthHeaders());

      if (!response.items || response.items.length === 0) {
        throw new YouTubeContentError('Channel not found', channelId);
      }

      return this.mapToYouTubeChannel(response.items[0]);
    } catch (error) {
      logger.error('Failed to get YouTube channel', { error, channelId });
      throw new YouTubeContentError('Failed to retrieve channel', channelId, { originalError: error });
    }
  }

  /**
   * Get channel videos
   */
  async getChannelVideos(channelId?: string, options: {
    readonly maxResults?: number;
    readonly order?: 'date' | 'rating' | 'relevance' | 'title' | 'videoCount' | 'viewCount';
    readonly publishedAfter?: Date;
    readonly publishedBefore?: Date;
    readonly pageToken?: string;
  } = {}): Promise<{
    readonly videos: readonly YouTubeVideo[];
    readonly nextPageToken?: string;
    readonly totalResults: number;
  }> {
    try {
      await this.ensureAuthenticated();

      const queryParams = new URLSearchParams();
      queryParams.set('part', 'snippet');
      queryParams.set('type', 'video');
      
      if (channelId) {
        queryParams.set('channelId', channelId);
      } else {
        queryParams.set('forMine', 'true');
      }
      
      if (options.maxResults) queryParams.set('maxResults', options.maxResults.toString());
      if (options.order) queryParams.set('order', options.order);
      if (options.publishedAfter) queryParams.set('publishedAfter', options.publishedAfter.toISOString());
      if (options.publishedBefore) queryParams.set('publishedBefore', options.publishedBefore.toISOString());
      if (options.pageToken) queryParams.set('pageToken', options.pageToken);

      const url = `${this.baseUrl}/search?${queryParams.toString()}`;
      const response = await this.httpClient.get(url, this.getAuthHeaders());

      // Get detailed video information
      const videoIds = response.items.map((item: any) => item.id.videoId).join(',');
      const videosResponse = await this.httpClient.get(
        `${this.baseUrl}/videos?part=snippet,statistics,status&id=${videoIds}`,
        this.getAuthHeaders()
      );

      return {
        videos: videosResponse.items.map((video: any) => this.mapToYouTubeVideo(video)),
        nextPageToken: response.nextPageToken,
        totalResults: response.pageInfo.totalResults
      };
    } catch (error) {
      logger.error('Failed to get channel videos', { error, channelId });
      throw new YouTubeContentError('Failed to retrieve channel videos', channelId, { originalError: error });
    }
  }

  /**
   * Create playlist
   */
  async createPlaylist(title: string, description?: string, privacy: 'private' | 'unlisted' | 'public' = 'private'): Promise<YouTubePlaylist> {
    try {
      await this.ensureAuthenticated();

      const playlistData = {
        snippet: {
          title,
          description: description || ''
        },
        status: {
          privacyStatus: privacy
        }
      };
      
      const response = await this.httpClient.post(
        `${this.baseUrl}/playlists?part=snippet,status`,
        playlistData,
        this.getAuthHeaders()
      );

      logger.info('YouTube playlist created successfully', {
        playlistId: response.id,
        title,
        privacy
      });

      return this.mapToYouTubePlaylist(response);
    } catch (error) {
      logger.error('Failed to create YouTube playlist', { error, title });
      throw new YouTubeContentError('Failed to create playlist', undefined, { originalError: error });
    }
  }

  /**
   * Add video to playlist
   */
  async addVideoToPlaylist(videoId: string, playlistId: string, position?: number): Promise<YouTubePlaylistItem> {
    try {
      await this.ensureAuthenticated();

      const itemData = {
        snippet: {
          playlistId,
          resourceId: {
            kind: 'youtube#video',
            videoId
          },
          position
        }
      };
      
      const response = await this.httpClient.post(
        `${this.baseUrl}/playlistItems?part=snippet`,
        itemData,
        this.getAuthHeaders()
      );

      logger.info('Video added to YouTube playlist successfully', {
        videoId,
        playlistId,
        position
      });

      return this.mapToYouTubePlaylistItem(response);
    } catch (error) {
      logger.error('Failed to add video to YouTube playlist', { error, videoId, playlistId });
      throw new YouTubeContentError('Failed to add video to playlist', videoId, { originalError: error });
    }
  }

  /**
   * Get analytics report
   */
  async getAnalytics(options: {
    readonly startDate: Date;
    readonly endDate: Date;
    readonly metrics: readonly string[];
    readonly dimensions?: readonly string[];
    readonly filters?: string;
    readonly maxResults?: number;
    readonly sort?: string;
  }): Promise<YouTubeAnalyticsReport> {
    try {
      await this.ensureAuthenticated();

      const queryParams = new URLSearchParams();
      queryParams.set('ids', 'channel==MINE');
      queryParams.set('startDate', this.formatDate(options.startDate));
      queryParams.set('endDate', this.formatDate(options.endDate));
      queryParams.set('metrics', options.metrics.join(','));
      
      if (options.dimensions) queryParams.set('dimensions', options.dimensions.join(','));
      if (options.filters) queryParams.set('filters', options.filters);
      if (options.maxResults) queryParams.set('max-results', options.maxResults.toString());
      if (options.sort) queryParams.set('sort', options.sort);

      const url = `${this.analyticsUrl}/reports?${queryParams.toString()}`;
      const response = await this.httpClient.get(url, this.getAuthHeaders());

      return response;
    } catch (error) {
      logger.error('Failed to get YouTube analytics', { error, options });
      throw new YouTubeIntegrationError('Failed to retrieve analytics', { originalError: error });
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private validateConfig(): void {
    const required = ['clientId', 'clientSecret', 'redirectUri'];
    const missing = required.filter(key => !this.config[key as keyof YouTubeConfig]);
    
    if (missing.length > 0) {
      throw new WorkflowValidationError(
        'youtube-config-validation',
        [`Missing required YouTube configuration: ${missing.join(', ')}`]
      );
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiresAt || this.tokenExpiresAt <= new Date()) {
      if (this.refreshToken) {
        await this.refreshAccessToken();
      } else {
        throw new YouTubeAuthenticationError('No valid access token available. Please authenticate first.');
      }
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.accessToken) {
      throw new YouTubeAuthenticationError('No access token available');
    }
    
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  private validateVideoUploadParams(params: YouTubeVideoUploadParams): void {
    if (!params.title?.trim()) {
      throw new WorkflowValidationError('youtube-upload-validation', ['Video title cannot be empty']);
    }

    if (!params.video.data) {
      throw new WorkflowValidationError('youtube-upload-validation', ['Video data is required']);
    }

    if (!params.video.filename.trim()) {
      throw new WorkflowValidationError('youtube-upload-validation', ['Video filename cannot be empty']);
    }

    const validPrivacyStatuses = ['private', 'unlisted', 'public'];
    if (params.privacy && !validPrivacyStatuses.includes(params.privacy)) {
      throw new WorkflowValidationError('youtube-upload-validation', [`Invalid privacy status: ${params.privacy}`]);
    }
  }

  private buildVideoMetadata(params: YouTubeVideoUploadParams): any {
    return {
      snippet: {
        title: params.title,
        description: params.description || '',
        tags: params.tags || [],
        categoryId: params.categoryId || '22', // Default to People & Blogs
        defaultLanguage: params.defaultLanguage,
        defaultAudioLanguage: params.defaultAudioLanguage
      },
      status: {
        privacyStatus: params.privacy,
        publishAt: params.publishAt?.toISOString(),
        license: params.license || 'youtube',
        embeddable: params.embeddable !== false,
        publicStatsViewable: params.publicStatsViewable !== false,
        madeForKids: params.madeForKids || false,
        selfDeclaredMadeForKids: params.selfDeclaredMadeForKids || false
      },
      recordingDetails: params.location || params.recordingDate ? {
        location: params.location ? {
          latitude: params.location.latitude,
          longitude: params.location.longitude,
          locationDescription: params.location.locationDescription
        } : undefined,
        recordingDate: params.recordingDate?.toISOString()
      } : undefined
    };
  }

  private buildVideoUpdateData(videoId: string, updates: Partial<Pick<YouTubeVideoUploadParams, 'title' | 'description' | 'tags' | 'categoryId' | 'privacy'>>): any {
    const data: any = {
      id: videoId
    };

    if (updates.title || updates.description || updates.tags || updates.categoryId) {
      data.snippet = {};
      if (updates.title) data.snippet.title = updates.title;
      if (updates.description) data.snippet.description = updates.description;
      if (updates.tags) data.snippet.tags = updates.tags;
      if (updates.categoryId) data.snippet.categoryId = updates.categoryId;
    }

    if (updates.privacy) {
      data.status = {
        privacyStatus: updates.privacy
      };
    }

    return data;
  }

  private async initiateUpload(metadata: any): Promise<Response> {
    const response = await fetch(`${this.uploadUrl}/videos?uploadType=resumable&part=snippet,status,recordingDetails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/*'
      },
      body: JSON.stringify(metadata)
    });

    if (!response.ok) {
      throw new YouTubeUploadError(`Failed to initiate upload: ${response.statusText}`);
    }

    return response;
  }

  private async uploadVideoFile(uploadUrl: string, videoData: Buffer): Promise<any> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/*'
      },
      body: new Uint8Array(videoData)
    });

    if (!response.ok) {
      throw new YouTubeUploadError(`Failed to upload video file: ${response.statusText}`);
    }

    return response.json();
  }

  private async uploadThumbnail(videoId: string, thumbnail: { data: Buffer; contentType: string }): Promise<void> {
    try {
      await fetch(`${this.uploadUrl}/thumbnails/set?videoId=${videoId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': thumbnail.contentType
        },
        body: new Uint8Array(thumbnail.data)
      });

      logger.info('YouTube thumbnail uploaded successfully', { videoId });
    } catch (error) {
      logger.warn('Failed to upload YouTube thumbnail', { error, videoId });
      // Don't throw error for thumbnail upload failure
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private mapToYouTubeVideo(data: any): YouTubeVideo {
    return {
      id: data.id,
      title: data.snippet?.title || '',
      description: data.snippet?.description || '',
      thumbnails: {
        default: data.snippet?.thumbnails?.default,
        medium: data.snippet?.thumbnails?.medium,
        high: data.snippet?.thumbnails?.high,
        standard: data.snippet?.thumbnails?.standard,
        maxres: data.snippet?.thumbnails?.maxres
      },
      channelId: data.snippet?.channelId || '',
      channelTitle: data.snippet?.channelTitle || '',
      tags: data.snippet?.tags || [],
      categoryId: data.snippet?.categoryId || '',
      liveBroadcastContent: data.snippet?.liveBroadcastContent || 'none',
      defaultLanguage: data.snippet?.defaultLanguage,
      defaultAudioLanguage: data.snippet?.defaultAudioLanguage,
      duration: data.contentDetails?.duration || '',
      dimension: data.contentDetails?.dimension || '2d',
      definition: data.contentDetails?.definition || 'sd',
      caption: data.contentDetails?.caption === 'true',
      licensedContent: data.contentDetails?.licensedContent || false,
      projection: data.contentDetails?.projection || 'rectangular',
      uploadStatus: data.status?.uploadStatus || 'uploaded',
      privacyStatus: data.status?.privacyStatus || 'private',
      license: data.status?.license || 'youtube',
      embeddable: data.status?.embeddable !== false,
      publicStatsViewable: data.status?.publicStatsViewable !== false,
      madeForKids: data.status?.madeForKids || false,
      publishedAt: data.snippet?.publishedAt ? new Date(data.snippet.publishedAt) : undefined,
      viewCount: parseInt(data.statistics?.viewCount || '0'),
      likeCount: parseInt(data.statistics?.likeCount || '0'),
      dislikeCount: parseInt(data.statistics?.dislikeCount || '0'),
      favoriteCount: parseInt(data.statistics?.favoriteCount || '0'),
      commentCount: parseInt(data.statistics?.commentCount || '0'),
      player: {
        embedHtml: data.player?.embedHtml || ''
      },
      topicDetails: data.topicDetails,
      recordingDetails: data.recordingDetails ? {
        recordingDate: data.recordingDetails.recordingDate ? new Date(data.recordingDetails.recordingDate) : undefined,
        location: data.recordingDetails.location
      } : undefined,
      fileDetails: data.fileDetails,
      processingDetails: data.processingDetails
    };
  }

  private mapToYouTubeChannel(data: any): YouTubeChannel {
    return {
      id: data.id,
      title: data.snippet?.title || '',
      description: data.snippet?.description || '',
      customUrl: data.snippet?.customUrl,
      publishedAt: new Date(data.snippet?.publishedAt),
      thumbnails: {
        default: data.snippet?.thumbnails?.default,
        medium: data.snippet?.thumbnails?.medium,
        high: data.snippet?.thumbnails?.high
      },
      defaultLanguage: data.snippet?.defaultLanguage,
      country: data.snippet?.country,
      viewCount: parseInt(data.statistics?.viewCount || '0'),
      subscriberCount: parseInt(data.statistics?.subscriberCount || '0'),
      hiddenSubscriberCount: data.statistics?.hiddenSubscriberCount || false,
      videoCount: parseInt(data.statistics?.videoCount || '0'),
      keywords: data.brandingSettings?.channel?.keywords,
      trackingAnalyticsAccountId: data.brandingSettings?.channel?.trackingAnalyticsAccountId,
      moderateComments: data.brandingSettings?.channel?.moderateComments || false,
      showRelatedChannels: data.brandingSettings?.channel?.showRelatedChannels || false,
      showBrowseView: data.brandingSettings?.channel?.showBrowseView || false,
      featuredChannelsTitle: data.brandingSettings?.channel?.featuredChannelsTitle,
      featuredChannelsUrls: data.brandingSettings?.channel?.featuredChannelsUrls || [],
      unsubscribedTrailer: data.brandingSettings?.channel?.unsubscribedTrailer,
      profileColor: data.brandingSettings?.channel?.profileColor,
      defaultTab: data.brandingSettings?.channel?.defaultTab,
      brandingSettings: data.brandingSettings
    };
  }

  private mapToYouTubePlaylist(data: any): YouTubePlaylist {
    return {
      id: data.id,
      title: data.snippet?.title || '',
      description: data.snippet?.description || '',
      thumbnails: {
        default: data.snippet?.thumbnails?.default,
        medium: data.snippet?.thumbnails?.medium,
        high: data.snippet?.thumbnails?.high,
        standard: data.snippet?.thumbnails?.standard,
        maxres: data.snippet?.thumbnails?.maxres
      },
      channelId: data.snippet?.channelId || '',
      channelTitle: data.snippet?.channelTitle || '',
      defaultLanguage: data.snippet?.defaultLanguage,
      publishedAt: new Date(data.snippet?.publishedAt),
      privacyStatus: data.status?.privacyStatus || 'private',
      itemCount: data.contentDetails?.itemCount || 0,
      tags: data.snippet?.tags || [],
      localizations: data.localizations
    };
  }

  private mapToYouTubePlaylistItem(data: any): YouTubePlaylistItem {
    return {
      id: data.id,
      playlistId: data.snippet?.playlistId || '',
      videoId: data.snippet?.resourceId?.videoId || '',
      position: data.snippet?.position || 0,
      videoOwnerChannelTitle: data.snippet?.videoOwnerChannelTitle,
      videoOwnerChannelId: data.snippet?.videoOwnerChannelId,
      note: data.snippet?.note,
      publishedAt: new Date(data.snippet?.publishedAt),
      videoPublishedAt: data.contentDetails?.videoPublishedAt ? new Date(data.contentDetails.videoPublishedAt) : undefined
    };
  }
}

export function createYouTubeIntegration(config: YouTubeConfig): YouTubeIntegration {
  return new YouTubeIntegration(config);
} 