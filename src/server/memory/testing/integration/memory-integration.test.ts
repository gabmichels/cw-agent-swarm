/**
 * Integration tests for memory system
 */

import { MemoryType } from '@/server/memory/config/types';
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { EmbeddingService } from '../../services/client/embedding-service';
import { QdrantMemoryClient } from '../../services/client/qdrant-client';
import { MemoryService } from '../../services/memory/memory-service';
import { EnhancedMemoryService } from '../../services/multi-agent/enhanced-memory-service';
import { SearchService } from '../../services/search/search-service';
import { loadApiKey } from '../load-api-key';

// Use environment variables or defaults
const QDRANT_URL = process.env.TEST_QDRANT_URL || 'http://localhost:6333';
const OPENAI_API_KEY = loadApiKey();

describe('Memory System Integration', () => {
  // Setup clients and services
  let client: QdrantMemoryClient;
  let embeddingService: EmbeddingService;
  let memoryService: MemoryService;
  let searchService: SearchService;

  // Store IDs for cleanup
  const createdMemoryIds: { id: string, type: MemoryType }[] = [];

  beforeAll(async () => {
    // Skip tests if OpenAI API key is not available
    if (!OPENAI_API_KEY) {
      console.warn('Skipping integration tests: No OpenAI API key provided');
      return;
    }

    console.log('Running integration tests with OpenAI API key');

    // Initialize services
    client = new QdrantMemoryClient({
      qdrantUrl: QDRANT_URL,
      openAIApiKey: OPENAI_API_KEY
    });

    embeddingService = new EmbeddingService({
      openAIApiKey: OPENAI_API_KEY,
      embeddingModel: 'text-embedding-ada-002',
      dimensions: 1536
    });

    await client.initialize();

    memoryService = new MemoryService(client, embeddingService);

    // Create an adapter that implements the EnhancedMemoryService interface
    const enhancedMemoryService = {
      ...memoryService,
      embeddingClient: embeddingService,
      memoryClient: client,
      getTimestampFn: () => Date.now(),
      extractIndexableFields: (memory: Record<string, any>) => ({ text: memory.text }),
      // Add the methods that SearchService actually uses
      getMemory: memoryService.getMemory,
      addMemory: memoryService.addMemory,
      updateMemory: memoryService.updateMemory,
      deleteMemory: memoryService.deleteMemory,
      searchMemories: memoryService.searchMemories
    } as unknown as EnhancedMemoryService;

    searchService = new SearchService(client, embeddingService, enhancedMemoryService);
  });

  afterAll(async () => {
    // Cleanup test data
    if (OPENAI_API_KEY) {
      for (const item of createdMemoryIds) {
        try {
          await memoryService.deleteMemory({
            id: item.id,
            type: item.type
          });
        } catch (err) {
          console.warn(`Failed to delete test memory ${item.id}:`, err);
        }
      }
    }
  });

  // Conditional tests based on API key availability
  test('Should properly initialize and connect services', async () => {
    if (!OPENAI_API_KEY) {
      return;
    }

    const status = await client.getStatus();
    expect(status.initialized).toBe(true);
    expect(status.connected).toBe(true);
  });

  describe('Full memory lifecycle', () => {
    // Skip the entire describe block if no API key
    beforeAll(() => {
      if (!OPENAI_API_KEY) {
        console.warn('Skipping memory lifecycle tests: No OpenAI API key provided');
      }
    });

    test('Should add, retrieve, search, update, and delete memories', async () => {
      if (!OPENAI_API_KEY) {
        return;
      }

      // 1. Add memories with UUID IDs
      const message1Id = randomUUID();
      const message2Id = randomUUID();
      const documentId = randomUUID();

      console.log(`Created UUID for message1: ${message1Id}`);
      console.log(`Created UUID for message2: ${message2Id}`);
      console.log(`Created UUID for document: ${documentId}`);

      const addMessage1Result = await memoryService.addMemory({
        id: message1Id,
        content: 'This is a test message about artificial intelligence',
        type: MemoryType.MESSAGE,
        metadata: {
          schemaVersion: '1.0.0',
          source: 'integration-test',
          importance: 'high'
        }
      });

      const addMessage2Result = await memoryService.addMemory({
        id: message2Id,
        content: 'This is another test message about machine learning',
        type: MemoryType.MESSAGE,
        metadata: {
          schemaVersion: '1.0.0',
          source: 'integration-test',
          importance: 'medium'
        }
      });

      const addDocumentResult = await memoryService.addMemory({
        id: documentId,
        content: 'This is a test document about neural networks and deep learning',
        type: MemoryType.DOCUMENT,
        metadata: {
          schemaVersion: '1.0.0',
          source: 'integration-test',
          filetype: 'text'
        }
      });

      // Store IDs for cleanup
      if (addMessage1Result.success) {
        createdMemoryIds.push({ id: message1Id, type: MemoryType.MESSAGE });
      }

      if (addMessage2Result.success) {
        createdMemoryIds.push({ id: message2Id, type: MemoryType.MESSAGE });
      }

      if (addDocumentResult.success) {
        createdMemoryIds.push({ id: documentId, type: MemoryType.DOCUMENT });
      }

      // Check add results
      expect(addMessage1Result.success).toBe(true);
      expect(addMessage2Result.success).toBe(true);
      expect(addDocumentResult.success).toBe(true);

      // 2. Retrieve memories
      const retrievedMessage = await memoryService.getMemory({
        id: message1Id,
        type: MemoryType.MESSAGE
      });

      // Check retrieval
      expect(retrievedMessage).not.toBeNull();
      expect(retrievedMessage?.id).toBe(message1Id);
      expect(retrievedMessage?.payload.text).toContain('artificial intelligence');

      // 3. Search for memories
      const searchResults = await searchService.search('artificial intelligence', {
        types: [MemoryType.MESSAGE, MemoryType.DOCUMENT],
        limit: 5
      });

      // Check search results
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults.some(result => result.point.id === message1Id)).toBe(true);

      // 4. Update a memory
      const updateResult = await memoryService.updateMemory({
        id: message1Id,
        type: MemoryType.MESSAGE,
        content: 'This is an updated test message about artificial intelligence and machine learning',
        metadata: {
          schemaVersion: '1.0.0',
          importance: 'critical'
        }
      });

      expect(updateResult).toBe(true);

      // Verify update
      const updatedMessage = await memoryService.getMemory({
        id: message1Id,
        type: MemoryType.MESSAGE
      });

      expect(updatedMessage?.payload.text).toContain('updated test message');
      expect(updatedMessage?.payload.metadata.importance).toBe('critical');

      // 5. Test hybrid search
      const hybridResults = await searchService.hybridSearch('neural networks', {
        types: [MemoryType.DOCUMENT],
        normalizeScores: true
      });

      expect(hybridResults.length).toBeGreaterThan(0);
      expect(hybridResults.some(result => result.point.id === documentId)).toBe(true);

      // 6. Delete memories
      const deleteMessage1 = await memoryService.deleteMemory({
        id: message1Id,
        type: MemoryType.MESSAGE
      });

      const deleteMessage2 = await memoryService.deleteMemory({
        id: message2Id,
        type: MemoryType.MESSAGE
      });

      const deleteDocument = await memoryService.deleteMemory({
        id: documentId,
        type: MemoryType.DOCUMENT
      });

      // Check deletion
      expect(deleteMessage1).toBe(true);
      expect(deleteMessage2).toBe(true);
      expect(deleteDocument).toBe(true);

      // Verify deletion
      const deletedMessage = await memoryService.getMemory({
        id: message1Id,
        type: MemoryType.MESSAGE
      });

      expect(deletedMessage).toBeNull();
    });
  });

  describe('Filter building', () => {
    test('Should create and apply complex filters', async () => {
      if (!OPENAI_API_KEY) {
        return;
      }

      // Create filter for date range and metadata
      const filter = searchService.buildFilter({
        startDate: new Date('2023-01-01'),
        endDate: new Date(),
        types: [MemoryType.MESSAGE],
        metadata: {
          source: 'integration-test'
        },
        textContains: 'test'
      });

      // Test that filter has expected structure
      expect(filter).toHaveProperty('timestamp');
      expect(filter).toHaveProperty('type', MemoryType.MESSAGE);
      expect(filter).toHaveProperty('metadata.source', 'integration-test');
      expect(filter).toHaveProperty('content'); // Changed from $text to content for Qdrant compatibility

      // Test applying filter (but don't expect results since we deleted test data)
      const filterResults = await searchService.search('test', {
        filter
      });

      // Just check that the search executes without error
      expect(Array.isArray(filterResults)).toBe(true);
    });
  });
}); 