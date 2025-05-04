/**
 * Script to initialize Qdrant collections for the memory system
 * 
 * Run with: npm run memory:setup-collections
 */
import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';
import { COLLECTION_CONFIGS } from '../src/server/memory/config/collections';
import { MemoryType } from '../src/server/memory/config';

// Load environment variables
dotenv.config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Log a message with a colored prefix
 */
function log(message: string, type = 'info'): void {
  const prefix = {
    info: `${colors.blue}[INFO]${colors.reset}`,
    success: `${colors.green}[SUCCESS]${colors.reset}`,
    error: `${colors.red}[ERROR]${colors.reset}`,
    warning: `${colors.yellow}[WARNING]${colors.reset}`,
    step: `${colors.cyan}[STEP]${colors.reset}`,
  };
  
  console.log(`${prefix[type] || prefix.info} ${message}`);
}

/**
 * Initialize the Qdrant client
 */
function initQdrantClient(): QdrantClient {
  const url = process.env.QDRANT_URL || 'http://localhost:6333';
  const apiKey = process.env.QDRANT_API_KEY;
  
  log(`Connecting to Qdrant at ${url}`, 'step');
  
  return new QdrantClient({ 
    url, 
    ...(apiKey && { apiKey }) 
  });
}

/**
 * Check if a collection exists
 */
async function collectionExists(client: QdrantClient, name: string): Promise<boolean> {
  try {
    const collections = await client.getCollections();
    return collections.collections.some(c => c.name === name);
  } catch (error) {
    log(`Error checking if collection exists: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Create a collection if it doesn't exist
 */
async function createCollectionIfNotExists(
  client: QdrantClient, 
  name: string,
  vectorSize: number = 1536, // Default for OpenAI embedding size
  indices: string[] = []
): Promise<boolean> {
  try {
    // Check if collection already exists
    const exists = await collectionExists(client, name);
    
    if (exists) {
      log(`Collection '${name}' already exists`, 'info');
      return true;
    }
    
    // Create the collection
    await client.createCollection(name, {
      vectors: {
        size: vectorSize,
        distance: 'Cosine',
      },
    });
    
    log(`Created collection '${name}'`, 'success');
    
    // Create indices for efficient filtering
    if (indices.length > 0) {
      for (const field of indices) {
        await client.createPayloadIndex(name, {
          field_name: field,
          field_schema: 'keyword',
        });
        log(`Created index on '${field}' for collection '${name}'`, 'success');
      }
    }
    
    return true;
  } catch (error) {
    log(`Error creating collection '${name}': ${error.message}`, 'error');
    return false;
  }
}

/**
 * Main function to setup all collections
 */
async function setupCollections(): Promise<void> {
  try {
    const client = initQdrantClient();
    
    // Test connection
    try {
      await client.getCollections();
      log('Connection to Qdrant successful', 'success');
    } catch (error) {
      log(`Failed to connect to Qdrant: ${error.message}`, 'error');
      log('Make sure Qdrant is running and accessible', 'warning');
      return;
    }
    
    // Get all collection configs
    const collections = Object.values(COLLECTION_CONFIGS);
    log(`Setting up ${collections.length} collections`, 'step');
    
    // Set up each collection
    for (const config of collections) {
      log(`Setting up collection: ${config.name}`, 'step');
      const indices = config.indices || [];
      
      const success = await createCollectionIfNotExists(client, config.name, 1536, indices);
      
      if (success) {
        log(`Collection '${config.name}' ready`, 'success');
      } else {
        log(`Failed to setup collection '${config.name}'`, 'error');
      }
    }
    
    // Output overall status
    log('Collection setup complete!', 'success');
    log(`Created/verified ${collections.length} collections for memory system`, 'success');
    
    // Output collection names for reference
    log('Memory collections:', 'info');
    for (const type of Object.values(MemoryType)) {
      const config = COLLECTION_CONFIGS[type];
      log(`  - ${type}: ${config?.name || 'Not configured'}`, 'info');
    }
    
  } catch (error) {
    log(`Fatal error during collection setup: ${error.message}`, 'error');
    console.error(error);
  }
}

// Run the collection setup
setupCollections().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 