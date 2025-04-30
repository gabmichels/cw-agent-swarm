import { config } from 'dotenv';
import { ApifyManager } from '../agents/chloe/tools/apifyManager';

// Load environment variables
config();

// Check if API token is available
if (!process.env.APIFY_API_KEY) {
  console.error('Error: APIFY_API_KEY environment variable is not set');
  console.error('Please add your Apify API token to the .env file:');
  console.error('APIFY_API_KEY=your_api_token_here');
  process.exit(1);
}

// Instantiate the ApifyManager
const apify = new ApifyManager();

// Test function to try different Apify actors
async function runApifyTests() {
  try {
    console.log('🔍 Testing Apify integration with crypto search...\n');
    
    // Test Reddit search
    console.log('📱 Searching Reddit for "Solana"...');
    const redditResults = await apify.runRedditSearch('Solana');
    
    if (redditResults.success && redditResults.output) {
      const posts = redditResults.output;
      console.log(`✅ Found ${posts.length} Reddit posts about Solana`);
      
      // Display the top 5 posts
      if (posts.length > 0) {
        console.log('\nTop Reddit posts:');
        posts.slice(0, 5).forEach((post: any, index: number) => {
          console.log(`[${index + 1}] ${post.title || 'Untitled'}`);
          console.log(`   Subreddit: ${post.community || 'unknown'}`);
          console.log(`   Score: ${post.score || 'N/A'}`);
          console.log(`   URL: ${post.url || 'N/A'}\n`);
        });
      }
    } else {
      console.log('❌ Failed to search Reddit');
    }
    
    // Test Twitter search (if time permits)
    console.log('\n🐦 Searching Twitter for "Solana"...');
    const twitterResults = await apify.runTwitterSearch('Solana');
    
    if (twitterResults.success && twitterResults.output) {
      const tweets = twitterResults.output;
      console.log(`✅ Found ${tweets.length} tweets about Solana`);
      
      // Display the top 5 tweets
      if (tweets.length > 0) {
        console.log('\nTop tweets:');
        tweets.slice(0, 5).forEach((tweet: any, index: number) => {
          console.log(`[${index + 1}] @${tweet.username || 'unknown'}: ${tweet.text?.substring(0, 100) || 'No content'}${tweet.text?.length > 100 ? '...' : ''}`);
          console.log(`   Likes: ${tweet.likeCount || 0}, Retweets: ${tweet.retweetCount || 0}`);
          console.log(`   Date: ${tweet.date || 'N/A'}\n`);
        });
      }
    } else {
      console.log('❌ Failed to search Twitter');
    }
    
    // Test Instagram scraper
    console.log('\n📸 Scraping Instagram profile for "solana"...');
    const instagramResults = await apify.runInstagramScraper('solana');
    
    if (instagramResults.success && instagramResults.output) {
      const data = instagramResults.output;
      console.log(`✅ Found ${data.length} Instagram items`);
      
      // Display profile info if available
      const profileData = data.find((item: any) => item.username === 'solana');
      if (profileData) {
        console.log('\nProfile information:');
        console.log(`Username: @${profileData.username}`);
        if (profileData.fullName) console.log(`Name: ${profileData.fullName}`);
        if (profileData.biography) console.log(`Bio: ${profileData.biography}`);
        if (profileData.followersCount) console.log(`Followers: ${profileData.followersCount}`);
      }
      
      // Display posts
      const posts = data.filter((item: any) => item.type === 'post' || item.caption);
      if (posts && posts.length > 0) {
        console.log(`\nFound ${posts.length} posts`);
        
        // Display a couple of posts
        posts.slice(0, 3).forEach((post: any, index: number) => {
          console.log(`\n[${index + 1}] ${post.caption ? post.caption.substring(0, 100) + (post.caption.length > 100 ? '...' : '') : 'No caption'}`);
          if (post.likesCount) console.log(`   Likes: ${post.likesCount}`);
          if (post.commentsCount) console.log(`   Comments: ${post.commentsCount}`);
        });
      }
    } else {
      console.log('❌ Failed to scrape Instagram');
    }
    
    // Test TikTok scraper
    console.log('\n🎵 Scraping TikTok content for "#solana"...');
    const tiktokResults = await apify.runTikTokScraper('#solana');
    
    if (tiktokResults.success && tiktokResults.output) {
      const items = tiktokResults.output;
      console.log(`✅ Found ${items.length} TikTok items`);
      
      // Display a few TikTok videos
      if (items.length > 0) {
        console.log('\nTop TikTok videos:');
        items.slice(0, 3).forEach((item: any, index: number) => {
          console.log(`[${index + 1}] ${item.desc ? item.desc.substring(0, 100) + (item.desc.length > 100 ? '...' : '') : 'No description'}`);
          
          if (item.authorMeta && item.authorMeta.name) {
            console.log(`   Author: @${item.authorMeta.name}`);
          }
          
          if (item.stats) {
            if (item.stats.diggCount) console.log(`   Likes: ${item.stats.diggCount}`);
            if (item.stats.playCount) console.log(`   Views: ${item.stats.playCount}`);
          }
          
          if (item.webVideoUrl) {
            console.log(`   URL: ${item.webVideoUrl}`);
          }
          
          console.log('');
        });
      }
    } else {
      console.log('❌ Failed to scrape TikTok');
    }
    
    console.log('\n✨ Apify integration testing complete!');
    
  } catch (error) {
    console.error('Error running Apify tests:', error);
  }
}

// Run the tests
runApifyTests().catch(console.error); 