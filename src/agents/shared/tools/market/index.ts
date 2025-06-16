/**
 * Market Scanner module - Singleton pattern for backward compatibility
 * 
 * This file exports the market scanner implementation as a singleton instance
 * to maintain backward compatibility with code that expects a global instance.
 */

import { DefaultMarketScanner } from './DefaultMarketScanner';
import { IMarketScanner, MarketScannerConfig } from './MarketScanner.interface';
import { MarketScannerTool, createMarketScannerTool } from './MarketScannerTool';
import { MarketScanScheduler } from './MarketScanScheduler';
import { parseMarketScanCommand, MarketScannerNLP, MarketScanCommandType } from './MarketScannerNLP';
import { ModularSchedulerManager } from '../../../../lib/scheduler/implementations/ModularSchedulerManager';
import { createSchedulerManager } from '../../../../lib/scheduler/factories/SchedulerFactory';
import { Tool, ToolExecutionResult } from '../../../../lib/tools/types';
import { IdGenerator } from '../../../../utils/ulid';
import { ToolCategory } from '../../../../lib/tools/types';

// Cache the scanner instance
let scannerInstance: DefaultMarketScanner | null = null;
let schedulerInstance: MarketScanScheduler | null = null;
let schedulerManager: ModularSchedulerManager | null = null;

/**
 * Create a market scanner instance
 * 
 * @param config Optional configuration
 * @returns Market scanner instance
 */
export function createMarketScanner(config?: MarketScannerConfig): IMarketScanner {
  if (!scannerInstance) {
    scannerInstance = new DefaultMarketScanner(config);
  }
  return scannerInstance;
}

/**
 * Get or create a market scan scheduler instance
 * 
 * @param marketScanner Market scanner instance
 * @returns Market scan scheduler instance
 */
export function getMarketScanScheduler(marketScanner: IMarketScanner): MarketScanScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new MarketScanScheduler(marketScanner);
  }
  return schedulerInstance;
}

/**
 * Initialize the market scanner system
 * 
 * @param config Optional configuration
 * @returns Initialized market scanner instance
 */
export async function initializeMarketScanner(config?: MarketScannerConfig): Promise<{
  scanner: IMarketScanner;
  scheduler: MarketScanScheduler;
  tool: MarketScannerTool;
}> {
  // Create or get the market scanner instance
  const scanner = createMarketScanner(config);
  
  // Initialize the scanner
  await scanner.initialize();
  
  // Create the scheduler
  const scheduler = getMarketScanScheduler(scanner);
  
  // If we don't have a scheduler manager, create one
  if (!schedulerManager) {
    schedulerManager = await createSchedulerManager({
      schedulingIntervalMs: 60000, // Check every minute
      maxConcurrentTasks: 3, // Max 3 concurrent scans
      defaultTaskTimeoutMs: 5 * 60 * 1000, // 5 minute timeout
      enabled: true,
    });
  }
  
  // Initialize the scheduler with the scheduler manager
  await scheduler.initialize(schedulerManager);
  
  // Create the tool
  const tool = createMarketScannerTool(scanner, scheduler);
  
  return { scanner, scheduler, tool };
}

/**
 * Parse a market scan natural language command
 * 
 * @param command Natural language command
 * @returns Parsed command or null if not recognized
 */
export function parseCommand(command: string) {
  return parseMarketScanCommand(command);
}

/**
 * Register market scanner tools with the shared tool registry
 * 
 * @returns List of registered tools
 */
export async function registerMarketTools(): Promise<Tool[]> {
  try {
    // Initialize the market scanner and get the tools
    const { scanner } = await initializeMarketScanner();
    
    // Create tools
    const trendTool = scanner.createMarketTrendTool();
    const commandTool = scanner.createMarketCommandTool();
    
    // Convert to Tool interface
    const tools: Tool[] = [
      {
        id: 'market_trends',
        name: 'Market Trend Finder',
        description: 'Find current market trends in AI and technology',
        category: ToolCategory.WEB,
        enabled: true,
        schema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'The category of trends to find (ai, automation, integration, analytics)'
            },
            minScore: {
              type: 'number',
              description: 'Minimum score threshold (0-100)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of trends to return'
            },
            refresh: {
              type: 'boolean',
              description: 'Whether to force a refresh of trend data'
            }
          }
        },
        metadata: {
          dataSource: 'MarketScanner',
          qualityScore: 0.85,
          lastUpdated: new Date().toISOString(),
          costEstimate: 2,
          usageLimit: 100
        },
        execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
          // Convert args to expected format
          const params = {
            category: args.category as string | undefined,
            minScore: args.minScore as number | undefined,
            limit: args.limit as number | undefined,
            refresh: args.refresh as boolean | undefined
          };
          
          const startTime = Date.now();
          try {
            // Call the tool using its invoke method (function property)
            const result = await (trendTool as any).invoke(params);
            const endTime = Date.now();
            
            // Return result in expected format
            return {
              id: IdGenerator.generate('trun'),
              toolId: 'market_trends',
              success: true,
              data: result,
              metrics: {
                startTime,
                endTime,
                durationMs: endTime - startTime
              }
            };
          } catch (error) {
            const endTime = Date.now();
            return {
              id: IdGenerator.generate('trun'),
              toolId: 'market_trends',
              success: false,
              error: {
                message: error instanceof Error ? error.message : String(error),
                code: 'EXECUTION_ERROR',
                details: error
              },
              metrics: {
                startTime,
                endTime,
                durationMs: endTime - startTime
              }
            };
          }
        }
      },
      {
        id: 'market_scan_command',
        name: 'Market Scan Command',
        description: 'Execute market scanning commands using natural language',
        category: ToolCategory.WEB,
        enabled: true,
        schema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Natural language command for market scanning'
            }
          }
        },
        metadata: {
          dataSource: 'MarketScanner',
          qualityScore: 0.9,
          lastUpdated: new Date().toISOString(),
          costEstimate: 3,
          usageLimit: 50
        },
        execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
          const startTime = Date.now();
          try {
            // Call the command tool using its invoke method (function property)
            const result = await (commandTool as any).invoke({
              command: args.command as string
            });
            const endTime = Date.now();
            
            // Return result in expected format
            return {
              id: IdGenerator.generate('trun'),
              toolId: 'market_scan_command',
              success: true,
              data: result,
              metrics: {
                startTime,
                endTime,
                durationMs: endTime - startTime
              }
            };
          } catch (error) {
            const endTime = Date.now();
            return {
              id: IdGenerator.generate('trun'),
              toolId: 'market_scan_command',
              success: false,
              error: {
                message: error instanceof Error ? error.message : String(error),
                code: 'EXECUTION_ERROR',
                details: error
              },
              metrics: {
                startTime,
                endTime,
                durationMs: endTime - startTime
              }
            };
          }
        }
      }
    ];
    
    return tools;
  } catch (error) {
    console.error('Error registering market tools:', error);
    return [];
  }
}

// Export types and interfaces
export type {
  IMarketScanner,
  MarketScannerConfig,
  MarketScanScheduler,
  MarketScannerTool
};
export { DefaultMarketScanner } from './DefaultMarketScanner';
export type { MarketScannerNLP, MarketScanCommandType } from './MarketScannerNLP';
export type { ISourceManager } from './interfaces/MarketSource.interface';
export type { ITrendAnalyzer } from './interfaces/TrendAnalysis.interface'; 