/**
 * Web Scraping Tools - Website crawling and general web scraping tools
 */

import { z } from 'zod';
import { logger } from '../../../../../../lib/logging';
import { IApifyManager } from '../ApifyManager.interface';
import { ToolDefinition } from '../types';

export function createWebScrapingTools(apifyManager: IApifyManager): Record<string, ToolDefinition> {
  return {
    'apify-website-crawler': {
      name: 'apify-website-crawler',
      description: 'Crawl a website to extract content and information. Default limits: 10 pages, depth 1.',
      costEstimate: 'high',
      usageLimit: 10, // max allowed runs/day
      schema: z.object({
        url: z.string().url().describe('The URL to crawl'),
        maxPages: z.number().min(1).max(50).optional().describe('Maximum number of pages to crawl'),
        maxDepth: z.number().min(1).max(3).optional().describe('Maximum depth to crawl'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { url: string; maxPages?: number; maxDepth?: number; dryRun?: boolean }): Promise<string> {
        try {
          // Check if this is a dry run request
          const isDryRun = args.dryRun || false;
          const maxPages = args.maxPages || 10;
          const maxDepth = args.maxDepth || 1;
          
          // Check if the limits are too high
          if (maxPages > 25) {
            return `I need your permission to crawl ${maxPages} pages, which exceeds our default limit of 25 to prevent excessive API usage. This may incur higher costs.\n\nTo approve, please reply with: "approve ${maxPages} pages for website crawler" or modify your request to stay within limits.`;
          }
          
          if (maxDepth > 2) {
            return `I need your permission to crawl to a depth of ${maxDepth}, which exceeds our default limit of 2 to prevent excessive API usage. Deeper crawls can increase costs exponentially.\n\nTo approve, please reply with: "approve depth ${maxDepth} for website crawler" or modify your request to stay within limits.`;
          }
          
          const result = await apifyManager.runWebsiteCrawler(args.url, isDryRun, maxPages, maxDepth);
          
          if (!result.success || !result.output) {
            return `Failed to crawl website "${args.url}"`;
          }
          
          // Format the results
          const pages = result.output;
          let summary = `Crawled ${pages.length} pages from ${args.url}\n\n`;
          
          // Summarize found pages
          if (pages.length > 0) {
            summary += 'Pages crawled:\n';
            summary += pages.slice(0, 5).map((page: any, index: number) => {
              return `[${index + 1}] ${page.title || 'Untitled'}\n   URL: ${page.url || 'N/A'}\n   Word count: ${page.text ? page.text.split(/\s+/).length : 'N/A'}\n`;
            }).join('\n');
            
            if (pages.length > 5) {
              summary += `\n... and ${pages.length - 5} more pages`;
            }
          }
          
          return summary;
        } catch (error) {
          logger.error('Error in apify-website-crawler tool:', error);
          return `Error crawling website: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    }
  };
} 