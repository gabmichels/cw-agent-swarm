import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../../lib/logging';

export interface ToolPerformanceRecord {
  toolName: string;
  successRate: number;
  recentFailures: number;
  totalRuns: number;
  successRuns: number;
  failureRuns: number;
  lastUsed: string;
  avgExecutionTime: number;
  parameters?: Record<string, any>;
}

interface ToolFallbackMap {
  [toolName: string]: string[];
}

/**
 * Tracks performance of tools and provides fallback mechanisms
 * when tools fail.
 */
export class ToolPerformanceTracker {
  private performanceMap: Map<string, ToolPerformanceRecord> = new Map();
  private fallbackMap: ToolFallbackMap = {};
  private storageDir: string;
  private readonly performanceFile: string;
  private readonly fallbackFile: string;
  
  constructor() {
    this.storageDir = path.join(process.cwd(), 'data', 'tool-performance');
    this.performanceFile = path.join(this.storageDir, 'tool-performance.json');
    this.fallbackFile = path.join(this.storageDir, 'tool-fallbacks.json');
    
    this.initialize();
  }
  
  private initialize(): void {
    try {
      // Ensure directory exists
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      
      // Load performance data if it exists
      if (fs.existsSync(this.performanceFile)) {
        const data = fs.readFileSync(this.performanceFile, 'utf-8');
        const records = JSON.parse(data) as ToolPerformanceRecord[];
        records.forEach(record => {
          this.performanceMap.set(record.toolName, record);
        });
        logger.info(`Loaded ${records.length} tool performance records`);
      }
      
      // Load fallback data if it exists
      if (fs.existsSync(this.fallbackFile)) {
        const data = fs.readFileSync(this.fallbackFile, 'utf-8');
        this.fallbackMap = JSON.parse(data) as ToolFallbackMap;
        logger.info(`Loaded fallback configurations for ${Object.keys(this.fallbackMap).length} tools`);
      }
    } catch (error) {
      logger.error(`Error initializing ToolPerformanceTracker: ${error}`);
    }
  }
  
  /**
   * Records the result of a tool execution
   * @param toolName Name of the tool that was executed
   * @param success Whether the execution was successful
   * @param executionTime Time taken for execution in milliseconds
   * @param parameters Optional parameters used for the execution
   */
  public recordResult(
    toolName: string, 
    success: boolean, 
    executionTime?: number,
    parameters?: Record<string, any>
  ): void {
    try {
      const now = new Date().toISOString();
      let record = this.performanceMap.get(toolName);
      
      if (!record) {
        // Create new record if this is first time seeing this tool
        record = {
          toolName,
          successRate: success ? 1 : 0,
          recentFailures: success ? 0 : 1,
          totalRuns: 1,
          successRuns: success ? 1 : 0,
          failureRuns: success ? 0 : 1,
          lastUsed: now,
          avgExecutionTime: executionTime || 0
        };
      } else {
        // Update existing record
        record.totalRuns++;
        if (success) {
          record.successRuns++;
          record.recentFailures = 0; // Reset recent failures counter on success
        } else {
          record.failureRuns++;
          record.recentFailures++;
        }
        
        // Update success rate
        record.successRate = record.successRuns / record.totalRuns;
        
        // Update execution time tracking
        if (executionTime) {
          record.avgExecutionTime = 
            (record.avgExecutionTime * (record.totalRuns - 1) + executionTime) / record.totalRuns;
        }
        
        record.lastUsed = now;
        
        // Optionally store the last used parameters
        if (parameters) {
          record.parameters = parameters;
        }
      }
      
      this.performanceMap.set(toolName, record);
      this.savePerformanceData();
      
      logger.debug(`Updated performance for tool ${toolName}: ${record.successRate.toFixed(2)} success rate`);
    } catch (error) {
      logger.error(`Error recording tool result: ${error}`);
    }
  }
  
  /**
   * Gets the performance record for a specific tool
   * @param toolName Name of the tool
   * @returns Performance record or null if not found
   */
  public getPerformance(toolName: string): ToolPerformanceRecord | null {
    return this.performanceMap.get(toolName) || null;
  }
  
  /**
   * Gets all tool performance records
   * @returns Array of performance records
   */
  public getAllPerformanceRecords(): ToolPerformanceRecord[] {
    return Array.from(this.performanceMap.values());
  }
  
  /**
   * Determines if a tool should be retried based on performance
   * @param toolName Name of the tool
   * @returns Boolean indicating whether to retry
   */
  public shouldRetry(toolName: string): boolean {
    const record = this.performanceMap.get(toolName);
    if (!record) return true; // Default to retry if no record
    
    // If tool has high success rate historically but just failed recently
    if (record.successRate > 0.7 && record.recentFailures === 1) {
      return true;
    }
    
    // Don't retry if tool has failed multiple times in a row
    if (record.recentFailures > 2) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Gets an alternative tool to use if the primary tool fails
   * @param toolName Name of the failed tool
   * @returns Name of fallback tool or null if no fallback available
   */
  public getFallback(toolName: string): string | null {
    const fallbacks = this.fallbackMap[toolName];
    if (!fallbacks || fallbacks.length === 0) {
      return null;
    }
    
    // Find the fallback with the best performance
    let bestFallback: string | null = null;
    let bestSuccessRate = 0;
    
    for (const fallbackName of fallbacks) {
      const performance = this.performanceMap.get(fallbackName);
      if (performance && performance.successRate > bestSuccessRate) {
        bestSuccessRate = performance.successRate;
        bestFallback = fallbackName;
      }
    }
    
    return bestFallback;
  }
  
  /**
   * Sets a fallback relationship between tools
   * @param primaryTool Name of the primary tool
   * @param fallbackTools Array of fallback tool names in priority order
   */
  public setFallbacks(primaryTool: string, fallbackTools: string[]): void {
    this.fallbackMap[primaryTool] = fallbackTools;
    this.saveFallbackData();
    logger.info(`Set ${fallbackTools.length} fallbacks for tool ${primaryTool}`);
  }
  
  /**
   * Remove a fallback relationship
   * @param primaryTool Name of the primary tool
   * @param fallbackTool Optional fallback tool to remove. If not provided, all fallbacks are removed.
   */
  public removeFallback(primaryTool: string, fallbackTool?: string): void {
    if (!fallbackTool) {
      delete this.fallbackMap[primaryTool];
    } else if (this.fallbackMap[primaryTool]) {
      this.fallbackMap[primaryTool] = this.fallbackMap[primaryTool].filter(t => t !== fallbackTool);
    }
    this.saveFallbackData();
  }
  
  /**
   * Save performance data to disk
   */
  private savePerformanceData(): void {
    try {
      const data = JSON.stringify(Array.from(this.performanceMap.values()), null, 2);
      fs.writeFileSync(this.performanceFile, data);
    } catch (error) {
      logger.error(`Error saving tool performance data: ${error}`);
    }
  }
  
  /**
   * Save fallback data to disk
   */
  private saveFallbackData(): void {
    try {
      const data = JSON.stringify(this.fallbackMap, null, 2);
      fs.writeFileSync(this.fallbackFile, data);
    } catch (error) {
      logger.error(`Error saving tool fallback data: ${error}`);
    }
  }
}

// Singleton instance
let instance: ToolPerformanceTracker | null = null;

/**
 * Get the singleton instance of ToolPerformanceTracker
 */
export function getToolPerformanceTracker(): ToolPerformanceTracker {
  if (!instance) {
    instance = new ToolPerformanceTracker();
  }
  return instance;
} 