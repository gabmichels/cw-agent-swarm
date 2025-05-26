/**
 * Instagram Tools - Post, hashtag, and profile scraping tools
 */

import { z } from 'zod';
import { logger } from '../../../../../../lib/logging';
import { IApifyManager } from '../ApifyManager.interface';
import { ToolDefinition } from '../types';

export function createInstagramTools(apifyManager: IApifyManager): Record<string, ToolDefinition> {
  return {
    'instagram-post-scraper': {
      name: 'instagram-post-scraper',
      description: 'Scrape specific Instagram posts by URLs. Get detailed post data including likes, comments, and media.',
      costEstimate: 'medium',
      usageLimit: 15,
      schema: z.object({
        postUrls: z.array(z.string().url()).min(1).max(10).describe('Array of Instagram post URLs to scrape'),
        includeComments: z.boolean().optional().describe('Whether to include comments (increases cost)'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { postUrls: string[]; includeComments?: boolean; dryRun?: boolean }): Promise<string> {
        try {
          const result = await apifyManager.runApifyActor({
            actorId: 'apify/instagram-post-scraper',
            input: {
              directUrls: args.postUrls,
              resultsLimit: args.postUrls.length,
              addParentData: args.includeComments || false
            },
            label: `Instagram post scraping: ${args.postUrls.length} posts`,
            dryRun: args.dryRun || false
          });

          if (!result.success || !result.output) {
            return `Failed to scrape Instagram posts: ${result.error || 'Unknown error'}`;
          }

          const posts = result.output;
          let summary = `Successfully scraped ${posts.length} Instagram posts:\n\n`;

          posts.slice(0, 5).forEach((post: any, index: number) => {
            summary += `[${index + 1}] Post by @${post.ownerUsername || 'unknown'}\n`;
            summary += `   Caption: ${(post.caption || 'No caption').substring(0, 100)}${post.caption && post.caption.length > 100 ? '...' : ''}\n`;
            summary += `   Likes: ${post.likesCount || 0}, Comments: ${post.commentsCount || 0}\n`;
            summary += `   Type: ${post.type || 'unknown'}, Date: ${post.timestamp || 'N/A'}\n`;
            summary += `   URL: ${post.url || 'N/A'}\n\n`;
          });

          if (posts.length > 5) {
            summary += `... and ${posts.length - 5} more posts`;
          }

          return summary;
        } catch (error) {
          logger.error('Error in instagram-post-scraper tool:', error);
          return `Error scraping Instagram posts: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },

    'instagram-hashtag-scraper': {
      name: 'instagram-hashtag-scraper',
      description: 'Scrape Instagram posts by hashtags. Find trending content and analyze hashtag performance.',
      costEstimate: 'high',
      usageLimit: 10,
      schema: z.object({
        hashtags: z.array(z.string()).min(1).max(5).describe('Array of hashtags to scrape (without # symbol)'),
        limit: z.number().min(1).max(50).optional().describe('Maximum number of posts per hashtag'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { hashtags: string[]; limit?: number; dryRun?: boolean }): Promise<string> {
        try {
          const hashtags = args.hashtags.map(tag => tag.replace('#', ''));
          const result = await apifyManager.runApifyActor({
            actorId: 'apify/instagram-hashtag-scraper',
            input: {
              hashtags: hashtags,
              resultsLimit: Math.min(args.limit || 10, 20),
              proxyConfiguration: {
                useApifyProxy: true
              }
            },
            label: `Instagram hashtag scraping: ${hashtags.join(', ')}`,
            dryRun: args.dryRun || false
          });

          if (!result.success || !result.output) {
            return `Failed to scrape Instagram hashtags: ${result.error || 'Unknown error'}`;
          }

          const posts = result.output;
          let summary = `Successfully scraped ${posts.length} posts from hashtags: ${hashtags.map(h => `#${h.replace('#', '')}`).join(', ')}\n\n`;

          // Group by hashtag if possible
          const hashtagGroups: Record<string, any[]> = {};
          posts.forEach((post: any) => {
            const hashtag = post.hashtag || 'unknown';
            if (!hashtagGroups[hashtag]) hashtagGroups[hashtag] = [];
            hashtagGroups[hashtag].push(post);
          });

          Object.entries(hashtagGroups).slice(0, 3).forEach(([hashtag, hashtagPosts]) => {
            summary += `📊 #${hashtag}: ${hashtagPosts.length} posts\n`;
            hashtagPosts.slice(0, 2).forEach((post: any, index: number) => {
              summary += `   [${index + 1}] @${post.ownerUsername || 'unknown'}: ${(post.caption || 'No caption').substring(0, 80)}${post.caption && post.caption.length > 80 ? '...' : ''}\n`;
              summary += `       Likes: ${post.likesCount || 0}, Comments: ${post.commentsCount || 0}\n`;
            });
            summary += '\n';
          });

          return summary;
        } catch (error) {
          logger.error('Error in instagram-hashtag-scraper tool:', error);
          return `Error scraping Instagram hashtags: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },

    'instagram-profile-scraper': {
      name: 'instagram-profile-scraper',
      description: 'Scrape Instagram user profiles and their recent posts. Get follower counts, bio, and post history.',
      costEstimate: 'medium',
      usageLimit: 15,
      schema: z.object({
        usernames: z.array(z.string()).min(1).max(5).describe('Array of Instagram usernames to scrape (without @ symbol)'),
        includeRecentPosts: z.boolean().optional().describe('Whether to include recent posts from the profile'),
        limit: z.number().min(1).max(30).optional().describe('Maximum number of recent posts to include'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { usernames: string[]; includeRecentPosts?: boolean; limit?: number; dryRun?: boolean }): Promise<string> {
        try {
          const result = await apifyManager.runApifyActor({
            actorId: 'apify/instagram-profile-scraper',
            input: {
              usernames: args.usernames.map(u => u.replace('@', '')),
              resultsLimit: args.limit || 12,
              addParentData: args.includeRecentPosts || false
            },
            label: `Instagram profile scraping: ${args.usernames.join(', ')}`,
            dryRun: args.dryRun || false
          });

          if (!result.success || !result.output) {
            return `Failed to scrape Instagram profiles: ${result.error || 'Unknown error'}`;
          }

          const profiles = result.output;
          let summary = `Successfully scraped ${profiles.length} Instagram profiles:\n\n`;

          profiles.forEach((profile: any, index: number) => {
            summary += `[${index + 1}] @${profile.username || 'unknown'}\n`;
            summary += `   Full Name: ${profile.fullName || 'N/A'}\n`;
            summary += `   Bio: ${(profile.biography || 'No bio').substring(0, 100)}${profile.biography && profile.biography.length > 100 ? '...' : ''}\n`;
            summary += `   Followers: ${profile.followersCount || 0}, Following: ${profile.followsCount || 0}\n`;
            summary += `   Posts: ${profile.postsCount || 0}, Verified: ${profile.verified ? 'Yes' : 'No'}\n`;
            summary += `   External URL: ${profile.externalUrl || 'None'}\n`;
            
            if (profile.latestPosts && profile.latestPosts.length > 0) {
              summary += `   Recent Posts: ${profile.latestPosts.length} posts found\n`;
            }
            summary += '\n';
          });

          return summary;
        } catch (error) {
          logger.error('Error in instagram-profile-scraper tool:', error);
          return `Error scraping Instagram profiles: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    }
  };
} 