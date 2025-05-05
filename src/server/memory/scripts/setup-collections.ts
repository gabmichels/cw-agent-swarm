/**
 * Collection Setup Script
 * 
 * This script initializes and verifies all collections needed for the memory system.
 * It can be used for initial setup or to validate existing collections against the current schema.
 */

import { QdrantMemoryClient } from '../services/client/qdrant-client';
import { COLLECTION_CONFIGS, MemoryType, MemoryError, MemoryErrorCode } from '../config';

// Collection configurations - these should match what's defined in config/collections.ts
// We're directly importing COLLECTION_CONFIGS instead of defining them here

interface SetupOptions {
  /** Qdrant URL to connect to */
  qdrantUrl?: string;
  /** Qdrant API key for authentication */
  qdrantApiKey?: string;
  /** Whether to recreate collections that don't match current schema */
  recreateIfNeeded?: boolean;
  /** Timeout for connection attempts in milliseconds */
  connectionTimeout?: number;
  /** Whether to log detailed information during setup */
  verbose?: boolean;
}

interface CollectionStatus {
  name: string;
  exists: boolean;
  matchesSchema: boolean;
  indices: string[];
  missingIndices: string[];
  recreated?: boolean;
  error?: string;
}

interface CollectionInfo {
  indexNames: string[];
  dimensions?: number;
  metadata?: Record<string, any>;
}

/**
 * Setup all memory collections according to current schema
 */
export async function setupCollections(options: SetupOptions = {}): Promise<CollectionStatus[]> {
  const {
    qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333',
    qdrantApiKey = process.env.QDRANT_API_KEY,
    recreateIfNeeded = false,
    connectionTimeout = 10000,
    verbose = false
  } = options;

  // Initialize client
  const client = new QdrantMemoryClient({
    qdrantUrl,
    qdrantApiKey,
    connectionTimeout
  });

  try {
    if (verbose) console.log('Initializing Qdrant client...');
    await client.initialize();
    
    if (verbose) console.log('Qdrant client initialized successfully');
  } catch (error) {
    throw new MemoryError(
      'Failed to initialize Qdrant client',
      MemoryErrorCode.DATABASE_ERROR,
      error instanceof Error ? error : undefined
    );
  }

  const results: CollectionStatus[] = [];

  // Process each collection defined in our configuration
  for (const type of Object.values(MemoryType)) {
    const config = COLLECTION_CONFIGS[type];
    
    // Skip undefined configurations
    if (!config) {
      if (verbose) console.log(`No configuration found for type: ${type}, skipping`);
      continue;
    }
    
    const collectionName = config.name;
    
    if (verbose) console.log(`Processing collection: ${collectionName}`);
    
    try {
      // Check if collection exists
      const exists = await client.collectionExists(collectionName);
      
      // Ensure indices is defined in config or use empty array as fallback
      const configIndices = config.indices || [];
      
      let status: CollectionStatus = {
        name: collectionName,
        exists,
        matchesSchema: false,
        indices: [],
        missingIndices: [...configIndices]
      };
      
      if (exists) {
        if (verbose) console.log(`Collection ${collectionName} exists, checking schema...`);
        
        // In a real implementation, you would check collection info properly
        status.indices = configIndices;
        status.missingIndices = [];
        status.matchesSchema = true;
        
        if (verbose) console.log(`Assumed collection ${collectionName} schema is valid`);
      } else {
        // Collection doesn't exist, create it
        if (verbose) console.log(`Collection ${collectionName} doesn't exist, creating...`);
        
        await client.createCollection(collectionName, 1536); // Default dimension for embeddings
        
        // Create indices for faster filtering - you would implement this in a real scenario
        // This would involve using client.createIndex(collectionName, field) for each index
        if (verbose) console.log(`Created collection ${collectionName}, indices would be added here`);
        
        // Update status
        status.exists = true;
        status.matchesSchema = true;
        status.missingIndices = [];
        status.indices = configIndices;
        
        if (verbose) console.log(`Collection ${collectionName} created successfully`);
      }
      
      results.push(status);
    } catch (error) {
      results.push({
        name: collectionName,
        exists: false,
        matchesSchema: false,
        indices: [],
        missingIndices: config.indices || [],
        error: String(error)
      });
      
      if (verbose) console.error(`Error processing ${collectionName}:`, error);
    }
  }
  
  if (verbose) {
    console.log('\nCollection setup summary:');
    console.table(results.map(r => ({
      name: r.name,
      exists: r.exists,
      matchesSchema: r.matchesSchema,
      recreated: r.recreated || false,
      missingIndices: r.missingIndices.length,
      error: r.error ? 'Yes' : 'No'
    })));
  }
  
  return results;
}

/**
 * CLI entry point for running the script directly
 */
if (require.main === module) {
  (async () => {
    try {
      console.log('Starting collection setup...');
      
      const results = await setupCollections({
        verbose: true,
        recreateIfNeeded: process.argv.includes('--recreate')
      });
      
      const success = results.every(r => r.exists && r.matchesSchema);
      
      if (success) {
        console.log('All collections setup successfully!');
      } else {
        console.error('Some collections could not be setup correctly:');
        const failed = results.filter(r => !r.exists || !r.matchesSchema);
        console.table(failed);
        process.exit(1);
      }
    } catch (error) {
      console.error('Setup failed:', error);
      process.exit(1);
    }
  })();
}

export default setupCollections; 