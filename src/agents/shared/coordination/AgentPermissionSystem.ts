/**
 * AgentPermissionSystem.ts - Cross-agent permission system
 * 
 * This module provides a comprehensive permission system for controlling
 * access between agents. It integrates with the memory isolation and
 * capability discovery systems.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  CapabilityAccessMode, 
  CapabilityInstance,
  CapabilityType, 
  CapabilityGrant 
} from '../capability-system/CapabilityDiscovery';
import { MemoryPermission } from '../memory/MemoryScope';

/**
 * Permission scope for agent permissions
 */
export enum PermissionScope {
  /**
   * Access to agent memory
   */
  MEMORY = 'memory',
  
  /**
   * Access to agent capabilities
   */
  CAPABILITY = 'capability',
  
  /**
   * Access to agent messaging
   */
  MESSAGING = 'messaging',
  
  /**
   * Access to agent resources
   */
  RESOURCE = 'resource',
  
  /**
   * Access to agent configuration
   */
  CONFIGURATION = 'configuration'
}

/**
 * Permission access level
 */
export enum PermissionLevel {
  /**
   * No access
   */
  NONE = 'none',
  
  /**
   * Read-only access
   */
  READ = 'read',
  
  /**
   * Limited access
   */
  LIMITED = 'limited',
  
  /**
   * Full access
   */
  FULL = 'full'
}

/**
 * Permission type
 */
export interface Permission {
  /**
   * Unique identifier for the permission
   */
  id: string;
  
  /**
   * ID of the agent this permission is for
   */
  agentId: string;
  
  /**
   * ID of the agent that granted this permission
   */
  grantedById: string;
  
  /**
   * Scope of the permission
   */
  scope: PermissionScope;
  
  /**
   * Access level for this permission
   */
  level: PermissionLevel;
  
  /**
   * Target ID within the scope (e.g., memory scope ID, capability ID)
   */
  targetId?: string;
  
  /**
   * When the permission was created
   */
  createdAt: Date;
  
  /**
   * When the permission expires
   */
  expiresAt?: Date;
  
  /**
   * Additional constraints on the permission
   */
  constraints?: Record<string, unknown>;
}

/**
 * Permission rule for evaluating access
 */
export interface PermissionRule {
  /**
   * Unique identifier for the rule
   */
  id: string;
  
  /**
   * Name of the rule
   */
  name: string;
  
  /**
   * Description of what the rule does
   */
  description: string;
  
  /**
   * Priority of the rule (higher numbers are evaluated first)
   */
  priority: number;
  
  /**
   * Function that evaluates the rule
   */
  evaluate: (context: PermissionContext) => Promise<PermissionRuleResult>;
  
  /**
   * Whether this rule is enabled
   */
  enabled: boolean;
}

/**
 * Context for permission evaluation
 */
export interface PermissionContext {
  /**
   * ID of the agent requesting access
   */
  requestingAgentId: string;
  
  /**
   * ID of the agent that owns the resource
   */
  ownerAgentId: string;
  
  /**
   * Scope of the permission
   */
  scope: PermissionScope;
  
  /**
   * Target ID within the scope
   */
  targetId?: string;
  
  /**
   * Requested access level
   */
  requestedLevel: PermissionLevel;
  
  /**
   * Additional context for the request
   */
  context?: Record<string, unknown>;
}

/**
 * Result of a permission rule evaluation
 */
export interface PermissionRuleResult {
  /**
   * Whether the permission is allowed
   */
  allowed: boolean;
  
  /**
   * Reason for the decision
   */
  reason?: string;
  
  /**
   * Constraints to apply to the permission
   */
  constraints?: Record<string, unknown>;
  
  /**
   * Whether this is a final decision (overrides other rules)
   */
  final: boolean;
}

/**
 * Request for a permission
 */
export interface PermissionRequest {
  /**
   * Unique identifier for the request
   */
  id: string;
  
  /**
   * ID of the agent requesting the permission
   */
  requestingAgentId: string;
  
  /**
   * ID of the agent that owns the resource
   */
  ownerAgentId: string;
  
  /**
   * Scope of the permission
   */
  scope: PermissionScope;
  
  /**
   * Target ID within the scope
   */
  targetId?: string;
  
  /**
   * Requested access level
   */
  requestedLevel: PermissionLevel;
  
  /**
   * Reason for the request
   */
  reason?: string;
  
  /**
   * Context for the request
   */
  context?: Record<string, unknown>;
  
  /**
   * Current status of the request
   */
  status: 'pending' | 'approved' | 'denied' | 'expired';
  
  /**
   * When the request was created
   */
  createdAt: Date;
  
