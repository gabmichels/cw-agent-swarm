/**
 * MarketScanScheduler.ts - Schedule and manage recurring market scans
 * 
 * This module provides functionality to schedule and manage recurring market scans
 * using the system's task scheduler.
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../../lib/logging';
import { IMarketScanner } from './MarketScanner.interface';
import { MarketTrend } from './MarketScanner.interface';
import { ModularSchedulerManager } from '../../../../lib/scheduler/implementations/ModularSchedulerManager';
import { MarketScanCommand } from './MarketScannerNLP';
import { Task, TaskPriority, TaskStatus, TaskScheduleType, taskPriorityToNumber } from '../../../../lib/scheduler/models/Task.model';

/**
 * Scheduled market scan metadata
 */
export interface ScheduledMarketScan {
  id: string;
  description: string;
  cronExpression: string;
  humanReadable: string;
  category?: string;
  limit?: number;
  minScore?: number;
  summarize: boolean;
  createdAt: Date;
  lastRun?: Date;
  nextRun?: Date;
  taskId?: string;
}

/**
 * Market scan scheduler that manages scheduled market scans
 */
export class MarketScanScheduler {
  private marketScanner: IMarketScanner;
  private schedulerManager?: ModularSchedulerManager;
  private scheduledScans: Map<string, ScheduledMarketScan> = new Map();
  private isInitialized = false;
  private datastorePath: string = './data/market-scans/scheduled.json';

  /**
   * Create a new MarketScanScheduler
   * 
   * @param marketScanner Market scanner instance to use for scans
   */
  constructor(marketScanner: IMarketScanner) {
    this.marketScanner = marketScanner;
  }

  /**
   * Initialize the scheduler with a scheduler manager
   * 
   * @param schedulerManager Scheduler manager instance
   */
  async initialize(schedulerManager: ModularSchedulerManager): Promise<void> {
    this.schedulerManager = schedulerManager;
    
    // Load any previously scheduled scans
    await this.loadScheduledScans();
    
    // Schedule all scans
    for (const scan of this.scheduledScans.values()) {
      await this.scheduleMarketScan(scan);
    }
    
    this.isInitialized = true;
    logger.info(`Market scan scheduler initialized with ${this.scheduledScans.size} scheduled scans`);
  }

  /**
   * Schedule a new market scan
   * 
   * @param command Market scan command
   * @returns Scheduled scan info
   */
  async scheduleMarketScanFromCommand(command: MarketScanCommand): Promise<ScheduledMarketScan> {
    if (!this.isInitialized || !this.schedulerManager) {
      throw new Error('Market scan scheduler not initialized');
    }
    
    if (!command.schedule) {
      throw new Error('Cannot schedule a market scan without schedule information');
    }
    
    // Create the scheduled scan
    const scanId = `scan-${uuidv4().substring(0, 8)}`;
    const category = command.category || 'ai';
    
    const scheduledScan: ScheduledMarketScan = {
      id: scanId,
      description: `Market scan for ${category}`,
      cronExpression: command.schedule.cronExpression,
      humanReadable: command.schedule.humanReadable,
      category,
      limit: command.limit,
      minScore: command.minScore,
      summarize: command.summarize || false,
      createdAt: new Date(),
    };
    
    // Schedule the scan with the scheduler manager
    await this.scheduleMarketScan(scheduledScan);
    
    // Save to our map
    this.scheduledScans.set(scanId, scheduledScan);
    
    // Save to persistent storage
    await this.saveScheduledScans();
    
    return scheduledScan;
  }

  /**
   * Schedule a market scan using the scheduler manager
   * 
   * @param scan Scheduled scan to schedule
   */
  private async scheduleMarketScan(scan: ScheduledMarketScan): Promise<void> {
    if (!this.schedulerManager) {
      throw new Error('Scheduler manager not available');
    }
    
    // Create task for the market scan
    const task: Task = {
      id: scan.taskId || `market-scan-${scan.id}`,
      name: scan.description,
      description: `Scheduled market scan for ${scan.category || 'all categories'}`,
      scheduleType: TaskScheduleType.INTERVAL,
      handler: async () => { return await this.runMarketScanTask(task); },
      status: TaskStatus.PENDING,
      priority: taskPriorityToNumber(TaskPriority.MEDIUM),
      createdAt: new Date(),
      updatedAt: new Date(),
      interval: {
        expression: scan.cronExpression,
        cronExpression: scan.cronExpression,
        executionCount: 0
      },
      metadata: {
        scanId: scan.id,
        category: scan.category,
        limit: scan.limit,
        minScore: scan.minScore,
        summarize: scan.summarize
      }
    };
    
    // If the task already exists, update it
    if (scan.taskId) {
      // Check if task exists
      const existingTask = await this.schedulerManager.getTask(scan.taskId);
      if (existingTask) {
        await this.schedulerManager.updateTask(task);
        logger.info(`Updated scheduled market scan task: ${task.id}`);
        return;
      }
    }
    
    // Otherwise, create a new task
    const scheduledTask = await this.schedulerManager.createTask(task);
    
    // Update the scan with the task ID
    scan.taskId = scheduledTask.id;
    
    // Calculate next run time (simplified - set to current time + 1 hour as placeholder)
    try {
      scan.nextRun = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    } catch (error) {
      logger.warn(`Failed to calculate next run time for scheduled scan ${scan.id}:`, error);
    }
    
    logger.info(`Scheduled market scan: ${scan.id}, next run: ${scan.nextRun?.toLocaleString() || 'unknown'}`);
  }

