#!/usr/bin/env ts-node

/**
 * N8N Workflow Repository Setup Script
 * 
 * This script sets up the N8N workflow repository integration:
 * 1. Clones the repository
 * 2. Sets up Python environment
 * 3. Starts the FastAPI server
 * 4. Validates the integration
 * 5. Runs basic tests
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { access, constants } from 'fs/promises';
import { join } from 'path';
import { logger } from '../src/lib/logging';
import { N8nWorkflowRepositoryService } from '../src/services/external-workflows/integrations/N8nWorkflowRepositoryService';
import { WorkflowSearchService } from '../src/services/external-workflows/integrations/WorkflowSearchService';
import { N8nWorkflowApiClient } from '../src/services/external-workflows/integrations/N8nWorkflowApiClient';
import { RepositoryManager } from '../src/services/external-workflows/integrations/RepositoryManager';
import type { 
  WorkflowSearchQuery, 
  WorkflowSearchResult, 
  N8nWorkflowTemplate,
  WorkflowCategory 
} from '../src/types/workflow';

const execAsync = promisify(exec);

// === Configuration ===

const config = {
  repositoryUrl: 'https://github.com/Zie619/n8n-workflows.git',
  localPath: './data/n8n-workflows-repo',
  serverPort: 8080,
  maxRetries: 3,
  timeoutMs: 30000
};

// === Setup Script Class ===

export class N8nWorkflowRepositorySetup {
  private repositoryService: N8nWorkflowRepositoryService;
  private searchService: WorkflowSearchService;
  private logger = logger;

  constructor() {
    const repositoryManager = new RepositoryManager();
    const apiClient = new N8nWorkflowApiClient();
    
    this.repositoryService = new N8nWorkflowRepositoryService(repositoryManager);
    this.searchService = new WorkflowSearchService(apiClient);
  }

  // === Public Methods ===

  public async run(): Promise<void> {
    try {
      this.logger.info('🚀 Starting N8n Workflow Repository Setup...');
      
      await this.checkDependencies();
      await this.initializeRepository();
      await this.validateInstallation();
      await this.testSearchCapabilities();
      
      this.logger.info('✅ Setup completed successfully!');
    } catch (error) {
      this.logger.error('❌ Setup failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  public async cleanup(): Promise<void> {
    this.logger.info('🧹 Cleaning up...');
    
    try {
      await this.repositoryService.stopWorkflowServer();
      this.logger.info('✅ Server stopped successfully');
    } catch (error) {
      this.logger.warn('⚠️ Cleanup warning', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  // === Private Setup Methods ===
  
  private async checkDependencies(): Promise<void> {
    this.logger.info('🔧 Checking dependencies...');
    
    // Check if Python is available
    try {
      await execAsync('python --version');
      this.logger.info('✅ Python is available');
    } catch {
      try {
        await execAsync('python3 --version');
        this.logger.info('✅ Python3 is available');
      } catch {
        throw new Error('Python is not available. Please install Python 3.8+');
      }
    }
    
    // Check if Git is available
    try {
      await execAsync('git --version');
      this.logger.info('✅ Git is available');
    } catch {
      throw new Error('Git is not available. Please install Git');
    }
    
    this.logger.info('✅ All dependencies checked');
  }
  
  private async initializeRepository(): Promise<void> {
    this.logger.info('📁 Setting up repository...');
    
    try {
      if (await this.checkRepositoryExists()) {
        this.logger.info('📁 Repository exists, updating...');
        const hasUpdates = await this.repositoryService.updateRepository();
        if (hasUpdates) {
          this.logger.info('📁 Repository updated with new changes');
        } else {
          this.logger.info('📁 Repository is already up to date');
        }
      } else {
        this.logger.info('📁 Repository not found, cloning...');
        await this.repositoryService.cloneRepository();
        this.logger.info('📁 Repository cloned successfully');
      }
      
      // Verify repository structure
      await this.validateRepositoryStructure();
      
    } catch (error) {
      this.logger.error('❌ Repository setup failed', { error });
      throw error;
    }
  }
  
  private async validateInstallation(): Promise<void> {
    this.logger.info('🔍 Validating installation...');
    
    try {
      // Check repository health
      const health = await this.repositoryService.checkRepositoryHealth();
      
      if (health.status !== 'healthy') {
        throw new Error(`Repository health check failed: ${health.issues.join(', ')}`);
      }
      
      // Start the server
      const serverStatus = await this.repositoryService.startWorkflowServer();
      
      if (!serverStatus.isRunning) {
        throw new Error('Failed to start workflow server');
      }
      
      this.logger.info('✅ Installation validation passed', {
        repositoryHealth: health.status,
        serverRunning: serverStatus.isRunning,
        serverPort: serverStatus.port
      });
      
    } catch (error) {
      this.logger.error('❌ Installation validation failed', { error });
      throw error;
    }
  }
  
  private async testSearchCapabilities(): Promise<void> {
    this.logger.info('🔍 Testing search capabilities...');
    
    const searchTests: Array<{
      name: string;
      query: WorkflowSearchQuery;
    }> = [
      {
        name: 'Simple text search',
        query: { q: 'email', limit: 5 }
      },
      {
        name: 'Category search',
        query: { category: 'email' as WorkflowCategory, limit: 5 }
      },
      {
        name: 'Complex search with complexity filter',
        query: { q: 'automation', complexity: 'simple', limit: 5 }
      }
    ];
    
    for (const test of searchTests) {
      const startTime = Date.now();
      const results = await this.searchService.searchWorkflows(test.query);
      const responseTime = Date.now() - startTime;
      
      this.logger.info(`🔍 ${test.name} completed`, {
        responseTime: `${responseTime}ms`,
        resultCount: results.workflows.length,
        totalResults: results.total
      });
      
      if (responseTime > 500) {
        this.logger.warn('⚠️ Search response time is slow', {
          test: test.name,
          responseTime: `${responseTime}ms`,
          expected: '<100ms'
        });
      }
    }
    
    this.logger.info('✅ Search capabilities test completed');
  }

  // === Helper Methods ===
  
  private async checkRepositoryExists(): Promise<boolean> {
    try {
      await access(config.localPath);
      await access(join(config.localPath, '.git'), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
  
  private async validateRepositoryStructure(): Promise<void> {
    this.logger.info('📋 Validating repository structure...');
    
    const requiredFiles = [
      'api_server.py',
      'workflow_db.py', 
      'requirements.txt',
      'workflows'
    ];
    
    const missingFiles: string[] = [];
    
    for (const file of requiredFiles) {
      const filePath = join(config.localPath, file);
      try {
        await access(filePath);
      } catch {
        missingFiles.push(file);
      }
    }
    
    if (missingFiles.length > 0) {
      throw new Error(`Repository structure validation failed. Missing files: ${missingFiles.join(', ')}`);
    }
    
    this.logger.info('✅ Repository structure validated');
  }
}

// === Main Execution ===

if (require.main === module) {
  const setup = new N8nWorkflowRepositorySetup();
  setup.run()
    .then(() => {
      logger.info('🎉 N8n Workflow Repository Setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Setup failed', { error: error.message });
      setup.cleanup().finally(() => process.exit(1));
    });
} 