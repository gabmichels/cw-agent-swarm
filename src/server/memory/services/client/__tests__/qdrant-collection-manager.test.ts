/**
 * Unit tests for QdrantCollectionManager
 */
import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { QdrantCollectionManager } from '../qdrant-collection-manager';
import { IQdrantConnection } from '../interfaces/qdrant-connection.interface';
import { DEFAULTS } from '../../../config';

// Mock the connection interface
const mockExecuteWithClient = vi.fn();
const mockConnection: IQdrantConnection = {
  initialize: vi.fn().mockResolvedValue(true),
  getClient: vi.fn(),
  releaseClient: vi.fn(),
  executeWithClient: mockExecuteWithClient,
  getStatus: vi.fn().mockReturnValue({
    isReady: true,
    statusMessage: 'Ready',
    lastConnectionAttempt: new Date(),
    lastSuccessfulConnection: new Date(),
    activeConnections: 0,
    maxConnections: 5
  }),
  close: vi.fn().mockResolvedValue(undefined)
};

describe('QdrantCollectionManager', () => {
  let collectionManager: QdrantCollectionManager;
  
  beforeEach(async () => {
    // Reset mock function call history
    vi.clearAllMocks();
    
    // Create a new collection manager
    collectionManager = new QdrantCollectionManager();
    
    // Initialize with mock connection
    await collectionManager.initialize(mockConnection);
  });
  
  test('should initialize successfully', async () => {
    // Mock the getCollections call in initialize
    mockExecuteWithClient.mockResolvedValueOnce({
      collections: [{ name: 'existing-collection' }]
    });
    
    const manager = new QdrantCollectionManager();
    await expect(manager.initialize(mockConnection)).resolves.not.toThrow();
    
    expect(mockExecuteWithClient).toHaveBeenCalled();
  });
  
  test('should create a collection', async () => {
    // Mock the collection existence check
    mockExecuteWithClient.mockResolvedValueOnce({
      collections: []
    });
    
    // Mock the createCollection call
    mockExecuteWithClient.mockResolvedValueOnce({});
    
    const result = await collectionManager.createCollection({
      name: 'test-collection',
      dimensions: 1536,
      distance: 'Cosine'
    });
    
    expect(result).toBe(true);
    expect(mockExecuteWithClient).toHaveBeenCalledTimes(2);
  });
  
  test('should not create a collection if it already exists', async () => {
    // Mock the collection existence check
    mockExecuteWithClient.mockResolvedValueOnce({
      collections: [{ name: 'test-collection' }]
    });
    
    const result = await collectionManager.createCollection({
      name: 'test-collection',
      dimensions: 1536
    });
    
    expect(result).toBe(false);
    expect(mockExecuteWithClient).toHaveBeenCalledTimes(1);
  });
  
  test('should create indices on a collection', async () => {
    // Mock the collection existence check
    mockExecuteWithClient.mockResolvedValueOnce({
      collections: [{ name: 'test-collection' }]
    });
    
    // Mock the createPayloadIndex calls
    mockExecuteWithClient.mockResolvedValueOnce({});
    mockExecuteWithClient.mockResolvedValueOnce({});
    
    const result = await collectionManager.createIndices('test-collection', [
      { fieldName: 'userId', fieldSchema: 'keyword' },
      { fieldName: 'timestamp', fieldSchema: 'integer' }
    ]);
    
    expect(result).toBe(true);
    expect(mockExecuteWithClient).toHaveBeenCalledTimes(3);
  });
  
  test('should check if a collection exists', async () => {
    // Mock the getCollections call
    mockExecuteWithClient.mockResolvedValueOnce({
      collections: [
        { name: 'test-collection' },
        { name: 'another-collection' }
      ]
    });
    
    const exists = await collectionManager.collectionExists('test-collection');
    
    expect(exists).toBe(true);
    expect(mockExecuteWithClient).toHaveBeenCalledTimes(1);
  });
  
  test('should return false for non-existent collection', async () => {
    // Mock the getCollections call
    mockExecuteWithClient.mockResolvedValueOnce({
      collections: [
        { name: 'existing-collection' }
      ]
    });
    
    const exists = await collectionManager.collectionExists('non-existent');
    
    expect(exists).toBe(false);
    expect(mockExecuteWithClient).toHaveBeenCalledTimes(1);
  });
  
  test('should get collection info', async () => {
    // Mock the collection existence check
    mockExecuteWithClient.mockResolvedValueOnce({
      collections: [{ name: 'test-collection' }]
    });
    
    // Mock the getCollection call
    mockExecuteWithClient.mockResolvedValueOnce({
      status: 'green',
      vectors_count: 1000,
      config: {
        params: {
          vectors: {
            default: {
              size: 1536
            }
          }
        }
      }
    });
    
    const info = await collectionManager.getCollectionInfo('test-collection');
    
    expect(info).not.toBeNull();
    expect(info?.name).toBe('test-collection');
    expect(info?.dimensions).toBe(1536);
    expect(info?.pointsCount).toBe(1000);
    expect(info?.createdAt).toBeInstanceOf(Date);
    expect(mockExecuteWithClient).toHaveBeenCalledTimes(2);
  });
  
  test('should return null for non-existent collection info', async () => {
    // Mock the collection existence check
    mockExecuteWithClient.mockResolvedValueOnce({
      collections: []
    });
    
    const info = await collectionManager.getCollectionInfo('non-existent');
    
    expect(info).toBeNull();
    expect(mockExecuteWithClient).toHaveBeenCalledTimes(1);
  });
  
  test('should use default dimensions if not available in collection info', async () => {
    // Mock the collection existence check
    mockExecuteWithClient.mockResolvedValueOnce({
      collections: [{ name: 'test-collection' }]
    });
    
    // Mock the getCollection call with missing vector config
    mockExecuteWithClient.mockResolvedValueOnce({
      status: 'green',
      vectors_count: 500,
      config: {
        params: {}
      }
    });
    
    const info = await collectionManager.getCollectionInfo('test-collection');
    
    expect(info).not.toBeNull();
    expect(info?.dimensions).toBe(DEFAULTS.DIMENSIONS);
    expect(mockExecuteWithClient).toHaveBeenCalledTimes(2);
  });
  
  test('should list all collections', async () => {
    // Mock the getCollections call
    mockExecuteWithClient.mockResolvedValueOnce({
      collections: [
        { name: 'collection1' },
        { name: 'collection2' },
        { name: 'collection3' }
      ]
    });
    
    const collections = await collectionManager.listCollections();
    
    expect(collections).toHaveLength(3);
    expect(collections).toContain('collection1');
    expect(collections).toContain('collection2');
    expect(collections).toContain('collection3');
    expect(mockExecuteWithClient).toHaveBeenCalledTimes(1);
  });
  
  test('should delete a collection', async () => {
    // Mock the collection existence check
    mockExecuteWithClient.mockResolvedValueOnce({
      collections: [{ name: 'test-collection' }]
    });
    
    // Mock the deleteCollection call
    mockExecuteWithClient.mockResolvedValueOnce({});
    
    const result = await collectionManager.deleteCollection('test-collection');
    
    expect(result).toBe(true);
    expect(mockExecuteWithClient).toHaveBeenCalledTimes(2);
  });
  
  test('should not delete a non-existent collection', async () => {
    // Mock the collection existence check
    mockExecuteWithClient.mockResolvedValueOnce({
      collections: []
    });
    
    const result = await collectionManager.deleteCollection('non-existent');
    
    expect(result).toBe(false);
    expect(mockExecuteWithClient).toHaveBeenCalledTimes(1);
  });
  
  test('should get point count for a collection', async () => {
    // Mock the collection existence check
    mockExecuteWithClient.mockResolvedValueOnce({
      collections: [{ name: 'test-collection' }]
    });
    
    // Mock the getCollection call
    mockExecuteWithClient.mockResolvedValueOnce({
      vectors_count: 2500
    });
    
    const count = await collectionManager.getPointCount('test-collection');
    
    expect(count).toBe(2500);
    expect(mockExecuteWithClient).toHaveBeenCalledTimes(2);
  });
  
  test('should get filtered point count for a collection', async () => {
    // Mock the collection existence check
    mockExecuteWithClient.mockResolvedValueOnce({
      collections: [{ name: 'test-collection' }]
    });
    
    // Mock the count call
    mockExecuteWithClient.mockResolvedValueOnce({
      count: 1200
    });
    
    const filter = { userId: 'user123' };
    const count = await collectionManager.getPointCount('test-collection', filter);
    
    expect(count).toBe(1200);
    expect(mockExecuteWithClient).toHaveBeenCalledTimes(2);
    expect(mockExecuteWithClient.mock.calls[1][0]).toMatchObject(expect.any(Function));
  });
  
  test('should throw if trying to use uninitialized manager', async () => {
    const uninitializedManager = new QdrantCollectionManager();
    
    await expect(uninitializedManager.listCollections())
      .rejects.toThrow('Collection manager not initialized');
  });
  
  test('should throw with an invalid schema type', async () => {
    // Mock the collection existence check
    mockExecuteWithClient.mockResolvedValueOnce({
      collections: [{ name: 'test-collection' }]
    });
    
    await expect(collectionManager.createIndices('test-collection', [
      { fieldName: 'invalid', fieldSchema: 'unknown-type' }
    ]))
      .rejects.toThrow('Unsupported schema type');
  });
}); 