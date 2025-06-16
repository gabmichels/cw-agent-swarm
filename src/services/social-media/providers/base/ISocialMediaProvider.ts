import { 
  SocialMediaProvider, 
  SocialMediaConnection, 
  SocialMediaConnectionStatus,
  SocialMediaCapability
} from '../../database/ISocialMediaDatabase';

// Following IMPLEMENTATION_GUIDELINES.md - interface-first design, dependency injection

export interface SocialMediaOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  tokenType: 'Bearer' | 'OAuth';
  scopes: string[];
}

export interface SocialMediaPost {
  id: string;
  platform: SocialMediaProvider;
  platformPostId: string;
  content: string;
  media?: MediaFile[];
  hashtags?: string[];
  mentions?: string[];
  url?: string;
  createdAt: Date;
  updatedAt: Date;
  metrics?: PostMetrics;
}

export interface PostCreationParams {
  content: string;
  media?: MediaFile[];
  hashtags?: string[];
  mentions?: string[];
  scheduledTime?: Date;
  visibility?: 'public' | 'private' | 'unlisted';
}

export interface PostScheduleParams {
  content: string;
  media?: MediaFile[];
  hashtags?: string[];
  scheduledTime: Date;
  visibility?: 'public' | 'private' | 'unlisted';
}

export interface ScheduledPost {
  id: string;
  platform: SocialMediaProvider;
  content: string;
  scheduledTime: Date;
  status: 'scheduled' | 'posted' | 'failed' | 'cancelled';
  createdAt: Date;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  profileImageUrl?: string;
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  isVerified?: boolean;
  accountType: 'personal' | 'business' | 'creator';
  bio?: string;
  website?: string;
}

export interface ContentAnalytics {
  postId: string;
  impressions: number;
  reach: number;
  likes: number;
  shares: number;
  comments: number;
  saves?: number;
  clicks?: number;
  engagementRate: number;
  demographics?: {
    ageGroups: Record<string, number>;
    genders: Record<string, number>;
    countries: Record<string, number>;
  };
  timeMetrics?: {
    hourlyViews: Record<string, number>;
    dailyViews: Record<string, number>;
  };
}

// TikTok specific interfaces
export interface TikTokVideoUpload {
  videoFile: Buffer;
  title: string;
  description?: string;
  hashtags?: string[];
  privacy: 'public' | 'friends' | 'private';
  allowComments: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  scheduleTime?: Date;
}

export interface TikTokVideoAnalytics extends ContentAnalytics {
  playTime: number;                      // Average play time in seconds
  completionRate: number;                // Percentage who watched to completion
  trafficSources: Record<string, number>; // Where views came from
}

// Media types
export interface MediaFile {
  id: string;
  type: 'image' | 'video' | 'gif' | 'audio';
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  metadata?: Record<string, unknown>;
}

// Analytics types
export interface PostMetrics {
  views: number;
  likes: number;
  shares: number;
  comments: number;
  clicks: number;
  engagementRate: number;
  reach: number;
  impressions: number;
}

export interface ContentAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  topics: string[];
  hashtags: string[];
  mentions: string[];
  readabilityScore: number;
  engagementPrediction: number;
  suggestedImprovements: string[];
}

export interface OptimizedContent {
  originalContent: string;
  optimizedContent: string;
  platform: SocialMediaProvider;
  improvements: string[];
  estimatedEngagement: number;
}

// Comment and engagement types
export interface CommentResponse {
  id: string;
  postId: string;
  content: string;
  author: string;
  createdAt: Date;
  likes: number;
  replies?: CommentResponse[];
}

export interface ResponseStrategy {
  tone: 'professional' | 'friendly' | 'casual';
  maxLength: number;
  includeEmojis: boolean;
  autoRespond: boolean;
  keywords: string[];
}

// Simplified provider interface for current implementation
export interface ISocialMediaProvider {
  // Connection management
  validateConnection(connectionId: string): Promise<SocialMediaConnectionStatus>;
  refreshTokens(connectionId: string): Promise<void>;
  
