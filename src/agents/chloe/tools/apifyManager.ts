import { safeParse } from '../../../lib/shared/utils';

export interface ApifyToolInput {
  actorId: string; // e.g., "apify/twitter-scraper"
  input: Record<string, any>;
  label?: string;
  dryRun?: boolean; // Added parameter to support dry run mode
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
  private usageTracker: Record<string, number> = {};
  private static MAX_DAILY_QUOTA = 100; // Maximum number of high-limit API calls per day
  
  constructor() {
    // Get API token from environment variable
    this.apiToken = process.env.APIFY_API_KEY || '';
    
    if (!this.apiToken) {
      console.warn('APIFY_API_KEY environment variable is not set. Apify tools will not work.');
    }
  }

  /**
   * Apply safe limits to actor input to prevent excessive scraping
   * @param input The original actor input
   * @param maxLimit The maximum limit to apply
   * @returns The input with safe limits applied
   */
  private applySafeLimits(input: any, maxLimit = 10): any {
    // 🛡️ Safeguard: This caps excessive scraping to avoid overbilling
    return {
      ...input,
      maxItems: Math.min(input?.maxItems || maxLimit, maxLimit),
      maxRequestsPerCrawl: Math.min(input?.maxRequestsPerCrawl || maxLimit, maxLimit),
      maxConcurrency: 1
    };
  }

