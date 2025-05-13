/**
 * Recreate Chat Sessions Collection
 * 
 * This script recreates the chat_sessions collection with
 * the correct dimensions for vector embeddings.
 */

const { QdrantClient } = require('@qdrant/js-client-rest');

// Configure Qdrant client to match your environment settings
const qdrantClient = new QdrantClient({ 
  url: 'http://localhost:6333',
  timeout: 5000
});

async function recreateCollection() {
  try {
    console.log('===== RECREATING CHAT SESSIONS COLLECTION =====');
    
    const collectionName = 'chat_sessions';
    
    // 1. Check if collection exists
    console.log(`Checking if ${collectionName} collection exists...`);
    let collections = await qdrantClient.getCollections();
    const existingCollections = collections.collections?.map(c => c.name) || [];
    
    if (existingCollections.includes(collectionName)) {
      console.log(`${collectionName} collection exists. Deleting it...`);
      await qdrantClient.deleteCollection(collectionName);
      console.log(`${collectionName} collection deleted.`);
    } else {
      console.log(`${collectionName} collection does not exist.`);
    }
    
    // 2. Create the collection with 1536 dimensions
    console.log(`Creating ${collectionName} collection with 1536 dimensions...`);
    
    await qdrantClient.createCollection(collectionName, {
      vectors: {
        size: 1536,
        distance: "Cosine"
      }
    });
    
    console.log(`${collectionName} collection created successfully.`);
    
    // 3. Verify the collection was created properly
    console.log('\nVerifying collection creation:');
    collections = await qdrantClient.getCollections();
    
    if (collections.collections?.map(c => c.name).includes(collectionName)) {
      console.log(`✅ ${collectionName} collection found.`);
      
      const collectionInfo = await qdrantClient.getCollection(collectionName);
      console.log(`Collection vector size: ${collectionInfo.config?.params?.vectors?.size}`);
      
      if (collectionInfo.config?.params?.vectors?.size === 1536) {
        console.log('✅ Collection vector size set correctly to 1536.');
      } else {
        console.error(`❌ Collection vector size is incorrect: ${collectionInfo.config?.params?.vectors?.size}`);
      }
    } else {
      console.error(`❌ ${collectionName} collection not found after creation.`);
    }
    
    console.log('\nCollection recreation complete.');
    
  } catch (error) {
    console.error('Error recreating collection:', error);
  }
}

// Run the function
recreateCollection().catch(console.error); 