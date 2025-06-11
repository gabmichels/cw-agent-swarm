/**
 * Script to clear all capabilities from the capabilities collection
 */

const { QdrantClient } = require('@qdrant/js-client-rest');

async function clearCapabilitiesCollection() {
  console.log('🧹 Clearing capabilities collection...');
  
  try {
    // Initialize Qdrant client
    const client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333'
    });
    
    const collectionName = 'capabilities';
    
    // Check if collection exists
    const collectionExists = await client.collectionExists(collectionName);
    
    if (!collectionExists) {
      console.log(`❌ Collection '${collectionName}' does not exist`);
      return;
    }
    
    // Get collection info first
    const collectionInfo = await client.getCollection(collectionName);
    console.log(`📊 Collection info:`, {
      name: collectionName,
      pointsCount: collectionInfo.points_count,
      vectorSize: collectionInfo.config.params.vectors.size
    });
    
    if (collectionInfo.points_count === 0) {
      console.log('✅ Collection is already empty');
      return;
    }
    
    // Delete the entire collection and recreate it empty
    console.log(`🗑️ Deleting collection '${collectionName}'...`);
    await client.deleteCollection(collectionName);
    
    // Recreate the collection with the same configuration
    console.log(`🔄 Recreating empty collection '${collectionName}'...`);
    const created = await client.createCollection(collectionName, {
      vectors: {
        size: collectionInfo.config.params.vectors.size,
        distance: collectionInfo.config.params.vectors.distance
      }
    });
    
    if (created) {
      console.log(`✅ Successfully cleared and recreated '${collectionName}' collection`);
    } else {
      console.error(`❌ Failed to recreate '${collectionName}' collection`);
    }
    
  } catch (error) {
    console.error('❌ Error clearing capabilities collection:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
clearCapabilitiesCollection()
  .then(() => {
    console.log('🎉 Capabilities collection cleared successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }); 