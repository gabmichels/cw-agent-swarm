import { 
  RepositoryStats, 
  RepositoryHealth, 
  ServerStatus, 
  CategoryCount, 
  IntegrationCount,
  RepositoryError
} from '../../../types/workflow';
import { RepositoryManager } from './RepositoryManager';
import { logger } from '../../../lib/logging';

// === Service Interface ===

export interface IN8nWorkflowRepositoryService {
  // Repository Management
  cloneRepository(): Promise<void>;
  updateRepository(): Promise<boolean>;
  checkRepositoryHealth(): Promise<RepositoryHealth>;
  
  // Server Management  
  startWorkflowServer(): Promise<ServerStatus>;
  stopWorkflowServer(): Promise<void>;
  getServerStatus(): Promise<ServerStatus>;
  restartServer(): Promise<ServerStatus>;
  
  // Repository Statistics
  getRepositoryStats(): Promise<RepositoryStats>;
  getCategoryBreakdown(): Promise<CategoryCount[]>;
  getIntegrationCounts(): Promise<IntegrationCount[]>;
}

// === Implementation ===

export class N8nWorkflowRepositoryService implements IN8nWorkflowRepositoryService {
  private readonly serviceName = 'N8nWorkflowRepositoryService';
  
  constructor(
    private readonly repositoryManager: RepositoryManager
  ) {}
  
  // === Repository Management ===
  
  async cloneRepository(): Promise<void> {
    logger.info(`[${this.serviceName}] Starting repository clone operation`);
    
    try {
      await this.repositoryManager.cloneRepository();
      logger.info(`[${this.serviceName}] Repository cloned successfully`);
    } catch (error) {
      logger.error(`[${this.serviceName}] Repository clone failed`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new RepositoryError(
        'Failed to clone N8N workflows repository',
        'CLONE_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  async updateRepository(): Promise<boolean> {
    logger.info(`[${this.serviceName}] Starting repository update operation`);
    
    try {
      const hasUpdates = await this.repositoryManager.updateRepository();
      logger.info(`[${this.serviceName}] Repository update completed`, { hasUpdates });
      return hasUpdates;
    } catch (error) {
      logger.error(`[${this.serviceName}] Repository update failed`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new RepositoryError(
        'Failed to update N8N workflows repository',
        'UPDATE_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  async checkRepositoryHealth(): Promise<RepositoryHealth> {
    logger.debug(`[${this.serviceName}] Checking repository health`);
    
    try {
      const health = await this.repositoryManager.checkHealth();
      logger.debug(`[${this.serviceName}] Repository health check completed`, { status: health.status });
      return health;
    } catch (error) {
      logger.error(`[${this.serviceName}] Repository health check failed`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new RepositoryError(
        'Failed to check repository health',
        'HEALTH_CHECK_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  // === Server Management ===
  
  async startWorkflowServer(): Promise<ServerStatus> {
    logger.info(`[${this.serviceName}] Starting workflow server`);
    
    try {
      const status = await this.repositoryManager.startServer();
      logger.info(`[${this.serviceName}] Workflow server started successfully`, { 
        port: status.port,
        responseTime: status.responseTime 
      });
      return status;
    } catch (error) {
      logger.error(`[${this.serviceName}] Failed to start workflow server`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new RepositoryError(
        'Failed to start workflow server',
        'SERVER_START_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  async stopWorkflowServer(): Promise<void> {
    logger.info(`[${this.serviceName}] Stopping workflow server`);
    
    try {
      await this.repositoryManager.stopServer();
      logger.info(`[${this.serviceName}] Workflow server stopped successfully`);
    } catch (error) {
      logger.error(`[${this.serviceName}] Failed to stop workflow server`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new RepositoryError(
        'Failed to stop workflow server',
        'SERVER_STOP_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  async getServerStatus(): Promise<ServerStatus> {
    logger.debug(`[${this.serviceName}] Checking server status`);
    
    try {
      const status = await this.repositoryManager.getServerStatus();
      logger.debug(`[${this.serviceName}] Server status retrieved`, { 
        isRunning: status.isRunning,
        responseTime: status.responseTime 
      });
      return status;
    } catch (error) {
      logger.error(`[${this.serviceName}] Failed to get server status`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new RepositoryError(
        'Failed to get server status',
        'SERVER_STATUS_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  async restartServer(): Promise<ServerStatus> {
    logger.info(`[${this.serviceName}] Restarting workflow server`);
    
    try {
      await this.stopWorkflowServer();
      // Wait 2 seconds before restarting
      await new Promise(resolve => setTimeout(resolve, 2000));
      const status = await this.startWorkflowServer();
      
      logger.info(`[${this.serviceName}] Workflow server restarted successfully`);
      return status;
    } catch (error) {
      logger.error(`[${this.serviceName}] Failed to restart workflow server`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new RepositoryError(
        'Failed to restart workflow server',
        'SERVER_RESTART_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  // === Repository Statistics ===
  
  async getRepositoryStats(): Promise<RepositoryStats> {
    logger.debug(`[${this.serviceName}] Fetching repository statistics`);
    
    try {
      const stats = await this.repositoryManager.getRepositoryStats();
      logger.debug(`[${this.serviceName}] Repository statistics retrieved`, { 
        totalWorkflows: stats.totalWorkflows,
        uniqueIntegrations: stats.uniqueIntegrations 
      });
      return stats;
    } catch (error) {
      logger.error(`[${this.serviceName}] Failed to get repository statistics`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new RepositoryError(
        'Failed to get repository statistics',
        'STATS_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  async getCategoryBreakdown(): Promise<CategoryCount[]> {
    logger.debug(`[${this.serviceName}] Fetching category breakdown`);
    
    try {
      const categories = await this.repositoryManager.getCategoryBreakdown();
      logger.debug(`[${this.serviceName}] Category breakdown retrieved`, { 
        categoriesCount: categories.length 
      });
      return categories;
    } catch (error) {
      logger.error(`[${this.serviceName}] Failed to get category breakdown`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new RepositoryError(
        'Failed to get category breakdown',
        'CATEGORY_BREAKDOWN_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  async getIntegrationCounts(): Promise<IntegrationCount[]> {
    logger.debug(`[${this.serviceName}] Fetching integration counts`);
    
    try {
      const integrations = await this.repositoryManager.getIntegrationCounts();
      logger.debug(`[${this.serviceName}] Integration counts retrieved`, { 
        integrationsCount: integrations.length 
      });
      return integrations;
    } catch (error) {
      logger.error(`[${this.serviceName}] Failed to get integration counts`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new RepositoryError(
        'Failed to get integration counts',
        'INTEGRATION_COUNTS_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
} 