import { ulid } from 'ulid';

// Following IMPLEMENTATION_GUIDELINES.md - ULID identifiers, strict typing, interface-first design

// Import MediaFile from provider interfaces
export interface MediaFile {
  id: string;
  type: 'image' | 'video' | 'gif' | 'audio';
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  metadata?: Record<string, unknown>;
}

export enum SocialMediaProvider {
  TWITTER = 'twitter',
  LINKEDIN = 'linkedin',
  FACEBOOK = 'facebook', 
  INSTAGRAM = 'instagram',
  REDDIT = 'reddit',
  TIKTOK = 'tiktok'
}

export enum SocialMediaConnectionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  ERROR = 'error',
  REVOKED = 'revoked'
}

export enum SocialMediaCapability {
  // Content Management
  POST_CREATE = 'POST_CREATE',
  POST_READ = 'POST_READ',
  POST_EDIT = 'POST_EDIT', 
  POST_DELETE = 'POST_DELETE',
  POST_SCHEDULE = 'POST_SCHEDULE',
  
  // Draft Management (NEW)
  DRAFT_READ = 'DRAFT_READ',
  DRAFT_PUBLISH = 'DRAFT_PUBLISH',
  DRAFT_SCHEDULE = 'DRAFT_SCHEDULE',
  
  // Media & Stories
  STORY_CREATE = 'STORY_CREATE',
  STORY_READ = 'STORY_READ',
  VIDEO_UPLOAD = 'VIDEO_UPLOAD',
  IMAGE_UPLOAD = 'IMAGE_UPLOAD',
  
  // Engagement
  COMMENT_READ = 'COMMENT_READ',
  COMMENT_CREATE = 'COMMENT_CREATE',
  COMMENT_MODERATE = 'COMMENT_MODERATE',
  LIKE_CREATE = 'LIKE_CREATE',
  SHARE_CREATE = 'SHARE_CREATE',
  
  // Analytics
  ANALYTICS_READ = 'ANALYTICS_READ',
  INSIGHTS_READ = 'INSIGHTS_READ',
  METRICS_READ = 'METRICS_READ',
  
  // Messaging
  DM_READ = 'DM_READ',
  DM_SEND = 'DM_SEND',
  
  // TikTok Specific
  TIKTOK_VIDEO_CREATE = 'TIKTOK_VIDEO_CREATE',
  TIKTOK_LIVE_CREATE = 'TIKTOK_LIVE_CREATE',
  TIKTOK_ANALYTICS_READ = 'TIKTOK_ANALYTICS_READ',
  
  // Platform Management
  ACCOUNT_READ = 'ACCOUNT_READ',
  PROFILE_EDIT = 'PROFILE_EDIT',
  
  // Advanced Features
  CROSS_PLATFORM_COORDINATION = 'CROSS_PLATFORM_COORDINATION',
  CONTENT_OPTIMIZATION = 'CONTENT_OPTIMIZATION'
}

export enum AccessLevel {
  NONE = 'NONE',
  READ = 'READ', 
  LIMITED = 'LIMITED',
  FULL = 'FULL'
}