  /**
   * Cancel a scheduled market scan
   * 
   * @param scanId ID of the scan to cancel
   * @returns True if the scan was cancelled, false otherwise
   */
  async cancelScheduledScan(scanId: string): Promise<boolean> {
    if (!this.isInitialized || !this.schedulerManager) {
      throw new Error('Market scan scheduler not initialized');
    }
    
    // Check if we have this scan
    const scan = this.scheduledScans.get(scanId);
    if (!scan) {
      return false;
    }
    
    // If we have a task ID, delete the task
    if (scan.taskId) {
      try {
        await this.schedulerManager.deleteTask(scan.taskId);
      } catch (error) {
        logger.error(`Error deleting task ${scan.taskId} for scan ${scanId}:`, error);
      }
    }
    
    // Remove from our map
    this.scheduledScans.delete(scanId);
    
    // Save to persistent storage
    await this.saveScheduledScans();
    
    logger.info(`Cancelled scheduled market scan: ${scanId}`);
    return true;
  }

  /**
   * Get all scheduled market scans
   * 
   * @returns List of all scheduled scans
   */
  getScheduledScans(): ScheduledMarketScan[] {
    return Array.from(this.scheduledScans.values());
  }

  /**
   * Run a market scan task
   * 
   * @param task Scheduled task
   * @returns Scan results
   */
  async runMarketScanTask(task: Task): Promise<MarketTrend[]> {
    if (!task.metadata || !task.metadata.scanId) {
      throw new Error('Invalid market scan task: missing scanId');
    }
    
    const scanId = task.metadata.scanId as string;
    const scan = this.scheduledScans.get(scanId);
    
    if (!scan) {
      throw new Error(`Scheduled scan not found: ${scanId}`);
    }
    
    // Update last run time
    scan.lastRun = new Date();
    
    // Run the scan
    const category = scan.category;
    const minScore = scan.minScore || 50;
    const limit = scan.limit || 10;
    
    logger.info(`Running scheduled market scan: ${scanId}, category: ${category || 'all'}`);
    
    // If we need to refresh trends first, do it
    await this.marketScanner.refreshTrends();
    
    // Get trends
    const trends = await this.marketScanner.getTrends(category, minScore, limit);
    
    logger.info(`Completed scheduled market scan ${scanId}, found ${trends.length} trends`);
    
    // Save to persistent storage (to update lastRun)
    await this.saveScheduledScans();
    
    return trends;
  }
  
  /**
   * Load scheduled scans from persistent storage
   */
  private async loadScheduledScans(): Promise<void> {
    try {
      // Use dynamic import to load the fs module
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Ensure the directory exists
      const dir = path.dirname(this.datastorePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Check if file exists
      try {
        await fs.access(this.datastorePath);
      } catch (error) {
        // File doesn't exist, create an empty file
        await fs.writeFile(this.datastorePath, JSON.stringify([], null, 2));
        return;
      }
      
      // Read the file
      const data = await fs.readFile(this.datastorePath, 'utf8');
      const scans = JSON.parse(data);
      
      // Convert to Map
      this.scheduledScans.clear();
      for (const scan of scans) {
        // Convert date strings back to Date objects
        scan.createdAt = new Date(scan.createdAt);
        if (scan.lastRun) scan.lastRun = new Date(scan.lastRun);
        if (scan.nextRun) scan.nextRun = new Date(scan.nextRun);
        
        this.scheduledScans.set(scan.id, scan);
      }
      
      logger.info(`Loaded ${this.scheduledScans.size} scheduled market scans`);
    } catch (error) {
      logger.error('Error loading scheduled market scans:', error);
    }
  }
  
  /**
   * Save scheduled scans to persistent storage
   */
  private async saveScheduledScans(): Promise<void> {
    try {
      // Use dynamic import to load the fs module
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Ensure the directory exists
      const dir = path.dirname(this.datastorePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Convert Map to array
      const scans = Array.from(this.scheduledScans.values());
      
      // Write to file
      await fs.writeFile(this.datastorePath, JSON.stringify(scans, null, 2));
    } catch (error) {
      logger.error('Error saving scheduled market scans:', error);
    }
  }
} 