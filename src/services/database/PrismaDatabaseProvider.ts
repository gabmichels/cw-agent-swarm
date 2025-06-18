import { PrismaClient } from '@prisma/client';
import { IDatabaseProvider } from './IDatabaseProvider';
import { tokenEncryption } from '../security/TokenEncryption';
import {
  WorkspaceConnection,
  WorkspaceConnectionCreateInput,
  WorkspaceConnectionUpdateInput,
  WorkspaceConnectionQuery,
  AgentWorkspacePermission,
  AgentWorkspacePermissionCreateInput,
  AgentWorkspacePermissionUpdateInput,
  AgentWorkspacePermissionQuery,
  WorkspaceAuditLog,
  WorkspaceAuditLogCreateInput,
  WorkspaceAuditLogQuery,
  AgentNotification,
  AgentNotificationCreateInput,
  AgentNotificationQuery,
  ConnectionStatus,
  AccessLevel,
  NotificationStatus,
  NotificationPriority,
  WorkspaceCapabilityType,
  WorkspaceEventType,
  WorkspaceAction,
  ActionResult
} from './types';

export class PrismaDatabaseProvider implements IDatabaseProvider {
  private client: PrismaClient;

  constructor() {
    this.client = new PrismaClient();
  }

  async initialize(): Promise<void> {
    // Prisma client is automatically initialized when instantiated
    await this.client.$connect();
  }

  async close(): Promise<void> {
    await this.client.$disconnect();
  }

  getClient(): PrismaClient {
    return this.client;
  }

  // Helper methods to convert Prisma results to proper types
  private convertAgentWorkspacePermission(prismaResult: any): AgentWorkspacePermission {
    return {
      ...prismaResult,
      capability: prismaResult.capability as WorkspaceCapabilityType,
      accessLevel: prismaResult.accessLevel as AccessLevel,
      revokedAt: prismaResult.revokedAt || undefined
    };
  }

  private convertWorkspaceAuditLog(prismaResult: any): WorkspaceAuditLog {
    return {
      ...prismaResult,
      action: prismaResult.action as WorkspaceAction,
      capability: prismaResult.capability as WorkspaceCapabilityType,
      result: prismaResult.result as ActionResult,
      agentId: prismaResult.agentId || undefined
    };
  }

  private convertAgentNotification(prismaResult: any): AgentNotification {
    return {
      ...prismaResult,
      eventType: prismaResult.eventType as WorkspaceEventType,
      priority: prismaResult.priority as NotificationPriority,
      status: prismaResult.status as NotificationStatus,
      processedAt: prismaResult.processedAt || undefined,
      failedAt: prismaResult.failedAt || undefined,
      errorMessage: prismaResult.errorMessage || undefined
    };
  }

