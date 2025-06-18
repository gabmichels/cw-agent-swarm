/**
 * DefaultRssProcessor.ts - Default implementation of RSS feed processor
 * 
 * This file provides a concrete implementation for processing RSS feeds
 * to extract market signals for trend analysis.
 */

import Parser from 'rss-parser';
import { logger } from '../../../../../../lib/logging';
import { MarketSignal } from '../../MarketScanner.interface';
import { IRssProcessor } from '../../interfaces/SourceProcessor.interface';
import { RssSource } from '../../interfaces/MarketSource.interface';
import { generateAgentId } from '../../../../../../lib/core/id-generation';

/**
 * Error class for RSS processor operations
 */
export class RssProcessorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RssProcessorError';
  }
}

/**
 * Default implementation of RSS feed processor
 */
export class DefaultRssProcessor implements IRssProcessor {
  private parser: Parser;
  
  /**
   * Create a new DefaultRssProcessor
   */
  constructor() {
    this.parser = new Parser({
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      }
    });
  }
  
  /**
   * Process an RSS feed source
   * 
   * @param source RSS source to process
   * @returns Extracted market signals
   */
  async processSource(source: RssSource): Promise<MarketSignal[]> {
    try {
      logger.info(`Processing RSS source: ${source.url}`);
      
      // Test feed validity
      const isValid = await this.testFeed(source.url || '');
      if (!isValid) {
        throw new RssProcessorError(`Invalid or inaccessible RSS feed: ${source.url}`);
      }
      
      // Parse the feed
      const feed = await this.parser.parseURL(source.url || '');
      
      // Process feed content
      const signals = await this.processFeedContent(feed, source);
      
      logger.info(`Processed RSS source ${source.id} and found ${signals.length} signals`);
      return signals;
    } catch (error) {
      logger.error(`Error processing RSS source ${source.id}:`, error);
      throw new RssProcessorError(`Failed to process RSS source ${source.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Test if an RSS feed is valid and accessible
   * 
   * @param url RSS feed URL to test
   * @returns Whether the feed is valid
   */
  async testFeed(url: string): Promise<boolean> {
    try {
      // Attempt to fetch feed headers only to validate
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
        }
      });
      
      // Check if the response is valid
      if (!response.ok) {
        logger.warn(`RSS feed returned status ${response.status}: ${url}`);
        return false;
      }
      
      // Check content type
      const contentType = response.headers.get('content-type');
      if (contentType) {
        const isXml = contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom');
        if (!isXml) {
          logger.warn(`RSS feed has unexpected content type: ${contentType}`);
          // Don't return false immediately, let the parser try to handle it
        }
      }
      
      return true;
    } catch (error) {
      logger.warn(`Error testing RSS feed ${url}:`, error);
      return false;
    }
  }
  
  /**
   * Process feed content
   * 
   * @param feed Parsed feed content
   * @param source Source metadata
   * @returns Extracted market signals
   */
  async processFeedContent(feed: any, source: RssSource): Promise<MarketSignal[]> {
    const signals: MarketSignal[] = [];
    const now = new Date();
    
    try {
      // Extract metadata from the feed
      const feedTitle = feed.title || 'Unknown Feed';
      const feedLink = feed.link || source.url;
      
      // Get items to process, respecting the limit
      const items = feed.items || [];
      const itemCount = source.itemLimit || 10;
      const itemsToProcess = items.slice(0, itemCount);
      
      // Process each item
      for (const item of itemsToProcess) {
        // Extract item data
        const title = item.title || 'Untitled';
        const content = source.parseFullContent 
          ? item.content || item['content:encoded'] || item.description || ''
          : item.description || item.summary || item.content || '';
        const link = item.link || '';
        
        // Parse the published date
        let publishedDate = now;
        if (item.pubDate) {
          publishedDate = new Date(item.pubDate);
        } else if (item.isoDate) {
          publishedDate = new Date(item.isoDate);
        } else if (item.published) {
          publishedDate = new Date(item.published);
        }
        
        // Create a market signal
        const signal: MarketSignal = {
          id: generateAgentId(), // Generate unique ID for the signal
          title,
          content: this.cleanContent(content),
          source: feedTitle,
          sourceType: 'rss',
          category: source.category,
          url: link,
          timestamp: publishedDate // Use timestamp instead of published/retrieved
        };
        
        signals.push(signal);
      }
    } catch (error) {
      logger.error(`Error processing feed content:`, error);
      // Continue processing if possible
    }
    
    return signals;
  }
  
  /**
   * Clean HTML content from feed items
   * 
   * @param content Content to clean
   * @returns Cleaned content
   */
  private cleanContent(content: string): string {
    try {
      // Remove HTML tags
      const withoutTags = content.replace(/<\/?[^>]+(>|$)/g, ' ');
      
      // Remove excess whitespace
      const withoutExcessSpace = withoutTags.replace(/\s+/g, ' ').trim();
      
      // Limit length to a reasonable size
      return withoutExcessSpace.length > 2000 
        ? withoutExcessSpace.substring(0, 2000) + '...'
        : withoutExcessSpace;
    } catch (error) {
      logger.error(`Error cleaning content:`, error);
      return content.substring(0, 500) + '...'; // Return truncated original on error
    }
  }
} 