/**
 * Twitter Tools - Twitter/X search and scraping tools
 */

import { z } from 'zod';
import { logger } from '../../../../../../lib/logging';
import { IApifyManager } from '../ApifyManager.interface';
import { ToolDefinition } from '../types';

export function createTwitterTools(apifyManager: IApifyManager): Record<string, ToolDefinition> {
  return {
    'apify-twitter-search': {
      name: 'apify-twitter-search',
      description: 'Search Twitter for high-engagement tweets using advanced search filters. Automatically excludes retweets and low-engagement posts. Max 40 results per search.',
      costEstimate: 'high',
      usageLimit: 10, // max allowed runs/day
      schema: z.object({
        keyword: z.string().min(1).describe('The search keyword or topic - will be enhanced with engagement filters'),
        limit: z.number().min(1).max(40).optional().describe('Maximum number of results (capped at 40)'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { keyword: string; limit?: number; dryRun?: boolean }): Promise<string> {
        try {
          // Check if this is a dry run request
          const isDryRun = args.dryRun || false;
          const maxItems = Math.min(args.limit || 20, 40); // Enforce 40 result limit
          
          // Check if the limit is too high (reduced threshold due to optimization)
          if (maxItems > 30) {
            return `I need your permission to fetch ${maxItems} tweets, which exceeds our default limit of 30 to prevent excessive API usage. This may incur higher costs.\n\nTo approve, please reply with: "approve ${maxItems} for twitter search" or modify your request to stay within limits.`;
          }
          
          const result = await apifyManager.runTwitterSearch(args.keyword, isDryRun, maxItems);
          
          if (!result.success || !result.output) {
            return `Failed to search Twitter for "${args.keyword}"`;
          }
          
          // Format the results
          const tweets = result.output;
          const formattedResult = tweets.slice(0, 5).map((tweet: any, index: number) => {
            return `[${index + 1}] @${tweet.username || 'unknown'}: ${tweet.text || 'No content'}\n   Likes: ${tweet.likeCount || 0}, Retweets: ${tweet.retweetCount || 0}\n   Date: ${tweet.date || 'N/A'}\n`;
          }).join('\n');
          
          return `Twitter search results for "${args.keyword}":\n\n${formattedResult}\n\nTotal results: ${tweets.length}`;
        } catch (error) {
          logger.error('Error in apify-twitter-search tool:', error);
          return `Error searching Twitter: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    }
  };
} 