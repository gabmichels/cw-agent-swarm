/**
 * Social media tools module - Exports for social tools
 * 
 * This file provides references to social media tools implemented through Apify.
 * The actual implementations are handled by DefaultApifyManager.
 * 
 * Custom tool implementations (RedditSearchTool, RssFeedTool) have been removed
 * in favor of using the DefaultApifyManager methods directly, which provide
 * visualization support:
 * - DefaultApifyManager.runRedditSearch
 * - DefaultApifyManager.runTwitterSearch
 * - DefaultApifyManager.runApifyActor (for RSS feeds)
 */

// No direct tool implementations - these are handled by DefaultApifyManager 