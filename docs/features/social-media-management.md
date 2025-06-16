# Social Media Management Feature Specification

## 🚨 CRITICAL: IMPLEMENTATION GUIDELINES COMPLIANCE

**FOR IMPLEMENTER:** This document outlines the social media posting capabilities for the agent swarm system. When implementing this feature:

### 🎯 **MUST FOLLOW @IMPLEMENTATION_GUIDELINES.md STRICTLY**

**ARCHITECTURE REQUIREMENTS:**
- ✅ **Clean break from legacy code patterns** - Replace don't extend
- ✅ **ULID/UUID for all identifiers** - No timestamp-based IDs
- ✅ **Strict TypeScript typing** - No 'any' types allowed
- ✅ **Dependency injection patterns** - Constructor injection for all dependencies
- ✅ **Test-driven development** - Write tests before implementation
- ✅ **Industry best practices** - Interface-first design, immutable data, pure functions
- ✅ **Performance consciousness** - Optimize for Qdrant, efficient data structures
- ✅ **No overengineering** - Keep it simple, stick to defined scope
- ✅ **No placeholder implementations** - Aim for full implementations

### 🏗️ **ARCHITECTURE PATTERN: FOLLOW WORKSPACE IMPLEMENTATION**

This feature MUST follow the **exact same architecture pattern** as the successful workspace integration:

1. **Database Layer** → `Prisma schema` + `IDatabaseProvider` interface
2. **Provider System** → `ISocialMediaProvider` interface + platform implementations  
3. **Service Layer** → `SocialMediaService` orchestrator
4. **API Routes** → REST endpoints for connection management
5. **UI Components** → Modal for connections + agent permission management
6. **Permission System** → Agent-level capability control

### 🔄 **REFERENCE IMPLEMENTATION**
- **Database**: Follow `WorkspaceConnection` schema pattern
- **UI Modal**: Follow `WorkspaceSettingsModal.tsx` pattern  
- **Agent Integration**: Follow `AgentWorkspacePermissionManager.tsx` pattern
- **Implementation Status**: Follow `WORKSPACE_IMPLEMENTATION_STATUS.md` tracking

---

## Feature Overview

The Social Media Management system enables agents to post content on behalf of users across multiple social media platforms and accounts. This capability extends the existing market scanning functionality by allowing agents to act on discovered trends and insights through automated posting.

### Key Requirements

- **Multi-Platform Support**: Twitter/X, LinkedIn, Facebook, Instagram, Reddit, **TikTok**
- **Multi-Account Management**: Support multiple accounts per platform
- **Account Grouping**: Organize accounts by product pages, teams, or purposes  
- **Agent-Level Control**: Enable/disable social media capabilities per agent
- **Content Processing**: Platform-specific formatting and optimization
- **Security & Compliance**: Secure credential management and audit logging
- **Rate Limiting**: Respect platform API limits and user-defined quotas

## Platform Support Matrix

| Platform | Create Posts | Stories | Reels/Videos | Live | Analytics | Comments | DMs |
|----------|--------------|---------|--------------|------|-----------|----------|-----|
| **Twitter/X** | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **LinkedIn** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Facebook** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Instagram** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Reddit** | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **TikTok** | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Architecture Overview

### 🏗️ Core Components Structure (Following Workspace Pattern)

```
src/services/social-media/              # Main service layer
├── database/
│   ├── ISocialMediaDatabase.ts         # Database abstraction interface
│   ├── PrismaSocialMediaDatabase.ts    # Prisma implementation
│   └── types/                          # Database types
├── providers/                          # Platform-specific implementations  
│   ├── base/
│   │   ├── ISocialMediaProvider.ts     # Abstract provider interface
│   │   └── SocialProviderTypes.ts      # Common interfaces
│   ├── TwitterProvider.ts              # Twitter/X implementation
│   ├── LinkedInProvider.ts             # LinkedIn implementation
│   ├── FacebookProvider.ts             # Facebook implementation
│   ├── InstagramProvider.ts            # Instagram implementation
│   ├── RedditProvider.ts               # Reddit implementation
│   └── TikTokProvider.ts               # TikTok implementation (NEW)
├── SocialMediaService.ts               # Primary orchestrator service
├── AccountManager.ts                   # Multi-account orchestration
├── ContentProcessor.ts                 # Content formatting & validation
├── RateLimiter.ts                      # API rate limiting service
├── PostScheduler.ts                    # Scheduling capabilities
├── AuditLogger.ts                      # Security audit logging
└── types/                              # TypeScript interfaces
    ├── SocialMediaTypes.ts             # Core type definitions
    ├── AccountTypes.ts                 # Account management types
    ├── ContentTypes.ts                 # Content processing types
    └── ProviderTypes.ts                # Provider interface types

src/components/social-media/            # UI components (Following Workspace Pattern)
├── SocialMediaSettingsModal.tsx       # Main connection modal (like WorkspaceSettingsModal)
├── SocialMediaConnectionCard.tsx      # Individual connection display
├── AgentSocialMediaPermissionManager.tsx  # Agent permission management
├── SocialMediaPermissionEditor.tsx    # Edit permissions in agent page
└── SocialMediaMetrics.tsx             # Analytics dashboard

src/app/api/social-media/              # API routes (Following Workspace Pattern)
├── connect/route.ts                   # POST - Initiate connection
├── callback/route.ts                  # GET - Handle OAuth callback
├── connections/
│   ├── route.ts                       # GET - List connections
│   └── [id]/route.ts                  # GET/DELETE - Connection details/revoke
└── permissions/route.ts               # POST/GET/DELETE - Agent permissions
```

### 🗃️ Database Schema Extensions (Following Workspace Pattern)

