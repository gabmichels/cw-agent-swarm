import { safeParse } from '../../../lib/shared/utils';

export interface ApifyToolInput {
  actorId: string; // e.g., "apify/twitter-scraper"
  input: Record<string, any>;
  label?: string;
}

export interface ApifyToolResult {
  runId: string;
  output: any;
  success: boolean;
  error?: string;
}

export class ApifyManager {
  private apiToken: string;
  private baseUrl = 'https://api.apify.com/v2';
  private maxRetries = 3;
  private retryDelay = 3000; // 3 seconds
  
  constructor() {
    // Get API token from environment variable
    this.apiToken = process.env.APIFY_API_KEY || '';
    
    if (!this.apiToken) {
      console.warn('APIFY_API_KEY environment variable is not set. Apify tools will not work.');
    }
  }

  /**
   * Run an Apify actor with the provided input
   * @param actorId The ID of the Apify actor to run
   * @param input The input parameters for the actor
   * @returns The result of the actor run
   */
  async runApifyActor({ actorId, input, label }: ApifyToolInput): Promise<ApifyToolResult> {
    try {
      if (!this.apiToken) {
        return {
          runId: '',
          output: null,
          success: false,
          error: 'APIFY_API_KEY environment variable is not set'
        };
      }

      console.log(`Starting Apify actor run: ${actorId}${label ? ` (${label})` : ''}`);
      
      // Start the actor run with retries
      let startRunResponse;
      let retries = 0;
      
      while (retries < this.maxRetries) {
        try {
          startRunResponse = await fetch(`${this.baseUrl}/acts/${actorId}/runs`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiToken}`
            },
            body: JSON.stringify({ 
              input,
              // Set timeout to 5 minutes
              timeout: 300
            })
          });
          
          if (startRunResponse.ok) {
            break;
          }
          
          // If we got a 429 (Too Many Requests) or 5xx error, retry
          if (startRunResponse.status === 429 || startRunResponse.status >= 500) {
            retries++;
            if (retries < this.maxRetries) {
              console.log(`Retrying actor start (${retries}/${this.maxRetries}) after error: ${startRunResponse.status}`);
              await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            }
            continue;
          }
          
          // For other errors, break and handle below
          break;
        } catch (error) {
          retries++;
          if (retries < this.maxRetries) {
            console.log(`Retrying actor start (${retries}/${this.maxRetries}) after error: ${error instanceof Error ? error.message : String(error)}`);
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          } else {
            throw error;
          }
        }
      }

      if (!startRunResponse || !startRunResponse.ok) {
        const errorText = startRunResponse ? await startRunResponse.text() : 'No response';
        const errorStatus = startRunResponse ? startRunResponse.status : 'Unknown status';
        throw new Error(`Failed to start Apify actor run: ${errorStatus} - ${errorText}`);
      }

      const startRunData = await startRunResponse.json();
      const runId = startRunData.id;
      
      if (!runId) {
        throw new Error('Failed to get run ID from Apify response');
      }

      console.log(`Apify actor run started with ID: ${runId}`);

      // Poll for run status
      let runFinished = false;
      let maxAttempts = 30; // 5 minutes max with 10-second intervals
      let attempts = 0;

      while (!runFinished && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10-second delay
        
        let runStatusResponse;
        try {
          runStatusResponse = await fetch(`${this.baseUrl}/actor-runs/${runId}`, {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`
            }
          });
        } catch (error) {
          console.warn(`Network error checking run status: ${error instanceof Error ? error.message : String(error)}`);
          attempts++;
          continue;
        }

        if (!runStatusResponse.ok) {
          console.warn(`Failed to get run status, attempt ${attempts + 1}/${maxAttempts}: ${runStatusResponse.status}`);
          attempts++;
          continue;
        }

        const runStatusData = await runStatusResponse.json();
        const status = runStatusData.status;