  // Workspace Connection Operations
  async createWorkspaceConnection(input: WorkspaceConnectionCreateInput): Promise<WorkspaceConnection> {
    // Encrypt tokens before storing
    const encryptedTokens = tokenEncryption.encryptTokens({
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      expires_in: input.tokenExpiresAt ? Math.floor((input.tokenExpiresAt.getTime() - Date.now()) / 1000) : undefined
    });

    const created = await this.client.workspaceConnection.create({
      data: {
        ...input,
        accessToken: encryptedTokens, // Store encrypted tokens
        refreshToken: undefined, // Refresh token is included in encrypted data
        status: input.status || ConnectionStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Return decrypted version for immediate use
    return this.decryptWorkspaceConnection(created);
  }

  async getWorkspaceConnection(id: string): Promise<WorkspaceConnection | null> {
    const connection = await this.client.workspaceConnection.findUnique({
      where: { id }
    });

    return connection ? this.decryptWorkspaceConnection(connection) : null;
  }

  async updateWorkspaceConnection(id: string, input: WorkspaceConnectionUpdateInput): Promise<WorkspaceConnection> {
    const updateData: any = {
      ...input,
      updatedAt: new Date()
    };

    // Handle token updates with encryption
    if (input.accessToken || input.refreshToken) {
      const encryptedTokens = tokenEncryption.encryptTokens({
        access_token: input.accessToken || '',
        refresh_token: input.refreshToken,
        expires_in: input.tokenExpiresAt ? Math.floor((input.tokenExpiresAt.getTime() - Date.now()) / 1000) : undefined
      });
      
      updateData.accessToken = encryptedTokens;
      updateData.refreshToken = undefined; // Refresh token is included in encrypted data
    }

    const updated = await this.client.workspaceConnection.update({
      where: { id },
      data: updateData
    });

    return this.decryptWorkspaceConnection(updated);
  }

  async deleteWorkspaceConnection(id: string): Promise<void> {
    await this.client.workspaceConnection.delete({
      where: { id }
    });
  }

  async findWorkspaceConnections(query: WorkspaceConnectionQuery): Promise<WorkspaceConnection[]> {
    const connections = await this.client.workspaceConnection.findMany({
      where: query
    });

    return connections.map(conn => this.decryptWorkspaceConnection(conn));
  }

  /**
   * Decrypt workspace connection tokens for use
   */
  private decryptWorkspaceConnection(prismaConnection: any): WorkspaceConnection {
    try {
      // Decrypt the tokens
      const decryptedTokens = tokenEncryption.decryptTokens(prismaConnection.accessToken);
      
      return {
        ...prismaConnection,
        accessToken: decryptedTokens.access_token,
        refreshToken: decryptedTokens.refresh_token || undefined,
        // Update tokenExpiresAt based on decrypted data if available
        tokenExpiresAt: decryptedTokens.expires_in && decryptedTokens.encrypted_at 
          ? new Date(new Date(decryptedTokens.encrypted_at).getTime() + (decryptedTokens.expires_in * 1000))
          : prismaConnection.tokenExpiresAt
      };
    } catch (error) {
      console.error('Failed to decrypt workspace connection tokens:', error);
      // Return connection with empty tokens if decryption fails
      return {
        ...prismaConnection,
        accessToken: '',
        refreshToken: undefined
      };
    }
  }

  /**
   * Check if workspace connection tokens are expired
   */
  async isWorkspaceConnectionExpired(id: string): Promise<boolean> {
    const connection = await this.client.workspaceConnection.findUnique({
      where: { id }
    });

    if (!connection) return true;

    try {
      return tokenEncryption.areTokensExpired(connection.accessToken);
    } catch (error) {
      console.error('Error checking workspace token expiry:', error);
      return true; // Assume expired if we can't decrypt
    }
  }

  // Agent Workspace Permission Operations
  async createAgentWorkspacePermission(input: AgentWorkspacePermissionCreateInput): Promise<AgentWorkspacePermission> {
    const result = await this.client.agentWorkspacePermission.create({
      data: {
        ...input,
        grantedAt: new Date(),
        lastUsedAt: new Date()
      }
    });
    
    return this.convertAgentWorkspacePermission(result);
  }

  async getAgentWorkspacePermission(id: string): Promise<AgentWorkspacePermission | null> {
    const result = await this.client.agentWorkspacePermission.findUnique({
      where: { id }
    });
    return result ? this.convertAgentWorkspacePermission(result) : null;
  }

  async updateAgentWorkspacePermission(id: string, input: AgentWorkspacePermissionUpdateInput): Promise<AgentWorkspacePermission> {
    const result = await this.client.agentWorkspacePermission.update({
      where: { id },
      data: {
        ...input,
        lastUsedAt: input.lastUsedAt || new Date()
      }
    });
    return this.convertAgentWorkspacePermission(result);
  }

  async deleteAgentWorkspacePermission(id: string): Promise<void> {
    await this.client.agentWorkspacePermission.delete({
      where: { id }
    });
  }

  async findAgentWorkspacePermissions(query: AgentWorkspacePermissionQuery): Promise<AgentWorkspacePermission[]> {
    const results = await this.client.agentWorkspacePermission.findMany({
      where: query
    });
    return results.map(result => this.convertAgentWorkspacePermission(result));
  }

  // Workspace Audit Log Operations
  async createWorkspaceAuditLog(input: WorkspaceAuditLogCreateInput): Promise<WorkspaceAuditLog> {
    const result = await this.client.workspaceAuditLog.create({
      data: {
        ...input,
        timestamp: new Date()
      }
    });
    return this.convertWorkspaceAuditLog(result);
  }

  async getWorkspaceAuditLog(id: string): Promise<WorkspaceAuditLog | null> {
    const result = await this.client.workspaceAuditLog.findUnique({
      where: { id }
    });
    return result ? this.convertWorkspaceAuditLog(result) : null;
  }

  async findWorkspaceAuditLogs(query: WorkspaceAuditLogQuery): Promise<WorkspaceAuditLog[]> {
    const { fromTimestamp, toTimestamp, ...restQuery } = query;
    const results = await this.client.workspaceAuditLog.findMany({
      where: {
        ...restQuery,
        timestamp: {
          ...(fromTimestamp && { gte: fromTimestamp }),
          ...(toTimestamp && { lte: toTimestamp })
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });
    return results.map(result => this.convertWorkspaceAuditLog(result));
  }

  async deleteWorkspaceAuditLog(id: string): Promise<void> {
    await this.client.workspaceAuditLog.delete({
      where: { id }
    });
  }

  // Agent Notification Operations
  async createAgentNotification(input: AgentNotificationCreateInput): Promise<AgentNotification> {
    const result = await this.client.agentNotification.create({
      data: {
        ...input,
        priority: input.priority || NotificationPriority.NORMAL,
        status: NotificationStatus.PENDING,
        createdAt: new Date(),
        retryCount: 0
      }
    });
    return this.convertAgentNotification(result);
  }

  async getAgentNotification(id: string): Promise<AgentNotification | null> {
    const result = await this.client.agentNotification.findUnique({
      where: { id }
    });
    return result ? this.convertAgentNotification(result) : null;
  }

  async updateAgentNotificationStatus(
    id: string,
    status: NotificationStatus,
    errorMessage?: string
  ): Promise<AgentNotification> {
    const updateData: any = {
      status,
      ...(status === NotificationStatus.PROCESSING && { processedAt: new Date() }),
      ...(status === NotificationStatus.FAILED && { failedAt: new Date(), errorMessage }),
      ...(status === NotificationStatus.PENDING && { retryCount: { increment: 1 } })
    };

    const result = await this.client.agentNotification.update({
      where: { id },
      data: updateData
    });
    return this.convertAgentNotification(result);
  }

  async findAgentNotifications(query: AgentNotificationQuery): Promise<AgentNotification[]> {
    const results = await this.client.agentNotification.findMany({
      where: query,
      orderBy: {
        createdAt: 'desc'
      }
    });
    return results.map(result => this.convertAgentNotification(result));
  }

  async deleteAgentNotification(id: string): Promise<void> {
    await this.client.agentNotification.delete({
      where: { id }
    });
  }
} 