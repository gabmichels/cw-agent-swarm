import { PrismaClient } from '@prisma/client';
import { ulid } from 'ulid';
import { logger } from '../../../lib/logging';
import {
  N8nConnectionConfig,
  N8nConnectionError,
  N8nCredentials
} from '../../../types/workflow';
import { tokenEncryption } from '../../security/TokenEncryption';

// === N8N Connection Manager Interface ===

export interface IN8nConnectionManager {
  // Connection Management
  createConnection(userId: string, credentials: N8nCredentials, config: N8nConnectionConfig): Promise<string>;
  getConnection(connectionId: string): Promise<N8nConnectionConfig | null>;
  getUserConnections(userId: string): Promise<N8nConnectionConfig[]>;
  updateConnection(connectionId: string, config: Partial<N8nConnectionConfig>): Promise<void>;
  deleteConnection(connectionId: string): Promise<void>;

  // Health & Validation
  testConnection(connectionId: string): Promise<boolean>;
  validateCredentials(credentials: N8nCredentials): Promise<boolean>;
  refreshTokens(connectionId: string): Promise<void>;

  // Credential Management
  getDecryptedCredentials(connectionId: string): Promise<N8nCredentials>;
  updateCredentials(connectionId: string, credentials: Partial<N8nCredentials>): Promise<void>;
}

// === N8N Connection Manager Implementation ===

export class N8nConnectionManager implements IN8nConnectionManager {
  private readonly serviceName = 'N8nConnectionManager';
  private readonly logger = logger;

  constructor(
    private readonly prisma: PrismaClient
  ) { }

  // === Connection Management ===