        if (status === 'SUCCEEDED' || status === 'FINISHED') {
          runFinished = true;
        } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
          throw new Error(`Apify actor run failed with status: ${status}`);
        }

        attempts++;
        console.log(`Apify run status check ${attempts}/${maxAttempts}: ${status}`);
      }

      if (!runFinished) {
        throw new Error('Apify actor run timed out');
      }

      // Get dataset items with retries
      let datasetResponse;
      retries = 0;
      
      while (retries < this.maxRetries) {
        try {
          datasetResponse = await fetch(`${this.baseUrl}/actor-runs/${runId}/dataset/items`, {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`
            }
          });
          
          if (datasetResponse.ok) {
            break;
          }
          
          retries++;
          if (retries < this.maxRetries) {
            console.log(`Retrying dataset fetch (${retries}/${this.maxRetries}) after error: ${datasetResponse.status}`);
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          }
        } catch (error) {
          retries++;
          if (retries < this.maxRetries) {
            console.log(`Retrying dataset fetch (${retries}/${this.maxRetries}) after error: ${error instanceof Error ? error.message : String(error)}`);
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          } else {
            throw error;
          }
        }
      }

      if (!datasetResponse || !datasetResponse.ok) {
        const errorStatus = datasetResponse ? datasetResponse.status : 'Unknown status';
        throw new Error(`Failed to get dataset items: ${errorStatus}`);
      }

      const output = await datasetResponse.json();
      
      return {
        runId,
        output,
        success: true
      };
    } catch (error) {
      console.error('Error running Apify actor:', error);
      return {
        runId: '',
        output: null,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Attempt to provide a fallback response when the API fails
   * @param keyword The search keyword
   * @param source The data source (reddit, twitter, etc.)
   * @returns A fallback response
   */
  private getFallbackResponse(keyword: string, source: string): any[] {
    console.log(`Generating fallback response for ${source} search: ${keyword}`);
    
    // Basic fallback with empty results
    return [];
  }

  /**
   * Run a Reddit search using Apify
   * @param keyword The keyword to search for on Reddit
   * @returns The search results
   */
  async runRedditSearch(keyword: string): Promise<ApifyToolResult> {
    try {
      const result = await this.runApifyActor({
        actorId: 'trudax/reddit-scraper-lite',
        input: { 
          searchQuery: keyword, 
          maxPosts: 10,
          skipComments: true
        },
        label: `Reddit search: ${keyword}`
      });
      
      // If the API call failed, provide a fallback response
      if (!result.success || !result.output) {
        console.warn(`Reddit search failed, using fallback for "${keyword}"`);
        result.output = this.getFallbackResponse(keyword, 'reddit');
        // We'll mark it as a success but include the original error
        result.success = true;
      }
      
      return result;
    } catch (error) {
      console.error('Error in Reddit search:', error);
      return {
        runId: '',
        output: this.getFallbackResponse(keyword, 'reddit'),
        success: true, // Mark as success but with fallback data
        error: `Original error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Run a Twitter search using Apify
   * @param keyword The keyword to search for on Twitter
   * @returns The search results
   */
  async runTwitterSearch(keyword: string): Promise<ApifyToolResult> {
    try {
      const result = await this.runApifyActor({
        actorId: 'apidojo/twitter-scraper-lite',
        input: { 
          searchTerms: [keyword], 
          maxTweets: 20,
          scrapeTweetReplies: false
        },
        label: `Twitter search: ${keyword}`
      });
      
      // If the API call failed, provide a fallback response
      if (!result.success || !result.output) {
        console.warn(`Twitter search failed, using fallback for "${keyword}"`);
        result.output = this.getFallbackResponse(keyword, 'twitter');
        result.success = true;
      }
      
      return result;
    } catch (error) {
      console.error('Error in Twitter search:', error);
      return {
        runId: '',
        output: this.getFallbackResponse(keyword, 'twitter'),
        success: true,
        error: `Original error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Crawl a website using Apify
   * @param url The URL to crawl
   * @returns The crawled content
   */
  async runWebsiteCrawler(url: string): Promise<ApifyToolResult> {
    try {
      const result = await this.runApifyActor({
        actorId: 'apify/website-content-crawler',
        input: { 
          startUrls: [{ url }], 
          maxDepth: 1,
          maxPagesPerCrawl: 10
        },
        label: `Website crawl: ${url}`
      });
      
      // If the API call failed, provide a fallback response
      if (!result.success || !result.output) {
        console.warn(`Website crawler failed, using fallback for "${url}"`);
        result.output = [];
        result.success = true;
      }
      
      return result;
    } catch (error) {
      console.error('Error in website crawler:', error);
      return {
        runId: '',
        output: [],
        success: true,
        error: `Original error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Run a YouTube search using Apify
   * @param keyword The keyword to search for on YouTube
   * @returns The search results
   */
  async runYouTubeSearch(keyword: string): Promise<ApifyToolResult> {
    return this.runApifyActor({
      actorId: 'apify/youtube-scraper',
      input: {
        search: keyword,
        maxResults: 10,
        proxy: {
          useApifyProxy: true
        }
      },
      label: `YouTube search: ${keyword}`
    });
  }

  /**
   * Scrape Instagram profiles and posts using Apify
   * @param username The Instagram username to scrape
   * @returns The scraped Instagram data
   */
  async runInstagramScraper(username: string): Promise<ApifyToolResult> {
    try {
      const result = await this.runApifyActor({
        actorId: 'apify/instagram-scraper',
        input: {
          usernames: [username],
          resultsLimit: 20,
          addParentData: true,
          proxy: {
            useApifyProxy: true
          }
        },
        label: `Instagram scrape: ${username}`
      });
      
      // If the API call failed, provide a fallback response
      if (!result.success || !result.output) {
        console.warn(`Instagram scraper failed, using fallback for "${username}"`);
        result.output = [];
        result.success = true;
      }
      
      return result;
    } catch (error) {
      console.error('Error in Instagram scraper:', error);
      return {
        runId: '',
        output: [],
        success: true,
        error: `Original error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Scrape TikTok content using Apify
   * @param username The TikTok username or hashtag to scrape
   * @returns The scraped TikTok data
   */
  async runTikTokScraper(searchTerm: string): Promise<ApifyToolResult> {
    try {
      // Determine if this is a username (@) or hashtag (#)
      const isUsername = searchTerm.startsWith('@');
      const isHashtag = searchTerm.startsWith('#');
      
      let input: Record<string, any> = {
        proxy: {
          useApifyProxy: true
        },
        maxItems: 20
      };
      
      // Set up the right input parameters based on what we're searching for
      if (isUsername) {
        const username = searchTerm.substring(1); // Remove @
        input.profiles = [username];
        input.scrapeType = 'posts';
      } else if (isHashtag) {
        const hashtag = searchTerm.substring(1); // Remove #
        input.hashtags = [hashtag];
        input.scrapeType = 'hashtag';
      } else {
        // If no prefix, treat as keyword search
        input.keywords = [searchTerm];
        input.scrapeType = 'search';
      }
      
      const result = await this.runApifyActor({
        actorId: 'clockworks/free-tiktok-scraper',
        input,
        label: `TikTok scrape: ${searchTerm}`
      });
      
      // If the API call failed, provide a fallback response
      if (!result.success || !result.output) {
        console.warn(`TikTok scraper failed, using fallback for "${searchTerm}"`);
        result.output = [];
        result.success = true;
      }
      
      return result;
    } catch (error) {
      console.error('Error in TikTok scraper:', error);
      return {
        runId: '',
        output: [],
        success: true,
        error: `Original error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

// Export tool factory functions for registration with Chloe's tool system
export const createApifyTools = () => {
  const apify = new ApifyManager();
  
  return {
    'apify-reddit-search': {
      name: 'apify-reddit-search',
      description: 'Search Reddit for posts related to a keyword or topic',
      async _call(input: string): Promise<string> {
        try {
          const result = await apify.runRedditSearch(input);
          
          if (!result.success || !result.output) {
            return `Failed to search Reddit for "${input}"`;
          }
          
          // Format the results
          const posts = result.output;
          const formattedResult = posts.slice(0, 5).map((post: any, index: number) => {
            return `[${index + 1}] ${post.title || 'Untitled'}\n   Subreddit: ${post.community || 'unknown'}\n   Score: ${post.score || 'N/A'}\n   URL: ${post.url || 'N/A'}\n`;
          }).join('\n');
          
          return `Reddit search results for "${input}":\n\n${formattedResult}\n\nTotal results: ${posts.length}`;
        } catch (error) {
          console.error('Error in apify-reddit-search tool:', error);
          return `Error searching Reddit: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },
    
    'apify-twitter-search': {
      name: 'apify-twitter-search',
      description: 'Search Twitter for tweets related to a keyword or topic',
      async _call(input: string): Promise<string> {
        try {
          const result = await apify.runTwitterSearch(input);
          
          if (!result.success || !result.output) {
            return `Failed to search Twitter for "${input}"`;
          }
          
          // Format the results
          const tweets = result.output;
          const formattedResult = tweets.slice(0, 5).map((tweet: any, index: number) => {
            return `[${index + 1}] @${tweet.username || 'unknown'}: ${tweet.text || 'No content'}\n   Likes: ${tweet.likeCount || 0}, Retweets: ${tweet.retweetCount || 0}\n   Date: ${tweet.date || 'N/A'}\n`;
          }).join('\n');
          
          return `Twitter search results for "${input}":\n\n${formattedResult}\n\nTotal results: ${tweets.length}`;
        } catch (error) {
          console.error('Error in apify-twitter-search tool:', error);
          return `Error searching Twitter: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },
    
    'apify-website-crawler': {
      name: 'apify-website-crawler',
      description: 'Crawl a website to extract content and information',
      async _call(input: string): Promise<string> {
        try {
          // Check if input is a valid URL
          try {
            new URL(input);
          } catch (e) {
            return `Invalid URL: ${input}. Please provide a valid URL starting with http:// or https://`;
          }
          
          const result = await apify.runWebsiteCrawler(input);
          
          if (!result.success || !result.output) {
            return `Failed to crawl website "${input}"`;
          }
          
          // Format the results
          const pages = result.output;
          let summary = `Crawled ${pages.length} pages from ${input}\n\n`;
          
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
          console.error('Error in apify-website-crawler tool:', error);
          return `Error crawling website: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },
    
    'apify-youtube-search': {
      name: 'apify-youtube-search',
      description: 'Search YouTube for videos related to a keyword or topic',
      async _call(input: string): Promise<string> {
        try {
          const result = await apify.runYouTubeSearch(input);
          
          if (!result.success || !result.output) {
            return `Failed to search YouTube for "${input}"`;
          }
          
          // Format the results
          const videos = result.output;
          const formattedResult = videos.slice(0, 5).map((video: any, index: number) => {
            return `[${index + 1}] ${video.title || 'Untitled'}\n   Channel: ${video.channelName || 'unknown'}\n   Views: ${video.viewCount || 'N/A'}\n   URL: ${video.url || 'N/A'}\n`;
          }).join('\n');
          
          return `YouTube search results for "${input}":\n\n${formattedResult}\n\nTotal results: ${videos.length}`;
        } catch (error) {
          console.error('Error in apify-youtube-search tool:', error);
          return `Error searching YouTube: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },
    
    'apify-instagram-scraper': {
      name: 'apify-instagram-scraper',
      description: 'Scrape Instagram profiles and posts for a specific username',
      async _call(input: string): Promise<string> {
        try {
          // Remove @ if present at the beginning
          const username = input.startsWith('@') ? input.substring(1) : input;
          
          const result = await apify.runInstagramScraper(username);
          
          if (!result.success || !result.output) {
            return `Failed to scrape Instagram data for "${username}"`;
          }
          
          // Format the results - profile info and recent posts
          const data = result.output;
          let response = '';
          
          // Check if we have profile data
          const profileData = data.find((item: any) => item.username === username);
          if (profileData) {
            response += `Instagram Profile: @${profileData.username}\n`;
            if (profileData.fullName) response += `Name: ${profileData.fullName}\n`;
            if (profileData.biography) response += `Bio: ${profileData.biography}\n`;
            if (profileData.followersCount) response += `Followers: ${profileData.followersCount}\n`;
            if (profileData.followsCount) response += `Following: ${profileData.followsCount}\n`;
            if (profileData.postsCount) response += `Posts: ${profileData.postsCount}\n`;
            response += '\n';
          }
          
          // Get posts (might be in a slightly different format depending on the actor)
          const posts = data.filter((item: any) => item.type === 'post' || item.caption);
          if (posts && posts.length > 0) {
            response += `Recent posts from @${username}:\n\n`;
            posts.slice(0, 5).forEach((post: any, index: number) => {
              response += `[${index + 1}] ${post.caption ? post.caption.substring(0, 100) + (post.caption.length > 100 ? '...' : '') : 'No caption'}\n`;
              if (post.likesCount) response += `   Likes: ${post.likesCount}\n`;
              if (post.commentsCount) response += `   Comments: ${post.commentsCount}\n`;
              if (post.url) response += `   URL: ${post.url}\n`;
              response += '\n';
            });
            
            if (posts.length > 5) {
              response += `... and ${posts.length - 5} more posts\n`;
            }
          } else {
            response += 'No posts found.\n';
          }
          
          return response;
        } catch (error) {
          console.error('Error in apify-instagram-scraper tool:', error);
          return `Error scraping Instagram: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },
    
    'apify-tiktok-scraper': {
      name: 'apify-tiktok-scraper',
      description: 'Scrape TikTok content for a username, hashtag, or keyword',
      async _call(input: string): Promise<string> {
        try {
          const result = await apify.runTikTokScraper(input);
          
          if (!result.success || !result.output) {
            return `Failed to scrape TikTok data for "${input}"`;
          }
          
          // Format the results
          const items = result.output;
          
          if (!items || items.length === 0) {
            return `No TikTok content found for "${input}"`;
          }
          
          let response = `TikTok results for "${input}":\n\n`;
          
          items.slice(0, 5).forEach((item: any, index: number) => {
            response += `[${index + 1}] `;
            
            if (item.desc) {
              response += `${item.desc.substring(0, 100)}${item.desc.length > 100 ? '...' : ''}\n`;
            } else {
              response += 'No description\n';
            }
            
            if (item.authorMeta && item.authorMeta.name) {
              response += `   Author: @${item.authorMeta.name}\n`;
            }
            
            if (item.stats) {
              if (item.stats.diggCount) response += `   Likes: ${item.stats.diggCount}\n`;
              if (item.stats.shareCount) response += `   Shares: ${item.stats.shareCount}\n`;
              if (item.stats.commentCount) response += `   Comments: ${item.stats.commentCount}\n`;
              if (item.stats.playCount) response += `   Views: ${item.stats.playCount}\n`;
            }
            
            if (item.webVideoUrl) {
              response += `   URL: ${item.webVideoUrl}\n`;
            }
            
            response += '\n';
          });
          
          if (items.length > 5) {
            response += `... and ${items.length - 5} more items`;
          }
          
          return response;
        } catch (error) {
          console.error('Error in apify-tiktok-scraper tool:', error);
          return `Error scraping TikTok: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    }
  };
}; 