  // Content creation
  createPost(connectionId: string, params: PostCreationParams): Promise<SocialMediaPost>;
  schedulePost(connectionId: string, params: PostScheduleParams): Promise<ScheduledPost>;
  
  // Content management
  getPost(connectionId: string, postId: string): Promise<SocialMediaPost>;
  getPosts(connectionId: string, params: { limit?: number; since?: Date; until?: Date }): Promise<SocialMediaPost[]>;
  editPost(connectionId: string, postId: string, content: string): Promise<SocialMediaPost>;
  deletePost(connectionId: string, postId: string): Promise<void>;
  cancelScheduledPost(connectionId: string, scheduledPostId: string): Promise<void>;
  
  // Content analysis
  analyzeContent(content: string): Promise<ContentAnalysis>;
  optimizeContent(content: string): Promise<OptimizedContent>;
  
  // Analytics
  getPostMetrics(connectionId: string, postId: string): Promise<PostMetrics>;
  
  // Engagement
  getComments(connectionId: string, postId: string): Promise<CommentResponse[]>;
  respondToComments(connectionId: string, postId: string, strategy: ResponseStrategy): Promise<CommentResponse[]>;
  
  // Platform-specific capabilities
  getSupportedCapabilities(): SocialMediaCapability[];
  
  // Rate limiting
  getRateLimitStatus(connectionId: string): Promise<{
    remaining: number;
    resetTime: Date;
    limit: number;
  }>;
}

// TikTok specific provider interface
export interface ITikTokProvider extends ISocialMediaProvider {
  // TikTok Video Management
  uploadVideo(connectionId: string, params: TikTokVideoUpload): Promise<SocialMediaPost>;
  getVideoAnalytics(connectionId: string, videoId: string): Promise<TikTokVideoAnalytics>;
  
  // TikTok Live Streaming
  createLiveStream(connectionId: string, params: {
    title: string;
    description?: string;
    privacy: 'public' | 'friends';
  }): Promise<{
    liveStreamId: string;
    streamUrl: string;
    streamKey: string;
  }>;
  
  // TikTok Trends & Discovery
  getTrendingHashtags(region?: string): Promise<Array<{
    hashtag: string;
    postCount: number;
    trend: 'rising' | 'stable' | 'declining';
  }>>;
  
  getTrendingSounds(): Promise<Array<{
    soundId: string;
    title: string;
    artist: string;
    useCount: number;
  }>>;
}

// Provider factory interface following dependency injection pattern
export interface ISocialMediaProviderFactory {
  createProvider(provider: SocialMediaProvider): ISocialMediaProvider;
  getAvailableProviders(): SocialMediaProvider[];
  isProviderAvailable(provider: SocialMediaProvider): boolean;
}

// Provider registry for dependency injection
export interface ISocialMediaProviderRegistry {
  register(provider: SocialMediaProvider, providerClass: new (config: SocialMediaOAuthConfig) => ISocialMediaProvider): void;
  get(provider: SocialMediaProvider): ISocialMediaProvider | null;
  getAll(): Map<SocialMediaProvider, ISocialMediaProvider>;
}

// Error types for providers
export class SocialMediaProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: SocialMediaProvider,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'SocialMediaProviderError';
  }
}

export class SocialMediaAuthError extends SocialMediaProviderError {
  constructor(
    message: string,
    provider: SocialMediaProvider,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, provider, `AUTH_${code}`, context);
    this.name = 'SocialMediaAuthError';
  }
}

export class SocialMediaRateLimitError extends SocialMediaProviderError {
  constructor(
    message: string,
    provider: SocialMediaProvider,
    public readonly resetTime: Date,
    public readonly remaining: number = 0
  ) {
    super(message, provider, 'RATE_LIMIT_EXCEEDED', { resetTime, remaining });
    this.name = 'SocialMediaRateLimitError';
  }
}

export class SocialMediaError extends Error {
  constructor(
    message: string,
    public code: string,
    public platform: SocialMediaProvider,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'SocialMediaError';
  }
} 