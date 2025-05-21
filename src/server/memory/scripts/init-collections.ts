/**
 * Collection Initialization Script
 * 
 * This script ensures all required collections exist in Qdrant
 * and creates them if they don't.
 */

import { QdrantMemoryClient } from '../services/client/qdrant-client';
import { COLLECTION_NAMES, ADDITIONAL_COLLECTIONS } from '../config/constants';
import { DEFAULTS } from '../config';

export async function initializeCollections() {
  try {
    console.log('Initializing memory collections...');
    
    // Initialize the Qdrant client
    const client = new QdrantMemoryClient({
      connectionTimeout: 10000 // 10 second timeout
    });

    await client.initialize();

    // Get list of required collections from COLLECTION_NAMES
    const requiredCollections = [...Object.values(COLLECTION_NAMES), ...ADDITIONAL_COLLECTIONS];
    
    for (const collectionName of requiredCollections) {
      try {
        const exists = await client.collectionExists(collectionName);
        
        if (!exists) {
          console.log(`Creating collection: ${collectionName}`);
          await client.createCollection(collectionName, DEFAULTS.DIMENSIONS);
          console.log(`Created collection: ${collectionName}`);
        } else {
          console.log(`Collection already exists: ${collectionName}`);
        }
      } catch (error) {
        console.error(`Error handling collection ${collectionName}:`, error);
      }
    }

    console.log('Memory collections initialization complete');
    return true;
  } catch (error) {
    console.error('Failed to initialize memory collections:', error);
    throw error;
  }
} 