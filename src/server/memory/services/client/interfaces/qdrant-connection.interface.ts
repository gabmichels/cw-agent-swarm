/**
 * Interface for QdrantConnection for managing connections to Qdrant server
 */

import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * Connection options for Qdrant
 */
export interface QdrantConnectionOptions {
  /**
   * URL of the Qdrant server (defaults to http://localhost:6333)
   */
  url?: string;
  
  /**
   * API key for Qdrant server authentication
   */
  apiKey?: string;
  
  /**
   * Connection timeout in milliseconds
   */
  connectionTimeout?: number;
  
  /**
   * Request timeout in milliseconds
   */
  requestTimeout?: number;
  
  /**
   * Maximum number of connections in the pool
   */
  poolSize?: number;
  
  /**
   * Retry options for failed connections
   */
  retry?: {
    /**
     * Maximum number of retry attempts
     */
    maxAttempts?: number;
    
    /**
     * Initial delay before retrying in milliseconds
     */
    initialDelayMs?: number;
    
    /**
     * Maximum delay between retries in milliseconds
     */
    maxDelayMs?: number;
    
    /**
     * Whether to use exponential backoff for retries
     */
    useExponentialBackoff?: boolean;
  };
}

/**
 * Status of the Qdrant connection
 */
export interface QdrantConnectionStatus {
  /**
   * Whether the connection is ready
   */
  isReady: boolean;
  
  /**
   * Connection status message
   */
  statusMessage: string;
  
  /**
   * Last connection attempt timestamp
   */
  lastConnectionAttempt: Date | null;
  
  /**
   * Last successful connection timestamp
   */
  lastSuccessfulConnection: Date | null;
  
  /**
   * Number of active connections in the pool
   */
  activeConnections: number;
  
  /**
   * Maximum connections allowed in the pool
   */
  maxConnections: number;
}

/**
 * Interface for QdrantConnection
 */
export interface IQdrantConnection {
  /**
   * Initialize the connection pool
   */
  initialize(): Promise<boolean>;
  
  /**
   * Get a client from the connection pool
   */
  getClient(): Promise<QdrantClient>;
  
  /**
   * Release a client back to the pool
   * @param client The client to release
   */
  releaseClient(client: QdrantClient): void;
  
  /**
   * Execute an operation with a client from the pool,
   * handling retries and timeouts automatically
   * @param operation The operation to execute with the client
   * @param timeoutMs Optional timeout in milliseconds
   */
  executeWithClient<T>(
    operation: (client: QdrantClient) => Promise<T>,
    timeoutMs?: number
  ): Promise<T>;
  
  /**
   * Get the connection status
   */
  getStatus(): QdrantConnectionStatus;
  
  /**
   * Close all connections in the pool
   */
  close(): Promise<void>;
} 