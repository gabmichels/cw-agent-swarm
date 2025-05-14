/**
 * SourceProcessor.interface.ts - Interfaces for market source processors
 * 
 * This file defines interfaces for components that process different types
 * of market sources to extract market signals.
 */

import { MarketSignal, MarketSource } from '../MarketScanner.interface';
import { RssSource, RedditSource, TwitterSource } from './MarketSource.interface';

/**
 * Common interface for all source processors
 */
export interface ISourceProcessor {
  /**
   * Process a source to extract market signals
   * 
   * @param source The source to process
   * @returns Extracted market signals
   */
  processSource(source: MarketSource): Promise<MarketSignal[]>;
}

/**
 * Interface for RSS feed processor
 */
export interface IRssProcessor extends ISourceProcessor {
  /**
   * Process an RSS feed source
   * 
   * @param source RSS source to process
   * @returns Extracted market signals
   */
  processSource(source: RssSource): Promise<MarketSignal[]>;
  
  /**
   * Test if an RSS feed is valid and accessible
   * 
   * @param url RSS feed URL to test
   * @returns Whether the feed is valid
   */
  testFeed(url: string): Promise<boolean>;
  
  /**
   * Process feed content
   * 
   * @param feedContent Raw feed content
   * @param source Source metadata
   * @returns Extracted market signals
   */
  processFeedContent(feedContent: string, source: RssSource): Promise<MarketSignal[]>;
}

/**
 * Interface for Reddit processor
 */
export interface IRedditProcessor extends ISourceProcessor {
  /**
   * Process a Reddit source
   * 
   * @param source Reddit source to process
   * @returns Extracted market signals
   */
  processSource(source: RedditSource): Promise<MarketSignal[]>;
  
  /**
   * Test if a subreddit is valid and accessible
   * 
   * @param subreddit Subreddit to test
   * @returns Whether the subreddit is valid
   */
  testSubreddit(subreddit: string): Promise<boolean>;
  
  /**
   * Process Reddit API response
   * 
   * @param responseData Response data from Reddit API
   * @param source Source metadata
   * @returns Extracted market signals
   */
  processRedditResponse(responseData: unknown, source: RedditSource): Promise<MarketSignal[]>;
}

/**
 * Interface for Twitter/X processor
 */
export interface ITwitterProcessor extends ISourceProcessor {
  /**
   * Process a Twitter source
   * 
   * @param source Twitter source to process
   * @returns Extracted market signals
   */
  processSource(source: TwitterSource): Promise<MarketSignal[]>;
  
  /**
   * Process Twitter API or scrape response
   * 
   * @param responseData Response data from Twitter API or scrape
   * @param source Source metadata
   * @returns Extracted market signals
   */
  processTwitterResponse(responseData: unknown, source: TwitterSource): Promise<MarketSignal[]>;
  
  /**
   * Get fallback results when Twitter scraping fails
   * 
   * @param source Twitter source
   * @param searchQuery Search query
   * @returns Fallback market signals
   */
  getFallbackResults(source: TwitterSource, searchQuery: string): Promise<MarketSignal[]>;
} 