export interface SocialMediaConnection {
  id: string;                            // ULID
  userId: string;                        // ULID - User who owns connection
  organizationId?: string;               // ULID - Optional organization
  provider: SocialMediaProvider;         // Platform enum
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

export interface AgentSocialMediaPermission {
  id: string;                            // ULID
  agentId: string;                       // ULID - Agent with permission
  connectionId: string;                  // ULID - Social media connection
  capabilities: SocialMediaCapability[]; // Granted capabilities
  accessLevel: AccessLevel;              // Permission level
  restrictions: Record<string, unknown>; // Custom restrictions
  grantedBy: string;                     // ULID - User who granted permission
  grantedAt: Date;
  isActive: boolean;
  auditLog: AuditEntry[];               // Permission change history
}

export interface AuditEntry {
  id: string;                            // ULID
  action: string;                        // Action performed
  performedBy: string;                   // ULID - User who performed action
  performedAt: Date;
  details: Record<string, unknown>;      // Action details
  ipAddress?: string;
  userAgent?: string;
}

export interface SocialMediaAuditLog {
  id: string;                            // ULID
  timestamp: Date;
  agentId?: string;                      // ULID - Optional for system actions
  connectionId: string;                  // ULID
  action: 'post' | 'schedule' | 'delete' | 'authenticate' | 'permission_grant' | 'permission_revoke';
  platform: SocialMediaProvider;
  content?: {
    text?: string;
    hashtags?: string[];
    media?: string[];
    targetAudience?: string;
  };
  result: 'success' | 'failure' | 'pending';
  error?: string;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, unknown>;
}

// NEW: Draft post interfaces
export interface DraftPost {
  id: string;                            // Platform's draft ID
  platform: SocialMediaProvider;
  title?: string;                        // Draft title/name
  content: string;
  media?: MediaFile[];
  hashtags?: string[];
  mentions?: string[];
  visibility?: 'public' | 'private' | 'unlisted';
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;    // Platform-specific data
}

export interface DraftPublishParams {
  draftId: string;
  scheduledTime?: Date;
  overrides?: {
    content?: string;
    hashtags?: string[];
    visibility?: 'public' | 'private' | 'unlisted';
  };
}

// Database abstraction interface following workspace pattern
export interface ISocialMediaDatabase {
  // Connection Management
  createConnection(connection: Omit<SocialMediaConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<SocialMediaConnection>;
  getConnection(connectionId: string): Promise<SocialMediaConnection | null>;
  getConnectionsByUser(userId: string): Promise<SocialMediaConnection[]>;
  getConnectionsByOrganization(organizationId: string): Promise<SocialMediaConnection[]>;
  updateConnection(connectionId: string, updates: Partial<SocialMediaConnection>): Promise<SocialMediaConnection>;
  deleteConnection(connectionId: string): Promise<void>;
  validateConnection(connectionId: string): Promise<boolean>;
  
  // Permission Management
  grantPermission(permission: Omit<AgentSocialMediaPermission, 'id' | 'grantedAt' | 'auditLog'>): Promise<AgentSocialMediaPermission>;
  revokePermission(permissionId: string): Promise<void>;
  getAgentPermissions(agentId: string): Promise<AgentSocialMediaPermission[]>;
  getConnectionPermissions(connectionId: string): Promise<AgentSocialMediaPermission[]>;
  updatePermission(permissionId: string, updates: Partial<AgentSocialMediaPermission>): Promise<AgentSocialMediaPermission>;
  validatePermissions(agentId: string, connectionId: string, requiredCapabilities: SocialMediaCapability[]): Promise<boolean>;
  
  // Audit Logging
  logAction(logEntry: Omit<SocialMediaAuditLog, 'id'>): Promise<SocialMediaAuditLog>;
  getAuditLogs(filters: {
    agentId?: string;
    connectionId?: string;
    platform?: SocialMediaProvider;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<SocialMediaAuditLog[]>;
  
  // Health & Monitoring
  getConnectionHealth(): Promise<{
    totalConnections: number;
    activeConnections: number;
    expiredConnections: number;
    errorConnections: number;
    byProvider: Record<SocialMediaProvider, number>;
  }>;
  
  // Cleanup & Maintenance
  cleanupExpiredConnections(): Promise<number>;
  rotateEncryptionKeys(): Promise<void>;
}

// Utility functions following IMPLEMENTATION_GUIDELINES.md
export class SocialMediaIdGenerator {
  static generateConnectionId(): string {
    return ulid();
  }
  
  static generatePermissionId(): string {
    return ulid();
  }
  
  static generateAuditId(): string {
    return ulid();
  }
}

// Custom error types following guidelines
export class SocialMediaError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'SocialMediaError';
  }
}

export class SocialMediaConnectionError extends SocialMediaError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `SOCIAL_MEDIA_CONNECTION_${code}`, context);
    this.name = 'SocialMediaConnectionError';
  }
}

export class SocialMediaPermissionError extends SocialMediaError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `SOCIAL_MEDIA_PERMISSION_${code}`, context);
    this.name = 'SocialMediaPermissionError';
  }
} 