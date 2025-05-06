# Standardized Memory System Deployment Guide

This guide provides instructions for deploying the standardized memory system in production, staging, and development environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Database Setup](#database-setup)
5. [Monitoring](#monitoring)
6. [Troubleshooting](#troubleshooting)
7. [Performance Optimization](#performance-optimization)

## Prerequisites

Before deploying the standardized memory system, ensure you have the following prerequisites:

- Node.js 16.x or higher
- Qdrant vector database instance (v1.0.0 or higher)
- Access to an embedding service (OpenAI or compatible alternative)
- Environment variables file (.env) with the following variables:
  - `QDRANT_URL`: URL of your Qdrant instance
  - `QDRANT_API_KEY`: API key for Qdrant (if using cloud version)
  - `OPENAI_API_KEY`: API key for OpenAI (for embeddings)
  - `MEMORY_COLLECTION_PREFIX`: Prefix for memory collections (default: 'memory')

## Installation

### Installing Dependencies

```bash
# Install dependencies
npm install

# Build the application
npm run build
```

### Setting Up Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Qdrant Configuration
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_api_key_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Memory System Configuration
MEMORY_COLLECTION_PREFIX=memory
MEMORY_DEFAULT_DIMENSION=1536
MEMORY_DEFAULT_DISTANCE=cosine
MEMORY_DEFAULT_TTL=0
```

## Configuration

### Memory Collection Configuration

The memory system uses multiple collections for different memory types. The default collections are:

- `memory_message`: For chat messages
- `memory_knowledge`: For knowledge items
- `memory_reflection`: For agent reflections
- `memory_fact`: For factual data
- `memory_file`: For file content

You can configure these collections by modifying the `src/server/memory/config.ts` file.

### Scaling Configuration

For high-traffic environments, adjust the following parameters in `src/server/memory/config.ts`:

```typescript
export const MEMORY_SEARCH_LIMIT = 1000; // Maximum search results
export const MEMORY_CACHE_TTL = 60 * 5; // Cache TTL in seconds (5 minutes)
export const MEMORY_BATCH_SIZE = 100; // Batch size for bulk operations
```

## Database Setup

### Creating Collections

Run the setup script to create and verify all required collections:

```bash
npm run memory:setup-collections
```

This script will:
1. Create all memory collections with the correct schema
2. Set up proper indexing for text and vector search
3. Verify that all collections are properly configured

### Data Migration (Optional)

If you need to migrate data from an older system, use the migration script:

```bash
npm run memory:migrate -- --source=old_db --target=new_db
```

## Monitoring

### Health Checks

The memory system provides health check endpoints to monitor its status:

- `GET /api/memory/health`: Returns the status of the memory service
- `GET /api/memory/health/collections`: Returns the status of all collections

Example health check response:

```json
{
  "status": "healthy",
  "collections": [
    {
      "name": "memory_message",
      "count": 1250,
      "status": "available"
    },
    {
      "name": "memory_knowledge",
      "count": 743,
      "status": "available"
    }
  ],
  "latency": {
    "avg": 45,
    "p95": 120,
    "p99": 200
  }
}
```

### Performance Monitoring

To monitor performance metrics:

1. Use the built-in performance logging by setting:
```
MEMORY_ENABLE_PERF_LOGS=true
```

2. Monitor logs for performance issues:
```
npm run memory:monitor
```

## Troubleshooting

### Common Issues

#### Vector Database Connection Issues

If you encounter connection issues with Qdrant:

1. Verify the Qdrant instance is running:
```bash
curl -X GET http://your-qdrant-host:6333/readiness
```

2. Check firewall settings to ensure the application can access Qdrant.

3. Verify API credentials if using a managed Qdrant instance.

#### Embedding Service Issues

If experiencing issues with embeddings:

1. Check the OpenAI API key is valid.
2. Verify rate limits haven't been exceeded.
3. Consider using a local embedding service for development.

### Error Logs

Check the error logs in the `logs` directory:

```bash
tail -f logs/memory-error.log
```

## Performance Optimization

### Caching Strategies

The memory system uses several caching strategies:

1. **In-memory cache**: For frequently accessed memories
2. **Search result cache**: To prevent redundant database queries
3. **Embedding cache**: To avoid re-computing embeddings for identical text

To adjust caching parameters, modify the cache settings in `src/server/memory/services/cacheService.ts`:

```typescript
export const CACHE_OPTIONS = {
  ttl: 60 * 5, // Cache TTL in seconds
  maxSize: 1000, // Maximum cache size
  updateAgeOnGet: true // Update item age on access
};
```

### Indexing Optimization

For large datasets, optimize indexes in Qdrant:

1. Increase the number of segments for parallel search:
```bash
curl -X PATCH http://localhost:6333/collections/memory_message -d '{"optimization": {"segments": 8}}'
```

2. Adjust the `ef` parameter for HNSW index to balance between speed and recall:
```bash
curl -X PATCH http://localhost:6333/collections/memory_message -d '{"hnsw_config": {"ef_construct": 100, "m": 16}}'
```

---

For further assistance, contact the development team or refer to the API documentation.

## Updates and Maintenance

### Applying Updates

When updating the memory system:

1. Take a database backup first:
```bash
npm run memory:backup
```

2. Apply updates:
```bash
git pull
npm install
npm run build
```

3. Run migrations if needed:
```bash
npm run memory:migrate
```

4. Restart the application:
```bash
pm2 restart memory-service
``` 