/**
 * TikTok Tools - Comprehensive TikTok scraping capabilities
 */

import { z } from 'zod';
import { logger } from '../../../../../../lib/logging';
import { IApifyManager } from '../ApifyManager.interface';
import { ToolDefinition } from '../types';

export function createTikTokTools(apifyManager: IApifyManager): Record<string, ToolDefinition> {
  return {
    'tiktok-posts-scraper': {
      name: 'tiktok-posts-scraper',
      description: 'Scrape TikTok videos/posts from profiles, hashtags, locations, or search results. Supports multiple URL types for comprehensive content discovery.',
      costEstimate: 'high',
      usageLimit: 10,
      schema: z.object({
        startUrls: z.array(z.string().url()).min(1).max(5).describe('Array of TikTok URLs (profiles, hashtags, posts, locations, etc.)'),
        keywords: z.array(z.string()).optional().describe('Keywords to search for on TikTok'),
        maxItems: z.number().min(1).max(100).optional().describe('Maximum number of items to scrape'),
        location: z.string().length(2).optional().describe('ISO 3166-1 alpha-2 country code for location targeting'),
        includeSearchKeywords: z.boolean().optional().describe('Include search keyword info in results'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { 
        startUrls: string[]; 
        keywords?: string[];
        maxItems?: number;
        location?: string;
        includeSearchKeywords?: boolean;
        dryRun?: boolean;
      }): Promise<string> {
        try {
          const maxItems = Math.min(args.maxItems || 20, 100);
          
          const input: Record<string, unknown> = {
            startUrls: args.startUrls.map(url => ({ url })),
            maxItems,
            location: args.location || 'US',
            includeSearchKeywords: args.includeSearchKeywords || false
          };

          if (args.keywords && args.keywords.length > 0) {
            input.keywords = args.keywords;
          }

          const result = await apifyManager.runApifyActor({
            actorId: 'apidojo/tiktok-scraper',
            input,
            label: `TikTok posts scraping: ${args.startUrls.length} URLs`,
            dryRun: args.dryRun || false
          });

          if (!result.success || !result.output) {
            return `Failed to scrape TikTok posts: ${result.error || 'Unknown error'}`;
          }

          const posts = result.output;
          let summary = `Successfully scraped ${posts.length} TikTok posts:\n\n`;

          posts.slice(0, 5).forEach((post: any, index: number) => {
            summary += `[${index + 1}] ${post.channel?.name || 'Unknown Creator'} (@${post.channel?.username || 'unknown'})\n`;
            summary += `   Title: ${(post.title || 'No title').substring(0, 120)}${post.title && post.title.length > 120 ? '...' : ''}\n`;
            summary += `   Views: ${post.views?.toLocaleString() || 0}, Likes: ${post.likes?.toLocaleString() || 0}\n`;
            summary += `   Comments: ${post.comments?.toLocaleString() || 0}, Shares: ${post.shares?.toLocaleString() || 0}\n`;
            if (post.hashtags && post.hashtags.length > 0) {
              summary += `   Hashtags: #${post.hashtags.join(' #')}\n`;
            }
            summary += `   Duration: ${post.video?.duration || 'N/A'}s\n`;
            summary += `   Posted: ${post.uploadedAtFormatted || 'N/A'}\n`;
            summary += `   URL: ${post.postPage || 'N/A'}\n\n`;
          });

          if (posts.length > 5) {
            summary += `... and ${posts.length - 5} more posts`;
          }

          return summary;
        } catch (error) {
          logger.error('Error in tiktok-posts-scraper tool:', error);
          return `Error scraping TikTok posts: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },

    'tiktok-hashtag-scraper': {
      name: 'tiktok-hashtag-scraper',
      description: 'Scrape TikTok posts from specific hashtags to discover trending content and analyze hashtag performance.',
      costEstimate: 'medium',
      usageLimit: 15,
      schema: z.object({
        hashtags: z.array(z.string()).min(1).max(3).describe('Hashtag names (without #) to scrape'),
        maxItems: z.number().min(1).max(50).optional().describe('Maximum number of posts per hashtag'),
        location: z.string().length(2).optional().describe('ISO 3166-1 alpha-2 country code'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { 
        hashtags: string[];
        maxItems?: number;
        location?: string;
        dryRun?: boolean;
      }): Promise<string> {
        try {
          const maxItems = Math.min(args.maxItems || 20, 50);
          
          // Convert hashtags to TikTok hashtag URLs
          const startUrls = args.hashtags.map(hashtag => {
            const cleanHashtag = hashtag.replace(/^#/, '');
            return `https://www.tiktok.com/tag/${cleanHashtag}`;
          });

          const result = await apifyManager.runApifyActor({
            actorId: 'apidojo/tiktok-scraper',
            input: {
              startUrls: startUrls,
              maxItems,
              location: args.location || 'US'
            },
            label: `TikTok hashtag scraping: ${args.hashtags.length} hashtags`,
            dryRun: args.dryRun || false
          });

          if (!result.success || !result.output) {
            return `Failed to scrape TikTok hashtags: ${result.error || 'Unknown error'}`;
          }

          const posts = result.output;
          let summary = `Successfully scraped ${posts.length} posts from hashtags: #${args.hashtags.join(', #')}\n\n`;

          // Group posts by hashtag if possible
          const hashtagMap = new Map<string, any[]>();
          posts.forEach((post: any) => {
            if (post.hashtags && post.hashtags.length > 0) {
              post.hashtags.forEach((tag: string) => {
                if (args.hashtags.some(h => h.toLowerCase() === tag.toLowerCase())) {
                  if (!hashtagMap.has(tag)) {
                    hashtagMap.set(tag, []);
                  }
                  hashtagMap.get(tag)!.push(post);
                }
              });
            }
          });

          if (hashtagMap.size > 0) {
            hashtagMap.forEach((tagPosts, hashtag) => {
              summary += `#${hashtag} (${tagPosts.length} posts):\n`;
              tagPosts.slice(0, 3).forEach((post: any, index: number) => {
                summary += `  [${index + 1}] ${post.channel?.name || 'Unknown'}: ${post.views?.toLocaleString() || 0} views, ${post.likes?.toLocaleString() || 0} likes\n`;
              });
              summary += '\n';
            });
          } else {
            // Fallback to general post listing
            posts.slice(0, 5).forEach((post: any, index: number) => {
              summary += `[${index + 1}] ${post.channel?.name || 'Unknown Creator'}\n`;
              summary += `   Views: ${post.views?.toLocaleString() || 0}, Likes: ${post.likes?.toLocaleString() || 0}\n`;
              summary += `   Hashtags: #${(post.hashtags || []).join(' #')}\n\n`;
            });
          }

          return summary;
        } catch (error) {
          logger.error('Error in tiktok-hashtag-scraper tool:', error);
          return `Error scraping TikTok hashtags: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },

    'tiktok-user-scraper': {
      name: 'tiktok-user-scraper',
      description: 'Scrape TikTok user profiles and their recent posts to analyze creator content and performance.',
      costEstimate: 'medium',
      usageLimit: 15,
      schema: z.object({
        usernames: z.array(z.string()).min(1).max(5).describe('TikTok usernames (without @) to scrape'),
        maxItems: z.number().min(1).max(30).optional().describe('Maximum number of posts per user'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { 
        usernames: string[];
        maxItems?: number;
        dryRun?: boolean;
      }): Promise<string> {
        try {
          const maxItems = Math.min(args.maxItems || 15, 30);
          
          // Convert usernames to TikTok profile URLs
          const startUrls = args.usernames.map(username => {
            const cleanUsername = username.replace(/^@/, '');
            return `https://www.tiktok.com/@${cleanUsername}`;
          });

          const result = await apifyManager.runApifyActor({
            actorId: 'apidojo/tiktok-scraper',
            input: {
              startUrls: startUrls,
              maxItems
            },
            label: `TikTok user scraping: ${args.usernames.length} users`,
            dryRun: args.dryRun || false
          });

          if (!result.success || !result.output) {
            return `Failed to scrape TikTok users: ${result.error || 'Unknown error'}`;
          }

          const posts = result.output;
          let summary = `Successfully scraped ${posts.length} posts from users: @${args.usernames.join(', @')}\n\n`;

          // Group posts by user
          const userMap = new Map<string, any[]>();
          posts.forEach((post: any) => {
            const username = post.channel?.username || 'unknown';
            if (!userMap.has(username)) {
              userMap.set(username, []);
            }
            userMap.get(username)!.push(post);
          });

          userMap.forEach((userPosts, username) => {
            const firstPost = userPosts[0];
            summary += `@${username} (${firstPost.channel?.name || 'Unknown Name'})\n`;
            summary += `   Followers: ${firstPost.channel?.followers?.toLocaleString() || 'N/A'}\n`;
            summary += `   Following: ${firstPost.channel?.following?.toLocaleString() || 'N/A'}\n`;
            summary += `   Total Videos: ${firstPost.channel?.videos?.toLocaleString() || 'N/A'}\n`;
            summary += `   Recent Posts (${userPosts.length}):\n`;
            
            userPosts.slice(0, 3).forEach((post: any, index: number) => {
              summary += `     [${index + 1}] ${(post.title || 'No title').substring(0, 80)}${post.title && post.title.length > 80 ? '...' : ''}\n`;
              summary += `         Views: ${post.views?.toLocaleString() || 0}, Likes: ${post.likes?.toLocaleString() || 0}\n`;
            });
            summary += '\n';
          });

          return summary;
        } catch (error) {
          logger.error('Error in tiktok-user-scraper tool:', error);
          return `Error scraping TikTok users: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },

    'tiktok-search-scraper': {
      name: 'tiktok-search-scraper',
      description: 'Search TikTok for specific keywords and scrape matching videos to discover trending content and topics.',
      costEstimate: 'medium',
      usageLimit: 15,
      schema: z.object({
        keywords: z.array(z.string()).min(1).max(3).describe('Keywords to search for on TikTok'),
        maxItems: z.number().min(1).max(50).optional().describe('Maximum number of results per keyword'),
        location: z.string().length(2).optional().describe('ISO 3166-1 alpha-2 country code for regional results'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { 
        keywords: string[];
        maxItems?: number;
        location?: string;
        dryRun?: boolean;
      }): Promise<string> {
        try {
          const maxItems = Math.min(args.maxItems || 20, 50);
          
          // Convert keywords to TikTok search URLs
          const startUrls = args.keywords.map(keyword => 
            `https://www.tiktok.com/search?q=${encodeURIComponent(keyword)}`
          );

          const result = await apifyManager.runApifyActor({
            actorId: 'apidojo/tiktok-scraper',
            input: {
              startUrls: startUrls,
              keywords: args.keywords,
              maxItems,
              location: args.location || 'US',
              includeSearchKeywords: true
            },
            label: `TikTok search scraping: ${args.keywords.length} keywords`,
            dryRun: args.dryRun || false
          });

          if (!result.success || !result.output) {
            return `Failed to search TikTok: ${result.error || 'Unknown error'}`;
          }

          const posts = result.output;
          let summary = `Successfully found ${posts.length} TikTok posts for search: "${args.keywords.join('", "')}"\n\n`;

          // Show top results
          posts.slice(0, 8).forEach((post: any, index: number) => {
            summary += `[${index + 1}] ${post.channel?.name || 'Unknown Creator'} (@${post.channel?.username || 'unknown'})\n`;
            summary += `   Title: ${(post.title || 'No title').substring(0, 100)}${post.title && post.title.length > 100 ? '...' : ''}\n`;
            summary += `   Performance: ${post.views?.toLocaleString() || 0} views, ${post.likes?.toLocaleString() || 0} likes\n`;
            if (post.hashtags && post.hashtags.length > 0) {
              summary += `   Hashtags: #${post.hashtags.slice(0, 5).join(' #')}\n`;
            }
            summary += `   Posted: ${post.uploadedAtFormatted || 'N/A'}\n\n`;
          });

          if (posts.length > 8) {
            summary += `... and ${posts.length - 8} more results`;
          }

          // Add engagement statistics
          if (posts.length > 0) {
            const totalViews = posts.reduce((sum: number, post: any) => sum + (post.views || 0), 0);
            const totalLikes = posts.reduce((sum: number, post: any) => sum + (post.likes || 0), 0);
            const avgViews = Math.round(totalViews / posts.length);
            const avgLikes = Math.round(totalLikes / posts.length);
            
            summary += `\n\nEngagement Summary:\n`;
            summary += `Total Views: ${totalViews.toLocaleString()}\n`;
            summary += `Total Likes: ${totalLikes.toLocaleString()}\n`;
            summary += `Avg Views/Post: ${avgViews.toLocaleString()}\n`;
            summary += `Avg Likes/Post: ${avgLikes.toLocaleString()}`;
          }

          return summary;
        } catch (error) {
          logger.error('Error in tiktok-search-scraper tool:', error);
          return `Error searching TikTok: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },

    'tiktok-location-scraper': {
      name: 'tiktok-location-scraper',
      description: 'Scrape TikTok posts from specific locations to analyze geo-targeted content and regional trends.',
      costEstimate: 'medium',
      usageLimit: 12,
      schema: z.object({
        locationUrls: z.array(z.string().url()).min(1).max(3).describe('TikTok location URLs to scrape'),
        maxItems: z.number().min(1).max(40).optional().describe('Maximum number of posts per location'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { 
        locationUrls: string[];
        maxItems?: number;
        dryRun?: boolean;
      }): Promise<string> {
        try {
          const maxItems = Math.min(args.maxItems || 20, 40);

          const result = await apifyManager.runApifyActor({
            actorId: 'apidojo/tiktok-scraper',
            input: {
              startUrls: args.locationUrls,
              maxItems
            },
            label: `TikTok location scraping: ${args.locationUrls.length} locations`,
            dryRun: args.dryRun || false
          });

          if (!result.success || !result.output) {
            return `Failed to scrape TikTok locations: ${result.error || 'Unknown error'}`;
          }

          const posts = result.output;
          let summary = `Successfully scraped ${posts.length} TikTok posts from ${args.locationUrls.length} locations:\n\n`;

          posts.slice(0, 6).forEach((post: any, index: number) => {
            summary += `[${index + 1}] ${post.channel?.name || 'Unknown Creator'}\n`;
            summary += `   Title: ${(post.title || 'No title').substring(0, 100)}${post.title && post.title.length > 100 ? '...' : ''}\n`;
            summary += `   Location-based performance: ${post.views?.toLocaleString() || 0} views, ${post.likes?.toLocaleString() || 0} likes\n`;
            summary += `   Posted: ${post.uploadedAtFormatted || 'N/A'}\n`;
            if (post.hashtags && post.hashtags.length > 0) {
              summary += `   Popular tags: #${post.hashtags.slice(0, 3).join(' #')}\n`;
            }
            summary += '\n';
          });

          if (posts.length > 6) {
            summary += `... and ${posts.length - 6} more location-based posts`;
          }

          return summary;
        } catch (error) {
          logger.error('Error in tiktok-location-scraper tool:', error);
          return `Error scraping TikTok locations: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    }
  };
} 