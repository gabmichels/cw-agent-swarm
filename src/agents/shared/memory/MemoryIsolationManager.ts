/**
 * MemoryIsolationManager.ts - Manager for agent memory isolation
 * 
 * This module provides a manager for handling memory isolation and controlled
 * sharing between agents. It enforces access controls and maintains memory
 * boundaries.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  MemoryScope,
  MemoryScopeCreationOptions,
  MemoryAccessLevel,
  MemoryPermission,
  MemoryPermissionSet,
  MemoryAccessResult,
  MemorySharingRequest,
  MemoryAccessMetrics,
  createReadOnlyPermissionSet,
  createFullPermissionSet
} from './MemoryScope';

/**
 * Configuration options for memory isolation manager
 */
export interface MemoryIsolationConfig {
  /**
   * Whether to enable agent memory isolation
   */
  enableIsolation: boolean;
  
  /**
   * Whether to create a default public scope
   */
  createDefaultPublicScope: boolean;
  
  /**
   * Default name for the public scope
   */
  defaultPublicScopeName: string;
  
  /**
   * Whether to require acknowledgment for memory sharing
   */
  requireSharingAcknowledgment: boolean;
  
  /**
   * Default timeout in milliseconds for sharing requests
   */
  sharingRequestTimeoutMs: number;
  
  /**
   * Default scope creation settings
   */
  defaultScopeSettings: {
    /**
     * Default access level for new scopes
     */
    accessLevel: MemoryAccessLevel;
    
    /**
     * Default permissions to grant for public scopes
     */
    publicPermissions: MemoryPermission[];
  };
  
  /**
   * Whether to track access metrics
   */
  trackAccessMetrics: boolean;
}

/**
 * Default memory isolation configuration
 */
export const DEFAULT_MEMORY_ISOLATION_CONFIG: MemoryIsolationConfig = {
  enableIsolation: true,
  createDefaultPublicScope: true,
  defaultPublicScopeName: 'shared',
  requireSharingAcknowledgment: true,
  sharingRequestTimeoutMs: 1000 * 60 * 60 * 24, // 24 hours
  defaultScopeSettings: {
    accessLevel: MemoryAccessLevel.PRIVATE,
    publicPermissions: [MemoryPermission.READ]
  },
  trackAccessMetrics: true
};

/**
 * Manages memory isolation and controlled sharing between agents
 */
export class MemoryIsolationManager {
  private config: MemoryIsolationConfig;
  private scopes: Map<string, MemoryScope> = new Map();
  private agentScopes: Map<string, Set<string>> = new Map();
  private sharingRequests: Map<string, MemorySharingRequest> = new Map();
  private metrics: MemoryAccessMetrics = {
    totalRequests: 0,
    grantedRequests: 0,
    deniedRequests: 0,
    accessByAgent: new Map(),
    accessByScope: new Map()
  };
  
  /**
   * Creates a new memory isolation manager
   * @param config Configuration options
   */
  constructor(config: Partial<MemoryIsolationConfig> = {}) {
    this.config = {
      ...DEFAULT_MEMORY_ISOLATION_CONFIG,
      ...config
    };
    
    // Initialize the manager
    this.initialize();
  }
  
  /**
   * Initializes the manager
   */
  private initialize(): void {
    // Create default public scope if enabled
    if (this.config.createDefaultPublicScope) {
      const defaultPublicScope = this.createScope({
        name: this.config.defaultPublicScopeName,
        description: 'Default shared memory space accessible by all agents',
        accessLevel: MemoryAccessLevel.PUBLIC,
        ownerAgentId: 'system',
        defaultPermissions: new Set(this.config.defaultScopeSettings.publicPermissions)
      });
      
      console.log(`Created default public scope: ${defaultPublicScope.scopeId.id} (${defaultPublicScope.scopeId.name})`);
    }
  }
  
