# Apify Tools - Modular Structure

This directory contains the modular implementation of Apify tools, organized by platform and functionality.

## Structure

```
tools/
├── index.ts              # Main exports for all tool modules
├── core.ts               # Core Apify tools (discovery, dynamic execution)
├── instagram.ts          # Instagram scraping tools
├── facebook.ts           # Facebook scraping tools
├── youtube.ts            # YouTube scraping tools
├── linkedin.ts           # LinkedIn scraping tools
├── twitter.ts            # Twitter/X scraping tools
├── reddit.ts             # Reddit scraping tools
├── web-scraping.ts       # General web scraping tools
└── README.md            # This file
```

## Tool Categories

### Core Tools (`core.ts`)
- `apify-actor-discovery` - Discover actors in the Apify Store
- `apify-suggest-actors` - Get actor suggestions for specific tasks
- `apify-dynamic-run` - Run any Apify actor by ID
- `apify-actor-info` - Get detailed information about an actor

### Instagram Tools (`instagram.ts`)
- `instagram-post-scraper` - Scrape specific Instagram posts by URLs
- `instagram-hashtag-scraper` - Scrape posts by hashtags
- `instagram-profile-scraper` - Scrape user profiles and recent posts

### Facebook Tools (`facebook.ts`)
- `facebook-posts-scraper` - Scrape public Facebook posts from pages
- `facebook-pages-scraper` - Scrape business pages for company info

### YouTube Tools (`youtube.ts`)
- `youtube-channel-scraper` - Scrape channel info and recent videos
- `youtube-video-scraper` - Scrape specific videos for metrics and comments

### LinkedIn Tools (`linkedin.ts`)
- `linkedin-company-scraper` - Scrape company pages for business intelligence
- `linkedin-profile-scraper` - Scrape professional profiles
- `linkedin-jobs-scraper` - Scrape job listings by keywords/location

### Twitter Tools (`twitter.ts`)
- `apify-twitter-search` - Search Twitter/X for tweets by keywords

### Reddit Tools (`reddit.ts`)
- `apify-reddit-search` - Search Reddit for posts by keywords

### Web Scraping Tools (`web-scraping.ts`)
- `apify-website-crawler` - Crawl websites to extract content

## Adding New Tools

### 1. Adding to Existing Platform

To add a new tool to an existing platform (e.g., a new Instagram tool):

1. Open the relevant platform file (e.g., `instagram.ts`)
2. Add your new tool to the returned object in the `createXXXTools` function
3. Follow the existing pattern for tool definition

Example:
```typescript
'instagram-story-scraper': {
  name: 'instagram-story-scraper',
  description: 'Scrape Instagram stories from user profiles',
  costEstimate: 'medium',
  usageLimit: 15,
  schema: z.object({
    usernames: z.array(z.string()).min(1).max(5).describe('Instagram usernames'),
    dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
  }),
  async func(args: { usernames: string[]; dryRun?: boolean }): Promise<string> {
    // Implementation here
  }
}
```

### 2. Adding a New Platform

To add a completely new platform (e.g., TikTok):

1. Create a new file: `tiktok.ts`
2. Follow the pattern of existing platform files
3. Export a `createTikTokTools` function
4. Add the import and spread to `index.ts`
5. Add the import and spread to `../ApifyToolFactory.ts`

Example structure for `tiktok.ts`:
```typescript
/**
 * TikTok Tools - TikTok scraping and analysis tools
 */

import { z } from 'zod';
import { logger } from '../../../../../../lib/logging';
import { IApifyManager } from '../ApifyManager.interface';
import { ToolDefinition } from '../types';

export function createTikTokTools(apifyManager: IApifyManager): Record<string, ToolDefinition> {
  return {
    'tiktok-profile-scraper': {
      // Tool definition here
    }
  };
}
```

Then update `index.ts`:
```typescript
export { createTikTokTools } from './tiktok';
```

And update `../ApifyToolFactory.ts`:
```typescript
import { createTikTokTools } from './tools';

// In createApifyTools function:
...createTikTokTools(apifyManager),
```

## Best Practices

1. **Consistent Naming**: Use platform-specific prefixes (e.g., `instagram-`, `linkedin-`)
2. **Cost Estimates**: Set appropriate `costEstimate` ('low', 'medium', 'high')
3. **Usage Limits**: Set reasonable `usageLimit` values to prevent API abuse
4. **Error Handling**: Always wrap tool execution in try-catch blocks
5. **Parameter Validation**: Use Zod schemas for robust parameter validation
6. **Permission Requests**: For high-cost operations, request user approval
7. **Result Formatting**: Provide consistent, readable output formatting

## Cost Control Features

All tools include built-in cost control:
- **Usage Limits**: Daily/session limits per tool
- **Permission Requests**: High-cost operations require explicit approval
- **Smart Defaults**: Reasonable limits to prevent excessive API usage
- **Dry Run Support**: Test tool execution without API calls

## Integration

The modular tools are automatically integrated into the agent system through:
1. `ApifyToolFactory.ts` - Main factory that combines all modules
2. Tool registration in the agent's tool manager
3. Automatic tool selection in `DefaultPlanningManager.ts`

This modular structure makes it easy to:
- Add new social media platforms
- Maintain platform-specific tools separately
- Scale the tool ecosystem without file bloat
- Test individual platform modules independently 