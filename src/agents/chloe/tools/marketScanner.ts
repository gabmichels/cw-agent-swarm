import fs from 'fs';
import path from 'path';
import Parser from 'rss-parser';
import { logger } from '../../../lib/logging';
import { addMemory as qdrantAddMemory } from '../../../server/qdrant';

interface Source {
  id: string;
  type: 'rss' | 'reddit' | 'twitter';
  url: string;
  category: string;
  theme: string;
  refresh_interval: number; // in hours
  last_checked?: string;
}

interface SourceFile {
  sources: Source[];
}

interface MarketSignal {
  title: string;
  content: string;
  source: string;
  sourceType: string;
  category: string;
  theme: string;
  url: string;
  published: Date;
  retrieved: Date;
}

/**
 * Market Scanner implementation
 * Scans multiple sources for market intelligence and trends
 */
export class MarketScanner {
  private sources: Source[] = [];
  private rssParser: Parser;
  private dataDir: string;
  private isEnabled: boolean = false;

  constructor() {
    this.rssParser = new Parser();
    this.dataDir = path.join(process.cwd(), 'data', 'sources');
    
    // Check if the data directory exists
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
        this.createSampleSourcesFiles();
        logger.info('Created sample source files in data/sources directory');
      }
      this.isEnabled = true;
    } catch (error) {
      logger.error('Failed to initialize market scanner data directory:', error);
      this.isEnabled = false;
    }

    this.loadSources();
  }

  /**
   * Create sample source files if they don't exist
   */
  private createSampleSourcesFiles() {
    const feedsFile = path.join(this.dataDir, 'feeds.json');
    const redditFile = path.join(this.dataDir, 'reddit.json');
    const twitterFile = path.join(this.dataDir, 'twitter.json');

    // Sample RSS feeds
    const sampleFeeds: SourceFile = {
      sources: [
        {
          id: 'moz-blog',
          type: 'rss',
          url: 'https://moz.com/blog/feed',
          category: 'SEO',
          theme: 'Marketing',
          refresh_interval: 24
        },
        {
          id: 'travel-leisure',
          type: 'rss',
          url: 'https://www.travelandleisure.com/feeds/all.rss.xml',
          category: 'Travel',
          theme: 'Travel',
          refresh_interval: 12
        },
        {
          id: 'techcrunch-ai',
          type: 'rss',
          url: 'https://techcrunch.com/tag/artificial-intelligence/feed/',
          category: 'AI News',
          theme: 'Technology',
          refresh_interval: 6
        }
      ]
    };

    // Sample Reddit sources
    const sampleReddit: SourceFile = {
      sources: [
        {
          id: 'digital-marketing',
          type: 'reddit',
          url: 'r/digital_marketing',
          category: 'Digital Marketing',
          theme: 'Marketing',
          refresh_interval: 24
        },
        {
          id: 'travel',
          type: 'reddit',
          url: 'r/travel',
          category: 'Travel',
          theme: 'Travel',
          refresh_interval: 24
        },
        {
          id: 'language-learning',
          type: 'reddit',
          url: 'r/languagelearning',
          category: 'Language Learning',
          theme: 'Education',
          refresh_interval: 48
        }
      ]
    };

    // Sample Twitter sources
    const sampleTwitter: SourceFile = {
      sources: [
        {
          id: 'travel-trends',
          type: 'twitter',
          url: 'search:travel OR tourism lang:en -is:retweet',
          category: 'Travel Trends',
          theme: 'Travel',
          refresh_interval: 8
        },
        {
          id: 'marketing-influencers',
          type: 'twitter',
          url: 'from:neilpatel OR from:ahrefs OR from:randfish',
          category: 'Marketing Influencers',
          theme: 'Marketing',
          refresh_interval: 12
        },
        {
          id: 'language-learning-twitter',
          type: 'twitter',
          url: 'search:language learning OR polyglot lang:en -is:retweet',
          category: 'Language Learning',
          theme: 'Education',
          refresh_interval: 24
        }
      ]
    };

    fs.writeFileSync(feedsFile, JSON.stringify(sampleFeeds, null, 2));
    fs.writeFileSync(redditFile, JSON.stringify(sampleReddit, null, 2));
    fs.writeFileSync(twitterFile, JSON.stringify(sampleTwitter, null, 2));
  }

  /**
   * Load sources from configuration files
   */
  private loadSources() {
    if (!this.isEnabled) {
      logger.warn('Market scanner is disabled due to initialization errors');
      return;
    }

    try {
      const files = ['feeds.json', 'reddit.json', 'twitter.json'];
      this.sources = [];

      for (const file of files) {
        const filePath = path.join(this.dataDir, file);
        if (fs.existsSync(filePath)) {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SourceFile;
          this.sources.push(...data.sources);
        }
      }

      logger.info(`Loaded ${this.sources.length} sources for market scanning`);
    } catch (error) {
      logger.error('Error loading market scanner sources:', error);
    }
  }

  /**
   * Check if a source needs to be refreshed based on its refresh interval
   */
  private shouldRefreshSource(source: Source): boolean {
    if (!source.last_checked) return true;

    const lastChecked = new Date(source.last_checked);
    const now = new Date();
    const hoursSinceLastCheck = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceLastCheck >= source.refresh_interval;
  }

  /**
   * Update the last_checked timestamp for a source
   */
  private updateSourceTimestamp(sourceId: string) {
    for (const sourceFile of ['feeds.json', 'reddit.json', 'twitter.json']) {
      const filePath = path.join(this.dataDir, sourceFile);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SourceFile;
        
        const sourceIndex = data.sources.findIndex(s => s.id === sourceId);
        if (sourceIndex !== -1) {
          data.sources[sourceIndex].last_checked = new Date().toISOString();
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
          return;
        }
      }
    }
  }

  /**
   * Scan RSS feeds
   */
  private async scanRssSource(source: Source): Promise<MarketSignal[]> {
    try {
      const feed = await this.rssParser.parseURL(source.url);
      const signals: MarketSignal[] = [];

      for (const item of feed.items.slice(0, 10)) { // Limit to 10 most recent items
        signals.push({
          title: item.title || 'No title',
          content: item.content || item.contentSnippet || 'No content',
          source: feed.title || source.url,
          sourceType: 'RSS',
          category: source.category,
          theme: source.theme,
          url: item.link || source.url,
          published: item.isoDate ? new Date(item.isoDate) : new Date(),
          retrieved: new Date()
        });
      }

      logger.info(`Scanned RSS source ${source.id} and found ${signals.length} items`);
      return signals;
    } catch (error) {
      logger.error(`Error scanning RSS source ${source.id}:`, error);
      return [];
    }
  }

  /**
   * Scan Reddit (enhanced scraping implementation)
   */
  private async scanRedditSource(source: Source): Promise<MarketSignal[]> {
    try {
      logger.info(`Scanning Reddit source: ${source.url}`);
      
      // Extract subreddit name - ensure it doesn't have r/ prefix in the URL
      const subredditName = source.url.replace(/^r\//, '');
      
      // Try multiple endpoints in case one fails
      const endpoints = [
        `https://www.reddit.com/r/${subredditName}/hot.json?limit=10`,
        `https://www.reddit.com/r/${subredditName}/top.json?t=week&limit=10`,
        `https://old.reddit.com/r/${subredditName}.json?limit=10`
      ];
      
      let responseData = null;
      let successfulEndpoint = '';
      
      // Try each endpoint until one works
      for (const endpoint of endpoints) {
        try {
          // Use a more browser-like User-Agent to avoid being blocked
          const response = await fetch(endpoint, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
              'Accept': 'application/json',
              'Accept-Language': 'en-US,en;q=0.9',
              'Connection': 'keep-alive'
            }
          });
          
          if (response.ok) {
            responseData = await response.json();
            successfulEndpoint = endpoint;
            break;
          }
        } catch (endpointError) {
          logger.warn(`Failed to fetch from Reddit endpoint ${endpoint}:`, endpointError);
          // Continue to the next endpoint
        }
      }
      
      if (!responseData) {
        logger.error(`All Reddit API endpoints failed for subreddit: ${subredditName}`);
        return [];
      }
      
      logger.info(`Successfully fetched Reddit data from: ${successfulEndpoint}`);
      const signals: MarketSignal[] = [];

      if (responseData.data && responseData.data.children) {
        for (const post of responseData.data.children) {
          const { data: postData } = post;
          
          // Skip ads, pinned posts or removed content
          if (postData.promoted || postData.stickied || postData.removed || postData.over_18) {
            continue;
          }
          
          // Format content for better readability
          let content = postData.selftext || '';
          if (content.length === 0 && postData.url) {
            content = `Link: ${postData.url}`;
          }
          
          // Truncate content if it's too long
          if (content.length > 1000) {
            content = content.substring(0, 1000) + '... (content truncated)';
          }
          
          // Process content to clean up any markdown or HTML
          content = content.replace(/&amp;/g, '&')
                          .replace(/&lt;/g, '<')
                          .replace(/&gt;/g, '>')
                          .replace(/&quot;/g, '"')
                          .replace(/&apos;/g, "'");
          
          // Add engagement metrics
          content += `\n\nUpvotes: ${postData.ups || 0}, Comments: ${postData.num_comments || 0}`;
          if (postData.awards_received) {
            content += `, Awards: ${postData.awards_received}`;
          }
          
          signals.push({
            title: postData.title || 'No title',
            content: content,
            source: `Reddit - r/${subredditName}`,
            sourceType: 'Reddit',
            category: source.category,
            theme: source.theme,
            url: `https://www.reddit.com${postData.permalink}`,
            published: new Date(postData.created_utc * 1000),
            retrieved: new Date()
          });
        }
      }

      logger.info(`Scanned Reddit source ${source.id} and found ${signals.length} items`);
      return signals;
    } catch (error) {
      logger.error(`Error scanning Reddit source ${source.id}:`, error);
      return [];
    }
  }

  /**
   * Scan Twitter/X using improved scraping approach with multiple fallbacks
   */
  private async scanTwitterSource(source: Source): Promise<MarketSignal[]> {
    try {
      logger.info(`Scanning Twitter source: ${source.url}`);
      
      // Parse the search query from the URL
      const searchQuery = source.url.replace('search:', '').trim();
      if (!searchQuery) {
        logger.warn(`Invalid Twitter source format: ${source.url}. Should be "search:query"`);
        return [];
      }
      
      const encodedQuery = encodeURIComponent(searchQuery);
      
      // Define multiple alternative frontends to try
      const endpoints = [
        {
          name: 'Nitter.net',
          url: `https://nitter.net/search?f=tweets&q=${encodedQuery}&since=7d`,
          tweetSelector: '.timeline-item',
          contentSelector: '.tweet-content',
          authorSelector: '.username',
          dateSelector: '.tweet-date a',
          linkSelector: '.tweet-link'
        },
        {
          name: 'Nitter.lacontrevoie.fr',
          url: `https://nitter.lacontrevoie.fr/search?f=tweets&q=${encodedQuery}&since=7d`,
          tweetSelector: '.timeline-item',
          contentSelector: '.tweet-content',
          authorSelector: '.username',
          dateSelector: '.tweet-date a',
          linkSelector: '.tweet-link'
        }
      ];
      
      let html = '';
      let successfulEndpoint = null;
      
      // Try each endpoint until one works
      for (const endpoint of endpoints) {
        try {
          logger.info(`Trying Twitter scraping endpoint: ${endpoint.name}`);
          
          // Use a more browser-like User-Agent with rotating properties
          const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:95.0) Gecko/20100101 Firefox/95.0'
          ];
          
          const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
          
          const response = await fetch(endpoint.url, {
            headers: {
              'User-Agent': randomUserAgent,
              'Accept': 'text/html,application/xhtml+xml,application/xml',
              'Accept-Language': 'en-US,en;q=0.9',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          if (response.ok) {
            html = await response.text();
            successfulEndpoint = endpoint;
            logger.info(`Successfully scraped Twitter data from: ${endpoint.name}`);
            break;
          }
        } catch (endpointError) {
          logger.warn(`Failed to fetch from Twitter endpoint ${endpoint.name}:`, endpointError);
          // Continue to the next endpoint
        }
      }
      
      if (!html || !successfulEndpoint) {
        logger.error(`All Twitter scraping endpoints failed for query: ${searchQuery}`);
        return this.getTwitterFallbackResult(source, searchQuery, encodedQuery);
      }
      
      // Extract tweets using regex - ideally would use a DOM parser in production
      const tweets: MarketSignal[] = [];
      
      // Extract tweet content, authors and dates using the selectors for the successful endpoint
      const contentRegex = new RegExp(`<div class="${successfulEndpoint.contentSelector.replace('.', '')}[^>]*>(.*?)<\\/div>`, 'gs');
      const authorRegex = new RegExp(`<a[^>]*class="${successfulEndpoint.authorSelector.replace('.', '')}"[^>]*>@([^<]+)<\\/a>`, 'gs');
      const dateRegex = new RegExp(`<${successfulEndpoint.dateSelector.replace('.', '').replace(' ', '[^>]*')}[^>]*>([^<]+)<\\/a>`, 'gs');
      const linkRegex = new RegExp(`<a[^>]*class="${successfulEndpoint.linkSelector.replace('.', '')}"[^>]*href="([^"]+)"`, 'gs');
      
      let contents: string[] = [];
      let authors: string[] = [];
      let dates: string[] = [];
      let links: string[] = [];
      let match;
      
      // Extract tweet contents
      while ((match = contentRegex.exec(html)) !== null) {
        let content = match[1].trim();
        // Clean up HTML entities and tags
        content = content.replace(/<[^>]*>/g, ' ')
                         .replace(/&amp;/g, '&')
                         .replace(/&lt;/g, '<')
                         .replace(/&gt;/g, '>')
                         .replace(/&quot;/g, '"')
                         .replace(/&apos;/g, "'")
                         .replace(/\s+/g, ' ');
        contents.push(content);
      }
      
      // Extract authors
      while ((match = authorRegex.exec(html)) !== null) {
        authors.push(match[1].trim());
      }
      
      // Extract dates
      while ((match = dateRegex.exec(html)) !== null) {
        dates.push(match[1].trim());
      }
      
      // Extract links
      while ((match = linkRegex.exec(html)) !== null) {
        links.push(match[1].trim());
      }
      
      // Combine the results
      const limit = Math.min(10, contents.length); // Get up to 10 tweets
      for (let i = 0; i < limit; i++) {
        if (contents[i]) {
          const author = authors[i] || 'unknown';
          const date = dates[i] || 'recent';
          const tweetUrl = links[i] ? 
            (links[i].startsWith('http') ? links[i] : `https://twitter.com${links[i]}`) : 
            `https://twitter.com/search?q=${encodedQuery}`;
          
          tweets.push({
            title: `Tweet by @${author}`,
            content: `${contents[i]}\n\nPosted: ${date}`,
            source: `Twitter - ${searchQuery}`,
            sourceType: 'Twitter',
            category: source.category,
            theme: source.theme,
            url: tweetUrl,
            published: this.parseTweetDate(date),
            retrieved: new Date()
          });
        }
      }
      
      // Return results if we found any
      if (tweets.length > 0) {
        logger.info(`Scanned Twitter source ${source.id} and found ${tweets.length} items`);
        return tweets;
      } else {
        logger.warn(`Twitter scraping found no results for ${searchQuery}`);
        return this.getTwitterFallbackResult(source, searchQuery, encodedQuery);
      }
    } catch (error) {
      logger.error(`Error scanning Twitter source ${source.id}:`, error);
      return this.getTwitterFallbackResult(source, source.url, encodeURIComponent(source.url.replace('search:', '')));
    }
  }
  
  /**
   * Helper method to parse Twitter dates
   */
  private parseTweetDate(dateStr: string): Date {
    try {
      // Handle relative dates like "2d", "5h", etc.
      if (/^\d+[smhdw]$/.test(dateStr)) {
        const now = new Date();
        const value = parseInt(dateStr.slice(0, -1));
        const unit = dateStr.slice(-1);
        
        switch (unit) {
          case 's': return new Date(now.getTime() - value * 1000);
          case 'm': return new Date(now.getTime() - value * 60 * 1000);
          case 'h': return new Date(now.getTime() - value * 60 * 60 * 1000);
          case 'd': return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
          case 'w': return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
        }
      }
      
      // Handle actual date strings
      return new Date(dateStr);
    } catch (e) {
      return new Date(); // Fallback to current date
    }
  }
  
  /**
   * Create fallback results when Twitter scraping fails
   */
  private getTwitterFallbackResult(source: Source, searchQuery: string, encodedQuery: string): MarketSignal[] {
    return [{
      title: `Twitter search for: ${searchQuery}`,
      content: `Unable to retrieve live Twitter data for "${searchQuery}". This is a placeholder result. The Twitter scraping feature encountered technical limitations. For production use, consider implementing the official Twitter API.`,
      source: `Twitter - ${searchQuery}`,
      sourceType: 'Twitter',
      category: source.category,
      theme: source.theme,
      url: `https://twitter.com/search?q=${encodedQuery}`,
      published: new Date(),
      retrieved: new Date()
    }];
  }

  /**
   * Summarize a batch of market signals into a concise insight
   */
  private async summarizeSignals(signals: MarketSignal[], category: string): Promise<string> {
    // Construct a prompt to summarize the signals
    const signalTexts = signals.map(s => `${s.title}: ${s.content.substring(0, 200)}...`);
    
    // In a real implementation, you would use the LLM to summarize
    // For now, just return a basic summary
    return `Market Scan Summary for ${category} - ${new Date().toLocaleDateString()}:\n\n` +
           `Analyzed ${signals.length} recent items from various sources related to ${category}.\n\n` +
           `Key items:\n${signalTexts.slice(0, 3).join('\n\n')}`;
  }

  /**
   * Save a market signal to memory
   */
  private async saveSignalToMemory(signal: MarketSignal, summary: string) {
    try {
      const content = `${signal.title}\n\n${signal.content}\n\nSource: ${signal.source} (${signal.sourceType})`;
      const metadata = {
        type: 'market_signal',
        category: signal.category,
        theme: signal.theme,
        source: signal.source,
        sourceType: signal.sourceType,
        url: signal.url,
        published: signal.published.toISOString(),
        retrieved: signal.retrieved.toISOString(),
        summary
      };
      
      // Add to memory with high importance
      await qdrantAddMemory('document', content, metadata);
      
      logger.info(`Saved market signal "${signal.title}" to memory`);
    } catch (error) {
      logger.error('Error saving market signal to memory:', error);
    }
  }

  /**
   * Run a market scan across all sources or specific categories
   */
  async runMarketScan(categories?: string[]): Promise<number> {
    if (!this.isEnabled) {
      logger.warn('Attempted to run market scan but scanner is disabled');
      return 0;
    }

    let scanCount = 0;
    const filteredSources = categories 
      ? this.sources.filter(source => categories.includes(source.category))
      : this.sources;
    
    for (const source of filteredSources) {
      if (!this.shouldRefreshSource(source)) {
        logger.info(`Skipping source ${source.id}, next refresh in ${source.refresh_interval} hours`);
        continue;
      }
      
      let signals: MarketSignal[] = [];
      
      switch (source.type) {
        case 'rss':
          signals = await this.scanRssSource(source);
          break;
        case 'reddit':
          signals = await this.scanRedditSource(source);
          break;
        case 'twitter':
          signals = await this.scanTwitterSource(source);
          break;
      }
      
      if (signals.length > 0) {
        // Summarize signals from this source
        const summary = await this.summarizeSignals(signals, source.category);
        
        // Save each signal to memory
        for (const signal of signals) {
          await this.saveSignalToMemory(signal, summary);
          scanCount++;
        }
        
        // Update the last_checked timestamp
        this.updateSourceTimestamp(source.id);
      }
    }
    
    logger.info(`Market scan complete, processed ${scanCount} signals`);
    return scanCount;
  }
}

// Export a factory function to create the scanner
export const createMarketScanner = (): MarketScanner => {
  return new MarketScanner();
}; 