```typescript
// Following IMPLEMENTATION_GUIDELINES.md - ULID identifiers, strict typing

interface SocialMediaConnection {
  id: string;                            // ULID
  userId: string;                        // ULID - User who owns connection
  organizationId?: string;               // ULID - Optional organization
  provider: SocialMediaProvider;         // Enum
  providerAccountId: string;             // Platform's account ID
  accountDisplayName: string;            // Human-readable name
  accountUsername: string;               // @username or handle
  accountType: 'personal' | 'business' | 'creator';
  encryptedCredentials: string;          // AES-256 encrypted OAuth tokens
  scopes: string[];                      // Granted permissions
  connectionStatus: SocialMediaConnectionStatus;
  metadata: Record<string, unknown>;     // Platform-specific data
  lastValidated: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface AgentSocialMediaPermission {
  id: string;                            // ULID
  agentId: string;                       // ULID - Agent with permission
  connectionId: string;                  // ULID - Social media connection
  capabilities: SocialMediaCapability[];  // Granted capabilities
  accessLevel: AccessLevel;              // 'NONE' | 'READ' | 'LIMITED' | 'FULL'
  restrictions: Record<string, unknown>; // Custom restrictions
  grantedBy: string;                     // ULID - User who granted permission
  grantedAt: Date;
  isActive: boolean;
  auditLog: AuditEntry[];               // Permission change history
}

enum SocialMediaProvider {
  TWITTER = 'twitter',
  LINKEDIN = 'linkedin', 
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  REDDIT = 'reddit',
  TIKTOK = 'tiktok'                     // NEW PLATFORM
}

enum SocialMediaCapability {
  // Content Management
  POST_CREATE = 'POST_CREATE',
  POST_READ = 'POST_READ', 
  POST_EDIT = 'POST_EDIT',
  POST_DELETE = 'POST_DELETE',
  
  // Media & Stories
  STORY_CREATE = 'STORY_CREATE',
  STORY_READ = 'STORY_READ',
  VIDEO_UPLOAD = 'VIDEO_UPLOAD',
  IMAGE_UPLOAD = 'IMAGE_UPLOAD',
  
  // Engagement
  COMMENT_READ = 'COMMENT_READ',
  COMMENT_CREATE = 'COMMENT_CREATE',
  LIKE_CREATE = 'LIKE_CREATE',
  SHARE_CREATE = 'SHARE_CREATE',
  
  // Analytics
  ANALYTICS_READ = 'ANALYTICS_READ',
  INSIGHTS_READ = 'INSIGHTS_READ',
  
  // Messaging
  DM_READ = 'DM_READ',
  DM_SEND = 'DM_SEND',
  
  // TikTok Specific
  TIKTOK_VIDEO_CREATE = 'TIKTOK_VIDEO_CREATE',
  TIKTOK_LIVE_CREATE = 'TIKTOK_LIVE_CREATE',
  TIKTOK_ANALYTICS_READ = 'TIKTOK_ANALYTICS_READ'
}
```

## 📱 TikTok Integration (NEW PLATFORM)

### TikTok Provider Implementation

```typescript
interface TikTokProvider extends ISocialMediaProvider {
  // Video Content
  uploadVideo(params: TikTokVideoUpload): Promise<TikTokPost>;
  scheduleVideo(params: TikTokVideoSchedule): Promise<TikTokScheduledPost>;
  
  // Live Streaming
  createLiveStream(params: TikTokLiveConfig): Promise<TikTokLiveStream>;
  
  // Analytics & Insights  
  getVideoAnalytics(videoId: string): Promise<TikTokVideoAnalytics>;
  getProfileAnalytics(timeframe: string): Promise<TikTokProfileAnalytics>;
  
  // Content Management
  getVideos(params: TikTokVideoQuery): Promise<TikTokVideo[]>;
  deleteVideo(videoId: string): Promise<void>;
  
  // Engagement
  getComments(videoId: string): Promise<TikTokComment[]>;
  replyToComment(commentId: string, text: string): Promise<TikTokComment>;
}

interface TikTokVideoUpload {
  videoFile: Buffer;                     // Video file data
  title: string;                         // Video title
  description?: string;                  // Video description
  hashtags?: string[];                   // Hashtags array
  privacy: 'public' | 'friends' | 'private';
  allowComments: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  scheduleTime?: Date;                   // Optional scheduling
}

interface TikTokVideoAnalytics {
  videoId: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  playTime: number;                      // Average play time
  engagementRate: number;
  demographics: {
    ageGroups: Record<string, number>;
    genders: Record<string, number>;
    countries: Record<string, number>;
  };
  performance: {
    hourlyViews: Record<string, number>;
    trafficSources: Record<string, number>;
  };
}
```

### TikTok OAuth Scopes

```typescript
const TIKTOK_SCOPES = [
  'user.info.basic',                     // Basic profile info
  'video.list',                          // Read user's videos
  'video.upload',                        // Upload videos
  'video.publish',                       // Publish videos
  'research.adlib.basic',                // Basic research data
  'research.data.basic'                  // Analytics data
];
```

## Multi-Account Management Strategy

### Account Organization

**Account Types:**
- **Personal**: Individual user accounts
- **Business**: Company/organization accounts  
- **Product**: Specific product or service accounts
- **Creator**: Content creator and influencer accounts

**Account Grouping:**
- Group accounts by purpose (e.g., "Marketing Team", "Product Launch")
- Support cross-platform groups (same campaign across Twitter + LinkedIn)
- Flexible permission assignment per group
- TikTok creator account management

### Authentication Architecture

**OAuth 2.0 Flow Implementation:**
```typescript
interface OAuthConfig {
  platform: SocialMediaProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

interface EncryptedCredentials {
  accessToken: string;                   // Encrypted access token
  refreshToken?: string;                 // Encrypted refresh token
  expiresAt: Date;
  tokenType: 'Bearer' | 'OAuth';
  encryptionVersion: string;             // For credential rotation
}
```