  /**
   * When the request expires
   */
  expiresAt?: Date;
  
  /**
   * When the request was responded to
   */
  respondedAt?: Date;
  
  /**
   * Reason for denial (if denied)
   */
  denialReason?: string;
  
  /**
   * Granted access level (if approved, might be different from requested)
   */
  grantedLevel?: PermissionLevel;
  
  /**
   * ID of the permission that was created (if approved)
   */
  permissionId?: string;
  
  /**
   * Constraints on the granted permission
   */
  constraints?: Record<string, unknown>;
}

/**
 * Agent permission system
 */
export class AgentPermissionSystem {
  /**
   * ID of the agent this permission system belongs to
   */
  private readonly agentId: string;
  
  /**
   * Permissions granted to other agents
   */
  private readonly outgoingPermissions: Map<string, Permission> = new Map();
  
  /**
   * Permissions received from other agents
   */
  private readonly incomingPermissions: Map<string, Permission> = new Map();
  
  /**
   * Permission rules
   */
  private readonly rules: PermissionRule[] = [];
  
  /**
   * Outgoing permission requests
   */
  private readonly outgoingRequests: Map<string, PermissionRequest> = new Map();
  
  /**
   * Incoming permission requests
   */
  private readonly incomingRequests: Map<string, PermissionRequest> = new Map();
  
  /**
   * Create a new agent permission system
   */
  constructor(agentId: string) {
    this.agentId = agentId;
    this.registerDefaultRules();
  }
  
  /**
   * Register default permission rules
   */
  private registerDefaultRules(): void {
    // Rule: Owner always has full access to their own resources
    this.addRule({
      id: 'owner-full-access',
      name: 'Owner Full Access',
      description: 'Owners always have full access to their own resources',
      priority: 1000,
      enabled: true,
      evaluate: async (context: PermissionContext): Promise<PermissionRuleResult> => {
        if (context.requestingAgentId === context.ownerAgentId) {
          return {
            allowed: true,
            reason: 'Owner has full access to own resources',
            final: true
          };
        }
        
        return {
          allowed: false,
          final: false
        };
      }
    });
    
    // Rule: Deny access if no explicit permission exists
    this.addRule({
      id: 'default-deny',
      name: 'Default Deny',
      description: 'Deny access if no explicit permission exists',
      priority: -1000, // Lowest priority, runs last
      enabled: true,
      evaluate: async (context: PermissionContext): Promise<PermissionRuleResult> => {
        return {
          allowed: false,
          reason: 'No explicit permission exists',
          final: true
        };
      }
    });
  }
  
  /**
   * Add a permission rule
   */
  addRule(rule: PermissionRule): void {
    this.rules.push(rule);
    
    // Sort rules by priority (highest first)
    this.rules.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Remove a rule
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(rule => rule.id === ruleId);
    
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    
    return false;
  }
  
  /**
   * Get rules
   */
  getRules(): PermissionRule[] {
    return [...this.rules];
  }
  
  /**
   * Enable or disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.find(r => r.id === ruleId);
    
    if (!rule) {
      return false;
    }
    
    rule.enabled = enabled;
    return true;
  }
  
  /**
   * Grant a permission to another agent
   */
  grantPermission(
    targetAgentId: string,
    scope: PermissionScope,
    level: PermissionLevel,
    options?: {
      targetId?: string;
      expiresIn?: number;
      constraints?: Record<string, unknown>;
    }
  ): Permission {
    const permissionId = uuidv4();
    const createdAt = new Date();
    const expiresAt = options?.expiresIn
      ? new Date(createdAt.getTime() + options.expiresIn)
      : undefined;
    
    const permission: Permission = {
      id: permissionId,
      agentId: targetAgentId,
      grantedById: this.agentId,
      scope,
      level,
      targetId: options?.targetId,
      createdAt,
      expiresAt,
      constraints: options?.constraints
    };
    
    this.outgoingPermissions.set(permissionId, permission);
    
    return permission;
  }
  
  /**
   * Revoke a permission
   */
  revokePermission(permissionId: string): boolean {
    return this.outgoingPermissions.delete(permissionId);
  }
  
