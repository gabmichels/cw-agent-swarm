/**
 * MemoryScope.ts - Interface for agent memory scoping and isolation
 * 
 * This module defines the interfaces and types needed for implementing
 * agent memory isolation and controlled memory sharing between agents.
 */

/**
 * Access level for memory scoping
 */
export enum MemoryAccessLevel {
  /**
   * Memory is only accessible by the owner agent
   */
  PRIVATE = 'private',
  
  /**
   * Memory is accessible by the owner and explicitly granted agents
   */
  SHARED = 'shared',
  
  /**
   * Memory is accessible by all agents in the system
   */
  PUBLIC = 'public'
}

/**
 * Permission type for memory access
 */
export enum MemoryPermission {
  /**
   * Permission to read memory
   */
  READ = 'read',
  
  /**
   * Permission to write/create memory
   */
  WRITE = 'write',
  
  /**
   * Permission to update existing memory
   */
  UPDATE = 'update',
  
  /**
   * Permission to delete memory
   */
  DELETE = 'delete',
  
  /**
   * Permission to share memory with other agents
   */
  SHARE = 'share'
}

/**
 * Permission set for memory access
 */
export type MemoryPermissionSet = Set<MemoryPermission>;

/**
 * Memory scope identifier
 */
export interface MemoryScopeId {
  /**
   * Unique identifier for the scope
   */
  id: string;
  
  /**
   * Display name for the scope
   */
  name: string;
  
  /**
   * Description of the scope's purpose
   */
  description?: string;
}

/**
 * Access control policy for memory scopes
 */
export interface MemoryAccessPolicy {
  /**
   * Access level for the scope
   */
  accessLevel: MemoryAccessLevel;
  
  /**
   * Owner agent ID
   */
  ownerAgentId: string;
  
  /**
   * Map of agent IDs to their permissions
   * Only relevant for SHARED access level
   */
  agentPermissions?: Map<string, MemoryPermissionSet>;
  
  /**
   * Default permissions for agents not explicitly listed
   * Only relevant for PUBLIC access level
   */
  defaultPermissions?: MemoryPermissionSet;
  
  /**
   * Whether to require explicit acknowledgment when sharing memory
   */
  requireAcknowledgment?: boolean;
}

/**
 * Memory scope definition
 */
export interface MemoryScope {
  /**
   * Scope identifier
   */
  scopeId: MemoryScopeId;
  
  /**
   * Access control policy
   */
  accessPolicy: MemoryAccessPolicy;
  
  /**
   * Memory types allowed in this scope
   * If undefined, all memory types are allowed
   */
  allowedMemoryTypes?: string[];
  
  /**
   * Creation timestamp
   */
  createdAt: Date;
  
  /**
   * Last modified timestamp
   */
  updatedAt: Date;
  
  /**
   * Optional metadata for the scope
   */
  metadata?: Record<string, unknown>;
}

/**
 * Memory scope creation options
 */
export interface MemoryScopeCreationOptions {
  /**
   * Name for the scope
   */
  name: string;
  
  /**
   * Description of the scope's purpose
   */
  description?: string;
  
  /**
   * Access level for the scope
   */
  accessLevel: MemoryAccessLevel;
  
  /**
   * Owner agent ID
   */
  ownerAgentId: string;
  
  /**
   * Map of agent IDs to their permissions
   * Only relevant for SHARED access level
   */
  agentPermissions?: Map<string, MemoryPermissionSet>;
  
  /**
   * Default permissions for agents not explicitly listed
   * Only relevant for PUBLIC access level
   */
  defaultPermissions?: MemoryPermissionSet;
  
  /**
   * Memory types allowed in this scope
   */
  allowedMemoryTypes?: string[];
  
  /**
   * Whether to require explicit acknowledgment when sharing memory
   */
  requireAcknowledgment?: boolean;
  
  /**
   * Optional metadata for the scope
   */
  metadata?: Record<string, unknown>;
}

/**
 * Memory request result with access information
 */
export interface MemoryAccessResult<T> {
  /**
   * Whether access was granted
   */
  granted: boolean;
  
  /**
   * The result value if access was granted
   */
  value?: T;
  
  /**
   * The scope that was accessed
   */
  scope?: MemoryScope;
  
  /**
   * Reason why access was denied, if applicable
   */
  deniedReason?: string;
  
  /**
   * Timestamp of the access request
   */
  timestamp: Date;
}

/**
 * Memory access metrics for monitoring
 */
export interface MemoryAccessMetrics {
  /**
   * Total number of access requests
   */
  totalRequests: number;
  
  /**
   * Number of granted requests
   */
  grantedRequests: number;
  
  /**
   * Number of denied requests
   */
  deniedRequests: number;
  
  /**
   * Map of agent IDs to their access counts
   */
  accessByAgent: Map<string, number>;
  
  /**
   * Map of scope IDs to their access counts
   */
  accessByScope: Map<string, number>;
}

/**
 * Memory sharing request between agents
 */
export interface MemorySharingRequest {
  /**
   * Unique request ID
   */
  requestId: string;
  
  /**
   * ID of the agent requesting to share memory
   */
  requestingAgentId: string;
  
  /**
   * ID of the agent receiving the shared memory
   */
  targetAgentId: string;
  
  /**
   * ID of the scope containing the memories to share
   */
  scopeId: string;
  
  /**
   * Optional list of specific memory IDs to share
   * If undefined, all memories in the scope are shared
   */
  memoryIds?: string[];
  
  /**
   * Permissions to grant to the target agent
   */
  permissionsToGrant: MemoryPermissionSet;
  
  /**
   * Status of the request
   */
  status: 'pending' | 'approved' | 'denied' | 'expired';
  
  /**
   * Creation timestamp
   */
  createdAt: Date;
  
  /**
   * Response timestamp
   */
  respondedAt?: Date;
  
  /**
   * Expiration timestamp
   */
  expiresAt?: Date;
  
  /**
   * Reason for approval or denial
   */
  responseReason?: string;
}

/**
 * Creates a new set of permissions with the specified permissions
 */
export function createPermissionSet(...permissions: MemoryPermission[]): MemoryPermissionSet {
  return new Set(permissions);
}

/**
 * Creates a read-only permission set
 */
export function createReadOnlyPermissionSet(): MemoryPermissionSet {
  return createPermissionSet(MemoryPermission.READ);
}

/**
 * Creates a read-write permission set
 */
export function createReadWritePermissionSet(): MemoryPermissionSet {
  return createPermissionSet(
    MemoryPermission.READ,
    MemoryPermission.WRITE,
    MemoryPermission.UPDATE
  );
}

/**
 * Creates a full permission set
 */
export function createFullPermissionSet(): MemoryPermissionSet {
  return createPermissionSet(
    MemoryPermission.READ,
    MemoryPermission.WRITE,
    MemoryPermission.UPDATE,
    MemoryPermission.DELETE,
    MemoryPermission.SHARE
  );
} 