  async createConnection(
    userId: string,
    credentials: N8nCredentials,
    config: N8nConnectionConfig
  ): Promise<string> {
    this.logger.info(`[${this.serviceName}] Creating N8n connection`, {
      userId,
      instanceUrl: credentials.instanceUrl,
      authMethod: credentials.authMethod
    });

    try {
      // Validate credentials first
      const isValid = await this.validateCredentials(credentials);
      if (!isValid) {
        throw new N8nConnectionError(
          'Invalid N8n credentials provided',
          credentials.instanceUrl,
          { authMethod: credentials.authMethod }
        );
      }

      // Determine provider ID based on instance type
      const providerId = this.determineProviderId(credentials.instanceUrl);

      // Store connection using existing IntegrationConnection pattern
      const connection = await this.prisma.integrationConnection.create({
        data: {
          id: ulid(),
          userId,
          providerId,
          displayName: config.displayName,
          status: 'ACTIVE',
          // Store encrypted credentials in existing fields
          accessToken: credentials.accessToken ? tokenEncryption.encrypt(credentials.accessToken) : null,
          refreshToken: credentials.refreshToken ? tokenEncryption.encrypt(credentials.refreshToken) : null,
          apiKey: credentials.apiKey ? tokenEncryption.encrypt(credentials.apiKey) : null,
          tokenExpiresAt: credentials.tokenExpiresAt,
          accountEmail: credentials.accountEmail,
          accountName: credentials.accountName,
          // Store N8n-specific configuration in configuration field
          configuration: JSON.stringify({
            instanceUrl: credentials.instanceUrl,
            authMethod: credentials.authMethod,
            isEnabled: config.isEnabled,
            lastHealthCheck: config.lastHealthCheck
          }),
          isEnabled: config.isEnabled,
          lastValidated: new Date()
        }
      });

      this.logger.info(`[${this.serviceName}] N8n connection created successfully`, {
        connectionId: connection.id,
        userId,
        providerId
      });

      return connection.id;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to create N8n connection`, {
        userId,
        instanceUrl: credentials.instanceUrl,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof N8nConnectionError) {
        throw error;
      }

      throw new N8nConnectionError(
        'Failed to create N8n connection',
        credentials.instanceUrl,
        { originalError: error }
      );
    }
  }

  async getConnection(connectionId: string): Promise<N8nConnectionConfig | null> {
    this.logger.debug(`[${this.serviceName}] Getting N8n connection`, { connectionId });

    try {
      const connection = await this.prisma.integrationConnection.findUnique({
        where: { id: connectionId },
        include: { provider: true }
      });

      if (!connection || !this.isN8nProvider(connection.providerId)) {
        return null;
      }

      const config = this.parseConfiguration(connection.configuration || '{}');

      return {
        instanceUrl: config.instanceUrl,
        authMethod: config.authMethod,
        displayName: connection.displayName,
        accountEmail: connection.accountEmail || undefined,
        accountName: connection.accountName || undefined,
        lastHealthCheck: config.lastHealthCheck ? new Date(config.lastHealthCheck) : undefined,
        isEnabled: connection.isEnabled
      };

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to get N8n connection`, {
        connectionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new N8nConnectionError(
        `Failed to get connection: ${connectionId}`,
        undefined,
        { connectionId, originalError: error }
      );
    }
  }

  async getUserConnections(userId: string): Promise<N8nConnectionConfig[]> {
    this.logger.debug(`[${this.serviceName}] Getting user N8n connections`, { userId });

    try {
      const connections = await this.prisma.integrationConnection.findMany({
        where: {
          userId,
          providerId: { in: ['n8n-cloud', 'n8n-self-hosted'] },
          isEnabled: true
        },
        include: { provider: true },
        orderBy: { createdAt: 'desc' }
      });

      const configs = connections.map(connection => {
        const config = this.parseConfiguration(connection.configuration || '{}');
        return {
          instanceUrl: config.instanceUrl,
          authMethod: config.authMethod,
          displayName: connection.displayName,
          accountEmail: connection.accountEmail || undefined,
          accountName: connection.accountName || undefined,
          lastHealthCheck: config.lastHealthCheck ? new Date(config.lastHealthCheck) : undefined,
          isEnabled: connection.isEnabled
        };
      });

      this.logger.debug(`[${this.serviceName}] Found ${configs.length} user N8n connections`, { userId });

      return configs;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to get user N8n connections`, {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new N8nConnectionError(
        'Failed to get user connections',
        undefined,
        { userId, originalError: error }
      );
    }
  }

  async updateConnection(connectionId: string, config: Partial<N8nConnectionConfig>): Promise<void> {
    this.logger.debug(`[${this.serviceName}] Updating N8n connection`, { connectionId, config });

    try {
      const existingConnection = await this.prisma.integrationConnection.findUnique({
        where: { id: connectionId }
      });

      if (!existingConnection) {
        throw new N8nConnectionError(
          `Connection not found: ${connectionId}`,
          undefined,
          { connectionId }
        );
      }

      const existingConfig = this.parseConfiguration(existingConnection.configuration || '{}');
      const updatedConfig = { ...existingConfig, ...config };

      await this.prisma.integrationConnection.update({
        where: { id: connectionId },
        data: {
          displayName: config.displayName || existingConnection.displayName,
          accountEmail: config.accountEmail || existingConnection.accountEmail,
          accountName: config.accountName || existingConnection.accountName,
          isEnabled: config.isEnabled !== undefined ? config.isEnabled : existingConnection.isEnabled,
          configuration: JSON.stringify(updatedConfig),
          updatedAt: new Date()
        }
      });

      this.logger.info(`[${this.serviceName}] N8n connection updated successfully`, { connectionId });

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to update N8n connection`, {
        connectionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new N8nConnectionError(
        `Failed to update connection: ${connectionId}`,
        undefined,
        { connectionId, originalError: error }
      );
    }
  }

  async deleteConnection(connectionId: string): Promise<void> {
    this.logger.info(`[${this.serviceName}] Deleting N8n connection`, { connectionId });

    try {
      await this.prisma.integrationConnection.delete({
        where: { id: connectionId }
      });

      this.logger.info(`[${this.serviceName}] N8n connection deleted successfully`, { connectionId });

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to delete N8n connection`, {
        connectionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new N8nConnectionError(
        `Failed to delete connection: ${connectionId}`,
        undefined,
        { connectionId, originalError: error }
      );
    }
  }

  // === Health & Validation ===

  async testConnection(connectionId: string): Promise<boolean> {
    this.logger.debug(`[${this.serviceName}] Testing N8n connection`, { connectionId });

    try {
      const credentials = await this.getDecryptedCredentials(connectionId);
      return await this.validateCredentials(credentials);

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Connection test failed`, {
        connectionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async validateCredentials(credentials: N8nCredentials): Promise<boolean> {
    this.logger.debug(`[${this.serviceName}] Validating N8n credentials`, {
      instanceUrl: credentials.instanceUrl,
      authMethod: credentials.authMethod
    });

    try {
      // For now, return a simple validation based on required fields
      // TODO: Implement actual N8n API validation once endpoints are available

      if (!credentials.instanceUrl || !credentials.authMethod) {
        return false;
      }

      if (credentials.authMethod === 'api-key' && !credentials.apiKey) {
        return false;
      }

      if (credentials.authMethod === 'oauth' && !credentials.accessToken) {
        return false;
      }

      // Basic URL validation
      try {
        new URL(credentials.instanceUrl);
      } catch {
        return false;
      }

      this.logger.debug(`[${this.serviceName}] Credentials validation passed`, {
        instanceUrl: credentials.instanceUrl,
        authMethod: credentials.authMethod
      });

      return true;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Credential validation failed`, {
        instanceUrl: credentials.instanceUrl,
        authMethod: credentials.authMethod,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async refreshTokens(connectionId: string): Promise<void> {
    this.logger.debug(`[${this.serviceName}] Refreshing tokens for N8n connection`, { connectionId });

    try {
      // TODO: Implement OAuth token refresh logic
      // For now, just update the last validated timestamp
      await this.prisma.integrationConnection.update({
        where: { id: connectionId },
        data: { lastValidated: new Date() }
      });

      this.logger.debug(`[${this.serviceName}] Token refresh completed`, { connectionId });

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to refresh tokens`, {
        connectionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new N8nConnectionError(
        `Failed to refresh tokens for connection: ${connectionId}`,
        undefined,
        { connectionId, originalError: error }
      );
    }
  }

  // === Credential Management ===

  async getDecryptedCredentials(connectionId: string): Promise<N8nCredentials> {
    this.logger.debug(`[${this.serviceName}] Getting decrypted credentials`, { connectionId });

    try {
      const connection = await this.prisma.integrationConnection.findUnique({
        where: { id: connectionId }
      });

      if (!connection) {
        throw new N8nConnectionError(
          `Connection not found: ${connectionId}`,
          undefined,
          { connectionId }
        );
      }

      const config = this.parseConfiguration(connection.configuration || '{}');

      // Decrypt credentials using existing tokenEncryption system
      const credentials: N8nCredentials = {
        instanceUrl: config.instanceUrl,
        authMethod: config.authMethod,
        apiKey: connection.apiKey ? tokenEncryption.decrypt(connection.apiKey) : undefined,
        accessToken: connection.accessToken ? tokenEncryption.decrypt(connection.accessToken) : undefined,
        refreshToken: connection.refreshToken ? tokenEncryption.decrypt(connection.refreshToken) : undefined,
        tokenExpiresAt: connection.tokenExpiresAt || undefined,
        accountEmail: connection.accountEmail || undefined,
        accountName: connection.accountName || undefined
      };

      return credentials;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to get decrypted credentials`, {
        connectionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new N8nConnectionError(
        `Failed to get credentials for connection: ${connectionId}`,
        undefined,
        { connectionId, originalError: error }
      );
    }
  }

  async updateCredentials(connectionId: string, credentials: Partial<N8nCredentials>): Promise<void> {
    this.logger.debug(`[${this.serviceName}] Updating credentials`, { connectionId });

    try {
      const updateData: any = {};

      if (credentials.apiKey) {
        updateData.apiKey = tokenEncryption.encrypt(credentials.apiKey);
      }

      if (credentials.accessToken) {
        updateData.accessToken = tokenEncryption.encrypt(credentials.accessToken);
      }

      if (credentials.refreshToken) {
        updateData.refreshToken = tokenEncryption.encrypt(credentials.refreshToken);
      }

      if (credentials.tokenExpiresAt) {
        updateData.tokenExpiresAt = credentials.tokenExpiresAt;
      }

      if (credentials.accountEmail) {
        updateData.accountEmail = credentials.accountEmail;
      }

      if (credentials.accountName) {
        updateData.accountName = credentials.accountName;
      }

      await this.prisma.integrationConnection.update({
        where: { id: connectionId },
        data: {
          ...updateData,
          lastValidated: new Date(),
          updatedAt: new Date()
        }
      });

      this.logger.info(`[${this.serviceName}] Credentials updated successfully`, { connectionId });

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to update credentials`, {
        connectionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new N8nConnectionError(
        `Failed to update credentials for connection: ${connectionId}`,
        undefined,
        { connectionId, originalError: error }
      );
    }
  }

  // === Private Utility Methods ===

  private determineProviderId(instanceUrl: string): string {
    // Determine if this is n8n Cloud or self-hosted based on URL
    if (instanceUrl.includes('n8n.cloud') || instanceUrl.includes('app.n8n.cloud')) {
      return 'n8n-cloud';
    }
    return 'n8n-self-hosted';
  }

  private isN8nProvider(providerId: string): boolean {
    return ['n8n-cloud', 'n8n-self-hosted'].includes(providerId);
  }

  private parseConfiguration(configString: string): any {
    try {
      return JSON.parse(configString);
    } catch {
      return {};
    }
  }
} 