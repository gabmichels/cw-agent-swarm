/**
 * MarketScannerNLP.ts - Natural language processing for market scanning commands
 * 
 * This module handles parsing and interpreting natural language commands
 * related to market scanning and scheduling.
 */

import { parse, ParsedResult } from 'chrono-node';
import { logger } from '../../../../lib/logging';

/**
 * Types of market scanning commands
 */
export enum MarketScanCommandType {
  IMMEDIATE_SCAN = 'immediate_scan',
  SCHEDULED_SCAN = 'scheduled_scan',
  CANCEL_SCHEDULED_SCAN = 'cancel_scheduled_scan',
  LIST_SCHEDULED_SCANS = 'list_scheduled_scans',
  GET_TREND_SUMMARY = 'get_trend_summary',
}

/**
 * Market scanning command with parsed parameters
 */
export interface MarketScanCommand {
  type: MarketScanCommandType;
  category?: string;
  schedule?: {
    cronExpression: string;
    humanReadable: string;
  };
  scanId?: string;
  limit?: number;
  minScore?: number;
  summarize?: boolean;
}

/**
 * Natural language processor for market scanning commands
 */
export class MarketScannerNLP {
  /**
   * Parse a natural language command into a structured command object
   * 
   * @param text Natural language command
   * @returns Parsed command or null if not recognized
   */
  parseCommand(text: string): MarketScanCommand | null {
    text = text.toLowerCase().trim();
    
    // Check for cancel commands first (highest priority)
    if (this.isCancelCommand(text)) {
      return this.parseCancelCommand(text);
    }
    
    // Check for list commands
    if (this.isListCommand(text)) {
      return {
        type: MarketScanCommandType.LIST_SCHEDULED_SCANS
      };
    }
    
    // Check for summary commands
    if (this.isSummaryCommand(text)) {
      return {
        type: MarketScanCommandType.GET_TREND_SUMMARY,
        summarize: true
      };
    }
    
    // Check for scheduling commands
    if (this.isScheduleCommand(text)) {
      return this.parseScheduleCommand(text);
    }
    
    // Check for immediate scan commands (lowest priority to catch everything else)
    if (this.isImmediateScanCommand(text)) {
      return this.parseImmediateScanCommand(text);
    }
    
    // Not recognized as a market scanning command
    return null;
  }
  
  /**
   * Check if the text is a scheduling command
   */
  private isScheduleCommand(text: string): boolean {
    const schedulePatterns = [
      'schedule', 'every', 'daily', 'weekly', 'monthly',
      'each day', 'each week', 'each month',
      'at', 'on', 'tomorrow', 'next'
    ];
    
    const scanPatterns = [
      'scan', 'market scan', 'analyze', 'look for trends',
      'check market', 'market analysis', 'market intelligence'
    ];
    
    // Must contain both a schedule pattern and a scan pattern
    return schedulePatterns.some(pattern => text.includes(pattern)) &&
           scanPatterns.some(pattern => text.includes(pattern));
  }
  
  /**
   * Check if the text is an immediate scan command
   */
  private isImmediateScanCommand(text: string): boolean {
    const scanPatterns = [
      'scan', 'market scan', 'analyze', 'look for trends', 'find trends',
      'check market', 'market analysis', 'market intelligence',
      'what is trending', 'what are trending', 'what\'s trending',
      'show me', 'find', 'get me', 'look for', 'search for',
      'discover', 'identify', 'explore', 'investigate'
    ];
    
    const trendPatterns = [
      'trend', 'trends', 'market', 'intelligence', 'insights',
      'patterns', 'signals', 'movements', 'developments'
    ];
    
    // Check if it contains scan patterns OR (trend patterns + action words)
    const hasScanPattern = scanPatterns.some(pattern => text.includes(pattern));
    const hasTrendPattern = trendPatterns.some(pattern => text.includes(pattern));
    
    return hasScanPattern || hasTrendPattern;
  }
  
  /**
   * Check if the text is a cancel command
   */
  private isCancelCommand(text: string): boolean {
    // Must start with or prominently feature cancel/stop words
    const explicitCancelPatterns = [
      /^cancel\s+/,
      /^stop\s+/,
      /^remove\s+/,
      /^delete\s+/,
      /^end\s+/,
      /^terminate\s+/,
      /^abort\s+/
    ];
    
    const scanPatterns = [
      'scan', 'market scan', 'scheduled scan', 'scanning', 'schedule'
    ];
    
    // Must have explicit cancel intent at the beginning AND scan reference
    const hasExplicitCancel = explicitCancelPatterns.some(pattern => pattern.test(text));
    const hasScan = scanPatterns.some(pattern => text.includes(pattern));
    
    return hasExplicitCancel && hasScan;
  }
  