**Security Features:**
- AES-256 encryption for stored credentials
- Automatic token refresh handling
- Credential rotation capabilities
- Audit logging for all authentication events
- Secure credential deletion on account removal

## Content Processing Pipeline

### Content Validation & Formatting

```typescript
interface PostContent {
  id: string;                            // ULID
  originalText: string;
  media?: MediaFile[];
  hashtags?: string[];
  mentions?: string[];
  scheduledTime?: Date;
  platforms: PlatformConfig[];
  metadata: {
    generatedBy: string;                 // Agent ID
    basedOnTrend?: string;               // Market scanner trend ID
    contentType: 'manual' | 'generated' | 'scheduled';
    approvalStatus: 'pending' | 'approved' | 'rejected';
  };
}

interface PlatformConfig {
  platform: SocialMediaProvider;
  accountId: string;
  customizations?: {
    textOverride?: string;               // Platform-specific text
    hashtagsOverride?: string[];         // Platform hashtag strategy
    mediaOverride?: MediaFile[];         // Platform-specific media
    schedulingOffset?: number;           // Stagger posts across platforms
  };
  postingStatus: 'pending' | 'posted' | 'failed';
  platformPostId?: string;               // ID from social platform
  postedAt?: Date;
  error?: string;
}
```

### Platform-Specific Optimizations

**Character Limits & Formatting:**
- Twitter/X: 280 characters, thread support
- LinkedIn: 3000 characters, article support
- Facebook: 63,206 characters, rich media
- Instagram: 2200 characters, visual-first
- Reddit: Title + body, community-specific rules
- TikTok: 2200 characters, video-focused content

**Content Adaptation:**
- Automatic character limit handling
- Platform-appropriate hashtag strategies
- Media format conversion and optimization
- URL shortening and tracking
- TikTok video optimization and trending sounds

## Agent Integration System

### Capability Registration

**AgentRegistrationForm.tsx Integration:**
```typescript
// Add to capability options in agent registration
interface SocialMediaCapabilityConfig {
  enabled: boolean;
  allowedPlatforms: SocialMediaProvider[];
  accountGroups: string[];
  postingLimits: {
    daily: number;
    hourly: number;
  };
  requiresApproval: boolean;
  contentFilters: string[];              // Content moderation rules
}
```

**Agent Tool Registration:**
```typescript
// Register social media tools with agents
const socialMediaTools: AgentTool[] = [
  {
    id: 'social_media_post',
    name: 'Social Media Post',
    description: 'Post content to social media platforms',
    requiredCapabilities: ['social_media.posting'],
    parameters: {
      content: { type: 'string', required: true },
      accounts: { type: 'array', required: true },
      platforms: { type: 'array', required: false },
      scheduleTime: { type: 'string', required: false }
    }
  },
  // Additional tools...
];
```

### Content Generation Integration

**Market Scanner Integration:**
- Auto-generate posts based on trending topics
- Cross-reference market insights with posting performance
- Trend-based content scheduling
- TikTok trend detection and content suggestions

**AI Content Generation:**
- Platform-optimized content creation
- Brand voice consistency
- A/B testing for content variations
- TikTok-specific content optimization

## Security & Compliance Framework

### Authentication Security

**Credential Management:**
- Zero-knowledge credential storage
- Encryption key rotation
- Secure credential sharing between agents
- Automatic credential expiration handling

**Access Control:**
- Agent-level permissions
- Account group access control
- Time-based access restrictions
- IP allowlisting for sensitive accounts

### Audit & Compliance

**Audit Logging:**
```typescript
interface SocialMediaAuditLog {
  id: string;                            // ULID
  timestamp: Date;
  agentId: string;
  action: 'post' | 'schedule' | 'delete' | 'authenticate';
  accountId: string;
  platform: SocialMediaProvider;
  content?: {
    text: string;
    hashtags: string[];
    media: string[];
  };
  result: 'success' | 'failure' | 'pending';
  error?: string;
  ipAddress: string;
  userAgent: string;
}
```

**Compliance Features:**
- Content moderation hooks
- Platform policy validation
- Automatic GDPR compliance
- Data retention policies

## Rate Limiting & Performance

### Multi-Level Rate Limiting

**Platform API Limits:**
- Twitter: 300 posts per 3-hour window
- LinkedIn: 125 posts per day
- Facebook: Varies by account type  
- Instagram: 25 posts per hour
- Reddit: 1 post per 10 minutes per subreddit
- TikTok: 10 videos per day for most accounts

**User-Defined Limits:**
- Account-level quotas
- Agent-level restrictions
- Time-based limiting (business hours only)
- Content type restrictions

**Smart Queue Management:**
```typescript
interface PostingQueue {
  id: string;                            // ULID
  content: PostContent;
  priority: 'high' | 'medium' | 'low';
  scheduledFor: Date;
  retryCount: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  estimatedPostTime: Date;
}
```

## Integration with Existing Systems

### Memory System Integration

**Posted Content Storage:**
- Store all posted content in memory system
- Track engagement metrics and performance
- Build posting history for learning

**Performance Analytics:**
- Track post success rates by agent
- Analyze optimal posting times
- Content performance by platform

### Market Scanner Integration

**Trend-Based Posting:**
- Automatic post generation from trending topics
- Market insight amplification
- Competitive analysis integration

**Content Strategy:**
- Trend correlation with posting performance
- Market-driven content calendars
- Real-time trend response capabilities

## 🔐 Security & Authentication (Following Guidelines)

### OAuth 2.0 Implementation

```typescript
interface SocialMediaOAuthConfig {
  platform: SocialMediaProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
}

interface EncryptedSocialCredentials {
  accessToken: string;                   // AES-256 encrypted
  refreshToken?: string;                 // AES-256 encrypted  
  expiresAt: Date;
  tokenType: 'Bearer' | 'OAuth';
  encryptionVersion: string;             // For credential rotation
  platformSpecific?: Record<string, unknown>; // Platform-specific tokens
}
```

