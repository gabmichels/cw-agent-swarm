import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  RepositoryStats, 
  RepositoryHealth, 
  ServerStatus, 
  CategoryCount, 
  IntegrationCount,
  WorkflowCategory,
  RepositoryError
} from '../../../types/workflow';
import { logger } from '../../../lib/logging';

const execAsync = promisify(exec);

// === Repository Manager Implementation ===

export class RepositoryManager {
  private readonly serviceName = 'RepositoryManager';
  private readonly REPO_URL = 'https://github.com/Zie619/n8n-workflows.git';
  private readonly LOCAL_PATH = './data/n8n-workflows-repo';
  private readonly SERVER_PORT = 8001; // Avoid conflicts with main app
  private serverProcess: ChildProcess | null = null;
  private lastHealthCheck: Date = new Date();
  private serverStartTime: Date | null = null;
  
  constructor() {}
  
  // === Repository Operations ===
  
  async cloneRepository(): Promise<void> {
    logger.info(`[${this.serviceName}] Starting repository clone`, { 
      repoUrl: this.REPO_URL,
      localPath: this.LOCAL_PATH 
    });
    
    try {
      // Check if repository already exists
      const repoExists = await this.checkRepositoryExists();
      if (repoExists) {
        logger.info(`[${this.serviceName}] Repository already exists, skipping clone`);
        return;
      }
      
      // Ensure data directory exists
      await this.ensureDataDirectory();
      
      // Clone the repository
      const { stdout, stderr } = await execAsync(
        `git clone ${this.REPO_URL} ${this.LOCAL_PATH}`,
        { timeout: 300000 } // 5 minutes timeout
      );
      
      logger.info(`[${this.serviceName}] Repository cloned successfully`, {
        stdout: stdout.trim(),
        stderr: stderr?.trim()
      });
      
      // Setup Python environment
      await this.setupPythonEnvironment();
      
    } catch (error) {
      logger.error(`[${this.serviceName}] Repository clone failed`, { error: error instanceof Error ? error.message : String(error) });
      throw new RepositoryError(
        'Failed to clone repository',
        'CLONE_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  async updateRepository(): Promise<boolean> {
    logger.info(`[${this.serviceName}] Starting repository update`);
    
    try {
      // Check if repository exists
      const repoExists = await this.checkRepositoryExists();
      if (!repoExists) {
        logger.warn(`[${this.serviceName}] Repository does not exist, cloning instead`);
        await this.cloneRepository();
        return true;
      }
      
      // Get current commit hash
      const { stdout: beforeHash } = await execAsync(
        'git rev-parse HEAD',
        { cwd: this.LOCAL_PATH }
      );
      
      // Pull latest changes
      const { stdout, stderr } = await execAsync(
        'git pull origin main',
        { cwd: this.LOCAL_PATH, timeout: 120000 } // 2 minutes timeout
      );
      
      // Get new commit hash
      const { stdout: afterHash } = await execAsync(
        'git rev-parse HEAD',
        { cwd: this.LOCAL_PATH }
      );
      
      const hasUpdates = beforeHash.trim() !== afterHash.trim();
      
      logger.info(`[${this.serviceName}] Repository update completed`, {
        hasUpdates,
        beforeHash: beforeHash.trim(),
        afterHash: afterHash.trim(),
        stdout: stdout.trim(),
        stderr: stderr?.trim()
      });
      
      // If there are updates, restart the server to pick up changes
      if (hasUpdates && this.serverProcess) {
        logger.info(`[${this.serviceName}] Updates detected, restarting server`);
        await this.restartServer();
      }
      
      return hasUpdates;
      
    } catch (error) {
      logger.error(`[${this.serviceName}] Repository update failed`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new RepositoryError(
        'Failed to update repository',
        'UPDATE_OPERATION_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  async checkHealth(): Promise<RepositoryHealth> {
    logger.debug(`[${this.serviceName}] Checking repository health`);
    
    const issues: string[] = [];
    this.lastHealthCheck = new Date();
    
    try {
      // Check if repository exists
      const repoExists = await this.checkRepositoryExists();
      if (!repoExists) {
        issues.push('Repository not found locally');
      }
      
      // Check if repository is up to date (last update within 24 hours)
      if (repoExists) {
        const lastUpdate = await this.getLastUpdateTime();
        const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceUpdate > 24) {
          issues.push(`Repository not updated in ${Math.round(hoursSinceUpdate)} hours`);
        }
      }
      
      // Check server health
      const serverStatus = await this.getServerStatus();
      if (!serverStatus.isRunning) {
        issues.push('API server not running');
      }
      
      if (serverStatus.responseTime > 1000) {
        issues.push(`API response time too slow: ${serverStatus.responseTime}ms`);
      }
      
      // Check Python dependencies
      if (repoExists) {
        const dependenciesOk = await this.checkPythonDependencies();
        if (!dependenciesOk) {
          issues.push('Python dependencies missing or outdated');
        }
      }
      
      const uptime = this.serverStartTime 
        ? Math.floor((Date.now() - this.serverStartTime.getTime()) / 1000)
        : 0;
      
      return {
        status: issues.length === 0 ? 'healthy' : 'unhealthy',
        issues,
        lastCheck: this.lastHealthCheck,
        uptime
      };
      
    } catch (error) {
      logger.error(`[${this.serviceName}] Health check failed`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      issues.push(`Health check error: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        status: 'unhealthy',
        issues,
        lastCheck: this.lastHealthCheck,
        uptime: 0
      };
    }
  }
  
  // === Server Management ===
  
  async startServer(): Promise<ServerStatus> {
    logger.info(`[${this.serviceName}] Starting workflow server`, { port: this.SERVER_PORT });
    
    try {
      // Check if repository exists
      const repoExists = await this.checkRepositoryExists();
      if (!repoExists) {
        throw new Error('Repository not found. Please clone repository first.');
      }
      
      // Stop existing server if running
      if (this.serverProcess) {
        await this.stopServer();
      }
      
      // Start the Python FastAPI server
      this.serverProcess = spawn('python', ['-m', 'api_server', '--port', this.SERVER_PORT.toString()], {
        cwd: this.LOCAL_PATH,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      this.serverStartTime = new Date();
      
      // Handle server process events
      this.serverProcess.on('error', (error) => {
        logger.error(`[${this.serviceName}] Server process error`, { 
          error: error instanceof Error ? error.message : String(error) 
        });
      });
      
      this.serverProcess.on('exit', (code, signal) => {
        logger.warn(`[${this.serviceName}] Server process exited`, { code, signal });
        this.serverProcess = null;
        this.serverStartTime = null;
      });
      
      // Wait for server to be ready
      await this.waitForServer();
      
      const status = await this.getServerStatus();
      logger.info(`[${this.serviceName}] Workflow server started successfully`, status);
      
      return status;
      
    } catch (error) {
      logger.error(`[${this.serviceName}] Failed to start server`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      this.serverProcess = null;
      this.serverStartTime = null;
      
      throw new RepositoryError(
        'Failed to start workflow server',
        'SERVER_START_FAILED',
        { 
          port: this.SERVER_PORT,
          error: error instanceof Error ? error.message : String(error) 
        }
      );
    }
  }
  
  async stopServer(): Promise<void> {
    logger.info(`[${this.serviceName}] Stopping workflow server`);
    
    if (!this.serverProcess) {
      logger.debug(`[${this.serviceName}] No server process to stop`);
      return;
    }
    
    try {
      // Send SIGTERM to gracefully shut down
      this.serverProcess.kill('SIGTERM');
      
      // Wait for process to exit (max 10 seconds)
      const exitPromise = new Promise<void>((resolve) => {
        this.serverProcess!.on('exit', () => resolve());
      });
      
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Server shutdown timeout')), 10000);
      });
      
      await Promise.race([exitPromise, timeoutPromise]);
      
      this.serverProcess = null;
      this.serverStartTime = null;
      
      logger.info(`[${this.serviceName}] Workflow server stopped successfully`);
      
    } catch (error) {
      logger.error(`[${this.serviceName}] Error stopping server`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      // Force kill if graceful shutdown failed
      if (this.serverProcess) {
        logger.warn(`[${this.serviceName}] Force killing server process`);
        this.serverProcess.kill('SIGKILL');
        this.serverProcess = null;
        this.serverStartTime = null;
      }
      
      throw new RepositoryError(
        'Failed to stop workflow server',
        'SERVER_STOP_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  async getServerStatus(): Promise<ServerStatus> {
    const isRunning = this.serverProcess !== null && !this.serverProcess.killed;
    
    if (!isRunning) {
      return {
        isRunning: false,
        port: this.SERVER_PORT,
        responseTime: 0,
        uptime: 0,
        memoryUsage: '0MB',
        errorRate: 1.0,
        lastHealthCheck: new Date()
      };
    }
    
    try {
      // Test server connectivity
      const startTime = Date.now();
      const response = await fetch(`http://localhost:${this.SERVER_PORT}/api/health`);
      const responseTime = Date.now() - startTime;
      
      const uptime = this.serverStartTime 
        ? Math.floor((Date.now() - this.serverStartTime.getTime()) / 1000)
        : 0;
      
      // Get memory usage (simplified)
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
      
      return {
        isRunning: response.ok,
        port: this.SERVER_PORT,
        responseTime,
        uptime,
        memoryUsage: `${Math.round(memoryUsage)}MB`,
        errorRate: response.ok ? 0.0 : 1.0,
        lastHealthCheck: new Date()
      };
      
    } catch (error) {
      logger.debug(`[${this.serviceName}] Server connectivity test failed`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return {
        isRunning: false,
        port: this.SERVER_PORT,
        responseTime: 0,
        uptime: 0,
        memoryUsage: '0MB',
        errorRate: 1.0,
        lastHealthCheck: new Date()
      };
    }
  }
  
  async restartServer(): Promise<ServerStatus> {
    logger.info(`[${this.serviceName}] Restarting workflow server`);
    
    await this.stopServer();
    // Wait 2 seconds before restarting
    await new Promise(resolve => setTimeout(resolve, 2000));
    return await this.startServer();
  }
  
  // === Repository Statistics ===
  
  async getRepositoryStats(): Promise<RepositoryStats> {
    logger.debug(`[${this.serviceName}] Fetching repository statistics`);
    
    try {
      // Make API call to get stats
      const response = await fetch(`http://localhost:${this.SERVER_PORT}/api/stats`);
      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Get disk usage
      const diskUsage = await this.calculateDiskUsage();
      
      return {
        totalWorkflows: data.total_workflows || 0,
        activeWorkflows: data.active_workflows || 0,
        totalNodes: data.total_nodes || 0,
        uniqueIntegrations: data.unique_integrations || 0,
        categories: data.categories || [],
        lastUpdated: new Date(data.last_updated || Date.now()),
        diskUsage,
        searchIndexSize: data.search_index_size || '0MB'
      };
      
    } catch (error) {
      logger.error(`[${this.serviceName}] Failed to get repository stats`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new RepositoryError(
        'Failed to get repository statistics',
        'STATS_API_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  async getCategoryBreakdown(): Promise<CategoryCount[]> {
    logger.debug(`[${this.serviceName}] Fetching category breakdown`);
    
    try {
      const response = await fetch(`http://localhost:${this.SERVER_PORT}/api/categories`);
      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return data.categories.map((cat: any) => ({
        category: cat.category as WorkflowCategory,
        count: cat.count
      }));
      
    } catch (error) {
      logger.error(`[${this.serviceName}] Failed to get category breakdown`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new RepositoryError(
        'Failed to get category breakdown',
        'CATEGORIES_API_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  async getIntegrationCounts(): Promise<IntegrationCount[]> {
    logger.debug(`[${this.serviceName}] Fetching integration counts`);
    
    try {
      const response = await fetch(`http://localhost:${this.SERVER_PORT}/api/integrations`);
      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return data.integrations.map((integration: any) => ({
        integration: integration.name,
        count: integration.count
      }));
      
    } catch (error) {
      logger.error(`[${this.serviceName}] Failed to get integration counts`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new RepositoryError(
        'Failed to get integration counts',
        'INTEGRATIONS_API_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  // === Private Helper Methods ===
  
  private async checkRepositoryExists(): Promise<boolean> {
    try {
      await fs.access(this.LOCAL_PATH);
      await fs.access(path.join(this.LOCAL_PATH, '.git'));
      return true;
    } catch {
      return false;
    }
  }
  
  private async ensureDataDirectory(): Promise<void> {
    const dataDir = path.dirname(this.LOCAL_PATH);
    await fs.mkdir(dataDir, { recursive: true });
  }
  
  private async setupPythonEnvironment(): Promise<void> {
    logger.info(`[${this.serviceName}] Setting up Python environment`);
    
    try {
      // Install requirements
      const { stdout, stderr } = await execAsync(
        'pip install -r requirements.txt',
        { cwd: this.LOCAL_PATH, timeout: 300000 } // 5 minutes timeout
      );
      
      logger.info(`[${this.serviceName}] Python dependencies installed`, {
        stdout: stdout.trim(),
        stderr: stderr?.trim()
      });
      
    } catch (error) {
      logger.error(`[${this.serviceName}] Failed to setup Python environment`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new RepositoryError(
        'Failed to setup Python environment',
        'PYTHON_SETUP_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  
  private async checkPythonDependencies(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        'pip check',
        { cwd: this.LOCAL_PATH }
      );
      return stdout.trim() === '';
    } catch {
      return false;
    }
  }
  
  private async waitForServer(maxRetries = 30): Promise<void> {
    logger.debug(`[${this.serviceName}] Waiting for server to be ready`);
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`http://localhost:${this.SERVER_PORT}/api/health`);
        if (response.ok) {
          logger.debug(`[${this.serviceName}] Server is ready`);
          return;
        }
      } catch (error) {
        logger.debug(`[${this.serviceName}] Server not ready, attempt ${i + 1}/${maxRetries}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    }
    
    throw new Error('Server failed to start within 30 seconds');
  }
  
  private async getLastUpdateTime(): Promise<Date> {
    try {
      const { stdout } = await execAsync(
        'git log -1 --format=%ct',
        { cwd: this.LOCAL_PATH }
      );
      
      const timestamp = parseInt(stdout.trim()) * 1000; // Convert to milliseconds
      return new Date(timestamp);
    } catch {
      return new Date(0); // Return epoch if can't determine
    }
  }
  
  private async calculateDiskUsage(): Promise<string> {
    try {
      const { stdout } = await execAsync(
        process.platform === 'win32' 
          ? `powershell "(Get-ChildItem -Recurse '${this.LOCAL_PATH}' | Measure-Object -Property Length -Sum).Sum / 1MB"`
          : `du -sm ${this.LOCAL_PATH}`,
        { timeout: 30000 }
      );
      
      const sizeMB = process.platform === 'win32'
        ? Math.round(parseFloat(stdout.trim()))
        : parseInt(stdout.split('\t')[0]);
        
      return `${sizeMB}MB`;
    } catch {
      return 'Unknown';
    }
  }
} 