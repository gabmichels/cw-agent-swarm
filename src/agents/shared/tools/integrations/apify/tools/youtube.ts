/**
 * YouTube Tools - Channel and video scraping tools
 */

import { z } from 'zod';
import { logger } from '../../../../../../lib/logging';
import { IApifyManager } from '../ApifyManager.interface';
import { ToolDefinition } from '../types';

export function createYouTubeTools(apifyManager: IApifyManager): Record<string, ToolDefinition> {
  return {
    'youtube-channel-scraper': {
      name: 'youtube-channel-scraper',
      description: 'Scrape YouTube channels for detailed information, subscriber counts, and recent videos.',
      costEstimate: 'medium',
      usageLimit: 15,
      schema: z.object({
        channelUrls: z.array(z.string().url()).min(1).max(5).describe('Array of YouTube channel URLs to scrape'),
        includeVideos: z.boolean().optional().describe('Whether to include recent videos from the channel'),
        videoLimit: z.number().min(1).max(20).optional().describe('Maximum number of recent videos to include'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { channelUrls: string[]; includeVideos?: boolean; videoLimit?: number; dryRun?: boolean }): Promise<string> {
        try {
          const result = await apifyManager.runApifyActor({
            actorId: 'apify/youtube-channel-scraper',
            input: {
              startUrls: args.channelUrls.map(url => ({ url })),
              maxVideos: args.includeVideos ? (args.videoLimit || 10) : 0
            },
            label: `YouTube channel scraping: ${args.channelUrls.length} channels`,
            dryRun: args.dryRun || false
          });

          if (!result.success || !result.output) {
            return `Failed to scrape YouTube channels: ${result.error || 'Unknown error'}`;
          }

          const channels = result.output;
          let summary = `Successfully scraped ${channels.length} YouTube channels:\n\n`;

          channels.forEach((channel: any, index: number) => {
            summary += `[${index + 1}] ${channel.title || 'Unknown Channel'}\n`;
            summary += `   Handle: @${channel.handle || 'N/A'}\n`;
            summary += `   Subscribers: ${channel.subscriberCount || 'N/A'}\n`;
            summary += `   Total Views: ${channel.viewCount || 'N/A'}\n`;
            summary += `   Videos: ${channel.videoCount || 'N/A'}\n`;
            summary += `   Description: ${(channel.description || 'No description').substring(0, 100)}${channel.description && channel.description.length > 100 ? '...' : ''}\n`;
            
            if (channel.latestVideos && channel.latestVideos.length > 0) {
              summary += `   Recent Videos: ${channel.latestVideos.length} videos found\n`;
              channel.latestVideos.slice(0, 2).forEach((video: any, vIndex: number) => {
                summary += `     [${vIndex + 1}] ${video.title || 'Untitled'} (${video.viewCount || 0} views)\n`;
              });
            }
            summary += '\n';
          });

          return summary;
        } catch (error) {
          logger.error('Error in youtube-channel-scraper tool:', error);
          return `Error scraping YouTube channels: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },

    'youtube-video-scraper': {
      name: 'youtube-video-scraper',
      description: 'Scrape YouTube video data including title, description, views, likes, comments, and metadata',
      costEstimate: 'medium',
      usageLimit: 20,
      schema: z.object({
        videoUrls: z.array(z.string().url()).min(1).max(5).describe('Array of YouTube video URLs to scrape'),
        searchTerms: z.array(z.string()).optional().describe('Search terms to find YouTube videos'),
        includeComments: z.boolean().optional().describe('Whether to include comments (increases cost)'),
        commentLimit: z.number().min(1).max(50).optional().describe('Maximum number of comments to scrape per video'),
        limit: z.number().min(1).max(20).optional().describe('Maximum number of videos to scrape'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { videoUrls: string[]; searchTerms?: string[]; includeComments?: boolean; commentLimit?: number; limit?: number; dryRun?: boolean }): Promise<string> {
        try {
          const result = await apifyManager.runApifyActor({
            actorId: 'streamers/youtube-scraper',
            input: {
              searchQueries: args.searchTerms || [],
              startUrls: args.videoUrls?.map(url => ({ url })) || [],
              maxResults: Math.min(args.limit || 10, 20),
              proxyConfiguration: {
                useApifyProxy: true
              }
            },
            label: `YouTube video scraping: ${args.videoUrls?.length || 0} URLs, ${args.searchTerms?.length || 0} search terms`,
            dryRun: args.dryRun || false
          });

          if (!result.success || !result.output) {
            return `Failed to scrape YouTube videos: ${result.error || 'Unknown error'}`;
          }

          const videos = result.output;
          let summary = `Successfully scraped ${videos.length} YouTube videos:\n\n`;

          videos.slice(0, 5).forEach((video: any, index: number) => {
            summary += `[${index + 1}] ${video.title || 'Unknown Video'}\n`;
            summary += `   Channel: ${video.channelName || 'Unknown'}\n`;
            summary += `   Views: ${video.viewCount || 0}, Likes: ${video.likeCount || 0}\n`;
            summary += `   Duration: ${video.duration || 'N/A'}, Published: ${video.publishedAt || 'N/A'}\n`;
            summary += `   Description: ${(video.description || 'No description').substring(0, 100)}${video.description && video.description.length > 100 ? '...' : ''}\n`;
            
            if (video.comments && video.comments.length > 0) {
              summary += `   Comments: ${video.comments.length} comments found\n`;
            }
            summary += `   URL: ${video.url || 'N/A'}\n\n`;
          });

          if (videos.length > 5) {
            summary += `... and ${videos.length - 5} more videos`;
          }

          return summary;
        } catch (error) {
          logger.error('Error in youtube-video-scraper tool:', error);
          return `Error scraping YouTube videos: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    }
  };
} 