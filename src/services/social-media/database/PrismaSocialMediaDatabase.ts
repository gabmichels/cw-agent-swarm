import { PrismaClient } from '@prisma/client';

// Temporary type definitions to handle Prisma client generation issues
interface PrismaClientWithSocialMedia extends PrismaClient {
  socialMediaConnection: any;
  agentSocialMediaPermission: any;
  socialMediaAuditLog: any;
}
import { ulid } from 'ulid';
import { tokenEncryption } from '../../security/TokenEncryption';
import {
  ISocialMediaDatabase,
  SocialMediaConnection,
  AgentSocialMediaPermission,
  SocialMediaAuditLog,
  SocialMediaProvider,
  SocialMediaConnectionStatus,
  SocialMediaCapability,
  AccessLevel,
  AuditEntry,
  SocialMediaError,
  SocialMediaPermissionError
} from './ISocialMediaDatabase';

// Following IMPLEMENTATION_GUIDELINES.md - dependency injection, error handling
export class PrismaSocialMediaDatabase implements ISocialMediaDatabase {
  private prisma: PrismaClientWithSocialMedia;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma as PrismaClientWithSocialMedia;
  }

  // Connection Management
  async createConnection(connection: Omit<SocialMediaConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<SocialMediaConnection> {
    try {
      const id = ulid();
      
      // Use production-ready encryption for credentials
      const encryptedCredentials = tokenEncryption.encryptTokens(
        typeof connection.encryptedCredentials === 'string' 
          ? JSON.parse(connection.encryptedCredentials)
          : connection.encryptedCredentials
      );

      const created = await this.prisma.socialMediaConnection.create({
        data: {
          id,
          userId: connection.userId,
          organizationId: connection.organizationId,
          provider: connection.provider,
          providerAccountId: connection.providerAccountId,
          accountDisplayName: connection.accountDisplayName,
          accountUsername: connection.accountUsername,
          accountType: connection.accountType,
          encryptedCredentials,
          scopes: connection.scopes.join(','),
          connectionStatus: connection.connectionStatus,
          metadata: JSON.stringify(connection.metadata),
          lastValidated: connection.lastValidated,
        }
      });

      return this.mapPrismaToConnection(created);
    } catch (error) {
      throw new SocialMediaError(
        'Failed to create social media connection',
        'CONNECTION_CREATE_FAILED',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async getConnection(connectionId: string): Promise<SocialMediaConnection | null> {
    try {
      const connection = await this.prisma.socialMediaConnection.findUnique({
        where: { id: connectionId }
      });

      return connection ? this.mapPrismaToConnection(connection) : null;
    } catch (error) {
      throw new SocialMediaError(
        'Failed to get social media connection',
        'CONNECTION_GET_FAILED',
        { connectionId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async getConnectionsByUser(userId: string): Promise<SocialMediaConnection[]> {
    try {
      const connections = await this.prisma.socialMediaConnection.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      return connections.map((conn: any) => this.mapPrismaToConnection(conn));
    } catch (error) {
      throw new SocialMediaError(
        'Failed to get user social media connections',
        'CONNECTIONS_GET_FAILED',
        { userId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async getConnectionsByOrganization(organizationId: string): Promise<SocialMediaConnection[]> {
    try {
      const connections = await this.prisma.socialMediaConnection.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' }
      });

      return connections.map((conn: any) => this.mapPrismaToConnection(conn));
    } catch (error) {
      throw new SocialMediaError(
        'Failed to get organization social media connections',
        'CONNECTIONS_GET_FAILED',
        { organizationId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async updateConnection(connectionId: string, updates: Partial<SocialMediaConnection>): Promise<SocialMediaConnection> {
    try {
      const updateData: any = {};
      
      if (updates.accountDisplayName) updateData.accountDisplayName = updates.accountDisplayName;
      if (updates.accountUsername) updateData.accountUsername = updates.accountUsername;
      if (updates.connectionStatus) updateData.connectionStatus = updates.connectionStatus;
      if (updates.scopes) updateData.scopes = updates.scopes.join(',');
      if (updates.metadata) updateData.metadata = JSON.stringify(updates.metadata);
      if (updates.lastValidated) updateData.lastValidated = updates.lastValidated;
      
      // Handle credential updates with proper encryption
      if (updates.encryptedCredentials) {
        updateData.encryptedCredentials = tokenEncryption.encryptTokens(
          typeof updates.encryptedCredentials === 'string' 
            ? JSON.parse(updates.encryptedCredentials)
            : updates.encryptedCredentials
        );
      }

      const updated = await this.prisma.socialMediaConnection.update({
        where: { id: connectionId },
        data: updateData
      });

      return this.mapPrismaToConnection(updated);
    } catch (error) {
      throw new SocialMediaError(
        'Failed to update social media connection',
        'CONNECTION_UPDATE_FAILED',
        { connectionId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async deleteConnection(connectionId: string): Promise<void> {
    try {
      // Delete related permissions first
      await this.prisma.agentSocialMediaPermission.deleteMany({
        where: { socialMediaConnectionId: connectionId }
      });

      // Delete audit logs
      await this.prisma.socialMediaAuditLog.deleteMany({
        where: { socialMediaConnectionId: connectionId }
      });

      // Delete the connection
      await this.prisma.socialMediaConnection.delete({
        where: { id: connectionId }
      });
    } catch (error) {
      throw new SocialMediaError(
        'Failed to delete social media connection',
        'CONNECTION_DELETE_FAILED',
        { connectionId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async validateConnection(connectionId: string): Promise<boolean> {
    try {
      const connection = await this.getConnection(connectionId);
      if (!connection) return false;

      // Check if tokens are expired using the encryption service
      let isExpired = false;
      try {
        isExpired = tokenEncryption.areTokensExpired(connection.encryptedCredentials);
      } catch (decryptionError) {
        console.warn('Failed to decrypt tokens with new encryption - may be old format, marking connection for re-authentication:', decryptionError);
        // If we can't decrypt the tokens, they're likely in the old format
        // Mark the connection as expired so the user can re-authenticate
        await this.updateConnection(connectionId, {
          connectionStatus: SocialMediaConnectionStatus.EXPIRED,
          metadata: { error: 'Encryption format migration required - please reconnect' }
        });
        return false;
      }
      
      if (isExpired) {
        await this.updateConnection(connectionId, {
          connectionStatus: SocialMediaConnectionStatus.EXPIRED
        });
        return false;
      }

      // Update last validated timestamp
      await this.updateConnection(connectionId, {
        lastValidated: new Date(),
        connectionStatus: SocialMediaConnectionStatus.ACTIVE
      });

      return true;
    } catch (error) {
      console.error('Connection validation failed:', error);
      
      // Update connection status to error
      try {
        await this.updateConnection(connectionId, {
          connectionStatus: SocialMediaConnectionStatus.ERROR,
          metadata: { error: error instanceof Error ? error.message : 'Validation failed' }
        });
      } catch (updateError) {
        console.error('Failed to update connection status:', updateError);
      }
      
      return false;
    }
  }

  // Permission Management
  async grantPermission(permission: Omit<AgentSocialMediaPermission, 'id' | 'grantedAt' | 'auditLog'>): Promise<AgentSocialMediaPermission> {
    try {
      const id = ulid();
      
      const created = await this.prisma.agentSocialMediaPermission.create({
        data: {
          id,
          agentId: permission.agentId,
          socialMediaConnectionId: permission.connectionId,
          capabilities: permission.capabilities.join(','),
          accessLevel: permission.accessLevel,
          restrictions: permission.restrictions ? JSON.stringify(permission.restrictions) : null,
          grantedBy: permission.grantedBy,
          isActive: permission.isActive
        }
      });

      return this.mapPrismaToPermission(created);
    } catch (error) {
      throw new SocialMediaPermissionError(
        'Failed to grant social media permission',
        'PERMISSION_GRANT_FAILED',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async revokePermission(permissionId: string): Promise<void> {
    try {
      await this.prisma.agentSocialMediaPermission.update({
        where: { id: permissionId },
        data: {
          isActive: false,
          revokedAt: new Date()
        }
      });
    } catch (error) {
      throw new SocialMediaPermissionError(
        'Failed to revoke social media permission',
        'PERMISSION_REVOKE_FAILED',
        { permissionId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async getAgentPermissions(agentId: string): Promise<AgentSocialMediaPermission[]> {
    try {
      const permissions = await this.prisma.agentSocialMediaPermission.findMany({
        where: { agentId, isActive: true },
        include: { socialMediaConnection: true }
      });

      return permissions.map((perm: any) => this.mapPrismaToPermission(perm));
    } catch (error) {
      throw new SocialMediaPermissionError(
        'Failed to get agent social media permissions',
        'PERMISSIONS_GET_FAILED',
        { agentId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async getConnectionPermissions(connectionId: string): Promise<AgentSocialMediaPermission[]> {
    try {
      const permissions = await this.prisma.agentSocialMediaPermission.findMany({
        where: { socialMediaConnectionId: connectionId, isActive: true }
      });

      return permissions.map((perm: any) => this.mapPrismaToPermission(perm));
    } catch (error) {
      throw new SocialMediaPermissionError(
        'Failed to get connection social media permissions',
        'PERMISSIONS_GET_FAILED',
        { connectionId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async updatePermission(permissionId: string, updates: Partial<AgentSocialMediaPermission>): Promise<AgentSocialMediaPermission> {
    try {
      const updateData: any = {};
      
      if (updates.capabilities) updateData.capabilities = updates.capabilities.join(',');
      if (updates.accessLevel) updateData.accessLevel = updates.accessLevel;
      if (updates.restrictions) updateData.restrictions = JSON.stringify(updates.restrictions);
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

      const updated = await this.prisma.agentSocialMediaPermission.update({
        where: { id: permissionId },
        data: updateData
      });

      return this.mapPrismaToPermission(updated);
    } catch (error) {
      throw new SocialMediaPermissionError(
        'Failed to update social media permission',
        'PERMISSION_UPDATE_FAILED',
        { permissionId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async validatePermissions(agentId: string, connectionId: string, requiredCapabilities: SocialMediaCapability[]): Promise<boolean> {
    try {
      const permissions = await this.prisma.agentSocialMediaPermission.findMany({
        where: {
          agentId,
          socialMediaConnectionId: connectionId,
          isActive: true
        }
      });

      if (permissions.length === 0) return false;

      const grantedCapabilities = permissions.flatMap((perm: any) => 
        perm.capabilities.split(',') as SocialMediaCapability[]
      );

      return requiredCapabilities.every(cap => grantedCapabilities.includes(cap));
    } catch (error) {
      console.error('Permission validation failed:', error);
      return false;
    }
  }

  // Audit Logging
  async logAction(logEntry: Omit<SocialMediaAuditLog, 'id'>): Promise<SocialMediaAuditLog> {
    try {
      const id = ulid();
      
      const created = await this.prisma.socialMediaAuditLog.create({
        data: {
          id,
          socialMediaConnectionId: logEntry.connectionId,
          agentId: logEntry.agentId,
          action: logEntry.action,
          platform: logEntry.platform,
          content: logEntry.content ? JSON.stringify(logEntry.content) : null,
          result: logEntry.result,
          error: logEntry.error,
          ipAddress: logEntry.ipAddress,
          userAgent: logEntry.userAgent,
          metadata: logEntry.metadata ? JSON.stringify(logEntry.metadata) : null
        }
      });

      return this.mapPrismaToAuditLog(created);
    } catch (error) {
      throw new SocialMediaError(
        'Failed to log social media action',
        'AUDIT_LOG_FAILED',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async getAuditLogs(filters: {
    agentId?: string;
    connectionId?: string;
    platform?: SocialMediaProvider;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<SocialMediaAuditLog[]> {
    try {
      const where: any = {};
      
      if (filters.agentId) where.agentId = filters.agentId;
      if (filters.connectionId) where.socialMediaConnectionId = filters.connectionId;
      if (filters.platform) where.platform = filters.platform;
      if (filters.action) where.action = filters.action;
      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) where.timestamp.gte = filters.startDate;
        if (filters.endDate) where.timestamp.lte = filters.endDate;
      }

      const logs = await this.prisma.socialMediaAuditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 100
      });

      return logs.map((log: any) => this.mapPrismaToAuditLog(log));
    } catch (error) {
      throw new SocialMediaError(
        'Failed to get social media audit logs',
        'AUDIT_LOGS_GET_FAILED',
        { filters, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  // Health & Monitoring
  async getConnectionHealth(): Promise<{
    totalConnections: number;
    activeConnections: number;
    expiredConnections: number;
    errorConnections: number;
    byProvider: Record<SocialMediaProvider, number>;
  }> {
    try {
      const [total, active, expired, error, byProvider] = await Promise.all([
        this.prisma.socialMediaConnection.count(),
        this.prisma.socialMediaConnection.count({
          where: { connectionStatus: SocialMediaConnectionStatus.ACTIVE }
        }),
        this.prisma.socialMediaConnection.count({
          where: { connectionStatus: SocialMediaConnectionStatus.EXPIRED }
        }),
        this.prisma.socialMediaConnection.count({
          where: { connectionStatus: SocialMediaConnectionStatus.ERROR }
        }),
        this.prisma.socialMediaConnection.groupBy({
          by: ['provider'],
          _count: { provider: true }
        })
      ]);

      const providerCounts: Record<SocialMediaProvider, number> = {
        [SocialMediaProvider.TWITTER]: 0,
        [SocialMediaProvider.LINKEDIN]: 0,
        [SocialMediaProvider.FACEBOOK]: 0,
        [SocialMediaProvider.INSTAGRAM]: 0,
        [SocialMediaProvider.REDDIT]: 0,
        [SocialMediaProvider.TIKTOK]: 0
      };

      byProvider.forEach((item: any) => {
        if (item.provider in providerCounts) {
          providerCounts[item.provider as SocialMediaProvider] = item._count.provider;
        }
      });

      return {
        totalConnections: total,
        activeConnections: active,
        expiredConnections: expired,
        errorConnections: error,
        byProvider: providerCounts
      };
    } catch (error) {
      throw new SocialMediaError(
        'Failed to get connection health',
        'HEALTH_CHECK_FAILED',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  // Cleanup & Maintenance
  async cleanupExpiredConnections(): Promise<number> {
    try {
      const expiredConnections = await this.prisma.socialMediaConnection.findMany({
        where: {
          OR: [
            { connectionStatus: SocialMediaConnectionStatus.EXPIRED },
            { connectionStatus: SocialMediaConnectionStatus.REVOKED }
          ]
        }
      });

      for (const connection of expiredConnections) {
        await this.deleteConnection(connection.id);
      }

      return expiredConnections.length;
    } catch (error) {
      throw new SocialMediaError(
        'Failed to cleanup expired connections',
        'CLEANUP_FAILED',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async rotateEncryptionKeys(): Promise<void> {
    // TODO: Implement encryption key rotation
    // This would involve re-encrypting all stored credentials with a new key
    throw new Error('Encryption key rotation not yet implemented');
  }

  /**
   * Migration helper: Mark old encrypted connections as expired
   * This forces users to re-authenticate with the new encryption format
   */
  async migrateOldEncryptedConnections(): Promise<number> {
    try {
      const connections = await this.prisma.socialMediaConnection.findMany({
        where: { connectionStatus: SocialMediaConnectionStatus.ACTIVE }
      });

      let migratedCount = 0;

      for (const connection of connections) {
        try {
          // Try to directly decrypt tokens to test the encryption format
          tokenEncryption.decryptTokens(connection.encryptedCredentials);
          console.log(`Connection ${connection.id} (${connection.provider}) is using new encryption format - skipping`);
        } catch (decryptionError) {
          // If decryption fails, this is likely an old format connection
          console.log(`Migrating old encrypted connection: ${connection.id} (${connection.provider}) - Error: ${decryptionError instanceof Error ? decryptionError.message : 'Unknown error'}`);
          
          try {
            await this.prisma.socialMediaConnection.update({
              where: { id: connection.id },
              data: {
                connectionStatus: SocialMediaConnectionStatus.EXPIRED,
                metadata: JSON.stringify({ 
                  error: 'Encryption format migration required - please reconnect',
                  migratedAt: new Date().toISOString(),
                  originalError: decryptionError instanceof Error ? decryptionError.message : 'Unknown error'
                })
              }
            });
            
            migratedCount++;
            console.log(`✅ Successfully marked connection ${connection.id} for re-authentication`);
          } catch (updateError) {
            console.error(`❌ Failed to update connection ${connection.id}:`, updateError);
          }
        }
      }

      console.log(`Migration complete: ${migratedCount} connections marked for re-authentication`);
      return migratedCount;
    } catch (error) {
      throw new SocialMediaError(
        'Failed to migrate old encrypted connections',
        'MIGRATION_FAILED',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  // Helper mapping functions
  private mapPrismaToConnection(prismaConnection: any): SocialMediaConnection {
    return {
      id: prismaConnection.id,
      userId: prismaConnection.userId,
      organizationId: prismaConnection.organizationId,
      provider: prismaConnection.provider as SocialMediaProvider,
      providerAccountId: prismaConnection.providerAccountId,
      accountDisplayName: prismaConnection.accountDisplayName,
      accountUsername: prismaConnection.accountUsername,
      accountType: prismaConnection.accountType as 'personal' | 'business' | 'creator',
      encryptedCredentials: prismaConnection.encryptedCredentials,
      scopes: prismaConnection.scopes.split(','),
      connectionStatus: prismaConnection.connectionStatus as SocialMediaConnectionStatus,
      metadata: prismaConnection.metadata ? JSON.parse(prismaConnection.metadata) : {},
      lastValidated: prismaConnection.lastValidated,
      createdAt: prismaConnection.createdAt,
      updatedAt: prismaConnection.updatedAt
    };
  }

  private mapPrismaToPermission(prismaPermission: any): AgentSocialMediaPermission {
    return {
      id: prismaPermission.id,
      agentId: prismaPermission.agentId,
      connectionId: prismaPermission.socialMediaConnectionId,
      capabilities: prismaPermission.capabilities.split(',') as SocialMediaCapability[],
      accessLevel: prismaPermission.accessLevel as AccessLevel,
      restrictions: prismaPermission.restrictions ? JSON.parse(prismaPermission.restrictions) : {},
      grantedBy: prismaPermission.grantedBy,
      grantedAt: prismaPermission.grantedAt,
      isActive: prismaPermission.isActive,
      auditLog: [] // TODO: Load audit log if needed
    };
  }

  private mapPrismaToAuditLog(prismaLog: any): SocialMediaAuditLog {
    return {
      id: prismaLog.id,
      timestamp: prismaLog.timestamp,
      agentId: prismaLog.agentId,
      connectionId: prismaLog.socialMediaConnectionId,
      action: prismaLog.action as any,
      platform: prismaLog.platform as SocialMediaProvider,
      content: prismaLog.content ? JSON.parse(prismaLog.content) : undefined,
      result: prismaLog.result as any,
      error: prismaLog.error,
      ipAddress: prismaLog.ipAddress,
      userAgent: prismaLog.userAgent,
      metadata: prismaLog.metadata ? JSON.parse(prismaLog.metadata) : {}
    };
  }
} 