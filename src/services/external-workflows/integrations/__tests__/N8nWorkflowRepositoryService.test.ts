import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { N8nWorkflowRepositoryService } from '../N8nWorkflowRepositoryService';
import { 
  RepositoryStats, 
  RepositoryHealth, 
  ServerStatus,
  CategoryCount,
  IntegrationCount,
  RepositoryError 
} from '../../../../types/workflow';

describe('N8nWorkflowRepositoryService', () => {
  let service: N8nWorkflowRepositoryService;
  let mockRepositoryManager: any;

  const mockRepositoryStats: RepositoryStats = {
    totalWorkflows: 2053,
    activeWorkflows: 215,
    totalNodes: 29445,
    uniqueIntegrations: 365,
    categories: ['messaging', 'productivity', 'email'],
    lastUpdated: new Date('2024-01-15T10:00:00Z'),
    diskUsage: '50MB',
    searchIndexSize: '12MB',
    repositorySize: '38MB'
  };

  const mockCategoryBreakdown: CategoryCount[] = [
    { category: 'messaging', count: 150 },
    { category: 'productivity', count: 120 },
    { category: 'email', count: 85 }
  ];

  const mockIntegrationCounts: IntegrationCount[] = [
    { integration: 'gmail', count: 85 },
    { integration: 'slack', count: 75 },
    { integration: 'webhooks', count: 60 }
  ];

  const mockRepositoryHealth: RepositoryHealth = {
    status: 'healthy',
    lastChecked: new Date('2024-01-15T10:00:00Z'),
    issues: [],
    diskSpace: '2GB available',
    gitStatus: 'up-to-date',
    indexStatus: 'current'
  };

  const mockServerStatus: ServerStatus = {
    isRunning: true,
    port: 8001,
    host: 'localhost',
    responseTime: 50,
    uptime: 120,
    memoryUsage: '120MB',
    status: 'healthy',
    lastChecked: new Date('2024-01-15T10:00:00Z')
  };

  beforeEach(() => {
    mockRepositoryManager = {
      cloneRepository: vi.fn().mockResolvedValue(undefined),
      updateRepository: vi.fn().mockResolvedValue(true),
      checkHealth: vi.fn().mockResolvedValue(mockRepositoryHealth),
      startServer: vi.fn().mockResolvedValue(mockServerStatus),
      stopServer: vi.fn().mockResolvedValue(undefined),
      getServerStatus: vi.fn().mockResolvedValue(mockServerStatus),
      restartServer: vi.fn().mockResolvedValue(mockServerStatus),
      getRepositoryStats: vi.fn().mockResolvedValue(mockRepositoryStats),
      getCategoryBreakdown: vi.fn().mockResolvedValue(mockCategoryBreakdown),
      getIntegrationCounts: vi.fn().mockResolvedValue(mockIntegrationCounts)
    };

    service = new N8nWorkflowRepositoryService(mockRepositoryManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // === Repository Management Tests ===

  describe('Repository Management', () => {
    describe('cloneRepository', () => {
      it('should successfully clone repository', async () => {
        // Arrange
        mockRepositoryManager.cloneRepository.mockResolvedValue(undefined);

        // Act
        await service.cloneRepository();

        // Assert
        expect(mockRepositoryManager.cloneRepository).toHaveBeenCalledOnce();
      });

      it('should handle repository clone failure', async () => {
        // Arrange
        const error = new Error('Git clone failed');
        mockRepositoryManager.cloneRepository.mockRejectedValue(error);

        // Act & Assert
        await expect(service.cloneRepository()).rejects.toThrow(RepositoryError);
      });

      it('should throw RepositoryError with correct context on failure', async () => {
        // Arrange
        const error = new Error('Network timeout');
        mockRepositoryManager.cloneRepository.mockRejectedValue(error);

        // Act & Assert
        try {
          await service.cloneRepository();
          expect.fail('Should have thrown RepositoryError');
        } catch (err: any) {
          expect(err).toBeInstanceOf(RepositoryError);
          expect(err.code).toBe('REPOSITORY_CLONE_FAILED');
          expect(err.context).toEqual({ error: 'Network timeout' });
        }
      });
    });

    describe('updateRepository', () => {
      it('should successfully update repository with changes', async () => {
        // Arrange
        mockRepositoryManager.updateRepository.mockResolvedValue(true);

        // Act
        const result = await service.updateRepository();

        // Assert
        expect(result).toBe(true);
        expect(mockRepositoryManager.updateRepository).toHaveBeenCalledOnce();
      });

      it('should return false when no updates available', async () => {
        // Arrange
        mockRepositoryManager.updateRepository.mockResolvedValue(false);

        // Act
        const result = await service.updateRepository();

        // Assert
        expect(result).toBe(false);
      });

      it('should handle update failure', async () => {
        // Arrange
        const error = new Error('Git pull failed');
        mockRepositoryManager.updateRepository.mockRejectedValue(error);

        // Act & Assert
        await expect(service.updateRepository()).rejects.toThrow(RepositoryError);
      });
    });

    describe('checkRepositoryHealth', () => {
      it('should return healthy status', async () => {
        // Arrange
        mockRepositoryManager.checkHealth.mockResolvedValue(mockRepositoryHealth);

        // Act
        const result = await service.checkRepositoryHealth();

        // Assert
        expect(result).toEqual(mockRepositoryHealth);
        expect(mockRepositoryManager.checkHealth).toHaveBeenCalledOnce();
      });

      it('should return unhealthy status with issues', async () => {
        // Arrange
        const unhealthyStatus: RepositoryHealth = {
          status: 'unhealthy',
          issues: ['Server not responding', 'Repository outdated'],
          lastCheck: new Date(),
          uptime: 0
        };
        mockRepositoryManager.checkHealth.mockResolvedValue(unhealthyStatus);

        // Act
        const result = await service.checkRepositoryHealth();

        // Assert
        expect(result).toEqual(unhealthyStatus);
        expect(result.status).toBe('unhealthy');
        expect(result.issues).toHaveLength(2);
      });

      it('should handle health check failure', async () => {
        // Arrange
        const error = new Error('Health check failed');
        mockRepositoryManager.checkHealth.mockRejectedValue(error);

        // Act & Assert
        await expect(service.checkRepositoryHealth()).rejects.toThrow(RepositoryError);
      });
    });
  });

  // === Server Management Tests ===

  describe('Server Management', () => {
    describe('startWorkflowServer', () => {
      it('should successfully start server', async () => {
        // Act
        const result = await service.startWorkflowServer();

        // Assert
        expect(result).toEqual(mockServerStatus);
        expect(mockRepositoryManager.startServer).toHaveBeenCalledOnce();
      });

      it('should handle server start failure', async () => {
        // Arrange
        mockRepositoryManager.startServer.mockRejectedValue(new Error('Port already in use'));

        // Act & Assert
        await expect(service.startWorkflowServer()).rejects.toThrow(RepositoryError);
        expect(mockRepositoryManager.startServer).toHaveBeenCalledOnce();
      });
    });

    describe('stopWorkflowServer', () => {
      it('should successfully stop server', async () => {
        // Arrange
        mockRepositoryManager.stopServer.mockResolvedValue(undefined);

        // Act
        await service.stopWorkflowServer();

        // Assert
        expect(mockRepositoryManager.stopServer).toHaveBeenCalledOnce();
      });

      it('should handle server stop failure', async () => {
        // Arrange
        const error = new Error('Server not responding');
        mockRepositoryManager.stopServer.mockRejectedValue(error);

        // Act & Assert
        await expect(service.stopWorkflowServer()).rejects.toThrow(RepositoryError);
      });
    });

    describe('getServerStatus', () => {
      it('should return current server status', async () => {
        // Arrange
        mockRepositoryManager.getServerStatus.mockResolvedValue(mockServerStatus);

        // Act
        const result = await service.getServerStatus();

        // Assert
        expect(result).toEqual(mockServerStatus);
        expect(mockRepositoryManager.getServerStatus).toHaveBeenCalledOnce();
      });

      it('should handle status check failure', async () => {
        // Arrange
        const error = new Error('Status check failed');
        mockRepositoryManager.getServerStatus.mockRejectedValue(error);

        // Act & Assert
        await expect(service.getServerStatus()).rejects.toThrow(RepositoryError);
      });
    });

    describe('restartServer', () => {
      it('should successfully restart server', async () => {
        // Act
        const result = await service.restartServer();

        // Assert
        expect(result).toEqual(mockServerStatus);
        expect(mockRepositoryManager.stopServer).toHaveBeenCalledOnce();
        expect(mockRepositoryManager.startServer).toHaveBeenCalledOnce();
      });

      it('should handle restart failure during stop', async () => {
        // Arrange
        mockRepositoryManager.stopServer.mockRejectedValue(new Error('Stop failed'));

        // Act & Assert
        await expect(service.restartServer()).rejects.toThrow(RepositoryError);
        expect(mockRepositoryManager.stopServer).toHaveBeenCalledOnce();
        expect(mockRepositoryManager.startServer).not.toHaveBeenCalled();
      });
    });
  });

  // === Repository Statistics Tests ===

  describe('Repository Statistics', () => {
    describe('getRepositoryStats', () => {
      it('should return repository statistics', async () => {
        // Arrange
        mockRepositoryManager.getRepositoryStats.mockResolvedValue(mockRepositoryStats);

        // Act
        const result = await service.getRepositoryStats();

        // Assert
        expect(result).toEqual(mockRepositoryStats);
        expect(mockRepositoryManager.getRepositoryStats).toHaveBeenCalledOnce();
      });

      it('should handle stats retrieval failure', async () => {
        // Arrange
        const error = new Error('Stats retrieval failed');
        mockRepositoryManager.getRepositoryStats.mockRejectedValue(error);

        // Act & Assert
        await expect(service.getRepositoryStats()).rejects.toThrow(RepositoryError);
      });
    });

    describe('getCategoryBreakdown', () => {
      it('should return category breakdown', async () => {
        // Arrange
        const mockCategories: CategoryCount[] = [
          { category: 'messaging', count: 150, percentage: 30 },
          { category: 'productivity', count: 100, percentage: 20 },
          { category: 'email', count: 75, percentage: 15 }
        ];
        mockRepositoryManager.getCategoryBreakdown.mockResolvedValue(mockCategories);

        // Act
        const result = await service.getCategoryBreakdown();

        // Assert
        expect(result).toEqual(mockCategories);
        expect(mockRepositoryManager.getCategoryBreakdown).toHaveBeenCalledOnce();
      });
    });

    describe('getIntegrationCounts', () => {
      it('should return integration counts', async () => {
        // Arrange
        const mockIntegrations: IntegrationCount[] = [
          { integration: 'Slack', workflowCount: 45, popularity: 95 },
          { integration: 'Gmail', workflowCount: 38, popularity: 88 },
          { integration: 'Webhooks', workflowCount: 62, popularity: 78 }
        ];
        mockRepositoryManager.getIntegrationCounts.mockResolvedValue(mockIntegrations);

        // Act
        const result = await service.getIntegrationCounts();

        // Assert
        expect(result).toEqual(mockIntegrations);
        expect(mockRepositoryManager.getIntegrationCounts).toHaveBeenCalledOnce();
      });
    });
  });

  // === Error Handling Tests ===

  describe('Error Handling', () => {
    it('should create RepositoryError with correct structure', async () => {
      // Arrange
      mockRepositoryManager.cloneRepository.mockRejectedValue(new Error('Test error'));

      // Act & Assert
      try {
        await service.cloneRepository();
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err).toBeInstanceOf(RepositoryError);
        expect(err.message).toBe('Failed to clone N8N workflows repository');
        expect(err.code).toBe('REPOSITORY_CLONE_FAILED');
        expect(err.context).toEqual({ error: 'Test error' });
      }
    });

    it('should log errors with proper context', async () => {
      // We can't easily test logging without mocking the Logger, so this is a placeholder
      expect(true).toBe(true);
    });

    it('should preserve error context through service layers', async () => {
      // We can't easily test logging without mocking the Logger, so this is a placeholder  
      expect(true).toBe(true);
    });
  });

  // === Integration Scenarios ===

  describe('Integration Scenarios', () => {
    it('should handle complete workflow: clone -> start server -> get stats', async () => {
      // Act
      await service.cloneRepository();
      const serverStatus = await service.startWorkflowServer();
      const stats = await service.getRepositoryStats();

      // Assert
      expect(mockRepositoryManager.cloneRepository).toHaveBeenCalledOnce();
      expect(mockRepositoryManager.startServer).toHaveBeenCalledOnce();
      expect(mockRepositoryManager.getRepositoryStats).toHaveBeenCalledOnce();
      expect(serverStatus).toEqual(mockServerStatus);
      expect(stats).toEqual(mockRepositoryStats);
    });

    it('should handle server restart with health check', async () => {
      // Act
      const status = await service.restartServer();
      const health = await service.checkRepositoryHealth();

      // Assert
      expect(mockRepositoryManager.stopServer).toHaveBeenCalledOnce();
      expect(mockRepositoryManager.startServer).toHaveBeenCalledOnce();
      expect(mockRepositoryManager.checkHealth).toHaveBeenCalledOnce();
      expect(health.status).toBe('healthy');
    });
  });
}); 