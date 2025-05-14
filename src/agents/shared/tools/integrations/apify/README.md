# Apify Integration

This directory contains the implementation of the Apify integration for the agent system. The integration provides a type-safe, interface-first approach to working with the Apify platform for web scraping operations.

## Components

### 1. Interfaces

- `IApifyManager`: The core interface that defines the contract for any Apify manager implementation.
- `ApifyToolInput`: Interface for input to Apify actors.
- `ApifyToolResult`: Interface for results from Apify actor runs.
- `ApifyLimitContext`: Interface for context when requesting higher limits.
- `ApifyLimitResult`: Interface for results of higher limit requests.
- `ApifyActorMetadata`: Interface for metadata about Apify actors.
- `ActorDiscoveryOptions`: Interface for options when discovering actors.

### 2. Implementation

- `DefaultApifyManager`: Concrete implementation of the `IApifyManager` interface.
- `ApifyError`: Custom error class for Apify operations.

### 3. Tool Factory

- `ApifyToolFactory`: Factory function for creating Apify tools that can be registered with the agent tool system.
- `createDynamicApifyTool`: Function for creating dynamic tool definitions from discovered actors.

## Usage

### Basic Usage

```typescript
import { defaultApifyManager } from 'src/agents/shared/tools/integrations/apify';

// Use the default singleton instance
const results = await defaultApifyManager.runRedditSearch('artificial intelligence', false, 20);
```

### Creating a Custom Instance

```typescript
import { DefaultApifyManager } from 'src/agents/shared/tools/integrations/apify';

const customManager = new DefaultApifyManager();
const results = await customManager.runTwitterSearch('machine learning', false, 15);
```

### Tool Registration

```typescript
import { createApifyTools } from 'src/agents/shared/tools/integrations/apify';
import { defaultApifyManager } from 'src/agents/shared/tools/integrations/apify';

// Create tool definitions
const apifyTools = createApifyTools(defaultApifyManager);

// Register with the tool system
toolManager.registerTools(apifyTools);
```

### Actor Discovery

```typescript
import { defaultApifyManager } from 'src/agents/shared/tools/integrations/apify';

// Discover actors by search term
const actors = await defaultApifyManager.discoverActors('web scraping', {
  category: 'Web Scraping',
  limit: 5,
  usageTier: 'free'
});

// Get detailed information about a specific actor
const actorInfo = await defaultApifyManager.getActorInfo('apify/web-scraper');

// Get actor suggestions based on a task description
const suggestions = await defaultApifyManager.suggestActorsForTask(
  'I need to extract product information from Amazon product pages'
);
```

### Dynamic Tool Generation

```typescript
import { createDynamicApifyTool } from 'src/agents/shared/tools/integrations/apify';
import { defaultApifyManager } from 'src/agents/shared/tools/integrations/apify';

// Discover an actor
const actors = await defaultApifyManager.discoverActors('amazon scraper');
const amazonActor = actors[0];

// Create a dynamic tool from the actor
const amazonScraperTool = createDynamicApifyTool(defaultApifyManager, amazonActor);

// Register the dynamic tool
toolManager.registerTool(amazonScraperTool);
```

## Supported Operations

The Apify integration supports the following operations:

1. **Reddit Search**: Search for posts on Reddit on specific topics.
2. **Twitter Search**: Search for tweets on specific topics.
3. **Website Crawler**: Crawl websites to extract content and information.
4. **YouTube Search**: Search for videos on YouTube.
5. **Instagram Scraper**: Scrape profiles and posts from Instagram.
6. **TikTok Scraper**: Scrape content from TikTok by username, hashtag, or keyword.
7. **Actor Discovery**: Discover Apify actors based on search criteria.
8. **Actor Suggestions**: Get actor suggestions based on task descriptions.
9. **Dynamic Actor Execution**: Run any discovered Apify actor with custom parameters.

## New Agent Discovery Tools

The following tools enable agents to discover and run Apify actors:

1. **apify-actor-discovery**: Search for Apify actors by query or category.
2. **apify-suggest-actors**: Get actor suggestions based on a task description.
3. **apify-actor-info**: Get detailed information about a specific actor.
4. **apify-dynamic-run**: Run any Apify actor with custom input parameters.

## Implementation Approach

The implementation follows the project's core principles:

1. **Interface-First Design**: The core interfaces define the contract for all implementations.
2. **Strict Type Safety**: No `any` types are used, all operations are properly typed.
3. **Clean Break Principles**: The implementation is completely decoupled from the original Chloe implementation.
4. **Dependency Injection**: The tool factory takes an `IApifyManager` instance, allowing for different implementations or testing mocks.

## Actor Discovery System Design

The actor discovery system is designed with several components:

1. **Metadata Model**: Comprehensive `ApifyActorMetadata` interface capturing all relevant actor information.
2. **Discovery API**: Methods for searching, filtering, and retrieving actor information.
3. **Suggestion Algorithm**: Relevance scoring system to match actors to task descriptions.
4. **Dynamic Schema Generation**: Automatic Zod schema generation from actor input schemas.
5. **Dynamic Tool Creation**: Factory function to create tool definitions from discovered actors.

## Status

- ✅ Core interfaces defined
- ✅ Skeleton implementation with proper error handling
- ✅ Tool factory for creating tool definitions
- ✅ Comprehensive test suite
- ✅ Actor discovery system implementation
- ✅ Dynamic tool generation
- 🟡 Complete implementation of all Apify actor methods
- 🔴 Update tool registration to use the new implementation

## Future Enhancements

1. **Full API Implementation**: Complete the implementation of all Apify actor methods.
2. **Rate Limiting**: Add more sophisticated rate limiting and quota management.
3. **Caching**: Add caching for commonly used queries to improve performance and reduce API calls.
4. **More Actors**: Support for additional Apify actors as needed.
5. **Schema Inference**: Enhanced schema generation from actor executions.
6. **Result Type Mapping**: Better mapping of actor outputs to structured types.
7. **Result Visualization**: Specialized formatters for different actor output types. 