  /**
   * Check if the text is a list command
   */
  private isListCommand(text: string): boolean {
    const listPatterns = [
      'list', 'show', 'display', 'tell me about', 'what are', 'view',
      'see', 'check', 'review', 'get list of'
    ];
    
    const scanPatterns = [
      'scan', 'market scan', 'scheduled scan', 'scans', 'schedules',
      'scheduled', 'running', 'active'
    ];
    
    return listPatterns.some(pattern => text.includes(pattern)) &&
           scanPatterns.some(pattern => text.includes(pattern));
  }
  
  /**
   * Check if the text is a summary command
   */
  private isSummaryCommand(text: string): boolean {
    const summaryPatterns = [
      'summary', 'summarize', 'overview', 'digest', 'brief'
    ];
    
    const trendPatterns = [
      'trend', 'market', 'scan result'
    ];
    
    return summaryPatterns.some(pattern => text.includes(pattern)) &&
           trendPatterns.some(pattern => text.includes(pattern));
  }
  
  /**
   * Parse a schedule command into a structured command
   */
  private parseScheduleCommand(text: string): MarketScanCommand {
    // Extract category if present
    const category = this.extractCategory(text);
    
    // Extract schedule parameters
    const schedule = this.extractSchedule(text);
    
    return {
      type: MarketScanCommandType.SCHEDULED_SCAN,
      category,
      schedule,
      limit: this.extractLimit(text),
      minScore: this.extractMinScore(text),
      summarize: text.includes('summarize') || text.includes('summary')
    };
  }
  
  /**
   * Parse an immediate scan command into a structured command
   */
  private parseImmediateScanCommand(text: string): MarketScanCommand {
    return {
      type: MarketScanCommandType.IMMEDIATE_SCAN,
      category: this.extractCategory(text),
      limit: this.extractLimit(text),
      minScore: this.extractMinScore(text),
      summarize: text.includes('summarize') || text.includes('summary')
    };
  }
  
  /**
   * Parse a cancel command into a structured command
   */
  private parseCancelCommand(text: string): MarketScanCommand {
    // Try to extract a scan ID - this would be like "scan-123" or "abc-456" or similar
    const idMatch = text.match(/(?:scan[- _](\w+)|(\w+)[- _]\d+)/i);
    const scanId = idMatch ? (idMatch[1] || idMatch[2]) : undefined;
    
    return {
      type: MarketScanCommandType.CANCEL_SCHEDULED_SCAN,
      scanId
    };
  }
  
  /**
   * Extract category from command text
   */
  private extractCategory(text: string): string | undefined {
    // Look for known categories
    const categories = ['ai', 'automation', 'integration', 'analytics'];
    
    // Check for "{category} trends" patterns FIRST (highest priority)
    const categoryTrendsMatch = text.match(/(\w+)\s+trends/i);
    if (categoryTrendsMatch) {
      const extractedCategory = categoryTrendsMatch[1].toLowerCase();
      if (categories.includes(extractedCategory)) {
        return extractedCategory;
      }
      // Try to map to known category
      const mapped = this.mapToKnownCategory(extractedCategory);
      if (mapped !== 'ai') { // Only return if it's not the default fallback
        return mapped;
      }
    }
    
    // Check for "in {category}" or "for {category}" patterns
    const inForMatch = text.match(/(in|for|about|on)\s+(\w+)/i);
    if (inForMatch) {
      const extractedCategory = inForMatch[2].toLowerCase();
      // If it's a known category, return it
      if (categories.includes(extractedCategory)) {
        return extractedCategory;
      }
      // Otherwise try to map to a known category
      const mapped = this.mapToKnownCategory(extractedCategory);
      if (mapped !== 'ai') { // Only return if it's not the default fallback
        return mapped;
      }
    }
    
    // Check each category explicitly (exact matches)
    for (const category of categories) {
      if (text.includes(category)) {
        return category;
      }
    }
    
    // Try to map partial matches as last resort
    const mappedCategory = this.mapToKnownCategory(text);
    if (mappedCategory !== 'ai') { // Only return if it's not the default fallback
      return mappedCategory;
    }
    
    return undefined;
  }
  
  /**
   * Extract schedule parameters from command text
   */
  private extractSchedule(text: string): { cronExpression: string, humanReadable: string } {
    // Handle common time expressions
    if (text.includes('daily') || text.includes('every day')) {
      // Look for a specific time
      const timeMatch = text.match(/at\s+(\d+)(?::(\d+))?\s*(am|pm)?/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1], 10);
        const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
        
        // Adjust hour for PM
        if (ampm === 'pm' && hour < 12) {
          hour += 12;
        } else if (ampm === 'am' && hour === 12) {
          hour = 0;
        }
        
        return {
          cronExpression: `0 ${minute} ${hour} * * *`,
          humanReadable: `daily at ${timeMatch[0]}`
        };
      }
      
