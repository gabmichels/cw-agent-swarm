import { PrismaClient } from '@prisma/client';
import { IDatabaseProvider } from './IDatabaseProvider';
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
    return this.client.workspaceConnection.create({
      data: {
        ...input,
        status: input.status || ConnectionStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  async getWorkspaceConnection(id: string): Promise<WorkspaceConnection | null> {
    return this.client.workspaceConnection.findUnique({
      where: { id }
    });
  }

  async updateWorkspaceConnection(id: string, input: WorkspaceConnectionUpdateInput): Promise<WorkspaceConnection> {
    return this.client.workspaceConnection.update({
      where: { id },
      data: {
        ...input,
        updatedAt: new Date()
      }
    });
  }

  async deleteWorkspaceConnection(id: string): Promise<void> {
    await this.client.workspaceConnection.delete({
      where: { id }
    });
  }

  async findWorkspaceConnections(query: WorkspaceConnectionQuery): Promise<WorkspaceConnection[]> {
    return this.client.workspaceConnection.findMany({
      where: query
    });
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