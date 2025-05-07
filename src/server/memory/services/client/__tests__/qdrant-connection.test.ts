/**
 * Unit tests for QdrantConnection
 */
import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { QdrantConnection } from '../qdrant-connection';
import { QdrantClient } from '@qdrant/js-client-rest';

// Mock the QdrantClient
vi.mock('@qdrant/js-client-rest', () => {
  return {
    QdrantClient: vi.fn().mockImplementation(() => ({
      getCollections: vi.fn().mockResolvedValue({
        collections: [
          { name: 'test-collection' }
        ]
      }),
      getCollection: vi.fn().mockResolvedValue({
        status: 'green',
        vectors_count: 100,
        config: {
          params: {
            vectors: {
              default: {
                size: 1536
              }
            }
          }
        }
      }),
      count: vi.fn().mockResolvedValue({ count: 100 })
    }))
  };
});

describe('QdrantConnection', () => {
  let connection: QdrantConnection;
  
  beforeEach(() => {
    // Reset mock function call history
    vi.clearAllMocks();
    
    // Create a new connection with test options
    connection = new QdrantConnection({
      url: 'http://test-qdrant:6333',
      apiKey: 'test-api-key',
      connectionTimeout: 1000,
      requestTimeout: 2000,
      poolSize: 3,
      retry: {
        maxAttempts: 2,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        useExponentialBackoff: true
      }
    });
  });
  
  afterEach(async () => {
    await connection.close();
  });
  
  test('should initialize successfully', async () => {
    const result = await connection.initialize();
    
    expect(result).toBe(true);
    expect(QdrantClient).toHaveBeenCalledWith({
      url: 'http://test-qdrant:6333',
      apiKey: 'test-api-key',
      timeout: 1000
    });
    
    const status = connection.getStatus();
    expect(status.isReady).toBe(true);
    expect(status.statusMessage).toBe('Connection pool ready');
    expect(status.activeConnections).toBe(0);
    expect(status.maxConnections).toBe(3);
  });
  
  test('should get a client from the pool', async () => {
    await connection.initialize();
    
    const client = await connection.getClient();
    
    expect(client).toBeDefined();
    
    const status = connection.getStatus();
    expect(status.activeConnections).toBe(1);
  });
  
  test('should release a client back to the pool', async () => {
    await connection.initialize();
    
    const client = await connection.getClient();
    connection.releaseClient(client);
    
    const status = connection.getStatus();
    expect(status.activeConnections).toBe(0);
  });
  
  test('should execute an operation with a client', async () => {
    await connection.initialize();
    
    const result = await connection.executeWithClient(client => {
      expect(client).toBeDefined();
      return Promise.resolve('test-result');
    });
    
    expect(result).toBe('test-result');
    
    // Client should be released after execution
    const status = connection.getStatus();
    expect(status.activeConnections).toBe(0);
  });
  
  test('should close and reset the connection pool', async () => {
    await connection.initialize();
    
    // Get a client to make sure the pool is active
    await connection.getClient();
    
    await connection.close();
    
    const status = connection.getStatus();
    expect(status.isReady).toBe(false);
    expect(status.statusMessage).toBe('Closed');
    expect(status.activeConnections).toBe(0);
  });
  
  test('should handle retries on failure', async () => {
    await connection.initialize();
    
    // Mock a function that fails once then succeeds
    const failOnceOperation = vi.fn()
      .mockRejectedValueOnce(new Error('Test error'))
      .mockResolvedValueOnce('success-after-retry');
    
    const result = await connection.executeWithClient(failOnceOperation);
    
    expect(result).toBe('success-after-retry');
    expect(failOnceOperation).toHaveBeenCalledTimes(2);
  });
  
  test('should throw after max retry attempts', async () => {
    await connection.initialize();
    
    // Mock a function that always fails
    const alwaysFailOperation = vi.fn().mockRejectedValue(new Error('Test error'));
    
    await expect(connection.executeWithClient(alwaysFailOperation))
      .rejects.toThrow('Test error');
    
    expect(alwaysFailOperation).toHaveBeenCalledTimes(2); // Initial + 1 retry
  });
  
  test('should use default options when none are provided', async () => {
    const defaultConnection = new QdrantConnection();
    
    // Should not throw
    expect(defaultConnection).toBeDefined();
    
    // Initialize with default parameters
    const result = await defaultConnection.initialize();
    expect(result).toBe(true);
    
    await defaultConnection.close();
  });
  
  test('should handle timeouts', async () => {
    await connection.initialize();
    
    // Mock a slow operation for timeout testing
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('too-late'), 5000));
    
    // This should timeout after 500ms
    await expect(connection.executeWithClient(() => timeoutPromise as Promise<string>, 500))
      .rejects.toThrow('Operation timeout');
  });
}); 