/**
 * MarketScannerTool.ts - Tool for handling market scanning commands
 * 
 * This tool provides a natural language interface to the market scanner
 * and scheduler, allowing users to request market scans and schedule them.
 */

import { z } from 'zod';
import { StructuredTool } from "langchain/tools";
import { logger } from '../../../../lib/logging';
import { IMarketScanner } from './MarketScanner.interface';
import { MarketScanScheduler } from './MarketScanScheduler';
import { MarketScanCommandType, MarketScanCommand, parseMarketScanCommand } from './MarketScannerNLP';

/**
 * Tool for handling market scanning commands
 */
export class MarketScannerTool extends StructuredTool {
  name = "market_scan_command";
  description = "Execute a market scanning command, such as scanning for trends or scheduling scans";
  schema = z.object({
    command: z.string().describe("The natural language command to execute, e.g., 'scan the market for AI trends' or 'schedule a daily market scan at 9 AM'"),
  });

  private marketScanner: IMarketScanner;
  private scheduler: MarketScanScheduler;

  constructor(marketScanner: IMarketScanner, scheduler: MarketScanScheduler) {
    super();
    this.marketScanner = marketScanner;
    this.scheduler = scheduler;
  }

  async _call({ command }: { command: string }): Promise<string> {
    try {
      // Parse the command
      const parsedCommand = parseMarketScanCommand(command);
      
      if (!parsedCommand) {
        return "I couldn't understand your market scanning command. Try phrases like 'scan the market for AI trends' or 'schedule a daily market scan at 9 AM'.";
      }
      
      // Handle the command based on type
      switch (parsedCommand.type) {
        case MarketScanCommandType.IMMEDIATE_SCAN:
          return await this.handleImmediateScan(parsedCommand);
        
        case MarketScanCommandType.SCHEDULED_SCAN:
          return await this.handleScheduledScan(parsedCommand);
        
        case MarketScanCommandType.CANCEL_SCHEDULED_SCAN:
          return await this.handleCancelScan(parsedCommand);
        
        case MarketScanCommandType.LIST_SCHEDULED_SCANS:
          return await this.handleListScans();
        
        case MarketScanCommandType.GET_TREND_SUMMARY:
          return await this.handleTrendSummary();
        
        default:
          return "Unsupported market scanning command type.";
      }
    } catch (error) {
      logger.error('Error executing market scan command:', error);
      return `Error executing market scan command: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Handle an immediate market scan command
   * 
   * @param command Parsed command
   * @returns Response message
   */
  private async handleImmediateScan(command: MarketScanCommand): Promise<string> {
    // Run a market scan
    await this.marketScanner.refreshTrends();
    
    // Get the trends
    const trends = await this.marketScanner.getTrends(
      command.category,
      command.minScore || 50,
      command.limit || 10
    );
    
    if (trends.length === 0) {
      return `No market trends found${command.category ? ` for category '${command.category}'` : ''}.`;
    }
    
    // Format the trends into a readable response
    let response = `Found ${trends.length} market trends${command.category ? ` for category '${command.category}'` : ''}:\n\n`;
    
    trends.forEach((trend, index) => {
      response += `${index + 1}. ${trend.name} (Score: ${trend.score}/100)\n`;
      response += `   ${trend.description}\n`;
      response += `   Category: ${trend.category}, Stage: ${trend.stage}\n`;
      response += `   Keywords: ${trend.keywords.join(', ')}\n\n`;
    });
    
    return response;
  }

  /**
   * Handle a scheduled market scan command
   * 
   * @param command Parsed command
   * @returns Response message
   */
  private async handleScheduledScan(command: MarketScanCommand): Promise<string> {
    if (!command.schedule) {
      return "Missing schedule information. Please specify when you want to schedule the scan.";
    }
    
    // Schedule the scan
    const scheduledScan = await this.scheduler.scheduleMarketScanFromCommand(command);
    
    // Format response
    return `I've scheduled a market scan (ID: ${scheduledScan.id}) ${scheduledScan.humanReadable}${
      command.category ? ` for category '${command.category}'` : ''
    }. The next scan will run at ${scheduledScan.nextRun?.toLocaleString() || 'the scheduled time'}.`;
  }

  /**
   * Handle a cancel scan command
   * 
   * @param command Parsed command
   * @returns Response message
   */
  private async handleCancelScan(command: MarketScanCommand): Promise<string> {
    if (!command.scanId) {
      // If no specific ID provided, list the scans
      const scans = this.scheduler.getScheduledScans();
      
      if (scans.length === 0) {
        return "There are no scheduled market scans to cancel.";
      }
      
      let response = "Which scheduled scan would you like to cancel? Here are the currently scheduled scans:\n\n";
      
      scans.forEach(scan => {
        response += `ID: ${scan.id} - ${scan.description} ${scan.humanReadable}\n`;
      });
      
      return response;
    }
    
    // Cancel the specified scan
    const success = await this.scheduler.cancelScheduledScan(command.scanId);
    
    if (success) {
      return `Successfully cancelled the scheduled market scan with ID: ${command.scanId}.`;
    } else {
      return `Could not find a scheduled market scan with ID: ${command.scanId}.`;
    }
  }

  /**
   * Handle a list scans command
   * 
   * @returns Response message
   */
  private async handleListScans(): Promise<string> {
    const scans = this.scheduler.getScheduledScans();
    
    if (scans.length === 0) {
      return "There are no scheduled market scans.";
    }
    
    let response = `There ${scans.length === 1 ? 'is' : 'are'} ${scans.length} scheduled market scan${scans.length === 1 ? '' : 's'}:\n\n`;
    
    scans.forEach(scan => {
      response += `ID: ${scan.id} - ${scan.description}\n`;
      response += `  Schedule: ${scan.humanReadable}\n`;
      if (scan.category) response += `  Category: ${scan.category}\n`;
      if (scan.lastRun) response += `  Last Run: ${scan.lastRun.toLocaleString()}\n`;
      if (scan.nextRun) response += `  Next Run: ${scan.nextRun.toLocaleString()}\n`;
      response += '\n';
    });
    
    return response;
  }

  /**
   * Handle a trend summary command
   * 
   * @returns Response message
   */
  private async handleTrendSummary(): Promise<string> {
    // Get all trends
    const trends = await this.marketScanner.getTrends(undefined, 60, 20);
    
    if (trends.length === 0) {
      return "No market trends available for summarization.";
    }
    
    // Group trends by category
    const trendsByCategory: Record<string, typeof trends> = {};
    
    trends.forEach(trend => {
      if (!trendsByCategory[trend.category]) {
        trendsByCategory[trend.category] = [];
      }
      trendsByCategory[trend.category].push(trend);
    });
    
    // Create summary
    let summary = `# Market Trend Summary\n\n`;
    summary += `Based on the latest market data, here are the most significant trends:\n\n`;
    
    // Add trends by category
    for (const [category, categoryTrends] of Object.entries(trendsByCategory)) {
      summary += `## ${category.toUpperCase()}\n\n`;
      
      // Sort by score (highest first)
      categoryTrends.sort((a, b) => b.score - a.score);
      
      // Add top trends
      categoryTrends.slice(0, 3).forEach(trend => {
        summary += `### ${trend.name} (Score: ${trend.score}/100)\n`;
        summary += `${trend.description}\n\n`;
        
        // Add business impact if high
        if (trend.estimatedBusinessImpact > 70) {
          summary += `**Business Impact**: High potential (${trend.estimatedBusinessImpact}/100)\n\n`;
        }
        
        // Add stage
        summary += `**Stage**: ${trend.stage}\n\n`;
        
        // Add relevant user needs
        if (trend.relevantUserNeeds && trend.relevantUserNeeds.length > 0) {
          summary += `**Addresses User Needs**: ${trend.relevantUserNeeds.join(', ')}\n\n`;
        }
      });
    }
    
    // Add total trends count
    summary += `\n## Overview\n\n`;
    summary += `Total trends analyzed: ${trends.length}\n`;
    summary += `Categories: ${Object.keys(trendsByCategory).join(', ')}\n`;
    summary += `Average trend score: ${Math.round(trends.reduce((sum, t) => sum + t.score, 0) / trends.length)}/100\n`;
    
    return summary;
  }
}

/**
 * Create a market scanner tool instance
 * 
 * @param marketScanner Market scanner instance
 * @param scheduler Market scan scheduler instance
 * @returns Market scanner tool instance
 */
export function createMarketScannerTool(
  marketScanner: IMarketScanner,
  scheduler: MarketScanScheduler
): MarketScannerTool {
  return new MarketScannerTool(marketScanner, scheduler);
} 