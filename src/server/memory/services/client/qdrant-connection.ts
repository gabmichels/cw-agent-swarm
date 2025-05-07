/**
 * Implementation of the QdrantConnection interface
 * Provides connection pooling and retry functionality for Qdrant
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { DEFAULTS } from '../../config';
import { IQdrantConnection, QdrantConnectionOptions, QdrantConnectionStatus } from './interfaces/qdrant-connection.interface';

/**
 * Represents a connection in the pool
 */
interface PooledConnection {
  client: QdrantClient;
  inUse: boolean;
  lastUsed: Date;
}

/**
 * Required retry configuration with no undefined values
 */
interface RequiredRetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  useExponentialBackoff: boolean;
}

/**
 * Implementation of the QdrantConnection interface
 */
export class QdrantConnection implements IQdrantConnection {
  private options: Required<QdrantConnectionOptions> & { retry: RequiredRetryConfig };
  private connectionPool: PooledConnection[] = [];
  private status: QdrantConnectionStatus;
  private initialized: boolean = false;
  private initializationPromise: Promise<boolean> | null = null;
  
  /**
   * Create a new QdrantConnection
   */
  constructor(options?: QdrantConnectionOptions) {
    // Set default options with guaranteed non-undefined values for retry
    this.options = {
      url: options?.url || process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: options?.apiKey || process.env.QDRANT_API_KEY || '',
      connectionTimeout: options?.connectionTimeout || DEFAULTS.CONNECTION_TIMEOUT,
      requestTimeout: options?.requestTimeout || DEFAULTS.FETCH_TIMEOUT,
      poolSize: options?.poolSize || 5,
      retry: {
        maxAttempts: options?.retry?.maxAttempts ?? 3,
        initialDelayMs: options?.retry?.initialDelayMs ?? 500,
        maxDelayMs: options?.retry?.maxDelayMs ?? 5000,
        useExponentialBackoff: options?.retry?.useExponentialBackoff !== false
      }
    };
    
    // Initialize status
    this.status = {
      isReady: false,
      statusMessage: 'Not initialized',
      lastConnectionAttempt: null,
      lastSuccessfulConnection: null,
      activeConnections: 0,
      maxConnections: this.options.poolSize
    };
  }
  
  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    // If initialization is already in progress, return the existing promise
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = this.initializeInternal();
    return this.initializationPromise;
  }
  
  /**
   * Internal initialization method
   */
  private async initializeInternal(): Promise<boolean> {
    try {
      console.log('Initializing Qdrant connection pool...');
      this.status.lastConnectionAttempt = new Date();
      this.status.statusMessage = 'Initializing...';
      
      // Create the first connection to test
      const testClient = new QdrantClient({
        url: this.options.url,
        apiKey: this.options.apiKey,
        timeout: this.options.connectionTimeout
      });
      
      // Test the connection by getting collections
      const testConnectionPromise = testClient.getCollections();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Connection timeout after ${this.options.connectionTimeout}ms`)),
          this.options.connectionTimeout
        )
      );
      
      await Promise.race([testConnectionPromise, timeoutPromise]);
      
      // Success - connection works, add it to the pool
      this.connectionPool.push({
        client: testClient,
        inUse: false,
        lastUsed: new Date()
      });
      
      // Create the rest of the pool
      for (let i = 1; i < this.options.poolSize; i++) {
        this.connectionPool.push({
          client: new QdrantClient({
            url: this.options.url,
            apiKey: this.options.apiKey,
            timeout: this.options.connectionTimeout
          }),
          inUse: false,
          lastUsed: new Date()
        });
      }
      
      // Update status
      this.status.isReady = true;
      this.status.statusMessage = 'Connection pool ready';
      this.status.lastSuccessfulConnection = new Date();
      this.initialized = true;
      
      console.log(`Qdrant connection pool initialized with ${this.options.poolSize} connections`);
      return true;
    } catch (error) {
      this.status.isReady = false;
      this.status.statusMessage = `Initialization failed: ${error instanceof Error ? error.message : String(error)}`;
      this.initialized = false; // Allow retry
      this.initializationPromise = null;
      
      console.error('Failed to initialize Qdrant connection pool:', error);
      return false;
    }
  }
  
  /**
   * Get a client from the connection pool
   */
  async getClient(): Promise<QdrantClient> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Check if any connections are available
    const availableConnection = this.connectionPool.find(connection => !connection.inUse);
    
    if (availableConnection) {
      availableConnection.inUse = true;
      availableConnection.lastUsed = new Date();
      this.status.activeConnections = this.connectionPool.filter(c => c.inUse).length;
      return availableConnection.client;
    }
    
    // All connections are in use
    if (this.connectionPool.length < this.options.poolSize) {
      // Pool is not at max size yet, create a new connection
      const newClient = new QdrantClient({
        url: this.options.url,
        apiKey: this.options.apiKey,
        timeout: this.options.connectionTimeout
      });
      
      const newConnection: PooledConnection = {
        client: newClient,
        inUse: true,
        lastUsed: new Date()
      };
      
      this.connectionPool.push(newConnection);
      this.status.activeConnections = this.connectionPool.filter(c => c.inUse).length;
      return newClient;
    }
    
    // Return the least recently used connection
    const sortedConnections = this.connectionPool.slice().sort(
      (a, b) => a.lastUsed.getTime() - b.lastUsed.getTime()
    );
    
    if (sortedConnections.length === 0) {
      // This shouldn't happen as we've already checked the pool, but just in case
      throw new Error('No connections available in the pool');
    }
    
    const leastRecentlyUsed = sortedConnections[0];
    leastRecentlyUsed.inUse = true;
    leastRecentlyUsed.lastUsed = new Date();
    this.status.activeConnections = this.connectionPool.filter(c => c.inUse).length;
    
    return leastRecentlyUsed.client;
  }
  
  /**
   * Release a client back to the pool
   */
  releaseClient(client: QdrantClient): void {
    const connection = this.connectionPool.find(c => c.client === client);
    
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = new Date();
      this.status.activeConnections = this.connectionPool.filter(c => c.inUse).length;
    }
  }
  
  /**
   * Execute an operation with a client from the pool
   */
  async executeWithClient<T>(
    operation: (client: QdrantClient) => Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const client = await this.getClient();
    const effectiveTimeout = timeoutMs || this.options.requestTimeout;
    
    let attempts = 0;
    let lastError: Error | null = null;
    
    const { maxAttempts, initialDelayMs, maxDelayMs, useExponentialBackoff } = this.options.retry;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        // Create a promise with timeout
        const operationPromise = operation(client);
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(
            () => reject(new Error(`Operation timeout after ${effectiveTimeout}ms`)),
            effectiveTimeout
          )
        );
        
        // Execute the operation with timeout
        const result = await Promise.race([operationPromise, timeoutPromise]);
        
        // Operation succeeded, release the client and return result
        this.releaseClient(client);
        return result;
      } catch (error) {
        lastError = error instanceof Error 
          ? error 
          : new Error(String(error));
        
        console.error(`Qdrant operation attempt ${attempts}/${maxAttempts} failed:`, error);
        
        // Check if we should retry
        if (attempts < maxAttempts) {
          // Calculate delay with optional exponential backoff
          let delayMs = initialDelayMs;
          
          if (useExponentialBackoff) {
            delayMs = Math.min(
              initialDelayMs * Math.pow(2, attempts - 1),
              maxDelayMs
            );
          }
          
          console.log(`Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    // All attempts failed, release the client and throw the last error
    this.releaseClient(client);
    throw lastError || new Error('Operation failed after multiple attempts');
  }
  
  /**
   * Get the connection status
   */
  getStatus(): QdrantConnectionStatus {
    return { ...this.status };
  }
  
  /**
   * Close all connections in the pool
   */
  async close(): Promise<void> {
    // No explicit close method in Qdrant client, but we can clean up our pool
    this.connectionPool = [];
    this.initialized = false;
    this.initializationPromise = null;
    
    this.status = {
      isReady: false,
      statusMessage: 'Closed',
      lastConnectionAttempt: this.status.lastConnectionAttempt,
      lastSuccessfulConnection: this.status.lastSuccessfulConnection,
      activeConnections: 0,
      maxConnections: this.options.poolSize
    };
  }
} 