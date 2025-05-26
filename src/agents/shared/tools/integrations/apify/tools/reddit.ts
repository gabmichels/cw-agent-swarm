/**
 * Reddit Tools - Reddit search and scraping tools
 */

import { z } from 'zod';
import { logger } from '../../../../../../lib/logging';
import { IApifyManager } from '../ApifyManager.interface';
import { ToolDefinition } from '../types';

export function createRedditTools(apifyManager: IApifyManager): Record<string, ToolDefinition> {
  return {
    'apify-reddit-search': {
      name: 'apify-reddit-search',
      description: 'Search Reddit for posts related to a keyword or topic. Default limit: 10 posts (use "bypass X items" for more posts with approval)',
      costEstimate: 'high',
      usageLimit: 10, // max allowed runs/day
      schema: z.object({
        keyword: z.string().min(1).describe('The search keyword or topic'),
        limit: z.number().min(1).max(100).optional().describe('Maximum number of results'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { keyword: string; limit?: number; dryRun?: boolean }): Promise<string> {
        try {
          // Check if this is a dry run request
          const isDryRun = args.dryRun || false;
          const maxItems = args.limit || 10;
          
          // Check if the limit is too high
          if (maxItems > 25) {
            return `I need your permission to fetch ${maxItems} posts from Reddit, which exceeds our default limit of 25 to prevent excessive API usage. This may incur higher costs.\n\nTo approve, please reply with: "approve ${maxItems} for reddit search" or modify your request to stay within limits.`;
          }
          
          const result = await apifyManager.runRedditSearch(args.keyword, isDryRun, maxItems);
          
          if (!result.success || !result.output) {
            return `Failed to search Reddit for "${args.keyword}"`;
          }
          
          // Format the results
          const posts = result.output;
          const formattedResult = posts.slice(0, 5).map((post: any, index: number) => {
            return `[${index + 1}] ${post.title || 'Untitled'}\n   Subreddit: ${post.community || 'unknown'}\n   Score: ${post.score || 'N/A'}\n   URL: ${post.url || 'N/A'}\n`;
          }).join('\n');
          
          return `Reddit search results for "${args.keyword}":\n\n${formattedResult}\n\nTotal results: ${posts.length}`;
        } catch (error) {
          logger.error('Error in apify-reddit-search tool:', error);
          return `Error searching Reddit: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    }
  };
} 