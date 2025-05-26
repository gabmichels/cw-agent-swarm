/**
 * DefaultApifyManager.ts - Default implementation of ApifyManager
 * 
 * This file provides the default implementation of the IApifyManager interface
 * for interacting with the Apify platform.
 */

import { 
  IApifyManager, 
  ApifyToolInput, 
  ApifyToolResult, 
  ApifyLimitContext, 
  ApifyLimitResult,
  ApifyActorMetadata,
  ActorDiscoveryOptions
} from './ApifyManager.interface';
import { logger } from '../../../../../lib/logging';

/**
 * Custom error class for Apify operations
 */
export class ApifyError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'ApifyError';
  }
}

/**
 * Default implementation of the ApifyManager interface
 */
export class DefaultApifyManager implements IApifyManager {
  private apiToken: string;
  private baseApiUrl = 'https://api.apify.com/v2';

  /**
   * Create a new ApifyManager
   */
  constructor() {
    // Get the API token from environment variables
    this.apiToken = process.env.APIFY_API_KEY || '';
    
    if (!this.apiToken) {
      logger.warn('APIFY_API_KEY environment variable is not set. Apify tools will not work.');
    }
  }

  /**
   * Run an Apify actor with the given options
   * 
   * @param options The options for running the actor
   * @param visualization Optional visualization context
   * @param visualizer Optional visualization service
   * @returns The result of the operation
   */
  async runApifyActor<T = any>(
    options: ApifyToolInput,
    visualization?: any,
    visualizer?: any
  ): Promise<ApifyToolResult<T>> {
    const startTime = Date.now();
    let vizNodeId: string | undefined;
    let isRssFeed = false;
    
    // Check if this is an RSS feed actor call
    if (options.actorId === 'lstolcman/rss-scraper' || 
        options.actorId === 'apify/rss-reader' || 
        options.label?.toLowerCase().includes('rss') || 
        (options.input && 'urls' in options.input && Array.isArray(options.input.urls))) {
      isRssFeed = true;
    }
    
    // Create visualization node if visualization is enabled and this is an RSS feed
    if (visualization && visualizer && isRssFeed) {
      try {
        // Create an RSS feed visualization node
        vizNodeId = visualizer.addNode(
          visualization,
          'rss_feed',
          'RSS Feed',
          {
            actorId: options.actorId,
            urls: options.input && 'urls' in options.input ? options.input.urls : [],
            label: options.label,
            timestamp: startTime,
            dryRun: options.dryRun
          },
          'in_progress'
        );
      } catch (visualizationError) {
        logger.error('Error creating RSS feed visualization node:', visualizationError);
      }
    }
    
    // Check if API token is available
    if (!this.apiToken) {
      // Update visualization with error if this is an RSS feed
      if (visualization && visualizer && vizNodeId && isRssFeed) {
        try {
          visualizer.updateNode(
            visualization,
            vizNodeId,
            {
              status: 'error',
              data: {
                error: 'APIFY_API_KEY environment variable is not set',
                errorCode: 'MISSING_API_KEY'
              }
            }
          );
        } catch (visualizationError) {
          logger.error('Error updating RSS feed visualization with error:', visualizationError);
        }
      }
      
      return {
        success: false,
        error: 'APIFY_API_KEY environment variable is not set'
      };
    }
    
    // Handle dry run mode
    if (options.dryRun) {
      logger.info(`[DRY RUN] Would start Apify actor: ${options.actorId} (${options.label || 'Unnamed run'})`);
      
      // Update visualization with dry run info if this is an RSS feed
      if (visualization && visualizer && vizNodeId && isRssFeed) {
        try {
          visualizer.updateNode(
            visualization,
            vizNodeId,
            {
              status: 'completed',
              data: {
                isDryRun: true,
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime
              }
            }
          );
        } catch (visualizationError) {
          logger.error('Error updating RSS feed visualization with dry run info:', visualizationError);
        }
      }
      
      return {
        success: true,
        runId: 'dry-run-id',
        output: [],
        error: 'This was a dry run. No actual API call was made.'
      };
    }
    
    try {
      // Update visualization with execution details if this is an RSS feed
      if (visualization && visualizer && vizNodeId && isRssFeed) {
        try {
          visualizer.updateNode(
            visualization,
            vizNodeId,
            {
              data: {
                executionStarted: Date.now()
              }
            }
          );
        } catch (visualizationError) {
          logger.error('Error updating RSS feed visualization with execution details:', visualizationError);
        }
      }
      
      // Convert actor ID format: replace '/' with '~' for API endpoint
      const apiActorId = options.actorId.replace('/', '~');
      
      // Build query parameters for run options
      const queryParams = new URLSearchParams();
      queryParams.append('token', this.apiToken);
      queryParams.append('memory', '4096');
      queryParams.append('timeout', '300');
      
      // Send the input directly as the request body (not wrapped)
      const runResponse = await fetch(`${this.baseApiUrl}/acts/${apiActorId}/runs?${queryParams.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options.input)
      });
      
      if (!runResponse.ok) {
        const error = await runResponse.text();
        logger.error(`Failed to start Apify actor: ${error}`);
        
        // Update visualization with error if this is an RSS feed
        if (visualization && visualizer && vizNodeId && isRssFeed) {
          try {
            visualizer.updateNode(
              visualization,
              vizNodeId,
              {
                status: 'error',
                data: {
                  error: `Failed to start actor: ${error}`,
                  errorCode: 'START_FAILED',
                  executionCompleted: Date.now(),
                  durationMs: Date.now() - startTime
                }
              }
            );
          } catch (visualizationError) {
            logger.error('Error updating RSS feed visualization with error:', visualizationError);
          }
        }
        
        return {
          success: false,
          error: `Failed to start actor: ${error}`
        };
      }
      
      const runData = await runResponse.json();
      const runId = runData.data.id;
      
      // Wait for the run to finish
      let status = 'RUNNING';
      let attempts = 0;
      const maxAttempts = 30;
      
      while (status === 'RUNNING' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        attempts++;
        
        const statusResponse = await fetch(`${this.baseApiUrl}/actor-runs/${runId}?token=${this.apiToken}`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!statusResponse.ok) {
          const error = await statusResponse.text();
          logger.error(`Failed to check run status: ${error}`);
          
          // Update visualization with error if this is an RSS feed
          if (visualization && visualizer && vizNodeId && isRssFeed) {
            try {
              visualizer.updateNode(
                visualization,
                vizNodeId,
                {
                  status: 'error',
                  data: {
                    error: `Failed to check run status: ${error}`,
                    errorCode: 'STATUS_CHECK_FAILED',
                    executionCompleted: Date.now(),
                    durationMs: Date.now() - startTime
                  }
                }
              );
            } catch (visualizationError) {
              logger.error('Error updating RSS feed visualization with error:', visualizationError);
            }
          }
          
          return {
            success: false,
            runId,
            error: `Failed to check run status: ${error}`
          };
        }
        
        const statusData = await statusResponse.json();
        status = statusData.data.status;
      }
      
      if (status !== 'SUCCEEDED') {
        logger.warn(`Actor run ${runId} did not complete successfully: ${status}`);
        
        // Update visualization with error if this is an RSS feed
        if (visualization && visualizer && vizNodeId && isRssFeed) {
          try {
            visualizer.updateNode(
              visualization,
              vizNodeId,
              {
                status: 'error',
                data: {
                  error: `Actor run did not complete successfully: ${status}`,
                  errorCode: 'RUN_FAILED',
                  executionCompleted: Date.now(),
                  durationMs: Date.now() - startTime
                }
              }
            );
          } catch (visualizationError) {
            logger.error('Error updating RSS feed visualization with error:', visualizationError);
          }
        }
        
        return {
          success: false,
          runId,
          error: `Actor run did not complete successfully: ${status}`
        };
      }
      
      // Get the run results
      const datasetResponse = await fetch(`${this.baseApiUrl}/actor-runs/${runId}/dataset/items?token=${this.apiToken}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!datasetResponse.ok) {
        const error = await datasetResponse.text();
        logger.error(`Failed to fetch run results: ${error}`);
        
        // Update visualization with error if this is an RSS feed
        if (visualization && visualizer && vizNodeId && isRssFeed) {
          try {
            visualizer.updateNode(
              visualization,
              vizNodeId,
              {
                status: 'error',
                data: {
                  error: `Failed to fetch run results: ${error}`,
                  errorCode: 'RESULTS_FETCH_FAILED',
                  executionCompleted: Date.now(),
                  durationMs: Date.now() - startTime
                }
              }
            );
          } catch (visualizationError) {
            logger.error('Error updating RSS feed visualization with error:', visualizationError);
          }
        }
        
        return {
          success: false,
          runId,
          error: `Failed to fetch run results: ${error}`
        };
      }
      
      const outputData = await datasetResponse.json();
      const endTime = Date.now();
      
      // Create results analysis node if visualization is enabled and this is an RSS feed
      if (visualization && visualizer && vizNodeId && isRssFeed && Array.isArray(outputData)) {
        try {
          // Update feed node with success
          visualizer.updateNode(
            visualization,
            vizNodeId,
            {
              status: 'completed',
              data: {
                resultCount: outputData.length,
                executionCompleted: endTime,
                durationMs: endTime - startTime,
                success: true
              }
            }
          );
          
          // Create analysis node if we have feed items
          if (outputData.length > 0) {
            // Analyze feed content
            const feedItems = outputData;
            const feedUrls = options.input && 'urls' in options.input ? options.input.urls : [];
            const firstUrl = Array.isArray(feedUrls) && feedUrls.length > 0 ? feedUrls[0] : 'unknown';
            
            // Create analysis node
            const analysisNodeId = visualizer.addNode(
              visualization,
              'rss_analysis',
              'RSS Feed Analysis',
              {
                url: firstUrl,
                resultCount: feedItems.length,
                totalFeeds: Array.isArray(feedUrls) ? feedUrls.length : 1,
                topTitles: feedItems.slice(0, 3).map((item: any) => item.title || 'Untitled'),
                contentTypes: this.categorizeRssContent(feedItems),
                timestamp: Date.now()
              },
              'completed'
            );
            
            // Connect feed node to analysis node
            visualizer.addEdge(
              visualization,
              vizNodeId,
              analysisNodeId,
              'flow',
              'analyzed'
            );
          }
        } catch (visualizationError) {
          logger.error('Error creating RSS feed analysis visualization:', visualizationError);
        }
      }
      
      return {
        success: true,
        runId,
        output: outputData
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error in Apify actor run: ${errorMessage}`);
      
      // Update visualization with error if this is an RSS feed
      if (visualization && visualizer && vizNodeId && isRssFeed) {
        try {
          visualizer.updateNode(
            visualization,
            vizNodeId,
            {
              status: 'error',
              data: {
                error: `Error in actor run: ${errorMessage}`,
                errorCode: 'EXECUTION_ERROR',
                errorStack: error instanceof Error ? error.stack : undefined,
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime
              }
            }
          );
        } catch (visualizationError) {
          logger.error('Error updating RSS feed visualization with error:', visualizationError);
        }
      }
      
      return {
        success: false,
        error: `Error in actor run: ${errorMessage}`
      };
    }
  }

  /**
   * Categorize RSS content types
   * 
   * @private
   * @param items RSS feed items from the API
   * @returns Object with categories and counts
   */
  private categorizeRssContent(items: any[]): Record<string, number> {
    const categories: Record<string, number> = {
      'text': 0,
      'image': 0,
      'video': 0,
      'link': 0,
      'audio': 0,
      'other': 0
    };
    
    for (const item of items) {
      const content = item.content || item.contentSnippet || item.description || '';
      
      if (item.enclosure && item.enclosure.type) {
        // Use enclosure type if available
        const type = item.enclosure.type;
        
        if (type.startsWith('image/')) {
          categories.image++;
        } else if (type.startsWith('video/')) {
          categories.video++;
        } else if (type.startsWith('audio/')) {
          categories.audio++;
        } else {
          categories.other++;
        }
      } else if (content.includes('<img') || content.match(/\.(jpg|jpeg|png|gif)/i)) {
        categories.image++;
      } else if (content.includes('<video') || content.match(/\.(mp4|webm|ogv)/i)) {
        categories.video++;
      } else if (content.includes('<audio') || content.match(/\.(mp3|wav|ogg)/i)) {
        categories.audio++;
      } else if (content.length > 0) {
        categories.text++;
      } else if (item.link) {
        categories.link++;
      } else {
        categories.other++;
      }
    }
    
    return categories;
  }

  /**
   * Search Reddit for posts related to a keyword or topic
   * 
   * @param query The search query
   * @param dryRun Whether to skip the actual API call
   * @param maxResults Maximum number of results to return
   * @param visualization Optional visualization context
   * @param visualizer Optional visualization service
   * @returns The search results
   */
  async runRedditSearch(
    query: string, 
    dryRun = false, 
    maxResults = 10,
    visualization?: any, 
    visualizer?: any
  ): Promise<ApifyToolResult> {
    const startTime = Date.now();
    let searchNodeId: string | undefined;
    
    // Create visualization node if visualization is enabled
    if (visualization && visualizer) {
      try {
        // Create a Reddit search visualization node
        searchNodeId = visualizer.addNode(
          visualization,
          'reddit_search',
          'Reddit Search',
          {
            query,
            maxResults,
            dryRun,
            timestamp: startTime
          },
          'in_progress'
        );
      } catch (visualizationError) {
        logger.error('Error creating Reddit search visualization node:', visualizationError);
      }
    }
    
    try {
      // Update visualization with execution details
      if (visualization && visualizer && searchNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            searchNodeId,
            {
              data: {
                executionStarted: Date.now()
              }
            }
          );
        } catch (visualizationError) {
          logger.error('Error updating Reddit search visualization:', visualizationError);
        }
      }
      
      // Execute the search
      const result = await this.runApifyActor({
        actorId: 'trudax/reddit-scraper-lite',
        input: {
          searchQuery: query,
          maxPosts: maxResults,
          skipComments: true,
        },
        label: `Reddit search: ${query}`,
        dryRun
      }, visualization, visualizer);
      
      // Create results analysis node if visualization is enabled and search was successful
      if (visualization && visualizer && searchNodeId && result.success && result.output) {
        try {
          const endTime = Date.now();
          
          // Update search node with success
          visualizer.updateNode(
            visualization,
            searchNodeId,
            {
              status: 'completed',
              data: {
                resultCount: Array.isArray(result.output) ? result.output.length : 0,
                executionCompleted: endTime,
                durationMs: endTime - startTime,
                success: true
              }
            }
          );
          
          // Create analysis node
          if (Array.isArray(result.output) && result.output.length > 0) {
            const posts = result.output;
            
            // Create analysis node
            const analysisNodeId = visualizer.addNode(
              visualization,
              'reddit_analysis',
              'Reddit Search Results Analysis',
              {
                query,
                resultCount: posts.length,
                communities: Array.from(new Set(posts.map((p: any) => p.community || p.subreddit || 'unknown'))),
                topTitles: posts.slice(0, 3).map((p: any) => p.title || 'Untitled'),
                timestamp: Date.now()
              },
              'completed'
            );
            
            // Connect search node to analysis node
            visualizer.addEdge(
              visualization,
              searchNodeId,
              analysisNodeId,
              'flow',
              'analyzed'
            );
          }
        } catch (visualizationError) {
          logger.error('Error creating Reddit search results visualization:', visualizationError);
        }
      } else if (visualization && visualizer && searchNodeId && !result.success) {
        // Update visualization with error
        try {
          visualizer.updateNode(
            visualization,
            searchNodeId,
            {
              status: 'error',
              data: {
                error: result.error || 'Search failed with no specific error',
                errorCode: 'SEARCH_FAILED',
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime
              }
            }
          );
        } catch (visualizationError) {
          logger.error('Error updating Reddit search visualization with error:', visualizationError);
        }
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error in Reddit search: ${errorMessage}`);
      
      // Update visualization with error
      if (visualization && visualizer && searchNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            searchNodeId,
            {
              status: 'error',
              data: {
                error: errorMessage,
                errorCode: 'SEARCH_ERROR',
                errorStack: error instanceof Error ? error.stack : undefined,
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime
              }
            }
          );
        } catch (visualizationError) {
          logger.error('Error updating Reddit search visualization with error:', visualizationError);
        }
      }
      
