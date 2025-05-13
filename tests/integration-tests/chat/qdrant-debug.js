/**
 * Qdrant Debug Utility
 * 
 * This script directly interacts with Qdrant to diagnose issues
 * with chat storage and retrieval.
 */

const { QdrantClient } = require('@qdrant/js-client-rest');

// Configure Qdrant client to match your environment settings
const qdrantClient = new QdrantClient({ 
  url: 'http://localhost:6333',
  timeout: 5000
});

async function debugQdrant() {
  try {
    console.log('==== QDRANT DEBUG UTILITY ====');
    
    // 1. List all collections
    console.log('\nListing all collections:');
    const collections = await qdrantClient.getCollections();
    console.log(`Found ${collections.collections?.length || 0} collections`);
    
    if (collections.collections) {
      for (const collection of collections.collections) {
        console.log(`- ${collection.name}`);
      }
    }
    
    // 2. Check chat_sessions collection
    const chatCollectionName = 'chat_sessions';
    console.log(`\nChecking ${chatCollectionName} collection details:`);
    
    try {
      const collectionInfo = await qdrantClient.getCollection(chatCollectionName);
      console.log('Collection info:', JSON.stringify(collectionInfo, null, 2));
      
      // 3. Count points in the collection
      console.log(`\nCounting points in ${chatCollectionName}:`);
      const countResult = await qdrantClient.count(chatCollectionName);
      console.log(`Total points: ${countResult.count || 0}`);
      
      // 4. List some points from the collection
      console.log(`\nListing up to 5 points from ${chatCollectionName}:`);
      const scrollResult = await qdrantClient.scroll(chatCollectionName, {
        limit: 5,
        with_payload: true,
        with_vector: false
      });
      
      if (scrollResult.result?.points?.length > 0) {
        for (const point of scrollResult.result.points) {
          console.log(`\nPoint ID: ${point.id}`);
          console.log('Payload keys:', Object.keys(point.payload || {}));
          
          if (point.payload?.metadata) {
            console.log('Metadata keys:', Object.keys(point.payload.metadata));
            
            // Show agent/user IDs if they exist
            if (point.payload.metadata.userId) {
              console.log(`User ID: ${point.payload.metadata.userId}`);
            }
            if (point.payload.metadata.agentId) {
              console.log(`Agent ID: ${point.payload.metadata.agentId}`);
            }
          }
          
          if (point.payload?.participants) {
            if (Array.isArray(point.payload.participants)) {
              console.log('Participants:', point.payload.participants.map(p => `${p.id} (${p.type})`).join(', '));
            } else if (typeof point.payload.participants === 'string') {
              console.log('Participants string:', point.payload.participants);
            }
          }
        }
      } else {
        console.log('No points found');
      }
      
      // 5. Try to search by ID for latest test chat
      if (process.argv.length > 2) {
        const testChatId = process.argv[2];
        console.log(`\nSearching for specific chat ID: ${testChatId}`);
        
        try {
          const pointResult = await qdrantClient.getPoints(chatCollectionName, { 
            ids: [testChatId],
            with_payload: true,
            with_vector: false
          });
          
          if (pointResult.result && pointResult.result.length > 0) {
            console.log('Found the chat!');
            console.log('Chat payload:', JSON.stringify(pointResult.result[0].payload, null, 2));
          } else {
            console.log('Chat not found by ID lookup');
          }
        } catch (idError) {
          console.error('Error looking up by ID:', idError.message);
        }
      }
      
    } catch (collectionError) {
      console.error(`Collection ${chatCollectionName} does not exist or error:`, collectionError.message);
    }
    
  } catch (error) {
    console.error('Error in debug utility:', error);
  }
}

// Run the debug utility
debugQdrant().catch(console.error); 