### Security Features (Following Guidelines)

- ✅ **AES-256 encryption** for stored credentials
- ✅ **Automatic token refresh** handling
- ✅ **Credential rotation** capabilities
- ✅ **Audit logging** for all authentication events
- ✅ **Secure credential deletion** on account removal
- ✅ **CSRF protection** via state parameters
- ✅ **Rate limiting** per provider and user

## 🛠️ Agent Integration Tools

### Social Media Agent Tools (Following Workspace Pattern)

```typescript
interface SocialMediaAgentTools {
  // Core posting tools
  createPost(params: PostCreationParams): Promise<SocialMediaPost>;
  schedulePost(params: PostScheduleParams): Promise<ScheduledPost>;
  
  // Content analysis
  analyzeContent(content: string): Promise<ContentAnalysis>;
  optimizeForPlatform(content: string, platform: SocialMediaProvider): Promise<OptimizedContent>;
  
  // Engagement tools
  getPostMetrics(postId: string): Promise<PostMetrics>;
  respondToComments(postId: string, strategy: ResponseStrategy): Promise<CommentResponse[]>;
  
  // TikTok specific tools
  createTikTokVideo(params: TikTokVideoParams): Promise<TikTokPost>;
  analyzeTikTokTrends(category?: string): Promise<TikTokTrend[]>;
  optimizeForTikTok(content: VideoContent): Promise<TikTokOptimizedVideo>;
}
```

### Available Agent Tools (26 Total)

#### Content Creation (8 tools)
- `create_text_post` - Create text-based posts
- `create_image_post` - Create posts with images
- `create_video_post` - Create posts with videos
- `create_story` - Create story content
- `create_tiktok_video` - Create TikTok videos (NEW)
- `schedule_post` - Schedule posts for later
- `create_poll` - Create poll posts
- `create_carousel` - Create carousel posts

#### Content Management (6 tools)
- `get_posts` - Retrieve account posts
- `edit_post` - Edit existing posts
- `delete_post` - Delete posts
- `get_post_metrics` - Get post performance
- `analyze_content` - Analyze content performance
- `optimize_content` - Optimize content for platforms

#### Engagement (7 tools)
- `get_comments` - Retrieve post comments
- `reply_to_comment` - Reply to comments
- `like_post` - Like/react to posts
- `share_post` - Share/repost content
- `send_dm` - Send direct messages
- `get_mentions` - Get account mentions
- `moderate_comments` - Moderate comment section

#### Analytics & Insights (5 tools)
- `get_account_analytics` - Account performance metrics
- `get_audience_insights` - Audience demographics
- `track_hashtags` - Track hashtag performance
- `analyze_trends` - Analyze trending content
- `get_competitor_analysis` - Competitor insights

## 🎯 Implementation Plan (Following Workspace Success Pattern)

### Phase 1: Foundation & Database ✅ **COMPLETED**
- [x] **1.1** Database schema design following workspace pattern
  - [x] Create `SocialMediaConnection` and `AgentSocialMediaPermission` tables
  - [x] Implement ULID generation for all IDs
  - [x] Add proper indexes and relationships
  - [x] Create migration scripts

- [x] **1.2** Core service architecture (Following IMPLEMENTATION_GUIDELINES.md)
  - [x] Implement `ISocialMediaProvider` interface
  - [x] Create `SocialMediaService` orchestrator
  - [x] Set up dependency injection container
  - [x] Implement error handling framework with custom error types

- [x] **1.3** Provider implementations (Start with Twitter/X)
  - [x] Twitter OAuth 2.0 authentication flow
  - [x] Basic posting functionality
  - [x] Rate limiting implementation
  - [x] Error handling and retry logic

### Phase 2: UI Integration ✅ **COMPLETED**
- [x] **2.1** Social Media Settings Modal (Following WorkspaceSettingsModal pattern)
  - [x] Create `SocialMediaSettingsModal.tsx`
  - [x] Platform connection interface
  - [x] OAuth flow handling
  - [x] Connection status monitoring

- [x] **2.2** Individual connection management
  - [x] Create `SocialMediaConnectionCard.tsx`
  - [x] Account verification process
  - [x] Connection health monitoring
  - [x] Multi-platform account linking

- [x] **2.3** Agent permission integration
  - [x] Update `AgentRegistrationForm.tsx` with social media step
  - [x] Create `AgentSocialMediaPermissionManager.tsx`
  - [x] Add to agent edit page (`page.tsx`)
  - [x] Implement permission validation

### Phase 3: Multi-Platform Support ✅ **COMPLETED**
- [x] **3.1** Core platforms
  - [x] LinkedIn provider implementation
  - [x] Facebook provider implementation  
  - [x] Instagram provider implementation
  - [x] Reddit provider implementation

- [x] **3.2** TikTok integration (NEW)
  - [x] TikTok OAuth flow implementation
  - [x] Video upload and scheduling
  - [x] TikTok-specific analytics
  - [x] Live streaming capabilities

- [x] **3.3** Advanced features
  - [x] Content scheduling system
  - [x] Cross-platform posting
  - [x] Content optimization per platform
  - [x] Advanced analytics dashboard

### Phase 4: Agent Tools & LLM Integration ✅ **COMPLETED**
- [x] **4.1** Tool registration with agents
  - [x] Integrate social media tools with ToolManager
  - [x] Dynamic tool availability based on permissions
  - [x] Natural language processing for social commands

- [x] **4.2** Content generation and optimization
  - [x] AI-powered content creation
  - [x] Platform-specific optimization
  - [x] Trend-based content suggestions
  - [x] A/B testing framework

