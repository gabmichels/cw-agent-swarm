/**
 * Script to check collection status in Qdrant
 */

import { QdrantMemoryClient } from '../services/client/qdrant-client';
import { COLLECTION_NAMES } from '../config/constants';

/**
 * Check collections
 */
export async function checkCollections() {
  try {
    console.log('Checking memory collections...');
    
    // Initialize the Qdrant client
    const client = new QdrantMemoryClient({
      connectionTimeout: 10000 // 10 second timeout
    });

    await client.initialize();

    // Get client status
    const status = await client.getStatus();
    console.log('Client status:', {
      initialized: status.initialized,
      connected: status.connected,
      usingFallback: status.usingFallback,
      collectionsReady: status.collectionsReady
    });

    // Get list of required collections from COLLECTION_NAMES
    const requiredCollections = Object.values(COLLECTION_NAMES);
    console.log('Required collections:', requiredCollections);
    
    for (const collectionName of requiredCollections) {
      try {
        const exists = await client.collectionExists(collectionName);
        
        if (exists) {
          const info = await client.getCollectionInfo(collectionName);
          console.log(`Collection exists: ${collectionName}`, info);
        } else {
          console.log(`Collection doesn't exist: ${collectionName}`);
        }
      } catch (error) {
        console.error(`Error checking collection ${collectionName}:`, error);
      }
    }

    // Try to get points count from documents collection
    try {
      const count = await client.getPointCount('documents');
      console.log('Document collection point count:', count);
    } catch (error) {
      console.error('Error getting document count:', error);
    }

    console.log('Memory collections check complete');
    return true;
  } catch (error) {
    console.error('Failed to check memory collections:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  checkCollections().catch(console.error);
} 