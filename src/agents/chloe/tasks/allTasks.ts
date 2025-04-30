import { ChloeAgent } from '../core/agent';
import { logger } from '../../../lib/logging';

/**
 * Run a targeted news scan task that checks for recent news in marketing-related categories
 * @param agent The ChloeAgent instance
 * @returns Promise resolving to boolean indicating success
 */
export async function runNewsScanTask(agent: ChloeAgent): Promise<boolean> {
  try {
    logger.info('Running news scan task via agent scheduler');
    
    // Trigger the news scan API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const marketScanUrl = new URL('/api/market-scan', baseUrl).toString();
    
    // Execute a news scan across multiple marketing-related categories
    const categories = ['marketing', 'social_media', 'digital_marketing', 'content_marketing'];
    const results = [];
    
    for (const category of categories) {
      try {
        logger.info(`Running news scan for category: ${category}`);
        const response = await fetch(marketScanUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'news-scan',
            payload: { category }
          })
        });
        
        const result = await response.json();
        
        if (result.success && result.result) {
          logger.info(`News scan for ${category} found ${result.result.count} results`);
          
          // Add category results to overall results
          if (result.result.count > 0) {
            results.push({
              category,
              items: result.result.results,
              count: result.result.count
            });
          }
        }
      } catch (categoryError) {
        logger.error(`Error scanning ${category} news:`, categoryError);
      }
    }
    
    // If we have results, reflect on them to generate insights
    if (results.length > 0) {
      // Collect top news items from each category
      const newsHighlights = results
        .map(categoryResult => {
          const topItems = categoryResult.items.slice(0, 3); // Take top 3 from each category
          return `### ${categoryResult.category.toUpperCase()} (${categoryResult.count} items found):\n` + 
            topItems.map((item: any) => `- ${item.title}`).join('\n');
        })
        .join('\n\n');
      
      // Reflect on the news to generate insights
      await agent.reflect(
        `I found these news items in my targeted news scan. What insights can I draw from them?\n\n${newsHighlights}`
      );
    }
    
    // Store a memory about the news scan
    await agent.reflect(
      'I completed a targeted news scan across marketing, social media, digital marketing, and content marketing categories. New information has been flagged in our knowledge base.'
    );
    
    logger.info('News scan task completed successfully');
    return true;
  } catch (error) {
    logger.error('Error running news scan task:', error);
    return false;
  }
}

/**
 * Research trending topics in marketing and related areas
 * @param agent The ChloeAgent instance
 * @returns Promise resolving to boolean indicating success
 */
export async function runTrendingTopicResearchTask(agent: ChloeAgent): Promise<boolean> {
  try {
    logger.info('Running trending topic research task via agent scheduler');
    
    // Trigger the market scan API for trending topics
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const marketScanUrl = new URL('/api/market-scan', baseUrl).toString();
    
    // Detect trending topics
    logger.info('Detecting trending topics in marketing');
    try {
      const response = await fetch(marketScanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'detect-trends',
          payload: { domain: 'marketing' }
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.topics) {
        logger.info(`Found ${result.topics.length} trending topics`);
        
        // Research each trending topic
        for (const topic of result.topics) {
          try {
            logger.info(`Researching trending topic: ${topic}`);
            
            // For each trending topic, run a deep dive research
            const researchResponse = await fetch(marketScanUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                action: 'research-scan',
                payload: { topic }
              })
            });
            
            const researchResult = await researchResponse.json();
            
            if (researchResult.success) {
              logger.info(`Successfully researched topic: ${topic}`);
            }
          } catch (topicError) {
            logger.error(`Error researching topic ${topic}:`, topicError);
          }
        }
        
        // Reflect on discovered trends
        await agent.reflect(
          `I've analyzed the following trending topics in marketing: ${result.topics.join(', ')}. These trends could influence our marketing strategy and content planning. I should consider incorporating these insights into our upcoming campaigns.`
        );
      }
    } catch (error) {
      logger.error('Error detecting trending topics:', error);
    }
    
    // Store a memory about the research conducted
    await agent.reflect(
      'I completed research on current trending topics in marketing. These insights have been flagged in our knowledge base and can inform future content strategy and campaign planning.'
    );
    
    logger.info('Trending topic research task completed successfully');
    return true;
  } catch (error) {
    logger.error('Error running trending topic research task:', error);
    return false;
  }
}

/**
 * Monitor social media trends and conversations
 * @param agent The ChloeAgent instance
 * @returns Promise resolving to boolean indicating success
 */
export async function runSocialMediaTrendsTask(agent: ChloeAgent): Promise<boolean> {
  try {
    logger.info('Running social media trends analysis via agent scheduler');
    
    // Trigger the market scan API for social media monitoring
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const marketScanUrl = new URL('/api/market-scan', baseUrl).toString();
    
    // Monitor key social platforms
    const platforms = ['twitter', 'linkedin', 'instagram', 'tiktok', 'reddit'];
    const results = [];
    
    for (const platform of platforms) {
      try {
        logger.info(`Analyzing social media trends on ${platform}`);
        const response = await fetch(marketScanUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'social-trends',
            payload: { platform }
          })
        });
        
        const result = await response.json();
        
        if (result.success && result.trends) {
          logger.info(`Found ${result.trends.length} trends on ${platform}`);
          
          // Add platform results to overall results
          if (result.trends.length > 0) {
            results.push({
              platform,
              trends: result.trends,
              count: result.trends.length
            });
          }
        }
      } catch (platformError) {
        logger.error(`Error analyzing trends on ${platform}:`, platformError);
      }
    }
    
    // If we have results, reflect on them to generate insights
    if (results.length > 0) {
      // Format social trend highlights
      const trendHighlights = results
        .map(platformResult => {
          const topTrends = platformResult.trends.slice(0, 5); // Take top 5 from each platform
          return `### ${platformResult.platform.toUpperCase()} Trends:\n` + 
            topTrends.map((trend: any) => `- ${trend.topic} (${trend.engagement} engagement)`).join('\n');
        })
        .join('\n\n');
      
      // Reflect on the social trends
      await agent.reflect(
        `I analyzed trending conversations across social media platforms. Here are the key trends I found:\n\n${trendHighlights}\n\nHow can we leverage these trends in our marketing strategy?`
      );
    }
    
    // Store a memory about the social media analysis
    await agent.reflect(
      'I completed an analysis of current social media trends across major platforms. These insights can help us identify opportunities for timely content creation and engagement.'
    );
    
    logger.info('Social media trends analysis task completed successfully');
    return true;
  } catch (error) {
    logger.error('Error running social media trends analysis task:', error);
    return false;
  }
} 