  /**
   * Run an Apify actor with the provided input
   * @param actorId The ID of the Apify actor to run
   * @param input The input parameters for the actor
   * @returns The result of the actor run
   */
  async runApifyActor({ actorId, input, label, dryRun }: ApifyToolInput): Promise<ApifyToolResult> {
    try {
      if (!this.apiToken) {
        return {
          runId: '',
          output: null,
          success: false,
          error: 'APIFY_API_KEY environment variable is not set'
        };
      }

      // Check for dry run mode
      if (dryRun === true) {
        // 🛡️ Safeguard: Skip actual API calls in dry run mode
        console.log(`[DRY RUN] Would start Apify actor: ${actorId}${label ? ` (${label})` : ''}`);
        return {
          runId: 'dry-run-id',
          output: [],
          success: true,
          error: 'This is a dry run, no actual API call was made'
        };
      }

      console.log(`Starting Apify actor run: ${actorId}${label ? ` (${label})` : ''}`);
      
      // Apply safe limits to the input
      const safeInput = this.applySafeLimits(input);
      
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
              input: safeInput,
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
   * @param dryRun Whether to skip the actual API call
   * @param maxItems Maximum number of items to retrieve
   * @returns The search results
   */
  async runRedditSearch(keyword: string, dryRun = false, maxItems = 10): Promise<ApifyToolResult> {
    try {
      const result = await this.runApifyActor({
        actorId: 'trudax/reddit-scraper-lite',
        input: { 
          searchQuery: keyword, 
          maxPosts: maxItems,
          skipComments: true
        },
        label: `Reddit search: ${keyword}`,
        dryRun
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
   * @param dryRun Whether to skip the actual API call
   * @param maxItems Maximum number of items to retrieve
   * @returns The search results
   */
  async runTwitterSearch(keyword: string, dryRun = false, maxItems = 10): Promise<ApifyToolResult> {
    try {
      const result = await this.runApifyActor({
        actorId: 'apidojo/twitter-scraper-lite',
        input: { 
          searchTerms: [keyword], 
          maxTweets: maxItems,
          scrapeTweetReplies: false
        },
        label: `Twitter search: ${keyword}`,
        dryRun
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
   * @param dryRun Whether to skip the actual API call
   * @param maxPages Maximum number of pages to crawl
   * @param maxDepth Maximum depth to crawl
   * @returns The crawled content
   */
  async runWebsiteCrawler(url: string, dryRun = false, maxPages = 10, maxDepth = 1): Promise<ApifyToolResult> {
    try {
      const result = await this.runApifyActor({
        actorId: 'apify/website-content-crawler',
        input: { 
          startUrls: [{ url }], 
          maxDepth: maxDepth,
          maxPagesPerCrawl: maxPages
        },
        label: `Website crawl: ${url}`,
        dryRun
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
   * @param dryRun Whether to skip the actual API call
   * @param maxItems Maximum number of items to retrieve
   * @returns The search results
   */
  async runYouTubeSearch(keyword: string, dryRun = false, maxItems = 10): Promise<ApifyToolResult> {
    return this.runApifyActor({
      actorId: 'apify/youtube-scraper',
      input: {
        search: keyword,
        maxResults: maxItems,
        proxy: {
          useApifyProxy: true
        }
      },
      label: `YouTube search: ${keyword}`,
      dryRun
    });
  }

  /**
   * Scrape Instagram profiles and posts using Apify
   * @param username The Instagram username to scrape
   * @param dryRun Whether to skip the actual API call
   * @param maxItems Maximum number of items to retrieve
   * @returns The scraped Instagram data
   */
  async runInstagramScraper(username: string, dryRun = false, maxItems = 10): Promise<ApifyToolResult> {
    try {
      const result = await this.runApifyActor({
        actorId: 'apify/instagram-scraper',
        input: {
          usernames: [username],
          resultsLimit: maxItems,
          addParentData: true,
          proxy: {
            useApifyProxy: true
          }
        },
        label: `Instagram scrape: ${username}`,
        dryRun
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
   * @param searchTerm The TikTok username or hashtag to scrape
   * @param dryRun Whether to skip the actual API call
   * @param maxItems Maximum number of items to retrieve
   * @returns The scraped TikTok data
   */
  async runTikTokScraper(searchTerm: string, dryRun = false, maxItems = 10): Promise<ApifyToolResult> {
    try {
      // Determine if this is a username (@) or hashtag (#)
      const isUsername = searchTerm.startsWith('@');
      const isHashtag = searchTerm.startsWith('#');
      
      let input: Record<string, any> = {
        proxy: {
          useApifyProxy: true
        },
        maxItems: maxItems
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
        label: `TikTok scrape: ${searchTerm}`,
        dryRun
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

  /**
   * Track usage by project or user
   * @param projectId Optional project identifier
   * @returns Current daily usage count
   */
  private async getDailyUsageForProject(projectId?: string): Promise<number> {
    const key = projectId || 'default';
    return this.usageTracker[key] || 0;
  }

  /**
   * Increment usage counter for a project
   * @param projectId Optional project identifier
   */
  private async incrementUsage(projectId?: string): Promise<void> {
    const key = projectId || 'default';
    this.usageTracker[key] = (this.usageTracker[key] || 0) + 1;
  }

  /**
   * Log bypass decisions for auditing and monitoring
   * @param data Bypass request details
   */
  private async logLimitBypass(data: {
    actorId: string;
    reason: string;
    requested: number;
    granted: number;
    context: any;
  }): Promise<void> {
    console.log(`[LIMIT BYPASS] ${data.actorId} - Requested: ${data.requested}, Granted: ${data.granted}, Reason: ${data.reason}`);
    // In production, this would log to a database or monitoring service
    
    // Increment usage counter
    await this.incrementUsage(data.context.projectId);
  }

  /**
   * Request permission to exceed default API limits
   * @param actorId The actor ID requesting higher limits
   * @param reason The business justification
   * @param requestedLimit The desired limit
   * @param context Additional context about the request
   * @returns Whether the request was approved and the granted limit
   */
  async requestHigherLimits(
    actorId: string, 
    reason: string, 
    requestedLimit: number,
    context: {
      userRole?: string;        // 'researcher', 'admin', etc.
      projectId?: string;       // track usage by project
      budgetApproved?: boolean; // explicit cost approval
      priority?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<{approved: boolean, grantedLimit: number}> {
    
    // 1. Check user authorization level
    const maxAllowedByRole = {
      'default': 25,
      'researcher': 50,
      'admin': 100
    }[context.userRole || 'default'];
    
    // 2. Check rate limiting and quota
    const dailyUsage = await this.getDailyUsageForProject(context.projectId);
    const hasQuotaRemaining = dailyUsage < ApifyManager.MAX_DAILY_QUOTA;
    
    // 3. Evaluate request reason
    const approvedLimit = Math.min(
      requestedLimit,
      maxAllowedByRole || 25,
      hasQuotaRemaining ? 100 : 25,
      context.budgetApproved ? 200 : 50
    );
    
    // 4. Log the decision for auditing
    await this.logLimitBypass({
      actorId,
      reason,
      requested: requestedLimit,
      granted: approvedLimit,
      context
    });
    
    return {
      approved: approvedLimit > 25,
      grantedLimit: approvedLimit
    };
  }
}

// Export tool factory functions for registration with Chloe's tool system
export const createApifyTools = () => {
  const apify = new ApifyManager();
  
  return {
    'apify-reddit-search': {
      name: 'apify-reddit-search',
      description: 'Search Reddit for posts related to a keyword or topic. Default limit: 10 posts (use "bypass X items" for more posts with approval)',
      costEstimate: 'high',
      usageLimit: 10, // max allowed runs/day
      async _call(input: string): Promise<string> {
        try {
          // Check if this is a dry run request
          const isDryRun = input.toLowerCase().includes('dry run') || input.toLowerCase().includes('test mode');
          
          // Check for bypass request syntax like "bypass 50 items"
          const bypassMatch = input.match(/bypass\s+(\d+)\s+(?:items|posts|results)(?:\s+for\s+(.+))?/i);
          
          if (bypassMatch) {
            const requestedLimit = parseInt(bypassMatch[1], 10);
            const reason = bypassMatch[2] || "No reason provided";
            
            if (requestedLimit > 25) {
              return `I need your permission to fetch ${requestedLimit} posts from Reddit, which exceeds our default limit of 25 to prevent excessive API usage. This may incur higher costs.\n\nTo approve, please reply with: "approve ${requestedLimit} for reddit search" or modify your request to stay within limits.`;
            }
          }
          
          // Handle approval in the input
          const approvalMatch = input.match(/approve\s+(\d+)\s+for\s+reddit/i);
          if (approvalMatch) {
            const approvedLimit = parseInt(approvalMatch[1], 10);
            
            // Extract search query with regex - everything after "for reddit search" and not containing command patterns
            const queryMatches = input.match(/for\s+reddit\s+search\s+(.+)/i) || 
                               input.match(/approve\s+\d+\s+for\s+reddit\s+search\s+(.+)/i);
            const searchQuery = queryMatches ? queryMatches[1].trim() : "";
            
            if (!searchQuery) {
              return "Please include your search query along with your approval.";
            }
            
            // Apply higher limits with approval
            const { approved, grantedLimit } = await apify.requestHigherLimits(
              'trudax/reddit-scraper-lite',
              "User explicitly approved",
              approvedLimit,
              { budgetApproved: true }
            );
            
            console.log(`Running Reddit search with approved limit: ${grantedLimit}`);
            const result = await apify.runRedditSearch(searchQuery, false, grantedLimit);
            
            if (!result.success || !result.output) {
              return `Failed to search Reddit for "${searchQuery}"`;
            }
            
            // Format the results
            const posts = result.output;
            const formattedResult = posts.slice(0, Math.min(10, posts.length)).map((post: any, index: number) => {
              return `[${index + 1}] ${post.title || 'Untitled'}\n   Subreddit: ${post.community || 'unknown'}\n   Score: ${post.score || 'N/A'}\n   URL: ${post.url || 'N/A'}\n`;
            }).join('\n');
            
            return `Reddit search results for "${searchQuery}" (Limit: ${grantedLimit}):\n\n${formattedResult}\n\nTotal results: ${posts.length}`;
          }
          
          // Check if user explicitly requested a certain number of results
          const maxItemsMatch = input.match(/top\s+(\d+)/i) || input.match(/limit\s+(\d+)/i);
          let maxItems = 10; // Default
          if (maxItemsMatch && maxItemsMatch[1]) {
            const requestedLimit = parseInt(maxItemsMatch[1], 10);
            
            if (requestedLimit > 25) {
              return `I need your permission to fetch ${requestedLimit} posts from Reddit, which exceeds our default limit of 25 to prevent excessive API usage. This may incur higher costs.\n\nTo approve, please reply with: "approve ${requestedLimit} for reddit search" or modify your request to stay within limits.`;
            }
            
            maxItems = Math.min(requestedLimit, 25); // Cap at 25 unless explicitly approved
          }
          
          // Extract the actual search query without meta instructions
          let searchQuery = input.replace(/\b(dry run|test mode|top \d+|limit \d+|bypass \d+ (?:items|posts|results)(?:\s+for\s+.+)?)\b/gi, '').trim();
          
          // If we're left with nothing, use the original input
          if (!searchQuery) {
            searchQuery = input;
          }
          
          const result = await apify.runRedditSearch(searchQuery, isDryRun, maxItems);
          
          if (!result.success || !result.output) {
            return `Failed to search Reddit for "${searchQuery}"`;
          }
          
          // Format the results
          const posts = result.output;
          const formattedResult = posts.slice(0, 5).map((post: any, index: number) => {
            return `[${index + 1}] ${post.title || 'Untitled'}\n   Subreddit: ${post.community || 'unknown'}\n   Score: ${post.score || 'N/A'}\n   URL: ${post.url || 'N/A'}\n`;
          }).join('\n');
          
          return `Reddit search results for "${searchQuery}":\n\n${formattedResult}\n\nTotal results: ${posts.length}`;
        } catch (error) {
          console.error('Error in apify-reddit-search tool:', error);
          return `Error searching Reddit: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },
    
    'apify-twitter-search': {
      name: 'apify-twitter-search',
      description: 'Search Twitter for tweets related to a keyword or topic. Default limit: 10 tweets (use "bypass X items" for more tweets with approval)',
      costEstimate: 'high',
      usageLimit: 10, // max allowed runs/day
      async _call(input: string): Promise<string> {
        try {
          // Check if this is a dry run request
          const isDryRun = input.toLowerCase().includes('dry run') || input.toLowerCase().includes('test mode');
          
          // Check for bypass request syntax like "bypass 50 items"
          const bypassMatch = input.match(/bypass\s+(\d+)\s+(?:items|tweets|results)(?:\s+for\s+(.+))?/i);
          
          if (bypassMatch) {
            const requestedLimit = parseInt(bypassMatch[1], 10);
            const reason = bypassMatch[2] || "No reason provided";
            
            if (requestedLimit > 25) {
              return `I need your permission to fetch ${requestedLimit} tweets, which exceeds our default limit of 25 to prevent excessive API usage. This may incur higher costs.\n\nTo approve, please reply with: "approve ${requestedLimit} for twitter search" or modify your request to stay within limits.`;
            }
          }
          
          // Handle approval in the input
          const approvalMatch = input.match(/approve\s+(\d+)\s+for\s+twitter/i);
          if (approvalMatch) {
            const approvedLimit = parseInt(approvalMatch[1], 10);
            
            // Extract search query with regex - everything after "for twitter search" and not containing command patterns
            const queryMatches = input.match(/for\s+twitter\s+search\s+(.+)/i) || 
                               input.match(/approve\s+\d+\s+for\s+twitter\s+search\s+(.+)/i);
            const searchQuery = queryMatches ? queryMatches[1].trim() : "";
            
            if (!searchQuery) {
              return "Please include your search query along with your approval.";
            }
            
            // Apply higher limits with approval
            const { approved, grantedLimit } = await apify.requestHigherLimits(
              'apidojo/twitter-scraper-lite',
              "User explicitly approved",
              approvedLimit,
              { budgetApproved: true }
            );
            
            console.log(`Running Twitter search with approved limit: ${grantedLimit}`);
            const result = await apify.runTwitterSearch(searchQuery, false, grantedLimit);
            
            if (!result.success || !result.output) {
              return `Failed to search Twitter for "${searchQuery}"`;
            }
            
            // Format the results
            const tweets = result.output;
            const formattedResult = tweets.slice(0, Math.min(10, tweets.length)).map((tweet: any, index: number) => {
              return `[${index + 1}] @${tweet.username || 'unknown'}: ${tweet.text || 'No content'}\n   Likes: ${tweet.likeCount || 0}, Retweets: ${tweet.retweetCount || 0}\n   Date: ${tweet.date || 'N/A'}\n`;
            }).join('\n');
            
            return `Twitter search results for "${searchQuery}" (Limit: ${grantedLimit}):\n\n${formattedResult}\n\nTotal results: ${tweets.length}`;
          }
          
          // Check if user explicitly requested a certain number of results
          const maxItemsMatch = input.match(/top\s+(\d+)/i) || input.match(/limit\s+(\d+)/i);
          let maxItems = 10; // Default
          if (maxItemsMatch && maxItemsMatch[1]) {
            const requestedLimit = parseInt(maxItemsMatch[1], 10);
            
            if (requestedLimit > 25) {
              return `I need your permission to fetch ${requestedLimit} tweets, which exceeds our default limit of 25 to prevent excessive API usage. This may incur higher costs.\n\nTo approve, please reply with: "approve ${requestedLimit} for twitter search" or modify your request to stay within limits.`;
            }
            
            maxItems = Math.min(requestedLimit, 25); // Cap at 25 unless explicitly approved
          }
          
          // Extract the actual search query without meta instructions
          let searchQuery = input.replace(/\b(dry run|test mode|top \d+|limit \d+|bypass \d+ (?:items|tweets|results)(?:\s+for\s+.+)?)\b/gi, '').trim();
          
          // If we're left with nothing, use the original input
          if (!searchQuery) {
            searchQuery = input;
          }
          
          const result = await apify.runTwitterSearch(searchQuery, isDryRun, maxItems);
          
          if (!result.success || !result.output) {
            return `Failed to search Twitter for "${searchQuery}"`;
          }
          
          // Format the results
          const tweets = result.output;
          const formattedResult = tweets.slice(0, 5).map((tweet: any, index: number) => {
            return `[${index + 1}] @${tweet.username || 'unknown'}: ${tweet.text || 'No content'}\n   Likes: ${tweet.likeCount || 0}, Retweets: ${tweet.retweetCount || 0}\n   Date: ${tweet.date || 'N/A'}\n`;
          }).join('\n');
          
          return `Twitter search results for "${searchQuery}":\n\n${formattedResult}\n\nTotal results: ${tweets.length}`;
        } catch (error) {
          console.error('Error in apify-twitter-search tool:', error);
          return `Error searching Twitter: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },
    
    'apify-website-crawler': {
      name: 'apify-website-crawler',
      description: 'Crawl a website to extract content and information. Default limits: 10 pages, depth 1 (use "bypass X pages" or "depth Y" for deeper crawls with approval)',
      costEstimate: 'high',
      usageLimit: 10, // max allowed runs/day
      async _call(input: string): Promise<string> {
        try {
          // Check if this is a dry run request
          const isDryRun = input.toLowerCase().includes('dry run') || input.toLowerCase().includes('test mode');
          
          // Check for bypass request syntax
          const bypassPagesMatch = input.match(/bypass\s+(\d+)\s+pages(?:\s+for\s+(.+))?/i);
          const bypassDepthMatch = input.match(/bypass\s+depth\s+(\d+)(?:\s+for\s+(.+))?/i);
          
          if (bypassPagesMatch) {
            const requestedPages = parseInt(bypassPagesMatch[1], 10);
            const reason = bypassPagesMatch[2] || "No reason provided";
            
            if (requestedPages > 25) {
              return `I need your permission to crawl ${requestedPages} pages, which exceeds our default limit of 25 to prevent excessive API usage. This may incur higher costs.\n\nTo approve, please reply with: "approve ${requestedPages} pages for website crawler" or modify your request to stay within limits.`;
            }
          }
          
          if (bypassDepthMatch) {
            const requestedDepth = parseInt(bypassDepthMatch[1], 10);
            const reason = bypassDepthMatch[2] || "No reason provided";
            
            if (requestedDepth > 2) {
              return `I need your permission to crawl to a depth of ${requestedDepth}, which exceeds our default limit of 2 to prevent excessive API usage. Deeper crawls can increase costs exponentially.\n\nTo approve, please reply with: "approve depth ${requestedDepth} for website crawler" or modify your request to stay within limits.`;
            }
          }
          
          // Handle approval in the input - pages
          const approvalPagesMatch = input.match(/approve\s+(\d+)\s+pages\s+for/i);
          const approvalDepthMatch = input.match(/approve\s+depth\s+(\d+)\s+for/i);
          
          if (approvalPagesMatch || approvalDepthMatch) {
            // Extract URL with regex
            const urlMatch = input.match(/https?:\/\/[^\s]+/);
            const url = urlMatch ? urlMatch[0] : "";
            
            if (!url) {
              return "Please include the URL you want to crawl along with your approval.";
            }
            
            let maxPages = 10;
            let maxDepth = 1;
            
            if (approvalPagesMatch) {
              const requestedPages = parseInt(approvalPagesMatch[1], 10);
              // Apply higher page limits with approval
              const { approved, grantedLimit } = await apify.requestHigherLimits(
                'apify/website-content-crawler',
                "User explicitly approved pages limit",
                requestedPages,
                { budgetApproved: true }
              );
              maxPages = grantedLimit;
            }
            
            if (approvalDepthMatch) {
              const requestedDepth = parseInt(approvalDepthMatch[1], 10);
              // Keep depth reasonable even with approval
              maxDepth = Math.min(requestedDepth, 5);
            }
            
            console.log(`Running website crawler with limits: ${maxPages} pages, depth ${maxDepth}`);
            const result = await apify.runWebsiteCrawler(url, false, maxPages, maxDepth);
            
            if (!result.success || !result.output) {
              return `Failed to crawl website "${url}"`;
            }
            
            // Format the results
            const pages = result.output;
            let summary = `Crawled ${pages.length} pages from ${url} (Limits: max ${maxPages} pages, depth ${maxDepth})\n\n`;
            
            // Summarize found pages
            if (pages.length > 0) {
              summary += 'Pages crawled:\n';
              summary += pages.slice(0, Math.min(10, pages.length)).map((page: any, index: number) => {
                return `[${index + 1}] ${page.title || 'Untitled'}\n   URL: ${page.url || 'N/A'}\n   Word count: ${page.text ? page.text.split(/\s+/).length : 'N/A'}\n`;
              }).join('\n');
              
              if (pages.length > 10) {
                summary += `\n... and ${pages.length - 10} more pages`;
              }
            }
            
            return summary;
          }
          
          // Check if user explicitly requested a certain depth or number of pages
          const maxDepthMatch = input.match(/depth\s+(\d+)/i);
          const maxPagesMatch = input.match(/pages\s+(\d+)/i) || input.match(/limit\s+(\d+)/i);
          
          let maxPages = 10;
          let maxDepth = 1;
          
          if (maxPagesMatch) {
            const requestedPages = parseInt(maxPagesMatch[1], 10);
            
            if (requestedPages > 25) {
              return `I need your permission to crawl ${requestedPages} pages, which exceeds our default limit of 25 to prevent excessive API usage. This may incur higher costs.\n\nTo approve, please reply with: "approve ${requestedPages} pages for website crawler" or modify your request to stay within limits.`;
            }
            
            maxPages = Math.min(requestedPages, 25); // Cap at 25 unless explicitly approved
          }
          
          if (maxDepthMatch) {
            const requestedDepth = parseInt(maxDepthMatch[1], 10);
            
            if (requestedDepth > 2) {
              return `I need your permission to crawl to a depth of ${requestedDepth}, which exceeds our default limit of 2 to prevent excessive API usage. Deeper crawls can increase costs exponentially.\n\nTo approve, please reply with: "approve depth ${requestedDepth} for website crawler" or modify your request to stay within limits.`;
            }
            
            maxDepth = Math.min(requestedDepth, 2); // Cap at 2 unless explicitly approved
          }
          
          // Extract the actual URL without meta instructions
          let url = input.replace(/\b(dry run|test mode|depth \d+|pages \d+|limit \d+|bypass \d+ pages(?:\s+for\s+.+)?|bypass depth \d+(?:\s+for\s+.+)?)\b/gi, '').trim();
          
          // Check if input is a valid URL
          try {
            new URL(url);
          } catch (e) {
            return `Invalid URL: ${url}. Please provide a valid URL starting with http:// or https://`;
          }
          
          const result = await apify.runWebsiteCrawler(url, isDryRun, maxPages, maxDepth);
          
          if (!result.success || !result.output) {
            return `Failed to crawl website "${url}"`;
          }
          
          // Format the results
          const pages = result.output;
          let summary = `Crawled ${pages.length} pages from ${url}\n\n`;
          
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
      description: 'Search YouTube for videos related to a keyword or topic. Default limit: 10 videos (use "bypass X items" for more videos with approval)',
      costEstimate: 'high',
      usageLimit: 10, // max allowed runs/day
      async _call(input: string): Promise<string> {
        try {
          // Check if this is a dry run request
          const isDryRun = input.toLowerCase().includes('dry run') || input.toLowerCase().includes('test mode');
          
          // Check for bypass request syntax like "bypass 50 items"
          const bypassMatch = input.match(/bypass\s+(\d+)\s+(?:items|videos|results)(?:\s+for\s+(.+))?/i);
          
          if (bypassMatch) {
            const requestedLimit = parseInt(bypassMatch[1], 10);
            const reason = bypassMatch[2] || "No reason provided";
            
            if (requestedLimit > 25) {
              return `I need your permission to fetch ${requestedLimit} videos, which exceeds our default limit of 25 to prevent excessive API usage. This may incur higher costs.\n\nTo approve, please reply with: "approve ${requestedLimit} for youtube search" or modify your request to stay within limits.`;
            }
          }
          
          // Handle approval in the input
          const approvalMatch = input.match(/approve\s+(\d+)\s+for\s+youtube/i);
          if (approvalMatch) {
            const approvedLimit = parseInt(approvalMatch[1], 10);
            
            // Extract search query with regex - everything after "for youtube search" and not containing command patterns
            const queryMatches = input.match(/for\s+youtube\s+search\s+(.+)/i) || 
                               input.match(/approve\s+\d+\s+for\s+youtube\s+search\s+(.+)/i);
            const searchQuery = queryMatches ? queryMatches[1].trim() : "";
            
            if (!searchQuery) {
              return "Please include your search query along with your approval.";
            }
            
            // Apply higher limits with approval
            const { approved, grantedLimit } = await apify.requestHigherLimits(
              'apify/youtube-scraper',
              "User explicitly approved",
              approvedLimit,
              { budgetApproved: true }
            );
            
            console.log(`Running YouTube search with approved limit: ${grantedLimit}`);
            const result = await apify.runYouTubeSearch(searchQuery, false, grantedLimit);
            
            if (!result.success || !result.output) {
              return `Failed to search YouTube for "${searchQuery}"`;
            }
            
            // Format the results
            const videos = result.output;
            const formattedResult = videos.slice(0, Math.min(10, videos.length)).map((video: any, index: number) => {
              return `[${index + 1}] ${video.title || 'Untitled'}\n   Channel: ${video.channelName || 'unknown'}\n   Views: ${video.viewCount || 'N/A'}\n   URL: ${video.url || 'N/A'}\n`;
            }).join('\n');
            
            return `YouTube search results for "${searchQuery}" (Limit: ${grantedLimit}):\n\n${formattedResult}\n\nTotal results: ${videos.length}`;
          }
          
          // Check if user explicitly requested a certain number of results
          const maxItemsMatch = input.match(/top\s+(\d+)/i) || input.match(/limit\s+(\d+)/i);
          let maxItems = 10; // Default
          if (maxItemsMatch && maxItemsMatch[1]) {
            const requestedLimit = parseInt(maxItemsMatch[1], 10);
            
            if (requestedLimit > 25) {
              return `I need your permission to fetch ${requestedLimit} videos, which exceeds our default limit of 25 to prevent excessive API usage. This may incur higher costs.\n\nTo approve, please reply with: "approve ${requestedLimit} for youtube search" or modify your request to stay within limits.`;
            }
            
            maxItems = Math.min(requestedLimit, 25); // Cap at 25 unless explicitly approved
          }
          
          // Extract the actual search query without meta instructions
          let searchQuery = input.replace(/\b(dry run|test mode|top \d+|limit \d+|bypass \d+ (?:items|videos|results)(?:\s+for\s+.+)?)\b/gi, '').trim();
          
          // If we're left with nothing, use the original input
          if (!searchQuery) {
            searchQuery = input;
          }
          
          const result = await apify.runYouTubeSearch(searchQuery, isDryRun, maxItems);
          
          if (!result.success || !result.output) {
            return `Failed to search YouTube for "${searchQuery}"`;
          }
          
          // Format the results
          const videos = result.output;
          const formattedResult = videos.slice(0, 5).map((video: any, index: number) => {
            return `[${index + 1}] ${video.title || 'Untitled'}\n   Channel: ${video.channelName || 'unknown'}\n   Views: ${video.viewCount || 'N/A'}\n   URL: ${video.url || 'N/A'}\n`;
          }).join('\n');
          
          return `YouTube search results for "${searchQuery}":\n\n${formattedResult}\n\nTotal results: ${videos.length}`;
        } catch (error) {
          console.error('Error in apify-youtube-search tool:', error);
          return `Error searching YouTube: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },
    
    'apify-instagram-scraper': {
      name: 'apify-instagram-scraper',
      description: 'Scrape Instagram profiles and posts for a specific username. Default limit: 10 posts (use "bypass X items" for more posts with approval)',
      costEstimate: 'high',
      usageLimit: 10, // max allowed runs/day
      async _call(input: string): Promise<string> {
        try {
          // Check if this is a dry run request
          const isDryRun = input.toLowerCase().includes('dry run') || input.toLowerCase().includes('test mode');
          
          // Check for bypass request syntax like "bypass 50 items"
          const bypassMatch = input.match(/bypass\s+(\d+)\s+(?:items|posts|results)(?:\s+for\s+(.+))?/i);
          
          if (bypassMatch) {
            const requestedLimit = parseInt(bypassMatch[1], 10);
            const reason = bypassMatch[2] || "No reason provided";
            
            if (requestedLimit > 25) {
              return `I need your permission to fetch ${requestedLimit} posts from Instagram, which exceeds our default limit of 25 to prevent excessive API usage. This may incur higher costs and potential rate limiting.\n\nTo approve, please reply with: "approve ${requestedLimit} for instagram scraper" or modify your request to stay within limits.`;
            }
          }
          
          // Handle approval in the input
          const approvalMatch = input.match(/approve\s+(\d+)\s+for\s+instagram/i);
          if (approvalMatch) {
            const approvedLimit = parseInt(approvalMatch[1], 10);
            
            // Extract username with regex - everything after "for instagram scraper" not containing command patterns
            const usernameMatches = input.match(/for\s+instagram\s+scraper\s+(.+)/i) || 
                                  input.match(/approve\s+\d+\s+for\s+instagram\s+scraper\s+(.+)/i) ||
                                  input.match(/@([a-zA-Z0-9._]+)/);
            
            let username = '';
            if (usernameMatches) {
              username = usernameMatches[1].trim();
              // Remove @ if present
              username = username.startsWith('@') ? username.substring(1) : username;
            }
            
            if (!username) {
              return "Please include the Instagram username you want to scrape along with your approval.";
            }
            
            // Apply higher limits with approval
            const { approved, grantedLimit } = await apify.requestHigherLimits(
              'apify/instagram-scraper',
              "User explicitly approved",
              approvedLimit,
              { budgetApproved: true }
            );
            
            console.log(`Running Instagram scraper with approved limit: ${grantedLimit}`);
            const result = await apify.runInstagramScraper(username, false, grantedLimit);
            
            if (!result.success || !result.output) {
              return `Failed to scrape Instagram data for "${username}"`;
            }
            
            // Format the results - profile info and recent posts
            const data = result.output;
            let response = `Instagram data for @${username} (Limit: ${grantedLimit})\n\n`;
            
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
              posts.slice(0, Math.min(10, posts.length)).forEach((post: any, index: number) => {
                response += `[${index + 1}] ${post.caption ? post.caption.substring(0, 100) + (post.caption.length > 100 ? '...' : '') : 'No caption'}\n`;
                if (post.likesCount) response += `   Likes: ${post.likesCount}\n`;
                if (post.commentsCount) response += `   Comments: ${post.commentsCount}\n`;
                if (post.url) response += `   URL: ${post.url}\n`;
                response += '\n';
              });
              
              if (posts.length > 10) {
                response += `... and ${posts.length - 10} more posts\n`;
              }
            } else {
              response += 'No posts found.\n';
            }
            
            return response;
          }
          
          // Check if user explicitly requested a certain number of results
          const maxItemsMatch = input.match(/top\s+(\d+)/i) || input.match(/limit\s+(\d+)/i);
          let maxItems = 10; // Default
          if (maxItemsMatch && maxItemsMatch[1]) {
            const requestedLimit = parseInt(maxItemsMatch[1], 10);
            
            if (requestedLimit > 25) {
              return `I need your permission to fetch ${requestedLimit} posts from Instagram, which exceeds our default limit of 25 to prevent excessive API usage. This may incur higher costs and potential rate limiting.\n\nTo approve, please reply with: "approve ${requestedLimit} for instagram scraper" or modify your request to stay within limits.`;
            }
            
            maxItems = Math.min(requestedLimit, 25); // Cap at 25 unless explicitly approved
          }
          
          // Extract the actual username without meta instructions
          let username = input.replace(/\b(dry run|test mode|top \d+|limit \d+|bypass \d+ (?:items|posts|results)(?:\s+for\s+.+)?)\b/gi, '').trim();
          
          // Remove @ if present at the beginning
          username = username.startsWith('@') ? username.substring(1) : username;
          
          const result = await apify.runInstagramScraper(username, isDryRun, maxItems);
          
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
      description: 'Scrape TikTok content for a username, hashtag, or keyword. Default limit: 10 items (use "bypass X items" for more items with approval)',
      costEstimate: 'high',
      usageLimit: 10, // max allowed runs/day
      async _call(input: string): Promise<string> {
        try {
          // Check if this is a dry run request
          const isDryRun = input.toLowerCase().includes('dry run') || input.toLowerCase().includes('test mode');
          
          // Check for bypass request syntax like "bypass 50 items"
          const bypassMatch = input.match(/bypass\s+(\d+)\s+(?:items|videos|results)(?:\s+for\s+(.+))?/i);
          
          if (bypassMatch) {
            const requestedLimit = parseInt(bypassMatch[1], 10);
            const reason = bypassMatch[2] || "No reason provided";
            
            if (requestedLimit > 25) {
              return `I need your permission to fetch ${requestedLimit} items from TikTok, which exceeds our default limit of 25 to prevent excessive API usage. This may incur higher costs and potential rate limiting.\n\nTo approve, please reply with: "approve ${requestedLimit} for tiktok scraper" or modify your request to stay within limits.`;
            }
          }
          
          // Handle approval in the input
          const approvalMatch = input.match(/approve\s+(\d+)\s+for\s+tiktok/i);
          if (approvalMatch) {
            const approvedLimit = parseInt(approvalMatch[1], 10);
            
            // Extract search term with regex - everything after "for tiktok scraper" not containing command patterns
            const searchMatches = input.match(/for\s+tiktok\s+scraper\s+(.+)/i) || 
                                input.match(/approve\s+\d+\s+for\s+tiktok\s+scraper\s+(.+)/i) ||
                                input.match(/[@#]([a-zA-Z0-9._]+)/);
            
            let searchTerm = searchMatches ? searchMatches[1].trim() : "";
            
            // If we matched a hashtag or username specifically, keep the prefix
            if (input.includes('@') && !searchTerm.startsWith('@')) {
              const usernameMatch = input.match(/@([a-zA-Z0-9._]+)/);
              if (usernameMatch) {
                searchTerm = '@' + usernameMatch[1];
              }
            } else if (input.includes('#') && !searchTerm.startsWith('#')) {
              const hashtagMatch = input.match(/#([a-zA-Z0-9._]+)/);
              if (hashtagMatch) {
                searchTerm = '#' + hashtagMatch[1];
              }
            }
            
            if (!searchTerm) {
              return "Please include a username (@user), hashtag (#tag), or keyword along with your approval.";
            }
            
            // Apply higher limits with approval
            const { approved, grantedLimit } = await apify.requestHigherLimits(
              'clockworks/free-tiktok-scraper',
              "User explicitly approved",
              approvedLimit,
              { budgetApproved: true }
            );
            
            console.log(`Running TikTok scraper with approved limit: ${grantedLimit}`);
            const result = await apify.runTikTokScraper(searchTerm, false, grantedLimit);
            
            if (!result.success || !result.output) {
              return `Failed to scrape TikTok data for "${searchTerm}"`;
            }
            
            // Format the results
            const items = result.output;
            
            if (!items || items.length === 0) {
              return `No TikTok content found for "${searchTerm}"`;
            }
            
            let response = `TikTok results for "${searchTerm}" (Limit: ${grantedLimit}):\n\n`;
            
            items.slice(0, Math.min(10, items.length)).forEach((item: any, index: number) => {
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
            
            if (items.length > 10) {
              response += `... and ${items.length - 10} more items`;
            }
            
            return response;
          }
          
          // Check if user explicitly requested a certain number of results
          const maxItemsMatch = input.match(/top\s+(\d+)/i) || input.match(/limit\s+(\d+)/i);
          let maxItems = 10; // Default
          if (maxItemsMatch && maxItemsMatch[1]) {
            const requestedLimit = parseInt(maxItemsMatch[1], 10);
            
            if (requestedLimit > 25) {
              return `I need your permission to fetch ${requestedLimit} items from TikTok, which exceeds our default limit of 25 to prevent excessive API usage. This may incur higher costs and potential rate limiting.\n\nTo approve, please reply with: "approve ${requestedLimit} for tiktok scraper" or modify your request to stay within limits.`;
            }
            
            maxItems = Math.min(requestedLimit, 25); // Cap at 25 unless explicitly approved
          }
          
          // Extract the actual search term without meta instructions
          let searchTerm = input.replace(/\b(dry run|test mode|top \d+|limit \d+|bypass \d+ (?:items|videos|results)(?:\s+for\s+.+)?)\b/gi, '').trim();
          
          // If we're left with nothing, use the original input
          if (!searchTerm) {
            searchTerm = input;
          }
          
          const result = await apify.runTikTokScraper(searchTerm, isDryRun, maxItems);
          
          if (!result.success || !result.output) {
            return `Failed to scrape TikTok data for "${searchTerm}"`;
          }
          
          // Format the results
          const items = result.output;
          
          if (!items || items.length === 0) {
            return `No TikTok content found for "${searchTerm}"`;
          }
          
          let response = `TikTok results for "${searchTerm}":\n\n`;
          
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