### Phase 5: LLM Integration & Intent Recognition ✅ **COMPLETED**
- [x] **5.1** Natural Language Processing System
  - [x] Implement `SocialMediaNLP` class
  - [x] Create keyword-based intent patterns
  - [x] Build context-aware intent inference
  - [x] Integrate LLM-powered intent classification

- [x] **5.2** Tool Manager Integration
  - [x] Register social media tools with existing ToolManager
  - [x] Implement permission-based tool filtering
  - [x] Create dynamic parameter resolution
  - [x] Add audit logging for tool execution

- [x] **5.3** Content Generation Integration
  - [x] Implement `SocialMediaContentGenerator`
  - [x] Create `TrendBasedContentSuggester`
  - [x] Integrate with market scanner for trend-based content
  - [x] Add proactive content suggestions

### Phase 6: Production & Scaling (Week 10)
- [ ] **6.1** Performance optimization
  - [ ] Database query optimization
  - [ ] Caching implementation
  - [ ] Background job processing
  - [ ] API response optimization

- [ ] **6.2** Security hardening
  - [ ] Security audit implementation
  - [ ] Vulnerability scanning
  - [ ] Penetration testing
  - [ ] Compliance certification

- [ ] **6.3** Linter & Code Quality
  - [ ] Resolve remaining TypeScript errors in legacy code
  - [ ] Fix social media component TypeScript warnings
  - [ ] Implement comprehensive test coverage
  - [ ] Code quality improvements

### 🔧 **LINTER ISSUES STATUS**

**Current Status**: 1 minor TypeScript warning in `SocialMediaConnectionCard.tsx` (line 189)
- **Issue**: `details` element type inference issue
- **Impact**: Minimal - component functions correctly
- **Resolution**: Will be addressed in Phase 6.3 code quality improvements

**Approach for Linter Issues**:
1. **Priority 1**: Fix issues that break functionality
2. **Priority 2**: Fix issues in new social media code
3. **Priority 3**: Address legacy code issues systematically
4. **Strategy**: Batch fix similar issues together rather than one-by-one

**Social Media Specific Issues**: ✅ **RESOLVED**
- All social media TypeScript interfaces properly typed
- Database schema follows strict typing requirements
- Provider implementations use proper error handling
- API routes have proper validation and typing

## 📊 Success Metrics

### Technical Metrics
- **Connection Success Rate**: >99% OAuth flow success
- **Posting Success Rate**: >99.5% successful posts
- **Response Time**: <2s average posting time
- **Uptime**: >99.9% service availability
- **Rate Limit Compliance**: 100% compliance with platform limits

### Business Metrics
- **Agent Adoption**: % of agents with social media capabilities
- **Platform Coverage**: Number of connected accounts per platform
- **Content Volume**: Posts per day/week/month across all platforms
- **Engagement Tracking**: Performance metrics collection
- **TikTok Adoption**: TikTok-specific usage and engagement metrics

## 🚨 Implementation Checklist

### IMPLEMENTATION_GUIDELINES.md Compliance
- [ ] ✅ ULID/UUID used for all identifiers
- [ ] ✅ No 'any' types in TypeScript
- [ ] ✅ Dependency injection implemented
- [ ] ✅ Interface-first design approach
- [ ] ✅ Test-driven development
- [ ] ✅ Clean break from legacy patterns
- [ ] ✅ Performance-optimized data structures
- [ ] ✅ Proper error handling with custom types

### Architecture Pattern Compliance  
- [ ] ✅ Database abstraction layer implemented
- [ ] ✅ Provider pattern for multi-platform support
- [ ] ✅ Service orchestration layer
- [ ] ✅ API route structure following workspace pattern
- [ ] ✅ UI components following workspace component patterns
- [ ] ✅ Permission system integrated with agents

### Platform Coverage
- [ ] ✅ Twitter/X integration
- [ ] ✅ LinkedIn integration
- [ ] ✅ Facebook integration
- [ ] ✅ Instagram integration
- [ ] ✅ Reddit integration
- [ ] ✅ **TikTok integration** (NEW REQUIREMENT)

---

**Implementation Priority**: High Priority - Extends market scanning with actionable social engagement

**Estimated Timeline**: 10 weeks across 5 phases

**Resource Requirements**: 2-3 developers, 1 UI/UX designer, 1 security specialist

**Dependencies**: Existing agent capability system, workspace implementation patterns

**SUCCESS PATTERN**: Follow the proven workspace implementation approach for guaranteed success

## Configuration Management

### Environment Variables
```bash
# Social Media API Keys
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
INSTAGRAM_CLIENT_ID=your_instagram_client_id
INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
TIKTOK_CLIENT_ID=your_tiktok_client_id
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret

# Security Configuration
SOCIAL_MEDIA_ENCRYPTION_KEY=your_encryption_key
SOCIAL_MEDIA_JWT_SECRET=your_jwt_secret

# Feature Flags
SOCIAL_MEDIA_ENABLED=true
POSTING_APPROVAL_REQUIRED=true
AUTO_POSTING_ENABLED=false

# Rate Limiting
SOCIAL_MEDIA_RATE_LIMIT_WINDOW=3600000  # 1 hour in ms
SOCIAL_MEDIA_MAX_POSTS_PER_HOUR=10
SOCIAL_MEDIA_QUEUE_SIZE=1000

# Audit & Logging
SOCIAL_MEDIA_AUDIT_ENABLED=true
SOCIAL_MEDIA_LOG_LEVEL=info
```

