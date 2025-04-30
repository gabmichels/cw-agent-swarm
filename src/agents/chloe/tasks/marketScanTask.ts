import { ChloeAgent } from '../agent';
import { logger } from '../../../lib/logging';

/**
 * Execute a full market scan task using the market-scan API
 */
export async function runMarketScanTask(agent: ChloeAgent): Promise<boolean> {
  try {
    logger.info('Running market scan task via agent scheduler');
    
    // For autonomy, we're going to trigger the market scan APIs and process the results
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    // Run comprehensive market scan
    const marketScanUrl = new URL('/api/market-scan', baseUrl).toString();
    
    // First, ensure autonomy mode is enabled
    logger.info('Enabling market scan autonomy mode');
    try {
      await fetch(marketScanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'set-autonomy-mode',
          payload: { enabled: true }
        })
      });
    } catch (error) {
      logger.error('Error enabling market scan autonomy mode:', error);
    }
    
    // Execute a news scan
    logger.info('Running news scan');
    try {
      const newsResponse = await fetch(marketScanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'news-scan',
          payload: {}
        })
      });
      
      const newsResult = await newsResponse.json();
      logger.info(`News scan complete: ${newsResult.success ? 'Success' : 'Failed'}`);
      
      if (newsResult.success && newsResult.result) {
        logger.info(`News scan found ${newsResult.result.count} results`);
        
        // Reflect on the news scan results to generate insights
        if (newsResult.result.count > 0) {
          const titles = newsResult.result.results.map((item: any) => item.title).join('\n- ');
          await agent.reflect(
            `I found these news items in my market scan. What insights can I draw from them?\n- ${titles}`
          );
        }
      }
    } catch (error) {
      logger.error('Error running news scan:', error);
    }
    
    // Run trending topic detection
    logger.info('Detecting trending topics');
    try {
      const trendResponse = await fetch(`${marketScanUrl}?action=trending`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const trendResult = await trendResponse.json();
      logger.info(`Trend detection complete: ${trendResult.success ? 'Success' : 'Failed'}`);
      
      if (trendResult.success && trendResult.topics && trendResult.topics.length > 0) {
        logger.info(`Found ${trendResult.topics.length} trending topics`);
        
        // Reflect on trending topics
        const topics = trendResult.topics.join('\n- ');
        await agent.reflect(
          `I identified these trending topics in my market scan. How should they influence our marketing strategy?\n- ${topics}`
        );
        
        // Research each trending topic
        for (const topic of trendResult.topics) {
          try {
            logger.info(`Researching trending topic: ${topic}`);
            await fetch(marketScanUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                action: 'web-search',
                payload: {
                  query: topic,
                  category: 'trending_topics'
                }
              })
            });
          } catch (topicError) {
            logger.error(`Error researching topic ${topic}:`, topicError);
          }
        }
      }
    } catch (error) {
      logger.error('Error detecting trending topics:', error);
    }
    
    // Run active search queries
    logger.info('Running search queries');
    try {
      const queriesResponse = await fetch(`${marketScanUrl}?action=queries`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const queriesResult = await queriesResponse.json();
      
      if (queriesResult.success && queriesResult.queries) {
        const highImportanceQueries = queriesResult.queries
          .filter((q: any) => q.importance === 'high' && q.enabled);
          
        logger.info(`Found ${highImportanceQueries.length} high importance queries to run`);
        
        // Run each high importance query
        for (const query of highImportanceQueries) {
          try {
            logger.info(`Running high importance query: ${query.query}`);
            await fetch(marketScanUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                action: 'run-query-now',
                payload: {
                  id: query.id
                }
              })
            });
          } catch (queryError) {
            logger.error(`Error running query ${query.query}:`, queryError);
          }
        }
      }
    } catch (error) {
      logger.error('Error running search queries:', error);
    }
    
    // Store a memory about the market scan
    await agent.reflect(
      'I completed a comprehensive market scan, analyzing news sources, detecting trending topics, and running high-importance search queries. The insights have been flagged in our knowledge base for review and analysis.'
    );
    
    logger.info('Market scan task completed successfully');
    return true;
  } catch (error) {
    logger.error('Error running market scan task:', error);
    return false;
  }
}

/**
 * Execute a news scanning task
 */