  /**
   * Creates a new memory scope
   * @param options Scope creation options
   * @returns The created scope
   */
  createScope(options: MemoryScopeCreationOptions): MemoryScope {
    // Generate a unique scope ID
    const scopeId = {
      id: `scope_${uuidv4()}`,
      name: options.name,
      description: options.description
    };
    
    // Create the access policy
    const accessPolicy = {
      accessLevel: options.accessLevel,
      ownerAgentId: options.ownerAgentId,
      agentPermissions: options.agentPermissions || new Map(),
      defaultPermissions: options.defaultPermissions || new Set(),
      requireAcknowledgment: options.requireAcknowledgment ?? this.config.requireSharingAcknowledgment
    };
    
    // Create the scope
    const newScope: MemoryScope = {
      scopeId,
      accessPolicy,
      allowedMemoryTypes: options.allowedMemoryTypes,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: options.metadata || {}
    };
    
    // Store the scope
    this.scopes.set(scopeId.id, newScope);
    
    // Associate the scope with the owner agent
    this.addAgentToScope(options.ownerAgentId, scopeId.id);
    
    // If the scope is shared, add it to the specified agents
    if (options.accessLevel === MemoryAccessLevel.SHARED && options.agentPermissions) {
      // Convert to array before iterating
      const agentIds = Array.from(options.agentPermissions.keys());
      for (const agentId of agentIds) {
        this.addAgentToScope(agentId, scopeId.id);
      }
    }
    
    return newScope;
  }
  
  /**
   * Associates an agent with a scope
   * @param agentId The agent ID
   * @param scopeId The scope ID
   */
  private addAgentToScope(agentId: string, scopeId: string): void {
    // Get or create the agent's scope set
    const agentScopeSet = this.agentScopes.get(agentId) || new Set<string>();
    
    // Add the scope to the agent's scope set
    agentScopeSet.add(scopeId);
    
    // Store the updated scope set
    this.agentScopes.set(agentId, agentScopeSet);
  }
  
  /**
   * Gets all scopes for an agent
   * @param agentId The agent ID
   * @returns The scopes the agent has access to
   */
  getScopesForAgent(agentId: string): MemoryScope[] {
    const result: MemoryScope[] = [];
    
    // Get the agent's scope set
    const agentScopeSet = this.agentScopes.get(agentId);
    
    // If the agent has explicit scopes, add them
    if (agentScopeSet) {
      // Convert to array before iterating
      const scopeIds = Array.from(agentScopeSet);
      for (const scopeId of scopeIds) {
        const scope = this.scopes.get(scopeId);
        if (scope) {
          result.push(scope);
        }
      }
    }
    
    // Add public scopes that the agent doesn't already have
    // Convert to array before iterating
    const allScopes = Array.from(this.scopes.values());
    for (const scope of allScopes) {
      // Only add public scopes that aren't already in the result
      if (scope.accessPolicy.accessLevel === MemoryAccessLevel.PUBLIC && 
          !result.some(s => s.scopeId.id === scope.scopeId.id)) {
        
        // Register the agent with this public scope to ensure proper access tracking
        this.addAgentToScope(agentId, scope.scopeId.id);
        
        result.push(scope);
      }
    }
    
    return result;
  }
  
  /**
   * Checks if an agent has access to a scope
   * @param agentId The agent ID
   * @param scopeId The scope ID
   * @param requiredPermission The required permission
   * @returns Whether the agent has access
   */
  checkAccess(
    agentId: string,
    scopeId: string,
    requiredPermission: MemoryPermission
  ): MemoryAccessResult<boolean> {
    // Get the scope
    const scope = this.scopes.get(scopeId);
    
    // If the scope doesn't exist, deny access
    if (!scope) {
      return this.createDeniedResult(
        false,
        undefined,
        'Scope does not exist',
        agentId
      );
    }
    
    // If memory isolation is disabled, grant access
    if (!this.config.enableIsolation) {
      return this.createGrantedResult(true, scope, agentId);
    }
    
    // If the agent is the owner, grant access
    if (scope.accessPolicy.ownerAgentId === agentId) {
      return this.createGrantedResult(true, scope, agentId);
    }
    
    // Check access level
    switch (scope.accessPolicy.accessLevel) {
      case MemoryAccessLevel.PRIVATE:
        // Private scopes are only accessible by the owner
        return this.createDeniedResult(
          false,
          scope,
          'Private scope is only accessible by the owner',
          agentId
        );
        
      case MemoryAccessLevel.SHARED:
        // Shared scopes are accessible by specified agents
        const permissions = scope.accessPolicy.agentPermissions?.get(agentId);
        
        if (!permissions) {
          return this.createDeniedResult(
            false,
            scope,
            'Agent does not have explicit access to this shared scope',
            agentId
          );
        }
        
        const hasPermission = permissions.has(requiredPermission);
        
        if (!hasPermission) {
          return this.createDeniedResult(
            false,
            scope,
            `Agent does not have ${requiredPermission} permission on this scope`,
            agentId
          );
        }
        
        return this.createGrantedResult(true, scope, agentId);
        
      case MemoryAccessLevel.PUBLIC:
        // Public scopes are accessible by all agents with default permissions
        const defaultPermissions = scope.accessPolicy.defaultPermissions;
        
        if (!defaultPermissions) {
          return this.createDeniedResult(
            false,
            scope,
            'Public scope does not have default permissions set',
            agentId
          );
        }
        
        const hasDefaultPermission = defaultPermissions.has(requiredPermission);
        
        if (!hasDefaultPermission) {
          return this.createDeniedResult(
            false,
            scope,
            `Default permissions do not include ${requiredPermission} permission`,
            agentId
          );
        }
        
        return this.createGrantedResult(true, scope, agentId);
        
      default:
        return this.createDeniedResult(
          false,
          scope,
          'Unknown access level',
          agentId
        );
    }
  }
  
