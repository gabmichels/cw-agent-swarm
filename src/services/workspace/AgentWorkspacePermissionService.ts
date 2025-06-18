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
import { 
  WorkspacePermissionError, 
  WorkspacePermissionErrorFactory, 
  WorkspaceErrorType 
} from './errors/WorkspacePermissionErrors';

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
  workspaceError?: WorkspacePermissionError;
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
    // Get the workspace connection first to provide better error context
    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      const workspaceError = WorkspacePermissionErrorFactory.createNoConnectionError(capability);
      return {
        isValid: false,
        error: workspaceError.message,
        workspaceError
      };
    }

    const connectionName = `${connection.displayName} (${connection.email})`;

    // Check if connection is active
    if (connection.status !== 'ACTIVE') {
      const workspaceError = WorkspacePermissionErrorFactory.createConnectionInactiveError(
        connectionId,
        connectionName,
        connection.status
      );
      return {
        isValid: false,
        error: workspaceError.message,
        workspaceError
      };
    }

    // Check for expired token
    if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
      const workspaceError = WorkspacePermissionErrorFactory.createExpiredTokenError(
        connectionId,
        connectionName,
        connection.provider
      );
      return {
        isValid: false,
        error: workspaceError.message,
        workspaceError
      };
    }

    // Check agent permissions
    const permissions = await this.db.findAgentWorkspacePermissions({
      agentId,
      workspaceConnectionId: connectionId,
      capability
    });

    const activePermission = permissions.find(p => !p.revokedAt);
    
    if (!activePermission) {
      const workspaceError = WorkspacePermissionErrorFactory.createNoPermissionError(
        capability,
        agentId,
        connectionName
      );
      return {
        isValid: false,
        error: workspaceError.message,
        workspaceError
      };
    }

    // Check rate limits
    const rateLimitResult = await this.checkRateLimit(agentId, capability);
    if (!rateLimitResult.allowed) {
      const workspaceError = WorkspacePermissionErrorFactory.createRateLimitError(
        capability,
        connectionName,
        rateLimitResult.resetTime
      );
      return {
        isValid: false,
        error: workspaceError.message,
        workspaceError
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
   * Validate that an agent has any workspace capabilities for a given capability type
   * This is used when no specific connection is provided
   */
  async validateAgentHasCapability(
    agentId: string,
    capability: WorkspaceCapabilityType
  ): Promise<PermissionValidationResult> {
    const capabilities = await this.getAgentWorkspaceCapabilities(agentId);
    const hasCapability = capabilities.some(cap => cap.capability === capability);
    
    if (!hasCapability) {
      const workspaceError = WorkspacePermissionErrorFactory.createNoPermissionError(
        capability,
        agentId
      );
      return {
        isValid: false,
        error: workspaceError.message,
        workspaceError
      };
    }

    return {
      isValid: true
    };
  }

  /**
   * Get the best connection for an agent's capability
   * Returns the most suitable active connection for a given capability
   */
  async getBestConnectionForCapability(
    agentId: string,
    capability: WorkspaceCapabilityType
  ): Promise<{connection?: WorkspaceConnection, error?: WorkspacePermissionError}> {
    const capabilities = await this.getAgentWorkspaceCapabilities(agentId);
    const matchingCapabilities = capabilities.filter(cap => cap.capability === capability);
    
    if (matchingCapabilities.length === 0) {
      return {
        error: WorkspacePermissionErrorFactory.createNoPermissionError(capability, agentId)
      };
    }

    // Get the connection for the first matching capability
    const connection = await this.db.getWorkspaceConnection(matchingCapabilities[0].connectionId);
    if (!connection) {
      return {
        error: WorkspacePermissionErrorFactory.createNoConnectionError(capability)
      };
    }

    return { connection };
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