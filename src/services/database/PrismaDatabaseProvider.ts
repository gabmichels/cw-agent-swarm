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
  NotificationPriority
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
    return this.client.agentWorkspacePermission.create({
      data: {
        ...input,
        grantedAt: new Date(),
        lastUsedAt: new Date()
      }
    });
  }

  async getAgentWorkspacePermission(id: string): Promise<AgentWorkspacePermission | null> {
    return this.client.agentWorkspacePermission.findUnique({
      where: { id }
    });
  }

  async updateAgentWorkspacePermission(id: string, input: AgentWorkspacePermissionUpdateInput): Promise<AgentWorkspacePermission> {
    return this.client.agentWorkspacePermission.update({
      where: { id },
      data: {
        ...input,
        lastUsedAt: input.lastUsedAt || new Date()
      }
    });
  }

  async deleteAgentWorkspacePermission(id: string): Promise<void> {
    await this.client.agentWorkspacePermission.delete({
      where: { id }
    });
  }

  async findAgentWorkspacePermissions(query: AgentWorkspacePermissionQuery): Promise<AgentWorkspacePermission[]> {
    return this.client.agentWorkspacePermission.findMany({
      where: query
    });
  }

  // Workspace Audit Log Operations
  async createWorkspaceAuditLog(input: WorkspaceAuditLogCreateInput): Promise<WorkspaceAuditLog> {
    return this.client.workspaceAuditLog.create({
      data: {
        ...input,
        timestamp: new Date()
      }
    });
  }

  async getWorkspaceAuditLog(id: string): Promise<WorkspaceAuditLog | null> {
    return this.client.workspaceAuditLog.findUnique({
      where: { id }
    });
  }

  async findWorkspaceAuditLogs(query: WorkspaceAuditLogQuery): Promise<WorkspaceAuditLog[]> {
    const { fromTimestamp, toTimestamp, ...restQuery } = query;
    return this.client.workspaceAuditLog.findMany({
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
  }

  async deleteWorkspaceAuditLog(id: string): Promise<void> {
    await this.client.workspaceAuditLog.delete({
      where: { id }
    });
  }

  // Agent Notification Operations
  async createAgentNotification(input: AgentNotificationCreateInput): Promise<AgentNotification> {
    return this.client.agentNotification.create({
      data: {
        ...input,
        priority: input.priority || NotificationPriority.NORMAL,
        status: NotificationStatus.PENDING,
        createdAt: new Date(),
        retryCount: 0
      }
    });
  }

  async getAgentNotification(id: string): Promise<AgentNotification | null> {
    return this.client.agentNotification.findUnique({
      where: { id }
    });
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

    return this.client.agentNotification.update({
      where: { id },
      data: updateData
    });
  }

  async findAgentNotifications(query: AgentNotificationQuery): Promise<AgentNotification[]> {
    return this.client.agentNotification.findMany({
      where: query,
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async deleteAgentNotification(id: string): Promise<void> {
    await this.client.agentNotification.delete({
      where: { id }
    });
  }
} 