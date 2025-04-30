# Apify Integration for Chloe

This module integrates [Apify](https://apify.com/) web scraping and data extraction capabilities with Chloe's tool system, providing robust and reliable external data sources.

## Overview

The Apify integration replaces brittle custom scraping utilities with professional, maintained scraping actors from the Apify platform. These tools provide Chloe with access to:

- Reddit posts and comments
- Twitter/X tweets and trends
- Website content crawling
- YouTube videos
- Instagram profiles and posts
- TikTok videos and trends
- And many more...

## Features

- **Resilient API Calls**: Includes automatic retries, error handling, and fallbacks
- **Rate Limiting Protection**: Handles 429 errors gracefully
- **Structured Data**: Returns cleaned, formatted data from various sources
- **SimpleTool Interface**: Fully compatible with Chloe's existing tool system

## Usage

### Configuration

1. Add your Apify API token to the `.env` file:
   ```
   APIFY_API_KEY=your_apify_token_here
   ```

2. The tools are automatically registered with Chloe's tool system upon initialization.

### Available Tools

- `apify-reddit-search` - Search Reddit for posts related to a keyword or topic
- `apify-twitter-search` - Search Twitter/X for tweets related to a keyword
- `apify-website-crawler` - Crawl websites to extract content
- `apify-youtube-search` - Search YouTube for videos by keyword
- `apify-instagram-scraper` - Scrape Instagram profiles and posts by username
- `apify-tiktok-scraper` - Scrape TikTok content by username, hashtag, or keyword

### Testing

Run the test script to verify your Apify integration is working:

```bash
npx ts-node src/scripts/test-apify.ts
```

## Extension

To add more Apify actors:

1. Add a new method in the `ApifyManager` class in `apifyManager.ts`
2. Add a corresponding tool in the `createApifyTools()` function
3. Update this documentation

## Benefits Over Custom Scrapers

- **Maintenance**: Apify actors are professionally maintained to handle site changes
- **Speed**: Optimized for performance with caching and concurrency
- **Proxy Management**: Automatic IP rotation to avoid blocking
- **Compliance**: Actors follow best practices for ethical scraping

## Error Handling

The integration includes robust error handling:

- Automatic retries for failed requests
- Fallback responses when actors fail
- Detailed error reporting
- Graceful degradation when API token is missing

## Future Improvements

- Add more specialized actors for market research
- Implement caching layer to reduce API usage
- Create combined meta-search tool that aggregates multiple sources
- Add result transformation options for specific Chloe uses 