      // Default daily at 9 AM
      return {
        cronExpression: '0 0 9 * * *',
        humanReadable: 'daily at 9 AM'
      };
    }
    
    if (text.includes('weekly') || text.includes('every week')) {
      // Try to extract day of week
      const dayMatch = text.match(/on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
      const day = dayMatch ? dayMatch[1].toLowerCase() : 'monday';
      
      // Map day to number (0 = Sunday)
      const dayMap: Record<string, number> = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6
      };
      
      const dayNum = dayMap[day] || 1;
      
      // Look for a time
      const timeMatch = text.match(/at\s+(\d+)(?::(\d+))?\s*(am|pm)?/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1], 10);
        const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
        
        // Adjust hour for PM
        if (ampm === 'pm' && hour < 12) {
          hour += 12;
        } else if (ampm === 'am' && hour === 12) {
          hour = 0;
        }
        
        return {
          cronExpression: `0 ${minute} ${hour} * * ${dayNum}`,
          humanReadable: `weekly on ${day} at ${timeMatch[0]}`
        };
      }
      
      // Default weekly on Monday at 9 AM
      return {
        cronExpression: `0 0 9 * * ${dayNum}`,
        humanReadable: `weekly on ${day} at 9 AM`
      };
    }
    
    // Try to use chrono-node to parse natural language dates
    try {
      const parsedDate = parse(text);
      if (parsedDate.length > 0) {
        const date = parsedDate[0].start.date();
        
        // Extract components for cron expression
        const minute = date.getMinutes();
        const hour = date.getHours();
        const dayOfMonth = date.getDate();
        const month = date.getMonth() + 1; // 0-indexed to 1-indexed
        
        // For one-time schedule
        return {
          cronExpression: `0 ${minute} ${hour} ${dayOfMonth} ${month} *`,
          humanReadable: `at ${date.toLocaleString()}`
        };
      }
    } catch (error) {
      logger.warn('Error parsing date with chrono-node:', error);
    }
    
    // Default to daily at 9 AM if we couldn't parse anything else
    return {
      cronExpression: '0 0 9 * * *',
      humanReadable: 'daily at 9 AM'
    };
  }
  
  /**
   * Extract limit parameter from command text
   */
  private extractLimit(text: string): number | undefined {
    // Look for patterns like "top 10", "5 trends", "limit 20", "get me 10", "show 5"
    const limitMatch = text.match(/(?:top|limit|get me|show|find)\s+(\d+)|(\d+)\s+(?:trends|results|items)|first\s+(\d+)/i);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1] || limitMatch[2] || limitMatch[3], 10);
      return !isNaN(limit) ? limit : undefined;
    }
    return undefined;
  }
  
  /**
   * Extract minimum score parameter from command text
   */
  private extractMinScore(text: string): number | undefined {
    // Look for patterns like "score > 70", "minimum score 50", "high score", "with score"
    const scoreMatch = text.match(/(?:score|minimum score|min score)[\s>]+(\d+)|high score|with high score/i);
    if (scoreMatch) {
      if (scoreMatch[1]) {
        const score = parseInt(scoreMatch[1], 10);
        return !isNaN(score) ? score : undefined;
      } else if (text.includes('high score') || text.includes('with high score')) {
        // Default high score threshold
        return 70;
      }
    }
    return undefined;
  }
  
  /**
   * Map an arbitrary category string to one of the known categories
   */
  private mapToKnownCategory(inputCategory: string): string {
    // Define mappings of related terms to official categories
    const categoryMap: Record<string, string[]> = {
      'ai': ['artificial intelligence', 'ml', 'machine learning', 'llm', 'gpt', 'deep learning', 'neural network', 'ai agent'],
      'automation': ['workflow', 'rpa', 'robotic process', 'bot', 'automated', 'no-code', 'low-code', 'automation'],
      'integration': ['api', 'connector', 'middleware', 'platform', 'interoperability', 'connect', 'data pipeline', 'integration'],
      'analytics': ['dashboard', 'reporting', 'bi', 'business intelligence', 'data', 'visualization', 'metrics', 'kpi', 'analytics']
    };
    
    // Check each category mapping
    for (const [category, terms] of Object.entries(categoryMap)) {
      if (terms.some(term => inputCategory.includes(term) || term.includes(inputCategory))) {
        return category;
      }
    }
    
    // Default to 'ai' if no match found
    return 'ai';
  }
}

/**
 * Create a singleton instance of the market scanner NLP
 */
export const marketScannerNLP = new MarketScannerNLP();

/**
 * Helper function to parse a market scan command
 * 
 * @param text Natural language command
 * @returns Parsed command or null if not recognized
 */
export function parseMarketScanCommand(text: string): MarketScanCommand | null {
  return marketScannerNLP.parseCommand(text);
} 