export async function runNewsScanTask(agent: ChloeAgent): Promise<boolean> {
  try {
    logger.info('Running news scan task via agent scheduler');
    
    // Trigger the news scan API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const marketScanUrl = new URL('/api/market-scan', baseUrl).toString();
    
    // Execute a news scan
    const categories = ['marketing', 'social_media', 'digital_marketing', 'content_marketing'];
    
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
        }
      } catch (categoryError) {
        logger.error(`Error scanning ${category} news:`, categoryError);
      }
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
 * Execute a trending topic research task
 */
export async function runTrendingTopicResearchTask(agent: ChloeAgent): Promise<boolean> {
  try {
    logger.info('Running trending topic research task via agent scheduler');
    
    // Trigger the trending topics API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const marketScanUrl = new URL('/api/market-scan', baseUrl).toString();
    
    // Get trending topics
    const trendResponse = await fetch(`${marketScanUrl}?action=trending`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const trendResult = await trendResponse.json();
    
    if (trendResult.success && trendResult.topics && trendResult.topics.length > 0) {
      logger.info(`Found ${trendResult.topics.length} trending topics`);
      
      // For each topic, run an in-depth research scan
      for (const topic of trendResult.topics) {
        try {
          logger.info(`Researching trending topic: ${topic}`);
          
          // Run web search
          await fetch(marketScanUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'web-search',
              payload: {
                query: topic,
                category: 'trending_topics'
              }
            })
          });
          
          // Run research papers search
          await fetch(marketScanUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'research-scan',
              payload: {
                topic
              }
            })
          });
          
          // Generate insights for this topic through reflection
          await agent.reflect(
            `I'm researching the trending topic "${topic}". What are the key implications for our marketing strategy? How can we leverage this trend?`
          );
        } catch (topicError) {
          logger.error(`Error researching topic ${topic}:`, topicError);
        }
      }
      
      // Generate a strategic analysis of all topics
      if (trendResult.topics.length > 0) {
        const topics = trendResult.topics.join('\n- ');
        await agent.reflect(
          `I've researched these trending topics:\n- ${topics}\n\nBased on my research, what are the top 3 strategic actions we should take to leverage these trends in our marketing?`
        );
      }
    } else {
      logger.info('No trending topics found or API call failed');
    }
    
    // Store a memory about the trending topic research
    await agent.reflect(
      'I completed an in-depth analysis of current trending topics in marketing. For each trend, I conducted web searches and research paper analysis to develop strategic insights.'
    );
    
    logger.info('Trending topic research task completed successfully');
    return true;
  } catch (error) {
    logger.error('Error running trending topic research task:', error);
    return false;
  }
}

/**
 * Execute a social media trends monitoring task
 */
export async function runSocialMediaTrendsTask(agent: ChloeAgent): Promise<boolean> {
  try {
    logger.info('Running social media trends task via agent scheduler');
    
    // Trigger the market scan API focusing on social media
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const marketScanUrl = new URL('/api/market-scan', baseUrl).toString();
    
    // Run web searches for social media platforms
    const platforms = ['Twitter', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok'];
    
    for (const platform of platforms) {
      try {
        logger.info(`Analyzing trends on ${platform}`);
        const response = await fetch(marketScanUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'web-search',
            payload: {
              query: `latest ${platform} algorithm changes and trends`,
              category: 'social_media_trends'
            }
          })
        });
        
        const result = await response.json();
        
        if (result.success && result.result) {
          logger.info(`${platform} trends search found ${result.result.count} results`);
        }
      } catch (platformError) {
        logger.error(`Error analyzing ${platform} trends:`, platformError);
      }
    }
    
    // Generate insights on social media trends
    await agent.reflect(
      'Based on my analysis of recent trends across Twitter, Facebook, Instagram, LinkedIn, and TikTok, what are the key shifts in social media algorithms and user behavior that should inform our content strategy?'
    );
    
    // Store a memory about the social media trends task
    await agent.reflect(
      'I conducted an analysis of trends across major social media platforms, examining algorithm changes, engagement patterns, and content performance. The findings have been flagged in our knowledge base to inform our social media strategy.'
    );
    
    logger.info('Social media trends task completed successfully');
    return true;
  } catch (error) {
    logger.error('Error running social media trends task:', error);
    return false;
  }
} 