  /**
   * Handle an incoming permission grant
   */
  handlePermissionGrant(permission: Permission): void {
    // Validate the permission
    if (permission.agentId !== this.agentId) {
      throw new Error(`Permission agent ID ${permission.agentId} doesn't match this agent ID ${this.agentId}`);
    }
    
    // Check if already expired
    if (permission.expiresAt && permission.expiresAt < new Date()) {
      return;
    }
    
    // Store the permission
    this.incomingPermissions.set(permission.id, permission);
    
    // Find any matching request and update its status
    const outgoingRequestsEntries = Array.from(this.outgoingRequests.entries());
    for (const [requestId, request] of outgoingRequestsEntries) {
      if (
        request.status === 'pending' &&
        request.ownerAgentId === permission.grantedById &&
        request.scope === permission.scope &&
        (request.targetId === permission.targetId || !request.targetId)
      ) {
        request.status = 'approved';
        request.respondedAt = new Date();
        request.grantedLevel = permission.level;
        request.permissionId = permission.id;
        request.constraints = permission.constraints;
        
        this.outgoingRequests.set(requestId, request);
        break;
      }
    }
  }
  
  /**
   * Get all outgoing permissions
   */
  getOutgoingPermissions(options?: {
    agentId?: string;
    scope?: PermissionScope;
    targetId?: string;
    includeExpired?: boolean;
  }): Permission[] {
    const now = new Date();
    const permissions = Array.from(this.outgoingPermissions.values());
    
    return permissions.filter(permission => {
      // Check expiration
      if (!options?.includeExpired && permission.expiresAt && permission.expiresAt < now) {
        return false;
      }
      
      // Check agent ID
      if (options?.agentId && permission.agentId !== options.agentId) {
        return false;
      }
      
      // Check scope
      if (options?.scope && permission.scope !== options.scope) {
        return false;
      }
      
      // Check target ID
      if (options?.targetId && permission.targetId !== options.targetId) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Get all incoming permissions
   */
  getIncomingPermissions(options?: {
    grantedById?: string;
    scope?: PermissionScope;
    targetId?: string;
    includeExpired?: boolean;
  }): Permission[] {
    const now = new Date();
    const permissions = Array.from(this.incomingPermissions.values());
    
    return permissions.filter(permission => {
      // Check expiration
      if (!options?.includeExpired && permission.expiresAt && permission.expiresAt < now) {
        return false;
      }
      
      // Check granted by ID
      if (options?.grantedById && permission.grantedById !== options.grantedById) {
        return false;
      }
      
      // Check scope
      if (options?.scope && permission.scope !== options.scope) {
        return false;
      }
      
      // Check target ID
      if (options?.targetId && permission.targetId !== options.targetId) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Check if the agent has permission for a specific access
   */
  async hasPermission(
    ownerAgentId: string,
    scope: PermissionScope,
    level: PermissionLevel,
    options?: {
      targetId?: string;
      context?: Record<string, unknown>;
    }
  ): Promise<boolean> {
    // Create context for evaluation
    const context: PermissionContext = {
      requestingAgentId: this.agentId,
      ownerAgentId,
      scope,
      targetId: options?.targetId,
      requestedLevel: level,
      context: options?.context
    };
    
    // Evaluate rules
    const result = await this.evaluatePermission(context);
    return result.allowed;
  }
  
  /**
   * Evaluate permission against rules
   */
  async evaluatePermission(context: PermissionContext): Promise<PermissionRuleResult> {
    // First check if we're the owner
    if (context.requestingAgentId === context.ownerAgentId) {
      return {
        allowed: true,
        reason: 'Owner has full access',
        final: true
      };
    }
    
    // Find matching permissions
    const permissions = this.getIncomingPermissions({
      grantedById: context.ownerAgentId,
      scope: context.scope,
      targetId: context.targetId
    });
    
    // If we have an explicit permission, check it first
    if (permissions.length > 0) {
      // Get the highest level permission
      const highestPermission = permissions.reduce((highest, current) => {
        const levels = [
          PermissionLevel.NONE,
          PermissionLevel.READ,
          PermissionLevel.LIMITED,
          PermissionLevel.FULL
        ];
        
        const highestLevel = levels.indexOf(highest.level);
        const currentLevel = levels.indexOf(current.level);
        
        return currentLevel > highestLevel ? current : highest;
      }, permissions[0]);
      
      // Check if the permission covers the requested level
      const requestedLevel = levels.indexOf(context.requestedLevel);
      const permissionLevel = levels.indexOf(highestPermission.level);
      
      if (permissionLevel >= requestedLevel) {
        return {
          allowed: true,
          reason: `Explicit permission grants ${highestPermission.level} access`,
          constraints: highestPermission.constraints,
          final: true
        };
      }
    }
    
    // Evaluate rules in priority order
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      
      const result = await rule.evaluate(context);
      
      if (result.final) {
        return result;
      }
    }
    
    // Default to deny if no rules made a final decision
    return {
      allowed: false,
      reason: 'No rule granted permission',
      final: true
    };
  }
  
  /**
   * Request a permission from another agent
   */
  requestPermission(
    ownerAgentId: string,
    scope: PermissionScope,
    level: PermissionLevel,
    options?: {
      targetId?: string;
      reason?: string;
      context?: Record<string, unknown>;
      expiresIn?: number;
    }
  ): string {
    const requestId = uuidv4();
    const createdAt = new Date();
    const expiresAt = options?.expiresIn
      ? new Date(createdAt.getTime() + options.expiresIn)
      : undefined;
    
    const request: PermissionRequest = {
      id: requestId,
      requestingAgentId: this.agentId,
      ownerAgentId,
      scope,
      targetId: options?.targetId,
      requestedLevel: level,
      reason: options?.reason,
      context: options?.context,
      status: 'pending',
      createdAt,
      expiresAt
    };
    
    this.outgoingRequests.set(requestId, request);
    
    // In a real implementation, this would send the request to the other agent
    
    return requestId;
  }
  
  /**
   * Handle an incoming permission request
   */
  async handlePermissionRequest(request: PermissionRequest): Promise<void> {
    // Validate the request
    if (request.ownerAgentId !== this.agentId) {
      throw new Error(`Request owner ID ${request.ownerAgentId} doesn't match this agent ID ${this.agentId}`);
    }
    
    // Check if already expired
    if (request.expiresAt && request.expiresAt < new Date()) {
      request.status = 'expired';
    }
    
    // Store the request
    this.incomingRequests.set(request.id, request);
    
    // Auto-approve based on rules
    if (request.status === 'pending') {
      const context: PermissionContext = {
        requestingAgentId: request.requestingAgentId,
        ownerAgentId: this.agentId,
        scope: request.scope,
        targetId: request.targetId,
        requestedLevel: request.requestedLevel,
        context: request.context
      };
      
      const result = await this.evaluatePermission(context);
      
      if (result.allowed) {
        await this.respondToRequest(request.id, true, undefined, {
          grantedLevel: request.requestedLevel,
          constraints: result.constraints
        });
      }
    }
  }
  
  /**
   * Get pending requests
   */
  getPendingRequests(): PermissionRequest[] {
    return Array.from(this.incomingRequests.values())
      .filter(request => request.status === 'pending');
  }
  
  /**
   * Respond to a permission request
   */
  async respondToRequest(
    requestId: string,
    approve: boolean,
    reason?: string,
    options?: {
      grantedLevel?: PermissionLevel;
      constraints?: Record<string, unknown>;
      expiresIn?: number;
    }
  ): Promise<boolean> {
    const request = this.incomingRequests.get(requestId);
    
    if (!request) {
      return false;
    }
    
    if (request.status !== 'pending') {
      return false;
    }
    
    // Update request
    request.status = approve ? 'approved' : 'denied';
    request.respondedAt = new Date();
    
    if (approve) {
      request.grantedLevel = options?.grantedLevel ?? request.requestedLevel;
      request.constraints = options?.constraints;
      
      // Create permission
      const permission = this.grantPermission(
        request.requestingAgentId,
        request.scope,
        request.grantedLevel,
        {
          targetId: request.targetId,
          expiresIn: options?.expiresIn,
          constraints: request.constraints
        }
      );
      
      request.permissionId = permission.id;
    } else {
      request.denialReason = reason;
    }
    
    this.incomingRequests.set(requestId, request);
    
    // Notify the other agent
    // In a real implementation, this would send the response to the other agent
    
    return true;
  }
  
  /**
   * Maps a memory permission to a permission level
   */
  static mapMemoryPermissionToLevel(permission: MemoryPermission): PermissionLevel {
    switch (permission) {
      case MemoryPermission.READ:
        return PermissionLevel.READ;
      case MemoryPermission.WRITE:
      case MemoryPermission.UPDATE:
      case MemoryPermission.DELETE:
        return PermissionLevel.LIMITED;
      case MemoryPermission.SHARE:
        return PermissionLevel.FULL;
      default:
        return PermissionLevel.NONE;
    }
  }
  
  /**
   * Maps a capability access mode to a permission level
   */
  static mapCapabilityAccessToLevel(accessMode: CapabilityAccessMode): PermissionLevel {
    switch (accessMode) {
      case CapabilityAccessMode.READ:
        return PermissionLevel.READ;
      case CapabilityAccessMode.EXECUTE:
        return PermissionLevel.LIMITED;
      case CapabilityAccessMode.FULL:
        return PermissionLevel.FULL;
      default:
        return PermissionLevel.NONE;
    }
  }
}

// Helper for the Permission level comparison
const levels = [
  PermissionLevel.NONE,
  PermissionLevel.READ,
  PermissionLevel.LIMITED,
  PermissionLevel.FULL
]; 