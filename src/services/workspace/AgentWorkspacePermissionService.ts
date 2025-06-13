import { DatabaseService } from '../database/DatabaseService';
import { IDatabaseProvider } from '../database/IDatabaseProvider';
import { 
  WorkspaceCapabilityType, 
  AgentWorkspacePermission, 
  WorkspaceConnection,
  AccessLevel,
  WorkspaceAction,
  ActionResult
} from '../database/types';

export interface GrantPermissionParams {
  agentId: string;
  workspaceConnectionId: string;
  capability: WorkspaceCapabilityType;
  accessLevel: AccessLevel;
  restrictions?: Record<string, any>;
  grantedBy: string;
  justification?: string;
}

export interface PermissionValidationResult {
  isValid: boolean;
  permission?: AgentWorkspacePermission;
  error?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: Date;
}

export interface AgentWorkspaceCapability {
  capability: WorkspaceCapabilityType;
  accessLevel: AccessLevel;
  connectionId: string;
  connectionName: string;
  provider: string;
  restrictions?: Record<string, any>;
}

export class AgentWorkspacePermissionService {
  private db: IDatabaseProvider;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Grant workspace permission to an agent
   */
  async grantPermission(params: GrantPermissionParams): Promise<AgentWorkspacePermission> {
    // Validate that the workspace connection exists and is active
    const connection = await this.db.getWorkspaceConnection(params.workspaceConnectionId);
    if (!connection || connection.status !== 'ACTIVE') {
      throw new Error('Workspace connection not found or inactive');
    }

    // Check if permission already exists
    const existingPermissions = await this.db.findAgentWorkspacePermissions({
      agentId: params.agentId,
      workspaceConnectionId: params.workspaceConnectionId,
      capability: params.capability
    });

    if (existingPermissions.length > 0) {
      // Update existing permission
      const existingPermission = existingPermissions[0];
      return await this.db.updateAgentWorkspacePermission(existingPermission.id, {
        accessLevel: params.accessLevel,
        restrictions: params.restrictions ? JSON.stringify(params.restrictions) : undefined,
        revokedAt: undefined // Clear any previous revocation
      });
    }

    // Create new permission
    const permission = await this.db.createAgentWorkspacePermission({
      agentId: params.agentId,
      workspaceConnectionId: params.workspaceConnectionId,
      capability: params.capability,
      accessLevel: params.accessLevel,
      restrictions: params.restrictions ? JSON.stringify(params.restrictions) : undefined,
      grantedBy: params.grantedBy
    });

    // Log audit event
    await this.logPermissionEvent(WorkspaceAction.ACCESS_GRANTED, params.agentId, params.workspaceConnectionId, params.capability);

    return permission;
  }

  /**
   * Revoke workspace permission from an agent
   */
  async revokePermission(permissionId: string, revokedBy: string): Promise<void> {
    const permission = await this.db.getAgentWorkspacePermission(permissionId);
    if (!permission) {
      throw new Error('Permission not found');
    }

    await this.db.updateAgentWorkspacePermission(permissionId, {
      revokedAt: new Date()
    });

    // Log audit event
    await this.logPermissionEvent(WorkspaceAction.ACCESS_REVOKED, permission.agentId, permission.workspaceConnectionId, permission.capability);
  }

  /**
   * Check if an agent has permission for a specific capability
   */
  async validatePermissions(
    agentId: string, 
    capability: WorkspaceCapabilityType, 
    connectionId: string
  ): Promise<PermissionValidationResult> {
    const permissions = await this.db.findAgentWorkspacePermissions({
      agentId,
      workspaceConnectionId: connectionId,
      capability
    });

    const activePermission = permissions.find(p => !p.revokedAt);
    
    if (!activePermission) {
      return {
        isValid: false,
        error: `Agent ${agentId} does not have ${capability} permission for connection ${connectionId}`
      };
    }

    // Check if the workspace connection is still active
    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection || connection.status !== 'ACTIVE') {
      return {
        isValid: false,
        error: 'Workspace connection is not active'
      };
    }

    // Update last used timestamp
    await this.db.updateAgentWorkspacePermission(activePermission.id, {
      lastUsedAt: new Date()
    });

    return {
      isValid: true,
      permission: activePermission
    };
  }

  /**
   * Get all workspace capabilities for an agent
   */
  async getAgentWorkspaceCapabilities(agentId: string): Promise<AgentWorkspaceCapability[]> {
    const permissions = await this.db.findAgentWorkspacePermissions({ agentId });
    const activePermissions = permissions.filter(p => !p.revokedAt);

    const capabilities: AgentWorkspaceCapability[] = [];

    for (const permission of activePermissions) {
      const connection = await this.db.getWorkspaceConnection(permission.workspaceConnectionId);
      if (connection && connection.status === 'ACTIVE') {
        capabilities.push({
          capability: permission.capability as WorkspaceCapabilityType,
          accessLevel: permission.accessLevel as AccessLevel,
          connectionId: permission.workspaceConnectionId,
          connectionName: `${connection.displayName} (${connection.email})`,
          provider: connection.provider,
          restrictions: permission.restrictions ? JSON.parse(permission.restrictions) : undefined
        });
      }
    }

    return capabilities;
  }

  /**
   * Check rate limits for agent capability usage
   */
  async checkRateLimit(agentId: string, capability: WorkspaceCapabilityType): Promise<RateLimitResult> {
    // TODO: Implement rate limiting logic
    // For now, return unlimited access
    return {
      allowed: true,
      remainingRequests: 1000,
      resetTime: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
    };
  }

  /**
   * Get all agents with permissions for a specific workspace connection
   */
  async getConnectionAgents(connectionId: string): Promise<string[]> {
    const permissions = await this.db.findAgentWorkspacePermissions({ 
      workspaceConnectionId: connectionId 
    });
    
    const activePermissions = permissions.filter(p => !p.revokedAt);
    const agentIds = [...new Set(activePermissions.map(p => p.agentId))];
    
    return agentIds;
  }

  /**
   * Bulk revoke all permissions for a workspace connection
   */
  async revokeAllConnectionPermissions(connectionId: string, revokedBy: string): Promise<void> {
    const permissions = await this.db.findAgentWorkspacePermissions({ 
      workspaceConnectionId: connectionId 
    });
    
    const activePermissions = permissions.filter(p => !p.revokedAt);
    
    for (const permission of activePermissions) {
      await this.revokePermission(permission.id, revokedBy);
    }
  }

  /**
   * Log permission-related audit events
   */
  private async logPermissionEvent(
    action: WorkspaceAction,
    agentId: string,
    connectionId: string,
    capability: WorkspaceCapabilityType
  ): Promise<void> {
    try {
      await this.db.createWorkspaceAuditLog({
        workspaceConnectionId: connectionId,
        agentId,
        action,
        capability,
        result: ActionResult.SUCCESS,
        metadata: JSON.stringify({
          timestamp: new Date().toISOString(),
          capability
        })
      });
    } catch (error) {
      console.error('Failed to log permission event:', error);
      // Don't throw - audit logging failure shouldn't break the main operation
    }
  }
} 