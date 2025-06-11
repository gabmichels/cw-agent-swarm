/**
 * Debug Capability Storage Script
 * 
 * This script debugs the capability storage process by testing each step independently
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
const { v4: uuidv4 } = require('uuid');

// Configuration
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const CAPABILITIES_COLLECTION = 'capabilities';

/**
 * Initialize Qdrant client
 */
function createQdrantClient() {
  return new QdrantClient({
    url: QDRANT_URL,
    apiKey: QDRANT_API_KEY
  });
}

/**
 * Generate a mock embedding
 */
function generateMockEmbedding() {
  const dimensions = 1536;
  return Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
}

/**
 * Test capability creation directly in Qdrant
 */
async function testDirectCapabilityStorage() {
  console.log('🔧 Testing Direct Capability Storage');
  console.log('====================================\n');
  
  try {
    const client = createQdrantClient();
    console.log('✅ Connected to Qdrant');
    
    // Check if collection exists
    const collections = await client.getCollections();
    const collectionExists = collections.collections.some(c => c.name === CAPABILITIES_COLLECTION);
    
    if (!collectionExists) {
      console.log(`❌ Collection '${CAPABILITIES_COLLECTION}' does not exist`);
      return;
    }
    
    console.log(`✅ Collection '${CAPABILITIES_COLLECTION}' exists`);
    
    // Test capability data (matching the format from agent creation)
    const testCapability = {
      id: 'test.capability.debug',
      name: 'Debug Test Capability',
      description: 'A test capability for debugging storage issues',
      type: 'skill',
      version: '1.0.0',
      content: 'Debug Test Capability - A test capability for debugging storage issues (skill: basic)',
      createdAt: new Date(),
      updatedAt: new Date(),
      schemaVersion: '1.0'
    };
    
    const agentId = 'debug_agent_test';
    const level = 'basic';
    const embedding = generateMockEmbedding();
    
    console.log('🔄 Creating test capability point...');
    
    // Try to create the point using Qdrant client directly
    const pointId = uuidv4();
    
    await client.upsert(CAPABILITIES_COLLECTION, {
      wait: true,
      points: [{
        id: pointId,
        vector: embedding,
        payload: {
          // Required BaseMemorySchema fields
          id: testCapability.id,
          text: testCapability.content,
          timestamp: testCapability.createdAt.toISOString(),
          type: 'capability_definition', // Use the string value directly
          is_deleted: false,
          
          // Required BaseMetadata fields
          metadata: {
            schemaVersion: testCapability.schemaVersion,
            timestamp: testCapability.createdAt.toISOString(),
            source: 'debug-test',
            tags: [],
            
            // Capability-specific metadata
            capabilityId: testCapability.id,
            capabilityName: testCapability.name,
            capabilityDescription: testCapability.description,
            capabilityType: testCapability.type,
            capabilityVersion: testCapability.version,
            capabilityParameters: {},
            capabilityDomains: [],
            
            // Agent reference
            agentId: agentId,
            level: level,
            category: testCapability.type
          }
        }
      }]
    });
    
    console.log(`✅ Test capability stored with point ID: ${pointId}`);
    
    // Wait a moment for indexing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try to retrieve the capability
    console.log('🔍 Retrieving test capability...');
    
    const retrieved = await client.retrieve(CAPABILITIES_COLLECTION, {
      ids: [pointId],
      with_payload: true,
      with_vector: false
    });
    
    if (retrieved.length > 0) {
      console.log('✅ Test capability retrieved successfully:');
      console.log('   ID:', retrieved[0].payload.id);
      console.log('   Name:', retrieved[0].payload.metadata.capabilityName);
      console.log('   Type:', retrieved[0].payload.metadata.capabilityType);
      console.log('   Agent ID:', retrieved[0].payload.metadata.agentId);
    } else {
      console.log('❌ Test capability could not be retrieved');
    }
    
    // Try to search for the capability using the API
    console.log('\n🔍 Testing API search...');
    
    const response = await fetch('http://localhost:3000/api/multi-agent/capabilities');
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ API returned ${data.capabilities?.length || 0} capabilities`);
      
      const foundTestCap = data.capabilities?.find(cap => cap.id === testCapability.id);
      if (foundTestCap) {
        console.log('✅ Test capability found via API');
      } else {
        console.log('❌ Test capability not found via API');
      }
    } else {
      console.log('❌ API request failed');
    }
    
    // Clean up: delete the test capability
    console.log('\n🧹 Cleaning up test capability...');
    await client.delete(CAPABILITIES_COLLECTION, {
      wait: true,
      points: [pointId]
    });
    console.log('✅ Test capability deleted');
    
  } catch (error) {
    console.error('❌ Error during direct storage test:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
  }
}

/**
 * Test capability creation via the API
 */
async function testAPICapabilityCreation() {
  console.log('\n🌐 Testing API Capability Creation');
  console.log('==================================\n');
  
  try {
    const testCapability = {
      name: 'API Test Capability',
      description: 'A test capability created via the API',
      type: 'skill',
      version: '1.0.0',
      parameters: {},
      tags: ['test'],
      domains: []
    };
    
    console.log('🔄 Creating capability via API...');
    
    const response = await fetch('http://localhost:3000/api/multi-agent/capabilities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testCapability)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Capability created via API');
      console.log('   ID:', data.capability?.id);
      console.log('   Name:', data.capability?.name);
      
      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try to retrieve it
      const getResponse = await fetch('http://localhost:3000/api/multi-agent/capabilities');
      if (getResponse.ok) {
        const getData = await getResponse.json();
        const found = getData.capabilities?.find(cap => cap.id === data.capability?.id);
        if (found) {
          console.log('✅ Created capability found in collection');
        } else {
          console.log('❌ Created capability not found in collection');
        }
      }
    } else {
      const errorData = await response.json();
      console.log('❌ API capability creation failed:', errorData.error);
    }
    
  } catch (error) {
    console.error('❌ Error during API creation test:', error);
  }
}

/**
 * Check collection status
 */
async function checkCollectionStatus() {
  console.log('\n📊 Checking Collection Status');
  console.log('=============================\n');
  
  try {
    const client = createQdrantClient();
    
    const collections = await client.getCollections();
    const capCollection = collections.collections.find(c => c.name === CAPABILITIES_COLLECTION);
    
    if (capCollection) {
      console.log('✅ Capabilities collection exists');
      
      const info = await client.getCollection(CAPABILITIES_COLLECTION);
      console.log(`   Points: ${info.points_count}`);
      console.log(`   Vectors: ${info.vectors_count}`);
      
      if (info.config?.params?.vectors) {
        const vectorConfig = info.config.params.vectors;
        console.log(`   Vector config:`, vectorConfig);
      }
    } else {
      console.log('❌ Capabilities collection does not exist');
    }
    
    // Check if we can scroll through points
    console.log('\n🔄 Scrolling through existing points...');
    
    const scrollResult = await client.scroll(CAPABILITIES_COLLECTION, {
      limit: 10,
      with_payload: true,
      with_vector: false
    });
    
    console.log(`   Found ${scrollResult.points?.length || 0} points in collection`);
    
    if (scrollResult.points && scrollResult.points.length > 0) {
      console.log('   Sample points:');
      scrollResult.points.slice(0, 3).forEach((point, index) => {
        console.log(`     ${index + 1}. ${point.payload?.metadata?.capabilityName || point.payload?.id || 'Unknown'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking collection status:', error);
  }
}

/**
 * Main debug function
 */
async function runDebug() {
  console.log('🚀 Debug Capability Storage Process');
  console.log('===================================\n');
  
  try {
    await checkCollectionStatus();
    await testDirectCapabilityStorage();
    await testAPICapabilityCreation();
    
    console.log('\n🎯 Debug Summary');
    console.log('================');
    console.log('• Collection status checked');
    console.log('• Direct Qdrant storage tested'); 
    console.log('• API capability creation tested');
    console.log('\nCheck the output above for any errors or issues.');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
if (require.main === module) {
  runDebug().catch(console.error);
}

module.exports = {
  testDirectCapabilityStorage,
  testAPICapabilityCreation,
  checkCollectionStatus,
  runDebug
}; 