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
   * Scan Reddit (fallback implementation with basic scraping)
   * In a production environment, use snoowrap or Reddit API
   */
  private async scanRedditSource(source: Source): Promise<MarketSignal[]> {
    try {
      const response = await fetch(`https://www.reddit.com/${source.url}.json`);
      const data = await response.json();
      const signals: MarketSignal[] = [];

      if (data.data && data.data.children) {
        for (const post of data.data.children.slice(0, 10)) { // Limit to 10 most recent posts
          const { data: postData } = post;
          signals.push({
            title: postData.title || 'No title',
            content: postData.selftext || `Upvotes: ${postData.ups}, Comments: ${postData.num_comments}`,
            source: `Reddit - ${source.url}`,
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
   * Scan Twitter (fallback implementation)
   * In a production environment, use X API or snscrape
   */
  private async scanTwitterSource(source: Source): Promise<MarketSignal[]> {
    // Note: This is a mock implementation since Twitter/X API access might be restricted
    // In a real implementation, you would use the X API or a scraping tool like snscrape
    logger.warn(`Twitter scanning for ${source.id} is mocked. Use X API in production.`);
    
    return [{
      title: `Market scan from Twitter source: ${source.id}`,
      content: `This is a placeholder for Twitter content from: ${source.url}. In a production environment, you would implement proper Twitter API integration or use web scraping.`,
      source: `Twitter - ${source.url}`,
      sourceType: 'Twitter',
      category: source.category,
      theme: source.theme,
      url: 'https://twitter.com/search',
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