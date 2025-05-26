/**
 * Website Tools - Website crawling and content extraction tools
 */

import { z } from 'zod';
import { logger } from '../../../../../../lib/logging';
import { IApifyManager } from '../ApifyManager.interface';
import { ToolDefinition } from '../types';

export function createWebsiteTools(apifyManager: IApifyManager): Record<string, ToolDefinition> {
  return {
    'website-crawler': {
      name: 'website-crawler',
      description: 'Crawl websites and extract text content to feed AI models, LLM applications, vector databases, or RAG pipelines',
      costEstimate: 'medium',
      usageLimit: 5,
      schema: z.object({
        startUrls: z.array(z.string().url()).min(1).max(3).describe('Array of URLs to start crawling from'),
        maxCrawlPages: z.number().min(1).max(20).optional().describe('Maximum number of pages to crawl'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { startUrls: string[]; maxCrawlPages?: number; dryRun?: boolean }): Promise<string> {
        try {
          const maxPages = Math.min(args.maxCrawlPages || 10, 20);
          
          const result = await apifyManager.runApifyActor({
            actorId: 'apify/website-content-crawler',
            input: {
              startUrls: args.startUrls.map(url => ({ url })),
              maxCrawlPages: maxPages,
              proxyConfiguration: {
                useApifyProxy: true
              }
            },
            label: `Website crawling: ${args.startUrls.length} URLs`,
            dryRun: args.dryRun || false
          });

          if (!result.success || !result.output) {
            return `Failed to crawl website: ${result.error || 'Unknown error'}`;
          }

          const pages = result.output;
          let summary = `Successfully crawled ${pages.length} pages from ${args.startUrls.length} starting URL(s):\n\n`;

          pages.slice(0, 5).forEach((page: any, index: number) => {
            summary += `[${index + 1}] ${page.url || 'Unknown URL'}\n`;
            summary += `   Title: ${page.metadata?.title || 'No title'}\n`;
            summary += `   Content: ${(page.text || 'No content').substring(0, 150)}${page.text && page.text.length > 150 ? '...' : ''}\n`;
            summary += `   Language: ${page.metadata?.languageCode || 'Unknown'}\n\n`;
          });

          if (pages.length > 5) {
            summary += `... and ${pages.length - 5} more pages`;
          }

          return summary;
        } catch (error) {
          logger.error('Error in website-crawler tool:', error);
          return `Error crawling website: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    }
  };
} 