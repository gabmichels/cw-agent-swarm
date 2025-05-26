/**
 * Facebook Tools - Page and post scraping tools
 */

import { z } from 'zod';
import { logger } from '../../../../../../lib/logging';
import { IApifyManager } from '../ApifyManager.interface';
import { ToolDefinition } from '../types';

export function createFacebookTools(apifyManager: IApifyManager): Record<string, ToolDefinition> {
  return {
    'facebook-posts-scraper': {
      name: 'facebook-posts-scraper',
      description: 'Scrape public Facebook posts from pages or groups. Monitor brand mentions and public discussions.',
      costEstimate: 'high',
      usageLimit: 10,
      schema: z.object({
        pageUrls: z.array(z.string().url()).min(1).max(3).describe('Array of Facebook page URLs to scrape'),
        limit: z.number().min(1).max(50).optional().describe('Maximum number of posts to scrape'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { pageUrls: string[]; limit?: number; dryRun?: boolean }): Promise<string> {
        try {
          const limit = Math.min(args.limit || 20, 50);
          
          const result = await apifyManager.runApifyActor({
            actorId: 'apify/facebook-posts-scraper',
            input: {
              startUrls: args.pageUrls.map(url => ({ url })),
              maxPosts: limit
            },
            label: `Facebook posts scraping: ${args.pageUrls.length} pages`,
            dryRun: args.dryRun || false
          });

          if (!result.success || !result.output) {
            return `Failed to scrape Facebook posts: ${result.error || 'Unknown error'}`;
          }

          const posts = result.output;
          let summary = `Successfully scraped ${posts.length} Facebook posts:\n\n`;

          posts.slice(0, 5).forEach((post: any, index: number) => {
            summary += `[${index + 1}] ${post.pageName || 'Unknown Page'}\n`;
            summary += `   Text: ${(post.text || 'No text content').substring(0, 150)}${post.text && post.text.length > 150 ? '...' : ''}\n`;
            summary += `   Reactions: ${post.likes || 0}, Comments: ${post.comments || 0}, Shares: ${post.shares || 0}\n`;
            summary += `   Date: ${post.time || 'N/A'}\n`;
            summary += `   URL: ${post.url || 'N/A'}\n\n`;
          });

          if (posts.length > 5) {
            summary += `... and ${posts.length - 5} more posts`;
          }

          return summary;
        } catch (error) {
          logger.error('Error in facebook-posts-scraper tool:', error);
          return `Error scraping Facebook posts: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },

    'facebook-pages-scraper': {
      name: 'facebook-pages-scraper',
      description: 'Scrape Facebook business pages for company information, reviews, and basic metrics.',
      costEstimate: 'medium',
      usageLimit: 15,
      schema: z.object({
        pageUrls: z.array(z.string().url()).min(1).max(5).describe('Array of Facebook page URLs to scrape'),
        includeReviews: z.boolean().optional().describe('Whether to include page reviews'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { pageUrls: string[]; includeReviews?: boolean; dryRun?: boolean }): Promise<string> {
        try {
          const result = await apifyManager.runApifyActor({
            actorId: 'apify/facebook-pages-scraper',
            input: {
              startUrls: args.pageUrls.map(url => ({ url })),
              includeReviews: args.includeReviews || false
            },
            label: `Facebook pages scraping: ${args.pageUrls.length} pages`,
            dryRun: args.dryRun || false
          });

          if (!result.success || !result.output) {
            return `Failed to scrape Facebook pages: ${result.error || 'Unknown error'}`;
          }

          const pages = result.output;
          let summary = `Successfully scraped ${pages.length} Facebook pages:\n\n`;

          pages.forEach((page: any, index: number) => {
            summary += `[${index + 1}] ${page.title || 'Unknown Page'}\n`;
            summary += `   Category: ${page.categories ? page.categories.join(', ') : 'N/A'}\n`;
            summary += `   Likes: ${page.likes || 0}, Followers: ${page.followers || 0}\n`;
            summary += `   Rating: ${page.overallStarRating || 'N/A'} (${page.ratingCount || 0} reviews)\n`;
            summary += `   Address: ${page.address || 'N/A'}\n`;
            summary += `   Phone: ${page.phone || 'N/A'}\n`;
            summary += `   Website: ${page.website || 'N/A'}\n\n`;
          });

          return summary;
        } catch (error) {
          logger.error('Error in facebook-pages-scraper tool:', error);
          return `Error scraping Facebook pages: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    }
  };
} 