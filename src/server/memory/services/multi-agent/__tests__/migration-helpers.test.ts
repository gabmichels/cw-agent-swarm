/**
 * Migration Helpers Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancedMemoryService } from '../enhanced-memory-service';
import { MemoryService } from '../../memory/memory-service';
import { 
  migrateToEnhancedMemoryService, 
  createEnhancedMemoryService,
  isEnhancedMemoryService, 
  asEnhancedMemoryService 
} from '../migration-helpers';
import { IMemoryClient } from '../../client/types';
import { EmbeddingService, EmbeddingResult } from '../../client/embedding-service';

// Mock data
const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
const mockTimestamp = 1633372800000; // 2021-10-05

// Mock clients
const mockMemoryClient: Record<keyof IMemoryClient, any> = {
  initialize: vi.fn().mockResolvedValue(undefined),
  isInitialized: vi.fn().mockReturnValue(true),
  getStatus: vi.fn().mockResolvedValue({ status: 'ok' }),
  createCollection: vi.fn().mockResolvedValue(true),
  collectionExists: vi.fn().mockResolvedValue(true),
  addPoint: vi.fn().mockResolvedValue('mock-id'),
  getPoints: vi.fn().mockResolvedValue([]),
  searchPoints: vi.fn().mockResolvedValue([]),
  updatePoint: vi.fn().mockResolvedValue(true),
  deletePoint: vi.fn().mockResolvedValue(true),
  addPoints: vi.fn().mockResolvedValue(['mock-id']),
  scrollPoints: vi.fn().mockResolvedValue([]),
  getPointCount: vi.fn().mockResolvedValue(0)
};

// Create a mock that matches the actual service API
const mockEmbeddingService = {
  getEmbedding: vi.fn().mockResolvedValue({ embedding: mockEmbedding } as EmbeddingResult),
  getBatchEmbeddings: vi.fn().mockResolvedValue([{ embedding: mockEmbedding }] as EmbeddingResult[])
} as unknown as EmbeddingService;

describe('Migration Helpers', () => {
  let baseMemoryService: MemoryService;
  let enhancedMemoryService: EnhancedMemoryService;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create instances for testing
    baseMemoryService = new MemoryService(
      mockMemoryClient as unknown as IMemoryClient,
      mockEmbeddingService,
      { getTimestamp: () => mockTimestamp }
    );
    
    enhancedMemoryService = new EnhancedMemoryService(
      mockMemoryClient as unknown as IMemoryClient,
      mockEmbeddingService,
      { getTimestamp: () => mockTimestamp }
    );
  });
  
  describe('migrateToEnhancedMemoryService', () => {
    it('should convert MemoryService to EnhancedMemoryService', () => {
      // Act
      const migrated = migrateToEnhancedMemoryService(
        baseMemoryService, 
        mockMemoryClient as unknown as IMemoryClient, 
        mockEmbeddingService
      );
      
      // Assert
      expect(migrated).toBeInstanceOf(EnhancedMemoryService);
    });
    
    it('should extract client and embedding service if not provided', () => {
      // Act
      const migrated = migrateToEnhancedMemoryService(baseMemoryService);
      
      // Assert
      expect(migrated).toBeInstanceOf(EnhancedMemoryService);
    });
  });
  
  describe('isEnhancedMemoryService', () => {
    it('should return true for EnhancedMemoryService', () => {
      // Act
      const result = isEnhancedMemoryService(enhancedMemoryService);
      
      // Assert
      expect(result).toBe(true);
    });
    
    it('should return false for base MemoryService', () => {
      // Act
      const result = isEnhancedMemoryService(baseMemoryService);
      
      // Assert
      expect(result).toBe(false);
    });
  });
  
  describe('asEnhancedMemoryService', () => {
    it('should return EnhancedMemoryService for EnhancedMemoryService input', () => {
      // Act
      const result = asEnhancedMemoryService(enhancedMemoryService);
      
      // Assert
      expect(result).toBeInstanceOf(EnhancedMemoryService);
      expect(result).toBe(enhancedMemoryService);
    });
    
    it('should return null for base MemoryService input', () => {
      // Act
      const result = asEnhancedMemoryService(baseMemoryService);
      
      // Assert
      expect(result).toBeNull();
    });
  });
}); 