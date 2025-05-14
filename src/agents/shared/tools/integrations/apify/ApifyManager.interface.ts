/**
 * ApifyManager.interface.ts - Interface for Apify integration
 * 
 * Defines the interface for the Apify manager that handles integration with the
 * Apify platform for web scraping and automation tasks.
 */

/**
 * Input for Apify tool operations
 */
export interface ApifyToolInput {
  /** The ID of the Apify actor to run */
  actorId: string;
  
  /** The input data for the actor */
  input: Record<string, any>;
  
  /** A descriptive label for the run for tracking purposes */
  label?: string;
  
  /** Whether to skip the actual API call (dry run) */
  dryRun?: boolean;
}

/**
 * Result from Apify tool operations
 */
export interface ApifyToolResult<T = any> {
  /** Whether the operation was successful */
  success: boolean;
  
  /** The ID of the actor run that was created */
  runId?: string;
  
  /** The output data from the actor run */
  output?: T[];
  
  /** Error message if the operation failed */
  error?: string;
}

/**
 * Context for higher limit requests
 */
export interface ApifyLimitContext {
  /** The role of the user requesting higher limits */
  userRole?: 'default' | 'researcher' | 'admin' | 'developer';
  
  /** Whether budget approval was granted for higher limits */
  budgetApproved?: boolean;
  
  /** The purpose of the request (e.g., research, analysis) */
  purpose?: string;
  
  /** Additional context for the request */
  additionalInfo?: string;
}

/**
 * Result of higher limit request
 */
export interface ApifyLimitResult {
  /** Whether the request was approved */
  approved: boolean;
  
  /** The limit that was granted */
  grantedLimit: number;
  
  /** The reason for the decision */
  reason?: string;
}

/**
 * Actor discovery and metadata interfaces
 */
export interface ApifyActorMetadata {
  /** The unique ID of the actor */
  id: string;
  
  /** The display name of the actor */
  name: string;
  
  /** A description of what the actor does */
  description: string;
  
  /** Categories the actor belongs to */
  categories: string[];
  
  /** Example use cases for the actor */
  examples: string[];
  
  /** Schema defining the expected input format */
  inputSchema?: any;
  
  /** Schema defining the expected output format */
  outputSchema?: any;
  
  /** Whether the actor is free or paid */
  usageTier: 'free' | 'paid';
  
  /** Estimated cost of running the actor */
  costEstimate: 'low' | 'medium' | 'high';
  
  /** When the actor was last updated */
  lastUpdated?: string;
  
  /** The author of the actor */
  author?: string;
  
  /** Rating of the actor (1-5) */
  rating?: number;
  
  /** Number of runs in the last 30 days */
  popularity?: number;
}

/**
 * Options for discovering actors
 */
export interface ActorDiscoveryOptions {
  /** Filter by category */
  category?: string;
  
  /** Maximum number of results to return */
  limit?: number;
  
  /** Number of results to skip */
  offset?: number;
  
  /** Minimum rating threshold (1-5) */
  minRating?: number;
  
  /** Filter by usage tier */
  usageTier?: 'free' | 'paid' | 'both';
  
  /** Sort results by */
  sortBy?: 'popularity' | 'rating' | 'newest' | 'relevance';
}

/**
 * Interface defining the contract for any ApifyManager implementation
 */
export interface IApifyManager {
  /**
   * Run an Apify actor with the given options
   * 
   * @param options The options for running the actor
   * @returns The result of the operation
   */
  runApifyActor<T = any>(options: ApifyToolInput): Promise<ApifyToolResult<T>>;
  
  /**
   * Search Reddit for posts related to a keyword or topic
   * 
   * @param query The search query
   * @param dryRun Whether to skip the actual API call
   * @param maxResults Maximum number of results to return
   * @returns The search results
   */
  runRedditSearch(query: string, dryRun?: boolean, maxResults?: number): Promise<ApifyToolResult>;
  
  /**
   * Search Twitter for tweets related to a keyword or topic
   * 
   * @param query The search query
   * @param dryRun Whether to skip the actual API call
   * @param maxResults Maximum number of results to return
   * @returns The search results
   */
  runTwitterSearch(query: string, dryRun?: boolean, maxResults?: number): Promise<ApifyToolResult>;
  
  /**
   * Crawl a website to extract content
   * 
   * @param url The URL to crawl
   * @param dryRun Whether to skip the actual API call
   * @param maxPages Maximum number of pages to crawl
   * @param maxDepth Maximum crawl depth
   * @returns The crawl results
   */
  runWebsiteCrawler(url: string, dryRun?: boolean, maxPages?: number, maxDepth?: number): Promise<ApifyToolResult>;
  
  /**
   * Search YouTube for videos related to a keyword or topic
   * 
   * @param query The search query
   * @param dryRun Whether to skip the actual API call
   * @param maxResults Maximum number of results to return
   * @returns The search results
   */
  runYouTubeSearch(query: string, dryRun?: boolean, maxResults?: number): Promise<ApifyToolResult>;
  
  /**
   * Scrape Instagram content by username
   * 
   * @param username The Instagram username
   * @param dryRun Whether to skip the actual API call
   * @param maxResults Maximum number of results to return
   * @returns The scraped data
   */
  runInstagramScraper(username: string, dryRun?: boolean, maxResults?: number): Promise<ApifyToolResult>;
  
  /**
   * Scrape TikTok content by hashtag, username, or keyword
   * 
   * @param query The search query (username, hashtag, or keyword)
   * @param dryRun Whether to skip the actual API call
   * @param maxResults Maximum number of results to return
   * @returns The scraped data
   */
  runTikTokScraper(query: string, dryRun?: boolean, maxResults?: number): Promise<ApifyToolResult>;
  
  /**
   * Request higher limits for an actor run
   * 
   * @param actorId The ID of the actor
   * @param reason The reason for requesting higher limits
   * @param requestedLimit The requested limit
   * @param context Additional context for the request
   * @returns The result of the request
   */
  requestHigherLimits(
    actorId: string,
    reason: string,
    requestedLimit: number,
    context?: ApifyLimitContext
  ): Promise<ApifyLimitResult>;
  
  /**
   * Discover actors based on a search query
   * 
   * @param query The search query
   * @param options Options for the discovery
   * @returns List of actor metadata
   */
  discoverActors(query: string, options?: ActorDiscoveryOptions): Promise<ApifyActorMetadata[]>;
  
  /**
   * Get detailed information about a specific actor
   * 
   * @param actorId The ID of the actor
   * @returns The actor metadata
   */
  getActorInfo(actorId: string): Promise<ApifyActorMetadata>;
  
  /**
   * Suggest actors for a specific task based on task description
   * 
   * @param taskDescription Description of the task
   * @param count Maximum number of suggestions to return
   * @returns List of suggested actor metadata
   */
  suggestActorsForTask(taskDescription: string, count?: number): Promise<ApifyActorMetadata[]>;
  
  /**
   * Dynamically run an actor discovered through the API
   * 
   * @param actorId The ID of the actor
   * @param input The input for the actor
   * @param options Additional options for the run
   * @returns The result of the actor run
   */
  dynamicRunActor<T = any>(
    actorId: string, 
    input: any, 
    options?: Partial<ApifyToolInput>
  ): Promise<ApifyToolResult<T>>;
} 