  /**
   * Creates a granted access result
   * @param value The result value
   * @param scope The accessed scope
   * @param requestingAgentId The agent ID requesting access
   * @returns The access result
   */
  private createGrantedResult<T>(value: T, scope: MemoryScope, requestingAgentId: string): MemoryAccessResult<T> {
    // Create the result
    const result: MemoryAccessResult<T> = {
      granted: true,
      value,
      scope,
      timestamp: new Date()
    };
    
    // Update metrics if tracking is enabled
    if (this.config.trackAccessMetrics) {
      this.updateMetrics(true, requestingAgentId, scope.scopeId.id);
    }
    
    return result;
  }
  
  /**
   * Creates a denied access result
   * @param value The result value
   * @param scope The accessed scope
   * @param reason The denial reason
   * @param requestingAgentId The agent ID requesting access
   * @returns The access result
   */
  private createDeniedResult<T>(
    value: T,
    scope: MemoryScope | undefined,
    reason: string,
    requestingAgentId?: string
  ): MemoryAccessResult<T> {
    // Create the result
    const result: MemoryAccessResult<T> = {
      granted: false,
      value,
      scope,
      deniedReason: reason,
      timestamp: new Date()
    };
    
    // Update metrics if tracking is enabled
    if (this.config.trackAccessMetrics && scope && requestingAgentId) {
      this.updateMetrics(false, requestingAgentId, scope.scopeId.id);
    }
    
    return result;
  }
  
  /**
   * Updates access metrics
   * @param granted Whether access was granted
   * @param agentId The agent ID
   * @param scopeId The scope ID
   */
  private updateMetrics(granted: boolean, agentId: string, scopeId: string): void {
    // Update total metrics
    this.metrics.totalRequests++;
    
    if (granted) {
      this.metrics.grantedRequests++;
    } else {
      this.metrics.deniedRequests++;
    }
    
    // Update agent metrics
    const agentCount = this.metrics.accessByAgent.get(agentId) || 0;
    this.metrics.accessByAgent.set(agentId, agentCount + 1);
    
    // Update scope metrics
    const scopeCount = this.metrics.accessByScope.get(scopeId) || 0;
    this.metrics.accessByScope.set(scopeId, scopeCount + 1);
  }
  
  /**
   * Creates a memory sharing request
   * @param requestingAgentId The requesting agent ID
   * @param targetAgentId The target agent ID
   * @param scopeId The scope ID
   * @param permissionsToGrant The permissions to grant
   * @param memoryIds Optional specific memory IDs to share
   * @returns The sharing request
   */
  createSharingRequest(
    requestingAgentId: string,
    targetAgentId: string,
    scopeId: string,
    permissionsToGrant: MemoryPermissionSet,
    memoryIds?: string[]
  ): MemorySharingRequest | null {
    // Get the scope
    const scope = this.scopes.get(scopeId);
    
    // If the scope doesn't exist, return null
    if (!scope) {
      console.warn(`Cannot create sharing request for non-existent scope: ${scopeId}`);
      return null;
    }
    
    // Check if the requesting agent is the owner or has SHARE permission
    const accessResult = this.checkAccess(
      requestingAgentId,
      scopeId,
      MemoryPermission.SHARE
    );
    
    if (!accessResult.granted) {
      console.warn(`Agent ${requestingAgentId} does not have permission to share scope ${scopeId}`);
      return null;
    }
    
    // Create the sharing request
    const request: MemorySharingRequest = {
      requestId: `share_${uuidv4()}`,
      requestingAgentId,
      targetAgentId,
      scopeId,
      memoryIds,
      permissionsToGrant,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.sharingRequestTimeoutMs)
    };
    