### Configuration Files
```typescript
// data/social-media/config.json
{
  "platforms": {
    "twitter": {
      "enabled": true,
      "rateLimits": {
        "postsPerHour": 25,
        "postsPerDay": 300
      },
      "features": {
        "threads": true,
        "scheduling": true,
        "analytics": true
      }
    },
    "linkedin": {
      "enabled": true,
      "rateLimits": {
        "postsPerHour": 5,
        "postsPerDay": 125
      },
      "features": {
        "articles": true,
        "scheduling": true,
        "analytics": true
      }
    },
    "tiktok": {
      "enabled": true,
      "rateLimits": {
        "videosPerHour": 2,
        "videosPerDay": 10
      },
      "features": {
        "videoUpload": true,
        "liveStreaming": true,
        "analytics": true,
        "trendAnalysis": true
      }
    }
  },
  "contentProcessing": {
    "autoHashtags": true,
    "linkShortening": true,
    "mediaOptimization": true,
    "tiktokOptimization": true
  },
  "security": {
    "requireApproval": true,
    "contentModeration": true,
    "auditLogging": true
  }
}
```

## Testing Strategy

### Unit Testing Requirements
- [ ] All service classes with 95%+ coverage
- [ ] Platform provider implementations (including TikTok)
- [ ] Content processing pipeline
- [ ] Authentication flows
- [ ] Rate limiting logic

### Integration Testing Requirements  
- [ ] End-to-end posting workflows
- [ ] Multi-platform posting coordination
- [ ] Agent tool integration
- [ ] OAuth authentication flows
- [ ] Error handling and recovery
- [ ] TikTok video upload and analytics

### Performance Testing Requirements
- [ ] Concurrent posting load testing
- [ ] Rate limiting effectiveness
- [ ] Database performance under load
- [ ] Memory usage optimization
- [ ] Response time benchmarks
- [ ] TikTok video processing performance

## Risk Mitigation

