/**
 * Setup script for test collections in Qdrant
 * This ensures all required collections exist before running tests
 */

import { loadApiKey } from './load-api-key';
import { QdrantMemoryClient } from '../services/client/qdrant-client';
import { MemoryType } from '@/server/memory/config/types';
import { COLLECTION_NAMES } from '@/server/memory/config/constants';

// Setup test environment
const TEST_QDRANT_URL = process.env.TEST_QDRANT_URL || 'http://localhost:6333';
const OPENAI_API_KEY = loadApiKey();

/**
 * Ensure collections exist for testing
 */
async function setupTestCollections() {
  if (!OPENAI_API_KEY) {
    console.error('No OpenAI API key found. Cannot set up test collections.');
    process.exit(1);
  }

  console.log('Setting up test collections in Qdrant...');
  
  // Initialize Qdrant client
  const client = new QdrantMemoryClient({
    qdrantUrl: TEST_QDRANT_URL,
    openAIApiKey: OPENAI_API_KEY
  });
  
  try {
    // Initialize client
    await client.initialize();
    console.log('Qdrant client initialized');

    // Ensure each core collection exists
    const collections = [
      MemoryType.MESSAGE,
      MemoryType.THOUGHT,
      MemoryType.DOCUMENT,
      MemoryType.TASK,
      MemoryType.MEMORY_EDIT
    ];

    for (const collection of collections) {
      const collectionName = COLLECTION_NAMES[collection] || String(collection);
      console.log(`Ensuring collection exists: ${collectionName}`);
      
      // Check if collection exists
      const exists = await client.collectionExists(collectionName);
      
      if (exists) {
        console.log(`Collection ${collectionName} already exists`);
      } else {
        console.log(`Creating collection ${collectionName}`);
        // Using 1536 dimensions for the OpenAI embeddings
        await client.createCollection(collectionName, 1536);
        console.log(`Collection ${collectionName} created successfully`);
      }
    }

    console.log('All test collections set up successfully');
  } catch (error) {
    console.error('Error setting up test collections:', error);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupTestCollections().catch(console.error);
}

export { setupTestCollections }; 