    // Store the request
    this.sharingRequests.set(request.requestId, request);
    
    return request;
  }
  
  /**
   * Responds to a memory sharing request
   * @param requestId The request ID
   * @param approved Whether the request is approved
   * @param reason Optional reason for the response
   * @returns Whether the response was processed
   */
  respondToSharingRequest(
    requestId: string,
    approved: boolean,
    reason?: string
  ): boolean {
    // Get the request
    const request = this.sharingRequests.get(requestId);
    
    // If the request doesn't exist, return false
    if (!request) {
      console.warn(`Cannot respond to non-existent sharing request: ${requestId}`);
      return false;
    }
    
    // If the request is not pending, return false
    if (request.status !== 'pending') {
      console.warn(`Cannot respond to ${request.status} sharing request: ${requestId}`);
      return false;
    }
    
    // Update the request
    request.status = approved ? 'approved' : 'denied';
    request.respondedAt = new Date();
    request.responseReason = reason;
    
    // If approved, grant the permissions
    if (approved) {
      this.grantPermissions(
        request.targetAgentId,
        request.scopeId,
        request.permissionsToGrant
      );
    }
    
    return true;
  }
  
  /**
   * Grants permissions to an agent for a scope
   * @param agentId The agent ID
   * @param scopeId The scope ID
   * @param permissions The permissions to grant
   * @returns Whether the permissions were granted
   */
  private grantPermissions(
    agentId: string,
    scopeId: string,
    permissions: MemoryPermissionSet
  ): boolean {
    // Get the scope
    const scope = this.scopes.get(scopeId);
    
    // If the scope doesn't exist, return false
    if (!scope) {
      console.warn(`Cannot grant permissions for non-existent scope: ${scopeId}`);
      return false;
    }
    
    // If the scope is not shared, return false
    if (scope.accessPolicy.accessLevel !== MemoryAccessLevel.SHARED) {
      console.warn(`Cannot grant permissions for non-shared scope: ${scopeId}`);
      return false;
    }
    
    // Initialize agentPermissions if it doesn't exist
    if (!scope.accessPolicy.agentPermissions) {
      scope.accessPolicy.agentPermissions = new Map();
    }
    
    // Get or create the agent's permission set
    const agentPermissions = scope.accessPolicy.agentPermissions.get(agentId) || new Set<MemoryPermission>();
    
    // Add the new permissions
    // Convert to array before iterating
    const permissionsArray = Array.from(permissions);
    for (const permission of permissionsArray) {
      agentPermissions.add(permission);
    }
    
    // Store the updated permission set
    scope.accessPolicy.agentPermissions.set(agentId, agentPermissions);
    
    // Add the agent to the scope
    this.addAgentToScope(agentId, scopeId);
    
    // Update the scope's updated timestamp
    scope.updatedAt = new Date();
    
    return true;
  }
  
  /**
   * Revokes permissions from an agent for a scope
   * @param agentId The agent ID
   * @param scopeId The scope ID
   * @param permissions The permissions to revoke
   * @returns Whether the permissions were revoked
   */
  revokePermissions(
    agentId: string,
    scopeId: string,
    permissions: MemoryPermissionSet
  ): boolean {
    // Get the scope
    const scope = this.scopes.get(scopeId);
    
    // If the scope doesn't exist, return false
    if (!scope) {
      console.warn(`Cannot revoke permissions for non-existent scope: ${scopeId}`);
      return false;
    }
    
    // If the scope is not shared, return false
    if (scope.accessPolicy.accessLevel !== MemoryAccessLevel.SHARED) {
      console.warn(`Cannot revoke permissions for non-shared scope: ${scopeId}`);
      return false;
    }
    
    // If the agent doesn't have permissions, return false
    if (!scope.accessPolicy.agentPermissions?.has(agentId)) {
      console.warn(`Agent ${agentId} does not have permissions for scope ${scopeId}`);
      return false;
    }
    
    // Get the agent's permission set
    const agentPermissions = scope.accessPolicy.agentPermissions.get(agentId)!;
    
    // Remove the specified permissions
    // Convert to array before iterating
    const permissionsArray = Array.from(permissions);
    for (const permission of permissionsArray) {
      agentPermissions.delete(permission);
    }
    
    // If the agent has no permissions left, remove them from the scope
    if (agentPermissions.size === 0) {
      scope.accessPolicy.agentPermissions.delete(agentId);
      
      // Remove the scope from the agent's scope set
      const agentScopeSet = this.agentScopes.get(agentId);
      if (agentScopeSet) {
        agentScopeSet.delete(scopeId);
        
        // If the agent has no scopes left, remove them from the agentScopes map
        if (agentScopeSet.size === 0) {
          this.agentScopes.delete(agentId);
        } else {
          this.agentScopes.set(agentId, agentScopeSet);
        }
      }
    } else {
      // Store the updated permission set
      scope.accessPolicy.agentPermissions.set(agentId, agentPermissions);
    }
    
    // Update the scope's updated timestamp
    scope.updatedAt = new Date();
    
    return true;
  }
  
  /**
   * Gets a scope by ID
   * @param scopeId The scope ID
   * @returns The scope, or undefined if it doesn't exist
   */
  getScope(scopeId: string): MemoryScope | undefined {
    return this.scopes.get(scopeId);
  }
  
  /**
   * Gets all scopes
   * @returns All scopes
   */
  getAllScopes(): MemoryScope[] {
    return Array.from(this.scopes.values());
  }
  
  /**
   * Gets access metrics
   * @returns The access metrics
   */
  getAccessMetrics(): MemoryAccessMetrics {
    return {
      totalRequests: this.metrics.totalRequests,
      grantedRequests: this.metrics.grantedRequests,
      deniedRequests: this.metrics.deniedRequests,
      accessByAgent: new Map(this.metrics.accessByAgent),
      accessByScope: new Map(this.metrics.accessByScope)
    };
  }
  
  /**
   * Gets all pending sharing requests for an agent
   * @param agentId The agent ID
   * @returns The pending sharing requests
   */
  getPendingSharingRequests(agentId: string): MemorySharingRequest[] {
    const result: MemorySharingRequest[] = [];
    
    // Check all sharing requests
    // Convert to array before iterating
    const requests = Array.from(this.sharingRequests.values());
    for (const request of requests) {
      // If the request is for the specified agent and is pending, add it to the result
      if (request.targetAgentId === agentId && request.status === 'pending') {
        result.push(request);
      }
    }
    
    return result;
  }
  
  /**
   * Gets all sharing requests created by an agent
   * @param agentId The agent ID
   * @returns The sharing requests
   */
  getCreatedSharingRequests(agentId: string): MemorySharingRequest[] {
    const result: MemorySharingRequest[] = [];
    
    // Check all sharing requests
    // Convert to array before iterating
    const requests = Array.from(this.sharingRequests.values());
    for (const request of requests) {
      // If the request was created by the specified agent, add it to the result
      if (request.requestingAgentId === agentId) {
        result.push(request);
      }
    }
    
    return result;
  }
  
  /**
   * Gets a sharing request by ID
   * @param requestId The request ID
   * @returns The sharing request, or undefined if it doesn't exist
   */
  getSharingRequest(requestId: string): MemorySharingRequest | undefined {
    return this.sharingRequests.get(requestId);
  }
  
  /**
   * Gets the agent IDs with access to a scope
   * @param scopeId The scope ID
   * @returns The agent IDs with access to the scope
   */
  getAgentsWithAccess(scopeId: string): string[] {
    const result: string[] = [];
    
    // Get the scope
    const scope = this.scopes.get(scopeId);
    
    // If the scope doesn't exist, return an empty array
    if (!scope) {
      return result;
    }
    
    // Add the owner
    result.push(scope.accessPolicy.ownerAgentId);
    
    // If the scope is shared, add all agents with permissions
    if (scope.accessPolicy.accessLevel === MemoryAccessLevel.SHARED &&
        scope.accessPolicy.agentPermissions) {
      // Convert to array before iterating
      const agentIds = Array.from(scope.accessPolicy.agentPermissions.keys());
      for (const agentId of agentIds) {
        if (!result.includes(agentId)) {
          result.push(agentId);
        }
      }
    }
    
    return result;
  }
} 