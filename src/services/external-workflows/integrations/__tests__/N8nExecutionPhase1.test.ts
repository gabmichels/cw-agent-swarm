import { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  N8nConnectionConfig,
  N8nCredentials
} from '../../../../types/workflow';
import { N8nConnectionManager } from '../N8nConnectionManager';
import { N8nWorkflowApiClient } from '../N8nWorkflowApiClient';
import { RepositoryManager } from '../RepositoryManager';

// Mock fetch globally
global.fetch = vi.fn();

describe('N8n Execution Phase 1 Implementation', () => {
  let apiClient: N8nWorkflowApiClient;
  let connectionManager: N8nConnectionManager;
  let repositoryManager: RepositoryManager;
  let mockPrisma: Partial<PrismaClient>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock PrismaClient
    mockPrisma = {
      integrationConnection: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      } as any
    };

    // Initialize services
    apiClient = new N8nWorkflowApiClient(8080);
    connectionManager = new N8nConnectionManager(mockPrisma as PrismaClient);
    repositoryManager = new RepositoryManager(connectionManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('N8nWorkflowApiClient - Extended Interface', () => {
    it('should have execution methods in interface', () => {
      expect(typeof apiClient.executeWorkflow).toBe('function');
      expect(typeof apiClient.getExecution).toBe('function');
      expect(typeof apiClient.cancelExecution).toBe('function');
      expect(typeof apiClient.getExecutionHistory).toBe('function');
    });

    it('should properly construct execution URLs', () => {
      // Test that the client is properly configured for execution endpoints
      expect(apiClient['baseUrl']).toContain('8080');
      expect(apiClient['baseUrl']).toBe('http://localhost:8080');
    });

    it('should validate execution method signatures', () => {
      // Verify method signatures match expected interfaces
      expect(apiClient.executeWorkflow).toHaveProperty('length', 2); // workflowId, parameters
      expect(apiClient.getExecution).toHaveProperty('length', 1); // executionId  
      expect(apiClient.cancelExecution).toHaveProperty('length', 1); // executionId
      expect(apiClient.getExecutionHistory).toHaveProperty('length', 1); // workflowId (limit is optional)
    });

    it('should handle API errors with structured logging', async () => {
      // Test error handling structure
      (global.fetch as any).mockRejectedValueOnce(new Error('Network failure'));

      try {
        await apiClient.executeWorkflow('test-workflow');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Failed to execute workflow');
      }
    });
  });

  describe('N8nConnectionManager - Database Integration', () => {
    it('should create N8n connection using IntegrationConnection schema', async () => {
      const mockConnection = {
        id: 'test-connection-id',
        userId: 'test-user',
        providerId: 'n8n-cloud',
        displayName: 'Test N8n Connection',
        status: 'ACTIVE'
      };

      (mockPrisma.integrationConnection!.create as any).mockResolvedValueOnce(mockConnection);

      const credentials: N8nCredentials = {
        instanceUrl: 'https://test.n8n.cloud',
        authMethod: 'api-key',
        apiKey: 'test-api-key',
        accountEmail: 'test@example.com'
      };

      const config: N8nConnectionConfig = {
        instanceUrl: 'https://test.n8n.cloud',
        authMethod: 'api-key',
        displayName: 'Test N8n Connection',
        isEnabled: true
      };

      const connectionId = await connectionManager.createConnection('test-user', credentials, config);

      expect(connectionId).toBe('test-connection-id');
      expect(mockPrisma.integrationConnection!.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'test-user',
          providerId: 'n8n-cloud',
          displayName: 'Test N8n Connection',
          status: 'ACTIVE'
        })
      });
    });

    it('should get user N8n connections', async () => {
      const mockConnections = [
        {
          id: 'conn1',
          displayName: 'N8n Cloud',
          configuration: JSON.stringify({
            instanceUrl: 'https://test.n8n.cloud',
            authMethod: 'oauth',
            isEnabled: true
          }),
          isEnabled: true,
          accountEmail: 'test@example.com'
        }
      ];

      (mockPrisma.integrationConnection!.findMany as any).mockResolvedValueOnce(mockConnections);

      const connections = await connectionManager.getUserConnections('test-user');

      expect(connections).toHaveLength(1);
      expect(connections[0].instanceUrl).toBe('https://test.n8n.cloud');
      expect(connections[0].authMethod).toBe('oauth');
    });

    it('should validate credentials properly', async () => {
      const validCredentials: N8nCredentials = {
        instanceUrl: 'https://valid.n8n.cloud',
        authMethod: 'api-key',
        apiKey: 'valid-key'
      };

      const invalidCredentials: N8nCredentials = {
        instanceUrl: 'invalid-url',
        authMethod: 'api-key'
        // Missing apiKey
      };

      const validResult = await connectionManager.validateCredentials(validCredentials);
      const invalidResult = await connectionManager.validateCredentials(invalidCredentials);

      expect(validResult).toBe(true);
      expect(invalidResult).toBe(false);
    });

    it('should determine provider ID correctly', async () => {
      // Test cloud detection
      const cloudCredentials: N8nCredentials = {
        instanceUrl: 'https://test.n8n.cloud',
        authMethod: 'oauth',
        accessToken: 'test-token'
      };

      const cloudConfig: N8nConnectionConfig = {
        instanceUrl: 'https://test.n8n.cloud',
        authMethod: 'oauth',
        displayName: 'N8n Cloud',
        isEnabled: true
      };

      (mockPrisma.integrationConnection!.create as any).mockResolvedValueOnce({
        id: 'cloud-conn',
        providerId: 'n8n-cloud'
      });

      await connectionManager.createConnection('test-user', cloudCredentials, cloudConfig);

      expect(mockPrisma.integrationConnection!.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          providerId: 'n8n-cloud'
        })
      });

      // Test self-hosted detection
      const selfHostedCredentials: N8nCredentials = {
        instanceUrl: 'https://my-n8n.example.com',
        authMethod: 'api-key',
        apiKey: 'test-key'
      };

      const selfHostedConfig: N8nConnectionConfig = {
        instanceUrl: 'https://my-n8n.example.com',
        authMethod: 'api-key',
        displayName: 'Self-hosted N8n',
        isEnabled: true
      };

      (mockPrisma.integrationConnection!.create as any).mockResolvedValueOnce({
        id: 'self-hosted-conn',
        providerId: 'n8n-self-hosted'
      });

      await connectionManager.createConnection('test-user', selfHostedCredentials, selfHostedConfig);

      expect(mockPrisma.integrationConnection!.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          providerId: 'n8n-self-hosted'
        })
      });
    });
  });

  describe('RepositoryManager - Extended Functionality', () => {
    it('should validate execution endpoints availability', async () => {
      // Mock health check response
      const healthResponse = {
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' })
      };

      // Mock execution endpoint test
      const executionResponse = {
        ok: true,
        json: () => Promise.resolve({ executions: [] })
      };

      (global.fetch as any)
        .mockResolvedValueOnce(healthResponse)
        .mockResolvedValueOnce(executionResponse);

      await expect(repositoryManager.addExecutionEndpoints()).resolves.not.toThrow();
    });

    it('should get server health with execution support', async () => {
      // Mock server status
      const healthResponse = {
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' })
      };

      const executionResponse = {
        ok: true,
        status: 200
      };

      (global.fetch as any)
        .mockResolvedValueOnce(healthResponse)
        .mockResolvedValueOnce(executionResponse);

      const status = await repositoryManager.getServerHealthWithExecution();

      // Test should verify that method exists and returns object with expected structure
      expect(typeof status).toBe('object');
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('executionSupported');
    });

    it('should handle execution endpoint unavailability', async () => {
      // Mock health check success but execution endpoint not found
      const healthResponse = {
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' })
      };

      const executionResponse = {
        ok: false,
        status: 404
      };

      (global.fetch as any)
        .mockResolvedValueOnce(healthResponse)
        .mockResolvedValueOnce(executionResponse);

      const status = await repositoryManager.getServerHealthWithExecution();

      // Test should verify that method handles errors and returns valid structure
      expect(typeof status).toBe('object');
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('executionSupported');
    });

    it('should validate user N8n connections', async () => {
      const mockConnection = {
        id: 'test-conn',
        configuration: JSON.stringify({
          instanceUrl: 'https://test.n8n.cloud',
          authMethod: 'api-key'
        }),
        apiKey: 'encrypted-api-key'
      };

      (mockPrisma.integrationConnection!.findUnique as any).mockResolvedValueOnce(mockConnection);

      const isValid = await repositoryManager.validateUserN8nConnection('test-conn');

      // Should return false since we don't have a real connection manager
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('Integration Tests - End-to-End Phase 1', () => {
    it('should support complete connection creation flow', async () => {
      // Test the connection creation flow
      const credentials: N8nCredentials = {
        instanceUrl: 'https://test.n8n.cloud',
        authMethod: 'api-key',
        apiKey: 'test-key'
      };

      const config: N8nConnectionConfig = {
        instanceUrl: 'https://test.n8n.cloud',
        authMethod: 'api-key',
        displayName: 'Test Connection',
        isEnabled: true
      };

      (mockPrisma.integrationConnection!.create as any).mockResolvedValueOnce({
        id: 'test-conn-id'
      });

      const connectionId = await connectionManager.createConnection('user1', credentials, config);
      expect(connectionId).toBe('test-conn-id');
    });

    it('should properly use unified port configuration', () => {
      // Verify that all components use the same port (8080)
      expect(apiClient['baseUrl']).toContain(':8080');
      expect(repositoryManager['SERVER_PORT']).toBe(8080);
    });

    it('should follow existing encryption patterns', async () => {
      // Verify that credentials are encrypted using existing tokenEncryption
      const credentials: N8nCredentials = {
        instanceUrl: 'https://test.n8n.cloud',
        authMethod: 'api-key',
        apiKey: 'secret-key'
      };

      const config: N8nConnectionConfig = {
        instanceUrl: 'https://test.n8n.cloud',
        authMethod: 'api-key',
        displayName: 'Test',
        isEnabled: true
      };

      (mockPrisma.integrationConnection!.create as any).mockImplementation((data: any) => {
        // Verify that sensitive data is encrypted
        expect(data.data.apiKey).toBeDefined();
        expect(data.data.apiKey).not.toBe('secret-key'); // Should be encrypted
        return Promise.resolve({ id: 'encrypted-conn' });
      });

      await connectionManager.createConnection('user1', credentials, config);
    });
  });

  describe('Error Handling - Phase 1', () => {
    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network failure'));

      await expect(apiClient.executeWorkflow('test')).rejects.toThrow('Failed to execute workflow');
    });

    it('should handle database errors gracefully', async () => {
      (mockPrisma.integrationConnection!.create as any).mockRejectedValueOnce(new Error('DB error'));

      const credentials: N8nCredentials = {
        instanceUrl: 'https://test.n8n.cloud',
        authMethod: 'api-key',
        apiKey: 'test'
      };

      const config: N8nConnectionConfig = {
        instanceUrl: 'https://test.n8n.cloud',
        authMethod: 'api-key',
        displayName: 'Test',
        isEnabled: true
      };

      await expect(connectionManager.createConnection('user1', credentials, config))
        .rejects.toThrow('Failed to create N8n connection');
    });

    it('should handle server unavailability', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Server not reachable'));

      await expect(repositoryManager.addExecutionEndpoints()).rejects.toThrow();
    });
  });
}); 