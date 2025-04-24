# Chloe Power Tools Documentation

This document explains the power tools added to Chloe to enhance her market awareness and content generation capabilities.

## 1. Coda Document Integration

Chloe can now read, write, and create documents inside your Coda workspace. This is useful for content briefs, research dumps, campaign notes, and other collaborative documentation.

### Setup

1. Get a Coda API Key from your Coda account settings
2. Add the API key to your environment variables:
   ```
   CODA_API_KEY=your-coda-api-key
   ```

### Features

- **List Documents**: View all available docs in your Coda workspace
- **Read Documents**: Fetch and read the content of specific documents
- **Create Documents**: Create new markdown-style documents with titles and content
- **Update Documents**: Modify existing documents with new content

### Usage Examples

Chloe can use these commands in her planning and execution:

```
# List all documents
coda_document list

# Read a document (replace doc_id with the actual ID)
coda_document read | doc_id

# Create a new document
coda_document create | Marketing Campaign Brief | # Campaign Overview\n\nThis document outlines our Q2 marketing strategy...

# Update an existing document
coda_document update | doc_id | # Updated Content\n\nHere is the revised marketing plan...
```

## 2. Market Scanner

The Market Scanner allows Chloe to automatically scan market signals from multiple sources and analyze trends.

### Sources

Configure data sources in the `data/sources/` directory:

- **RSS Feeds**: `feeds.json` - Marketing blogs, travel sites, and industry news
- **Reddit**: `reddit.json` - Relevant subreddits for monitoring
- **Twitter**: `twitter.json` - Twitter queries and accounts to follow

Each source has a refresh interval that determines how often it's checked.

### Features

- **Automated Scanning**: Runs on a schedule (twice daily by default)
- **Multi-platform**: Collects data from RSS feeds, Reddit, and Twitter
- **Memory Integration**: Stores results in Chloe's memory for later retrieval
- **Category Filtering**: Can scan specific categories or all configured sources

### Configuration

Each source is configured with:
- **ID**: Unique identifier
- **Type**: `rss`, `reddit`, or `twitter`
- **URL**: Source URL or search query
- **Category**: Topical category (e.g., "SEO", "Travel")
- **Theme**: Higher-level theme (e.g., "Marketing", "Education")
- **Refresh Interval**: Hours between scans

### Usage Examples

Chloe can run market scans manually or rely on the scheduled tasks:

```
# Run a scan of all sources
market_scan

# Run a scan for specific categories
market_scan Travel,SEO

# Search memory for discovered trends
search_memory recent travel trends
```

## Integration with Scheduling

Both tools are integrated with Chloe's autonomy system:

1. **Market Scanner** runs twice daily (7 AM and 3 PM) to collect market intelligence
2. **Coda Document Sync** runs daily at 6 PM to update documentation with new insights

To modify these schedules, edit the `setupDefaultSchedule` function in `src/agents/chloe/scheduler.ts`.

## Dependencies

These tools require the following packages:

- `axios`: For making API requests to Coda
- `rss-parser`: For parsing RSS feeds

Make sure these are installed in your project:

```
npm install axios rss-parser
```

## Environment Variables

Required environment variables:

```
CODA_API_KEY=your-coda-api-key
```

Optional environment variables:

```
TWITTER_API_KEY=your-twitter-api-key
TWITTER_API_SECRET=your-twitter-api-secret
REDDIT_CLIENT_ID=your-reddit-client-id
REDDIT_CLIENT_SECRET=your-reddit-client-secret
```

Without these optional keys, the tools will use fallback methods for collecting data. 