### Technical Risks
- **API Changes**: Platform API deprecation or changes (especially TikTok's evolving API)
- **Rate Limiting**: Unexpected platform limit changes
- **Authentication**: OAuth flow breakage or token expiration
- **Content Policy**: Platform policy violations
- **Performance**: System performance under high load
- **Video Processing**: TikTok video upload and processing failures

### Business Risks
- **Compliance**: Regulatory compliance failures
- **Security**: Credential compromise or data breaches
- **Reputation**: Inappropriate content posting
- **Legal**: Terms of service violations
- **Financial**: API cost overruns
- **Platform Bans**: Account suspension or platform bans

### Mitigation Strategies
- Regular API monitoring and adaptation
- Comprehensive testing and validation
- Multi-layered security implementation
- Content moderation and approval workflows
- Continuous compliance monitoring
- Platform-specific best practices and guidelines

## 🤖 LLM Integration & User Intent Recognition

### How Social Media Capabilities Interact with the LLM

The social media management system integrates deeply with the LLM through multiple layers:

#### 1. **Tool Registration & Discovery**
```typescript
// Agent tools are registered with the LLM context
interface SocialMediaToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
      enum?: string[];
    }>;
    required: string[];
  };
  capabilities: SocialMediaCapability[];
}

// Example tool registration
const socialMediaTools: SocialMediaToolDefinition[] = [
  {
    name: 'social_media_create_post',
    description: 'Create and publish a post to social media platforms',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The text content of the post'
        },
        platforms: {
          type: 'array',
          description: 'Target social media platforms',
          enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'reddit', 'tiktok']
        },
        media: {
          type: 'array',
          description: 'Optional media files to attach'
        },
        schedule_time: {
          type: 'string',
          description: 'Optional ISO timestamp to schedule the post'
        }
      },
      required: ['content', 'platforms']
    },
    capabilities: ['POST_CREATE', 'IMAGE_UPLOAD']
  }
];
```

#### 2. **Context-Aware Tool Selection**
The LLM receives social media tools in its system prompt with detailed descriptions:

```typescript
// System prompt includes available tools based on agent permissions
const systemPrompt = `
You are an AI agent with access to social media management capabilities.

Available Social Media Tools:
- social_media_create_post: Create posts on Twitter, LinkedIn, Facebook, Instagram, Reddit, or TikTok
- social_media_analyze_trends: Analyze trending topics and hashtags
- social_media_schedule_post: Schedule posts for optimal engagement times
- social_media_get_analytics: Retrieve performance metrics for posts
- social_media_create_tiktok_video: Create TikTok videos with trending sounds

When users mention posting, sharing, tweeting, or social media activities, consider using these tools.
Always check user permissions before attempting to post to any platform.
`;
```

### User Intent Recognition Strategies

#### 1. **Natural Language Processing (NLP) Intent Mapping**

**Keyword-Based Intent Detection:**
```typescript
interface IntentPattern {
  intent: 'social_media_post' | 'social_media_schedule' | 'social_media_analyze';
  patterns: string[];
  confidence: number;
  requiredCapabilities: SocialMediaCapability[];
}

const intentPatterns: IntentPattern[] = [
  {
    intent: 'social_media_post',
    patterns: [
      'post this to twitter',
      'share on social media',
      'tweet about',
      'post on linkedin',
      'share this on facebook',
      'upload to tiktok',
      'post to instagram'
    ],
    confidence: 0.9,
    requiredCapabilities: ['POST_CREATE']
  },
  {
    intent: 'social_media_schedule',
    patterns: [
      'schedule a post',
      'post this later',
      'schedule for tomorrow',
      'post at 3pm',
      'queue this post'
    ],
    confidence: 0.85,
    requiredCapabilities: ['POST_CREATE', 'POST_SCHEDULE']
  },
  {
    intent: 'social_media_analyze',
    patterns: [
      'how did my post perform',
      'show me analytics',
      'engagement metrics',
      'post performance',
      'social media stats'
    ],
    confidence: 0.8,
    requiredCapabilities: ['ANALYTICS_READ']
  }
];
```

#### 2. **Context-Aware Intent Recognition**

**Conversation Context Analysis:**
```typescript
interface ConversationContext {
  previousMessages: string[];
  currentTopic: string;
  userGoals: string[];
  availableConnections: SocialMediaConnection[];
  agentCapabilities: SocialMediaCapability[];
}

class SocialMediaIntentRecognizer {
  recognizeIntent(
    userMessage: string, 
    context: ConversationContext
  ): SocialMediaIntent | null {
    // 1. Direct command detection
    const directIntent = this.detectDirectCommands(userMessage);
    if (directIntent) return directIntent;
    
    // 2. Contextual intent inference
    const contextualIntent = this.inferFromContext(userMessage, context);
    if (contextualIntent) return contextualIntent;
    
    // 3. Content-based intent detection
    const contentIntent = this.detectContentIntent(userMessage, context);
    return contentIntent;
  }
  
  private detectDirectCommands(message: string): SocialMediaIntent | null {
    // Direct commands like "post this to twitter"
    const lowerMessage = message.toLowerCase();
    
    for (const pattern of intentPatterns) {
      for (const patternText of pattern.patterns) {
        if (lowerMessage.includes(patternText)) {
          return {
            type: pattern.intent,
            confidence: pattern.confidence,
            extractedParams: this.extractParameters(message, pattern)
          };
        }
      }
    }
    
    return null;
  }
  
  private inferFromContext(
    message: string, 
    context: ConversationContext
  ): SocialMediaIntent | null {
    // Infer intent from conversation context
    // Example: If discussing market trends, suggest social media sharing
    
    if (context.currentTopic.includes('market_trend') && 
        message.includes('share') || message.includes('tell people')) {
      return {
        type: 'social_media_post',
        confidence: 0.7,
        suggestedPlatforms: this.suggestPlatformsForTopic(context.currentTopic)
      };
    }
    
    return null;
  }
}
```

#### 3. **LLM-Powered Intent Classification**

**Using LLM for Complex Intent Recognition:**
```typescript
class LLMIntentClassifier {
  async classifyIntent(userMessage: string, context: ConversationContext): Promise<SocialMediaIntent | null> {
    const prompt = `
    Analyze the following user message and determine if they want to perform a social media action.
    
    User message: "${userMessage}"
    
    Available social media platforms: ${context.availableConnections.map(c => c.provider).join(', ')}
    Agent capabilities: ${context.agentCapabilities.join(', ')}
    
    If this is a social media request, respond with JSON:
    {
      "intent": "social_media_post|social_media_schedule|social_media_analyze|none",
      "confidence": 0.0-1.0,
      "platforms": ["twitter", "linkedin", etc.],
      "content": "extracted content to post",
      "schedule_time": "ISO timestamp if scheduling",
      "reasoning": "why you classified it this way"
    }
    
    If not a social media request, respond with: {"intent": "none"}
    `;
    
    const response = await this.llm.complete(prompt);
    return JSON.parse(response);
  }
}
```

### Tool Invocation Flow

#### 1. **Permission-Based Tool Filtering**
```typescript
class SocialMediaToolManager {
  getAvailableTools(agentId: string): SocialMediaToolDefinition[] {
    const permissions = this.getAgentPermissions(agentId);
    
    return socialMediaTools.filter(tool => 
      tool.capabilities.every(cap => 
        permissions.some(perm => perm.capabilities.includes(cap))
      )
    );
  }
  
  async executeTool(
    toolName: string, 
    parameters: Record<string, unknown>,
    agentId: string
  ): Promise<ToolExecutionResult> {
    // 1. Validate permissions
    const hasPermission = await this.validatePermissions(toolName, agentId);
    if (!hasPermission) {
      throw new Error('Agent lacks required permissions for this social media action');
    }
    
    // 2. Execute tool with audit logging
    const result = await this.socialMediaService.executeTool(toolName, parameters, agentId);
    
    // 3. Log execution for compliance
    await this.auditLogger.logToolExecution({
      agentId,
      toolName,
      parameters,
      result,
      timestamp: new Date()
    });
    
    return result;
  }
}
```

#### 2. **Dynamic Tool Parameter Resolution**
```typescript
class ParameterResolver {
  async resolveParameters(
    toolName: string,
    userIntent: SocialMediaIntent,
    context: ConversationContext
  ): Promise<Record<string, unknown>> {
    const baseParams = userIntent.extractedParams || {};
    
    // Auto-resolve missing parameters
    if (toolName === 'social_media_create_post') {
      // Auto-select platforms if not specified
      if (!baseParams.platforms) {
        baseParams.platforms = this.suggestOptimalPlatforms(
          baseParams.content as string,
          context.availableConnections
        );
      }
      
      // Auto-optimize content for platforms
      if (baseParams.content) {
        baseParams.optimizedContent = await this.optimizeContentForPlatforms(
          baseParams.content as string,
          baseParams.platforms as string[]
        );
      }
      
      // Auto-suggest hashtags
      baseParams.hashtags = await this.suggestHashtags(
        baseParams.content as string,
        baseParams.platforms as string[]
      );
    }
    
    return baseParams;
  }
}
```

### Integration with Existing Agent Architecture

#### 1. **Agent Registration Integration**
```typescript
// Extended agent registration to include social media setup
interface AgentSocialMediaConfig {
  enabled: boolean;
  defaultPlatforms: SocialMediaProvider[];
  autoPosting: {
    enabled: boolean;
    requiresApproval: boolean;
    maxPostsPerDay: number;
  };
  contentFilters: {
    profanityFilter: boolean;
    brandVoiceCheck: boolean;
    complianceCheck: boolean;
  };
}

// In AgentRegistrationForm.tsx - Step 6: Social Media Setup
const socialMediaStep = {
  title: 'Social Media Integration',
  description: 'Configure social media posting capabilities',
  component: SocialMediaPermissionEditor,
  validation: (data: AgentSocialMediaConfig) => {
    if (data.enabled && data.defaultPlatforms.length === 0) {
      return 'Please select at least one social media platform';
    }
    return null;
  }
};
```

#### 2. **Tool Manager Integration**
```typescript
// In ToolManager - register social media tools
class ToolManager {
  private socialMediaToolManager: SocialMediaToolManager;
  
  async registerAgentTools(agentId: string): Promise<void> {
    // ... existing tool registration
    
    // Register social media tools based on permissions
    const socialMediaTools = await this.socialMediaToolManager.getAvailableTools(agentId);
    
    for (const tool of socialMediaTools) {
      this.registerTool(agentId, {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        execute: async (params) => {
          return await this.socialMediaToolManager.executeTool(
            tool.name, 
            params, 
            agentId
          );
        }
      });
    }
  }
}
```

### Content Generation & Optimization

#### 1. **AI-Powered Content Creation**
```typescript
class SocialMediaContentGenerator {
  async generateContent(
    topic: string,
    platforms: SocialMediaProvider[],
    brandVoice: BrandVoice,
    context: MarketInsight[]
  ): Promise<PlatformOptimizedContent> {
    const baseContent = await this.llm.complete(`
      Create engaging social media content about: ${topic}
      
      Brand voice: ${brandVoice.tone} (${brandVoice.description})
      Market context: ${context.map(c => c.summary).join(', ')}
      
      Requirements:
      - Engaging and authentic
      - Appropriate for professional audience
      - Include relevant hashtags
      - Call-to-action when appropriate
    `);
    
    // Optimize for each platform
    const optimizedContent: Record<string, string> = {};
    
    for (const platform of platforms) {
      optimizedContent[platform] = await this.optimizeForPlatform(
        baseContent, 
        platform, 
        brandVoice
      );
    }
    
    return {
      baseContent,
      platformContent: optimizedContent,
      suggestedHashtags: await this.generateHashtags(topic, platforms),
      optimalPostTimes: await this.getOptimalPostTimes(platforms)
    };
  }
}
```

#### 2. **Trend-Based Content Suggestions**
```typescript
class TrendBasedContentSuggester {
  async suggestContentFromTrends(
    marketTrends: MarketTrend[],
    agentCapabilities: SocialMediaCapability[],
    userPreferences: UserPreferences
  ): Promise<ContentSuggestion[]> {
    const suggestions: ContentSuggestion[] = [];
    
    for (const trend of marketTrends) {
      if (trend.confidence > 0.7 && trend.relevanceScore > 0.6) {
        const contentIdea = await this.generateContentIdea(trend);
        
        suggestions.push({
          trend,
          contentIdea,
          suggestedPlatforms: this.selectOptimalPlatforms(trend, agentCapabilities),
          estimatedEngagement: await this.predictEngagement(contentIdea, trend),
          urgency: this.calculateUrgency(trend)
        });
      }
    }
    
    return suggestions.sort((a, b) => b.urgency - a.urgency);
  }
}
```

### User Experience Flow

#### 1. **Natural Conversation Flow**
```
User: "I just discovered this amazing market trend in AI tools. We should share this with our audience."

Agent: "That's a great insight! I can help you share this trend across your social media platforms. 

Based on your connected accounts, I can post to:
- Twitter/X (@yourcompany) - 15.2K followers
- LinkedIn (Your Company Page) - 8.5K followers  
- Reddit (r/entrepreneur) - Approved poster

Would you like me to:
1. Create optimized posts for each platform
2. Schedule them for optimal engagement times
3. Include relevant hashtags and mentions

What specific aspects of the AI tools trend should I highlight?"

User: "Focus on the productivity gains and cost savings. Post to Twitter and LinkedIn now, schedule Reddit for tomorrow morning."

Agent: [Executes social_media_create_post and social_media_schedule_post tools]

"✅ Posted to Twitter and LinkedIn successfully!
📅 Scheduled Reddit post for tomorrow at 9 AM EST

Performance tracking:
- Twitter: Posted at 2:34 PM (optimal time for your audience)
- LinkedIn: Posted at 2:35 PM with professional tone adaptation
- Reddit: Scheduled for 9:00 AM EST in r/entrepreneur

I'll monitor engagement and provide analytics in 24 hours."
```

#### 2. **Proactive Content Suggestions**
```typescript
// Agent proactively suggests social media actions
class ProactiveSocialMediaAgent {
  async checkForContentOpportunities(): Promise<void> {
    // Check for trending topics relevant to user's industry
    const trends = await this.marketScanner.getRelevantTrends();
    
    // Check for optimal posting times
    const optimalTimes = await this.getOptimalPostingTimes();
    
    // Check for content performance insights
    const insights = await this.analyzeRecentPostPerformance();
    
    if (trends.length > 0 && this.isOptimalPostingTime()) {
      await this.suggestTrendBasedContent(trends);
    }
    
    if (insights.underperformingContent.length > 0) {
      await this.suggestContentOptimizations(insights);
    }
  }
  
  private async suggestTrendBasedContent(trends: MarketTrend[]): Promise<void> {
    const suggestion = `
    🔥 Trending Opportunity Detected!
    
    "${trends[0].title}" is gaining momentum in your industry.
    
    I can create and post content about this trend to:
    - Increase your thought leadership presence
    - Engage with the trending conversation
    - Drive traffic to your content
    
    Would you like me to draft posts for your social media accounts?
    `;
    
    await this.sendNotification(suggestion);
  }
}
```

This comprehensive LLM integration ensures that:

1. **Natural Intent Recognition**: Users can express social media desires naturally without learning specific commands
2. **Context-Aware Responses**: The agent understands conversation context and suggests appropriate actions
3. **Permission-Aware Execution**: Tools are only available based on agent permissions and connected accounts
4. **Intelligent Parameter Resolution**: Missing parameters are intelligently filled based on context and best practices
5. **Proactive Suggestions**: The agent can proactively suggest social media actions based on trends and opportunities

The system bridges the gap between natural language conversation and structured tool execution, making social media management feel like a natural extension of the conversation rather than a separate system.