      return {
        success: false,
        error: `Error in Reddit search: ${errorMessage}`
      };
    }
  }

  /**
   * Search Twitter for tweets related to a keyword or topic
   * 
   * @param query The search query
   * @param dryRun Whether to skip the actual API call
   * @param maxResults Maximum number of results to return
   * @param visualization Optional visualization context
   * @param visualizer Optional visualization service
   * @returns The search results
   */
  async runTwitterSearch(
    query: string, 
    dryRun = false, 
    maxResults = 10,
    visualization?: any, 
    visualizer?: any
  ): Promise<ApifyToolResult> {
    const startTime = Date.now();
    let searchNodeId: string | undefined;
    
    // Create visualization node if visualization is enabled
    if (visualization && visualizer) {
      try {
        // Create a Twitter search visualization node
        searchNodeId = visualizer.addNode(
          visualization,
          'twitter_search',
          'Twitter Search',
          {
            query,
            maxResults,
            dryRun,
            timestamp: startTime
          },
          'in_progress'
        );
      } catch (visualizationError) {
        logger.error('Error creating Twitter search visualization node:', visualizationError);
      }
    }
    
    try {
      // Update visualization with execution details
      if (visualization && visualizer && searchNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            searchNodeId,
            {
              data: {
                executionStarted: Date.now()
              }
            }
          );
        } catch (visualizationError) {
          logger.error('Error updating Twitter search visualization:', visualizationError);
        }
      }
      
      // Execute the search
      const result = await this.runApifyActor({
        actorId: 'apidojo/twitter-scraper-lite',
        input: {
          searchTerms: [query],
          maxItems: Math.min(maxResults, 40), // Enforce max 40 results as per documentation
          includeSearchTerms: false,
          onlyImage: false,
          onlyQuote: false,
          onlyTwitterBlue: false,
          onlyVerifiedUsers: true,
          onlyVideo: false,
          sort: 'Latest',
          tweetLanguage: 'en'
        },
        label: `Twitter search: ${query}`,
        dryRun
      }, visualization, visualizer);
      
      // Create results analysis node if visualization is enabled and search was successful
      if (visualization && visualizer && searchNodeId && result.success && result.output) {
        try {
          const endTime = Date.now();
          
          // Update search node with success
          visualizer.updateNode(
            visualization,
            searchNodeId,
            {
              status: 'completed',
              data: {
                resultCount: Array.isArray(result.output) ? result.output.length : 0,
                executionCompleted: endTime,
                durationMs: endTime - startTime,
                success: true
              }
            }
          );
          
          // Create analysis node
          if (Array.isArray(result.output) && result.output.length > 0) {
            const tweets = result.output;
            
            // Create analysis node
            const analysisNodeId = visualizer.addNode(
              visualization,
              'twitter_analysis',
              'Twitter Search Results Analysis',
              {
                query,
                resultCount: tweets.length,
                users: Array.from(new Set(tweets.map((t: any) => t.username || t.user?.screen_name || 'unknown'))),
                topContent: tweets.slice(0, 3).map((t: any) => t.text || t.full_text || t.content || 'No content'),
                contentTypes: this.categorizeTweets(tweets),
                timestamp: Date.now()
              },
              'completed'
            );
            
            // Connect search node to analysis node
            visualizer.addEdge(
              visualization,
              searchNodeId,
              analysisNodeId,
              'flow',
              'analyzed'
            );
          }
        } catch (visualizationError) {
          logger.error('Error creating Twitter search results visualization:', visualizationError);
        }
      } else if (visualization && visualizer && searchNodeId && !result.success) {
        // Update visualization with error
        try {
          visualizer.updateNode(
            visualization,
            searchNodeId,
            {
              status: 'error',
              data: {
                error: result.error || 'Search failed with no specific error',
                errorCode: 'SEARCH_FAILED',
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime
              }
            }
          );
        } catch (visualizationError) {
          logger.error('Error updating Twitter search visualization with error:', visualizationError);
        }
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error in Twitter search: ${errorMessage}`);
      
      // Update visualization with error
      if (visualization && visualizer && searchNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            searchNodeId,
            {
              status: 'error',
              data: {
                error: errorMessage,
                errorCode: 'SEARCH_ERROR',
                errorStack: error instanceof Error ? error.stack : undefined,
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime
              }
            }
          );
        } catch (visualizationError) {
          logger.error('Error updating Twitter search visualization with error:', visualizationError);
        }
      }
      
      return {
        success: false,
        error: `Error in Twitter search: ${errorMessage}`
      };
    }
  }

  /**
   * Categorize tweet types 
   * 
   * @private
   * @param tweets Array of tweet objects from the API
   * @returns Object with categories and counts
   */
  private categorizeTweets(tweets: any[]): Record<string, number> {
    const categories: Record<string, number> = {
      'text': 0,
      'image': 0,
      'video': 0,
      'link': 0,
      'retweet': 0,
      'reply': 0
    };
    
    for (const tweet of tweets) {
      // Check for retweets and replies
      if (tweet.is_retweet || tweet.retweeted_status || tweet.text?.startsWith('RT @')) {
        categories.retweet++;
      } else if (tweet.in_reply_to_status_id || tweet.in_reply_to_user_id || tweet.text?.startsWith('@')) {
        categories.reply++;
      }
      
      // Check for media
      if (tweet.has_media || tweet.extended_entities?.media || tweet.entities?.media) {
        const media = tweet.extended_entities?.media || tweet.entities?.media || [];
        
        for (const item of media) {
          if (item.type === 'photo' || item.type === 'image') {
            categories.image++;
          } else if (item.type === 'video' || item.type === 'animated_gif') {
            categories.video++;
          }
        }
      }
      
      // Check for links
      if (tweet.entities?.urls && tweet.entities.urls.length > 0) {
        categories.link++;
      }
      
      // If no other category fits, mark as text
      if (!Object.values(categories).some(count => count > 0)) {
        categories.text++;
      }
    }
    
    return categories;
  }

  /**
   * Crawl a website to extract content
   * 
   * @param url The URL to crawl
   * @param dryRun Whether to skip the actual API call
   * @param maxPages Maximum number of pages to crawl
   * @param maxDepth Maximum crawl depth
   * @returns The crawl results
   */
  async runWebsiteCrawler(url: string, dryRun = false, maxPages = 10, maxDepth = 1): Promise<ApifyToolResult> {
    try {
      return await this.runApifyActor({
        actorId: 'apify/website-content-crawler',
        input: {
          startUrls: [{ url }],
          maxDepth,
          maxPagesPerCrawl: maxPages,
        },
        label: `Website crawl: ${url}`,
        dryRun
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error in website crawl: ${errorMessage}`);
      return {
        success: false,
        error: `Error in website crawl: ${errorMessage}`
      };
    }
  }

  /**
   * Search YouTube for videos related to a keyword or topic
   * 
   * @param query The search query
   * @param dryRun Whether to skip the actual API call
   * @param maxResults Maximum number of results to return
   * @returns The search results
   */
  async runYouTubeSearch(query: string, dryRun = false, maxResults = 10): Promise<ApifyToolResult> {
    try {
      return await this.runApifyActor({
        actorId: 'apify/youtube-scraper',
        input: {
          search: query,
          maxResults,
          proxy: {
            useApifyProxy: true,
          },
        },
        label: `YouTube search: ${query}`,
        dryRun
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error in YouTube search: ${errorMessage}`);
      return {
        success: false,
        error: `Error in YouTube search: ${errorMessage}`
      };
    }
  }

  /**
   * Scrape Instagram content by username
   * 
   * @param username The Instagram username
   * @param dryRun Whether to skip the actual API call
   * @param maxResults Maximum number of results to return
   * @returns The scraped data
   */
  async runInstagramScraper(username: string, dryRun = false, maxResults = 10): Promise<ApifyToolResult> {
    try {
      return await this.runApifyActor({
        actorId: 'apify/instagram-scraper',
        input: {
          usernames: [username],
          resultsLimit: maxResults,
          addParentData: true,
          proxy: {
            useApifyProxy: true,
          },
        },
        label: `Instagram scrape: ${username}`,
        dryRun
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error in Instagram scrape: ${errorMessage}`);
      return {
        success: false,
        error: `Error in Instagram scrape: ${errorMessage}`
      };
    }
  }

  /**
   * Scrape TikTok content by hashtag, username, or keyword
   * 
   * @param query The search query (username, hashtag, or keyword)
   * @param dryRun Whether to skip the actual API call
   * @param maxResults Maximum number of results to return
   * @returns The scraped data
   */
  async runTikTokScraper(query: string, dryRun = false, maxResults = 10): Promise<ApifyToolResult> {
    try {
      // Determine the type of search based on the query
      if (query.startsWith('@')) {
        // Username search
        const username = query.substring(1);
        return await this.runApifyActor({
          actorId: 'clockworks/free-tiktok-scraper',
          input: {
            profiles: [username],
            scrapeType: 'posts',
            proxy: { useApifyProxy: true },
            maxItems: maxResults,
          },
          label: `TikTok scrape: ${query}`,
          dryRun
        });
      } else if (query.startsWith('#')) {
        // Hashtag search
        const hashtag = query.substring(1);
        return await this.runApifyActor({
          actorId: 'clockworks/free-tiktok-scraper',
          input: {
            hashtags: [hashtag],
            scrapeType: 'hashtag',
            proxy: { useApifyProxy: true },
            maxItems: maxResults,
          },
          label: `TikTok scrape: ${query}`,
          dryRun
        });
      } else {
        // Keyword search
        return await this.runApifyActor({
          actorId: 'clockworks/free-tiktok-scraper',
          input: {
            keywords: [query],
            scrapeType: 'search',
            proxy: { useApifyProxy: true },
            maxItems: maxResults,
          },
          label: `TikTok scrape: ${query}`,
          dryRun
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error in TikTok scrape: ${errorMessage}`);
      return {
        success: false,
        error: `Error in TikTok scrape: ${errorMessage}`
      };
    }
  }

  /**
   * Request higher limits for an actor run
   * 
   * @param actorId The ID of the actor
   * @param reason The reason for requesting higher limits
   * @param requestedLimit The requested limit
   * @param context Additional context for the request
   * @returns The result of the request
   */
  async requestHigherLimits(
    actorId: string,
    reason: string,
    requestedLimit: number,
    context?: ApifyLimitContext
  ): Promise<ApifyLimitResult> {
    // Simplified implementation - in a real system, this would involve
    // more sophisticated logic or a call to an approval service
    
    // Default limit for unspecified roles
    let grantedLimit = 25;
    
    // Adjust limit based on user role
    if (context?.userRole) {
      switch (context.userRole) {
        case 'researcher':
          grantedLimit = Math.min(requestedLimit, 50);
          break;
        case 'admin':
          grantedLimit = context.budgetApproved ? Math.min(requestedLimit, 100) : 50;
          break;
        case 'developer':
          grantedLimit = Math.min(requestedLimit, 75);
          break;
        default:
          grantedLimit = 25;
      }
    }
    
    // Determine if request is approved
    const approved = grantedLimit >= requestedLimit;
    
    // Log the decision
    logger.info(`Limit request for ${actorId}: requested=${requestedLimit}, granted=${grantedLimit}, approved=${approved}`);
    
    return {
      approved,
      grantedLimit,
      reason: approved 
        ? 'Request approved based on user role and context' 
        : `Request partially approved. Maximum limit for your role is ${grantedLimit}`
    };
  }

  /**
   * Discover actors based on a search query
   * 
   * @param query The search query
   * @param options Options for the discovery
   * @returns List of actor metadata
   */
  async discoverActors(query: string, options?: ActorDiscoveryOptions): Promise<ApifyActorMetadata[]> {
    try {
      // Default options
      const limit = options?.limit || 10;
      const offset = options?.offset || 0;
      const category = options?.category || '';
      const usageTier = options?.usageTier || 'both';
      const sortBy = options?.sortBy || 'relevance';
      const minRating = options?.minRating || 0;
      
      // Build query parameters
      const queryParams = new URLSearchParams({
        search: query,
        limit: limit.toString(),
        offset: offset.toString(),
        sortBy: sortBy
      });
      
      if (category) {
        queryParams.append('category', category);
      }
      
      if (usageTier !== 'both') {
        queryParams.append('pricingModel', usageTier === 'paid' ? 'PAID' : 'FREE');
      }
      
      // Prepare headers - the public store API might not require authentication
      const headers: Record<string, string> = {
          'Content-Type': 'application/json'
      };
      
      // Add authorization header only if API token is available
      if (this.apiToken) {
        headers['Authorization'] = `Bearer ${this.apiToken}`;
      } else {
        logger.info('No API token provided for actor discovery - attempting public access');
      }
      
      const url = `${this.baseApiUrl}/store?${queryParams.toString()}`;
      logger.debug(`Making request to Apify Store API: ${url}`);
      
      // Make request to Apify API
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        const error = await response.text();
        logger.error(`Failed to discover actors (${response.status}): ${error}`);
        logger.error(`Request URL: ${url}`);
        logger.error(`Request headers: ${JSON.stringify(headers, null, 2)}`);
        
        // Provide specific error messages based on status code
        if (response.status === 401) {
          logger.warn('Unauthorized access to Apify Store API - this might be expected for public access');
          return [];
        } else if (response.status === 404) {
          logger.error('Apify Store API endpoint not found - check if the URL is correct');
          return [];
        } else if (response.status === 429) {
          logger.warn('Rate limit exceeded for Apify Store API');
          return [];
        }
        
        return [];
      }
      
      const data = await response.json();
      logger.debug(`Apify Store API response structure: ${JSON.stringify(Object.keys(data), null, 2)}`);
      
      // Check if the response has the expected structure
      if (!data.data || !data.data.items) {
        logger.error(`Unexpected response structure from Apify Store API: ${JSON.stringify(data, null, 2)}`);
        return [];
      }
      
      const actors = data.data.items;
      logger.info(`Found ${actors.length} actors from Apify Store API`);
      
      // Map to our metadata format and filter by minimum rating
      return actors
        .filter((actor: any) => (actor.stats?.reviewsAverage || 0) >= minRating)
        .map((actor: any) => ({
          id: actor.id,
          name: actor.name,
          description: actor.description || 'No description available',
          categories: actor.categories || [],
          examples: actor.exampleUsages || [],
          inputSchema: actor.inputSchema,
          outputSchema: actor.outputSchema,
          usageTier: actor.pricing?.type === 'FREE' ? 'free' : 'paid',
          costEstimate: this.estimateCost(actor.pricing),
          lastUpdated: actor.lastModifiedAt,
          author: actor.authorId,
          rating: actor.stats?.reviewsAverage,
          popularity: actor.stats?.runCountForLastMonth
        }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error discovering actors: ${errorMessage}`);
      
      // Provide helpful error context
      if (errorMessage.includes('fetch')) {
        logger.error('Network error occurred while accessing Apify Store API');
      } else if (errorMessage.includes('JSON')) {
        logger.error('Failed to parse JSON response from Apify Store API');
      }
      
      return [];
    }
  }

  /**
   * Get detailed information about a specific actor
   * 
   * @param actorId The ID of the actor
   * @returns The actor metadata
   */
  async getActorInfo(actorId: string): Promise<ApifyActorMetadata> {
    if (!this.apiToken) {
      throw new ApifyError('Cannot get actor info: APIFY_API_KEY is not set', 'NO_API_KEY');
    }
    
    try {
      const response = await fetch(`${this.baseApiUrl}/acts/${actorId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new ApifyError(`Failed to get actor info: ${error}`, 'API_ERROR');
      }
      
      const data = await response.json();
      const actor = data.data;
      
      return {
        id: actor.id,
        name: actor.name,
        description: actor.description || 'No description available',
        categories: actor.categories || [],
        examples: actor.exampleUsages || [],
        inputSchema: actor.inputSchema,
        outputSchema: actor.outputSchema,
        usageTier: actor.pricing?.type === 'FREE' ? 'free' : 'paid',
        costEstimate: this.estimateCost(actor.pricing),
        lastUpdated: actor.lastModifiedAt,
        author: actor.authorId,
        rating: actor.stats?.reviewsAverage,
        popularity: actor.stats?.runCountForLastMonth
      };
    } catch (error) {
      if (error instanceof ApifyError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ApifyError(`Error getting actor info: ${errorMessage}`, 'UNKNOWN_ERROR');
    }
  }

  /**
   * Suggest actors for a specific task based on task description
   * 
   * @param taskDescription Description of the task
   * @param count Maximum number of suggestions to return
   * @returns List of suggested actor metadata
   */
  async suggestActorsForTask(taskDescription: string, count = 5): Promise<ApifyActorMetadata[]> {
    try {
      // Extract key terms from the task description
      const keywords = this.extractKeywords(taskDescription);
      
      // Search for actors matching these keywords
      // Use the first 3 keywords for the search
      const searchQuery = keywords.slice(0, 3).join(' ');
      
      // Get actors matching the search query
      const actors = await this.discoverActors(searchQuery, {
        limit: count * 2, // Get more than we need to allow for filtering
        sortBy: 'popularity',
        minRating: 4.0 // Only suggest highly-rated actors
      });
      
      // Score actors based on how well they match the task description
      const scoredActors = actors.map(actor => {
        const score = this.calculateRelevanceScore(actor, taskDescription, keywords);
        return { actor, score };
      });
      
      // Sort by score and return the top 'count' actors
      return scoredActors
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
        .map(item => item.actor);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error suggesting actors: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Dynamically run an actor discovered through the API
   * 
   * @param actorId The ID of the actor
   * @param input The input for the actor
   * @param options Additional options for the run
   * @returns The result of the actor run
   */
  async dynamicRunActor<T = any>(
    actorId: string, 
    input: any, 
    options?: Partial<ApifyToolInput>
  ): Promise<ApifyToolResult<T>> {
    try {
      // First, validate the actor exists
      await this.getActorInfo(actorId);
      
      // Run the actor with the provided input
      return await this.runApifyActor<T>({
        actorId,
        input,
        label: options?.label || `Dynamic run: ${actorId}`,
        dryRun: options?.dryRun
      });
    } catch (error) {
      if (error instanceof ApifyError) {
        return {
          success: false,
          error: `Error with dynamic actor: ${error.message} (${error.code})`
        };
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error in dynamic actor run: ${errorMessage}`);
      return {
        success: false,
        error: `Error in dynamic actor run: ${errorMessage}`
      };
    }
  }

  /**
   * Calculate estimated cost based on pricing information
   * @private
   */
  private estimateCost(pricing: any): 'low' | 'medium' | 'high' {
    if (!pricing || pricing.type === 'FREE') {
      return 'low';
    }
    
    if (pricing.type === 'PAID' && pricing.pricingList) {
      // Check the average price tier
      const averagePrice = pricing.pricingList.reduce(
        (sum: number, item: any) => sum + (item.price || 0), 
        0
      ) / pricing.pricingList.length;
      
      if (averagePrice < 5) return 'low';
      if (averagePrice < 20) return 'medium';
      return 'high';
    }
    
    return 'medium'; // Default if we can't determine
  }

  /**
   * Extract relevant keywords from a task description
   * @private
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction based on common stop words removal
    // In a real implementation, this could use NLP techniques
    const stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for',
      'with', 'by', 'about', 'as', 'into', 'like', 'through', 'after', 'over', 'between',
      'out', 'against', 'during', 'without', 'before', 'under', 'around', 'among',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
      'does', 'did', 'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might',
      'must', 'that', 'which', 'who', 'whom', 'whose', 'what', 'this', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
    ]);
    
    // Extract words, convert to lowercase, remove stop words and short words
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => !stopWords.has(word) && word.length > 2) // Remove stop words and short words
      .slice(0, 10); // Take at most 10 keywords
  }

  /**
   * Calculate relevance score of an actor for a given task
   * @private
   */
  private calculateRelevanceScore(
    actor: ApifyActorMetadata, 
    taskDescription: string, 
    keywords: string[]
  ): number {
    let score = 0;
    
    // Base score based on popularity and rating
    score += (actor.popularity || 0) / 100; // Max 5 points for very popular actors
    score += (actor.rating || 0) * 2; // Max 10 points for 5-star rated actors
    
    // Check keyword matches in actor name and description
    const actorText = `${actor.name} ${actor.description} ${actor.categories.join(' ')}`.toLowerCase();
    
    // Calculate how many keywords match
    const matchingKeywords = keywords.filter(keyword => actorText.includes(keyword));
    score += matchingKeywords.length * 3; // 3 points per matching keyword
    
    // Bonus for exact phrase match
    if (actorText.includes(taskDescription.toLowerCase())) {
      score += 10; // Significant bonus for exact match
    }
    
    // Check if the task description mentions the actor name
    if (taskDescription.toLowerCase().includes(actor.name.toLowerCase())) {
      score += 15; // Even bigger bonus if task explicitly mentions the actor
    }
    
    return score;
  }
} 