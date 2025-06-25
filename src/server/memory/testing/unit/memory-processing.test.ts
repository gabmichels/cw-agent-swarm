/**
 * Unit tests for memory processing functionality
 * 
 * These tests focus on the memory processing pipeline, including:
 * - Memory transformation
 * - Memory enrichment
 * - Memory validation
 * - Schema enforcement
 */

import { ImportanceLevel, MemoryType } from '@/server/memory/config/types';
import { beforeEach, describe, expect, test } from 'vitest';
import { createEnumStructuredId, EntityNamespace, EntityType } from '../../../../types/entity-identifier';
import { CognitiveProcessType } from '../../../../types/metadata';
import { MemoryService } from '../../services/memory/memory-service';
import { MockEmbeddingService } from '../utils/mock-embedding-service';
import { MockMemoryClient } from '../utils/mock-memory-client';

// Custom metadata type for relationship tests
type RelationshipMetadata = {
  parentId?: string;
  relationship?: string;
  source: string;
  schemaVersion: string;
  importance: ImportanceLevel;
};

describe('Memory Processing', () => {
  // Test setup
  let mockClient: MockMemoryClient;
  let mockEmbeddingService: MockEmbeddingService;
  let memoryService: MemoryService;
  const mockTimestamp = 1625097600000; // Fixed timestamp for testing

  beforeEach(() => {
    // Create mocks
    mockClient = new MockMemoryClient();
    mockEmbeddingService = new MockEmbeddingService();

    // Initialize memory service with mocks and fixed timestamp
    memoryService = new MemoryService(mockClient, mockEmbeddingService, {
      getTimestamp: () => mockTimestamp
    });

    mockClient.getCollectionInfo = async (collectionName: string) => ({
      name: collectionName,
      dimensions: 1536,
      pointsCount: 0,
      createdAt: new Date()
    });
  });

  describe('Memory Transformation', () => {
    test('should transform raw memory into standardized format', async () => {
      // Setup test data
      const content = 'Test memory content';
      const type = MemoryType.MESSAGE;
      const memoryId = 'test-id-1';

      // Add memory
      const result = await memoryService.addMemory({
        content,
        type,
        id: memoryId
      });

      // Assertions
      expect(result.success).toBe(true);
      expect(result.id).toBe(memoryId);

      // Verify memory was transformed correctly
      const memory = await memoryService.getMemory({
        id: memoryId,
        type
      });
      expect(memory).toBeDefined();
      expect(memory?.payload.text).toBe(content);
      expect(memory?.payload.type).toBe(type);
      expect(memory?.payload.timestamp).toBe(mockTimestamp.toString());
      expect(memory?.payload.metadata.schemaVersion).toBe('1.0.0');
    });

    test('should handle memory type-specific transformations', async () => {
      // Setup test data for different memory types
      const testCases = [
        {
          type: MemoryType.TASK,
          content: 'Complete project documentation',
          expectedMetadata: {
            status: 'pending',
            priority: 'medium'
          }
        },
        {
          type: MemoryType.THOUGHT,
          content: 'Thinking about implementation approach',
          expectedMetadata: {
            processType: CognitiveProcessType.THOUGHT,
            agentId: createEnumStructuredId(EntityNamespace.SYSTEM, EntityType.AGENT, 'default-agent')
          }
        }
      ];

      // Test each memory type
      for (const testCase of testCases) {
        const result = await memoryService.addMemory({
          content: testCase.content,
          type: testCase.type
        });

        expect(result.success).toBe(true);
        expect(result.id).toBeDefined();

        // Verify type-specific transformation
        const memory = await memoryService.getMemory({
          id: result.id!,
          type: testCase.type
        });
        expect(memory).toBeDefined();
        expect(memory?.payload.type).toBe(testCase.type);
        expect(memory?.payload.metadata).toMatchObject(testCase.expectedMetadata);
      }
    });
  });

  describe('Memory Enrichment', () => {
    test('should calculate and store memory importance', async () => {
      // Setup test data
      const content = 'Critical system alert: Database connection failed';
      const type = MemoryType.MESSAGE;

      // Add memory
      const result = await memoryService.addMemory({
        content,
        type,
        metadata: {
          importance: ImportanceLevel.HIGH
        }
      });

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();

      // Verify importance was stored
      const memory = await memoryService.getMemory({
        id: result.id!,
        type
      });
      expect(memory?.payload.metadata.importance).toBe(ImportanceLevel.HIGH);
    });

    test('should create relationships between related memories', async () => {
      // Setup test data
      const parentContent = 'Parent task: Implement feature X';
      const childContent = 'Subtask: Write unit tests for feature X';

      // Add parent memory
      const parentResult = await memoryService.addMemory({
        content: parentContent,
        type: MemoryType.TASK,
        metadata: {
          importance: ImportanceLevel.HIGH,
          source: 'test',
          schemaVersion: '1.0.0'
        } as RelationshipMetadata
      });

      expect(parentResult.success).toBe(true);
      expect(parentResult.id).toBeDefined();

      // Add child memory with relationship
      const childResult = await memoryService.addMemory({
        content: childContent,
        type: MemoryType.TASK,
        metadata: {
          parentId: parentResult.id!,
          relationship: 'subtask',
          importance: ImportanceLevel.MEDIUM,
          source: 'test',
          schemaVersion: '1.0.0'
        } as RelationshipMetadata
      });

      expect(childResult.success).toBe(true);
      expect(childResult.id).toBeDefined();

      // Verify relationship was created
      const childMemory = await memoryService.getMemory({
        id: childResult.id!,
        type: MemoryType.TASK
      });
      expect(childMemory?.payload.metadata).toMatchObject({
        parentId: parentResult.id,
        relationship: 'subtask'
      });
    });
  });

  describe('Memory Validation', () => {
    test('should validate memory schema', async () => {
      // Test with invalid memory (missing required fields)
      const invalidMemory = {
        type: MemoryType.MESSAGE
        // Missing content and other required fields
      };

      // Attempt to add invalid memory
      const result = await memoryService.addMemory(invalidMemory as any);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should enforce type constraints', async () => {
      // Test with invalid type
      const result = await memoryService.addMemory({
        content: 'Test content',
        type: 'INVALID_TYPE' as MemoryType
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Memory Processing Performance', () => {
    test('should efficiently process batch memories', async () => {
      // Setup test data
      const memories = Array.from({ length: 10 }, (_, i) => ({
        content: `Test memory ${i}`,
        type: MemoryType.MESSAGE
      }));

      // Measure processing time
      const startTime = Date.now();

      // Process memories in parallel
      const results = await Promise.all(
        memories.map(memory => memoryService.addMemory(memory))
      );

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Verify all memories were processed
      expect(results.every(r => r.success)).toBe(true);

      // Verify processing time is reasonable (adjust threshold as needed)
      expect(processingTime).toBeLessThan(1000); // Should process 10 memories in under 1 second
    });
  });
}); 