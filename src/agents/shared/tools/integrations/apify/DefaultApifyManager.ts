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
   * @returns The result of the operation
   */
  async runApifyActor<T = any>(options: ApifyToolInput): Promise<ApifyToolResult<T>> {
    // Check if API token is available
    if (!this.apiToken) {
      return {
        success: false,
        error: 'APIFY_API_KEY environment variable is not set'
      };
    }
    
    // Handle dry run mode
    if (options.dryRun) {
      logger.info(`[DRY RUN] Would start Apify actor: ${options.actorId} (${options.label || 'Unnamed run'})`);
      return {
        success: true,
        runId: 'dry-run-id',
        output: [],
        error: 'This was a dry run. No actual API call was made.'
      };
    }
    
    try {
      // Create actor run
      const runResponse = await fetch(`${this.baseApiUrl}/acts/${options.actorId}/runs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          memory: 4096,
          timeout: 300,
          build: 'latest',
          webhooks: [],
          input: options.input
        })
      });
      
      if (!runResponse.ok) {
        const error = await runResponse.text();
        logger.error(`Failed to start Apify actor: ${error}`);
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
        
        const statusResponse = await fetch(`${this.baseApiUrl}/actor-runs/${runId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`
          }
        });
        
        if (!statusResponse.ok) {
          const error = await statusResponse.text();
          logger.error(`Failed to check run status: ${error}`);
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
        return {
          success: false,
          runId,
          error: `Actor run did not complete successfully: ${status}`
        };
      }
      
      // Get the run results
      const datasetResponse = await fetch(`${this.baseApiUrl}/actor-runs/${runId}/dataset/items`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      });
      
      if (!datasetResponse.ok) {
        const error = await datasetResponse.text();
        logger.error(`Failed to fetch run results: ${error}`);
        return {
          success: false,
          runId,
          error: `Failed to fetch run results: ${error}`
        };
      }
      
      const outputData = await datasetResponse.json();
      
      return {
        success: true,
        runId,
        output: outputData
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error in Apify actor run: ${errorMessage}`);
      return {
        success: false,
        error: `Error in actor run: ${errorMessage}`
      };
    }
  }

  /**
   * Search Reddit for posts related to a keyword or topic
   * 
   * @param query The search query
   * @param dryRun Whether to skip the actual API call
   * @param maxResults Maximum number of results to return
   * @returns The search results
   */
  async runRedditSearch(query: string, dryRun = false, maxResults = 10): Promise<ApifyToolResult> {
    try {
      return await this.runApifyActor({
        actorId: 'trudax/reddit-scraper-lite',
        input: {
          searchQuery: query,
          maxPosts: maxResults,
          skipComments: true,
        },
        label: `Reddit search: ${query}`,
        dryRun
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error in Reddit search: ${errorMessage}`);
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
   * @returns The search results
   */
  async runTwitterSearch(query: string, dryRun = false, maxResults = 10): Promise<ApifyToolResult> {
    try {
      return await this.runApifyActor({
        actorId: 'apidojo/twitter-scraper-lite',
        input: {
          searchTerms: [query],
          maxTweets: maxResults,
          scrapeTweetReplies: false,
        },
        label: `Twitter search: ${query}`,
        dryRun
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error in Twitter search: ${errorMessage}`);
      return {
        success: false,
        error: `Error in Twitter search: ${errorMessage}`
      };
    }
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
    if (!this.apiToken) {
      logger.warn('Cannot discover actors: APIFY_API_KEY is not set');
      return [];
    }
    
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
      
      // Make request to Apify API
      const response = await fetch(`${this.baseApiUrl}/store/acts?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.text();
        logger.error(`Failed to discover actors: ${error}`);
        return [];
      }
      
      const data = await response.json();
      const actors = data.data.items;
      
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