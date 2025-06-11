/**
 * Migrate Agent Capabilities Script
 * 
 * This script migrates capabilities from agent 34d75975-4a1f-167a-743d-92190d910ae0 (Kleo)
 * to the capabilities collection in Qdrant and ensures the form integration works properly.
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
const { v4: uuidv4 } = require('uuid');
const { ulid } = require('ulid');

// Configuration
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const AGENT_ID = '34d75975-4a1f-167a-743d-92190d910ae0';
const CAPABILITIES_COLLECTION = 'capabilities';
const AGENTS_COLLECTION = 'agents';

// Capability types enum
const CapabilityType = {
  SKILL: 'skill',
  DOMAIN: 'domain', 
  ROLE: 'role',
  TAG: 'tag'
};

// Sample capabilities for Kleo agent based on typical AI assistant capabilities
const KLEO_CAPABILITIES = [
  {
    id: 'skill.conversation',
    name: 'Conversation',
    description: 'Ability to engage in natural, contextual conversations with users',
    type: CapabilityType.SKILL,
    level: 'expert'
  },
  {
    id: 'skill.problem_solving',
    name: 'Problem Solving',
    description: 'Capability to analyze problems and provide structured solutions',
    type: CapabilityType.SKILL,
    level: 'advanced'
  },
  {
    id: 'skill.knowledge_retrieval',
    name: 'Knowledge Retrieval',
    description: 'Ability to access and retrieve relevant information from knowledge bases',
    type: CapabilityType.SKILL,
    level: 'advanced'
  },
  {
    id: 'skill.task_planning',
    name: 'Task Planning',
    description: 'Capability to break down complex tasks into manageable steps',
    type: CapabilityType.SKILL,
    level: 'intermediate'
  },
  {
    id: 'skill.code_assistance',
    name: 'Code Assistance',
    description: 'Ability to help with programming tasks, debugging, and code review',
    type: CapabilityType.SKILL,
    level: 'advanced'
  },
  {
    id: 'domain.general_knowledge',
    name: 'General Knowledge',
    description: 'Broad knowledge across various domains and subjects',
    type: CapabilityType.DOMAIN,
    level: 'expert'
  },
  {
    id: 'domain.technology',
    name: 'Technology',
    description: 'Specialized knowledge in technology, software, and digital systems',
    type: CapabilityType.DOMAIN,
    level: 'advanced'
  },
  {
    id: 'domain.business',
    name: 'Business',
    description: 'Understanding of business processes, strategy, and operations',
    type: CapabilityType.DOMAIN,
    level: 'intermediate'
  },
  {
    id: 'role.assistant',
    name: 'Assistant',
    description: 'Primary role as a helpful AI assistant',
    type: CapabilityType.ROLE,
    level: 'expert'
  },
  {
    id: 'role.advisor',
    name: 'Advisor',
    description: 'Role as a knowledgeable advisor providing guidance and recommendations',
    type: CapabilityType.ROLE,
    level: 'advanced'
  },
  {
    id: 'role.collaborator',
    name: 'Collaborator',
    description: 'Ability to work collaboratively with users on projects and tasks',
    type: CapabilityType.ROLE,
    level: 'advanced'
  },
  {
    id: 'tag.helpful',
    name: 'Helpful',
    description: 'Characterized by being consistently helpful and supportive',
    type: CapabilityType.TAG,
    level: 'expert'
  },
  {
    id: 'tag.reliable',
    name: 'Reliable',
    description: 'Dependable and consistent in performance and responses',
    type: CapabilityType.TAG,
    level: 'advanced'
  },
  {
    id: 'tag.adaptable',
    name: 'Adaptable',
    description: 'Able to adjust approach based on context and user needs',
    type: CapabilityType.TAG,
    level: 'advanced'
  }
];

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
 * Generate embedding for text (mock implementation)
 */
async function generateEmbedding(text) {
  // For now, generate a random embedding vector of dimension 1536
  // In production, this should use the actual embedding service
  const dimensions = 1536;
  const embedding = Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
  return embedding;
}

/**
 * Check if collection exists, create if it doesn't
 */
async function ensureCollection(client, collectionName, dimensions = 1536) {
  try {
    const collections = await client.getCollections();
    const exists = collections.collections.some(c => c.name === collectionName);
    
    if (!exists) {
      console.log(`Creating collection: ${collectionName}`);
      await client.createCollection(collectionName, {
        vectors: {
          size: dimensions,
          distance: 'Cosine'
        }
      });
      
      // Create useful indices
      await client.createPayloadIndex(collectionName, {
        field_name: 'type',
        field_schema: 'keyword'
      });
      
      await client.createPayloadIndex(collectionName, {
        field_name: 'agentId',
        field_schema: 'keyword'
      });
      
      await client.createPayloadIndex(collectionName, {
        field_name: 'level',
        field_schema: 'keyword'
      });
      
      await client.createPayloadIndex(collectionName, {
        field_name: 'timestamp',
        field_schema: 'datetime'
      });
      
      console.log(`Collection ${collectionName} created successfully`);
    } else {
      console.log(`Collection ${collectionName} already exists`);
    }
  } catch (error) {
    console.error(`Error ensuring collection ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Get agent data from the agents collection
 */
async function getAgentData(client, agentId) {
  try {
    const searchResult = await client.search(AGENTS_COLLECTION, {
      vector: await generateEmbedding('dummy'), // Dummy vector for search
      limit: 100,
      filter: {
        must: [
          {
            key: 'id',
            match: {
              value: agentId
            }
          }
        ]
      },
      with_payload: true
    });
    
    if (searchResult.length > 0) {
      return searchResult[0].payload;
    }
    
    console.log(`Agent ${agentId} not found in agents collection`);
    return null;
  } catch (error) {
    console.error(`Error retrieving agent ${agentId}:`, error);
    return null;
  }
}

/**
 * Store capability in the capabilities collection
 */
async function storeCapability(client, capability, agentId) {
  const timestamp = new Date().toISOString();
  const capabilityId = uuidv4();
  
  // Generate content for embedding
  const content = `${capability.name} - ${capability.description} (${capability.type}: ${capability.level})`;
  
  // Generate embedding
  const embedding = await generateEmbedding(content);
  
  const point = {
    id: capabilityId,
    vector: embedding,
    payload: {
      id: capability.id,
      name: capability.name,
      description: capability.description,
      type: capability.type,
      level: capability.level,
      agentId: agentId,
      version: '1.0.0',
      parameters: {},
      tags: [],
      domains: capability.type === CapabilityType.DOMAIN ? [capability.name] : [],
      content: content,
      timestamp: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      schemaVersion: '1.0',
      metadata: {}
    }
  };
  
  try {
    await client.upsert(CAPABILITIES_COLLECTION, {
      wait: true,
      points: [point]
    });
    console.log(`✅ Stored capability: ${capability.name} (${capability.id})`);
    return true;
  } catch (error) {
    console.error(`❌ Error storing capability ${capability.name}:`, error);
    return false;
  }
}

/**
 * Check if capability already exists
 */
async function capabilityExists(client, capabilityId) {
  try {
    const searchResult = await client.search(CAPABILITIES_COLLECTION, {
      vector: await generateEmbedding('dummy'),
      limit: 1,
      filter: {
        must: [
          {
            key: 'id',
            match: {
              value: capabilityId
            }
          }
        ]
      }
    });
    
    return searchResult.length > 0;
  } catch (error) {
    console.error(`Error checking if capability exists: ${capabilityId}`, error);
    return false;
  }
}

/**
 * Update agent with capabilities reference
 */
async function updateAgentCapabilities(client, agentId, capabilities) {
  try {
    // Search for the agent
    const searchResult = await client.search(AGENTS_COLLECTION, {
      vector: await generateEmbedding('dummy'),
      limit: 1,
      filter: {
        must: [
          {
            key: 'id',
            match: {
              value: agentId
            }
          }
        ]
      },
      with_payload: true
    });
    
    if (searchResult.length === 0) {
      console.log(`Agent ${agentId} not found for capability update`);
      return false;
    }
    
    const agentPoint = searchResult[0];
    const agentPayload = agentPoint.payload;
    
    // Update capabilities in agent payload
    const updatedPayload = {
      ...agentPayload,
      capabilities: capabilities.map(cap => ({
        id: cap.id,
        name: cap.name,
        description: cap.description,
        version: '1.0.0',
        parameters: {}
      })),
      updatedAt: new Date().toISOString()
    };
    
    // Regenerate content for new embedding
    const newContent = `${updatedPayload.name} - ${updatedPayload.description} - Capabilities: ${capabilities.map(c => c.name).join(', ')}`;
    const newEmbedding = await generateEmbedding(newContent);
    
    // Update the agent point with new content and embedding
    await client.upsert(AGENTS_COLLECTION, {
      wait: true,
      points: [{
        id: agentPoint.id,
        vector: newEmbedding,  // Use new embedding
        payload: {
          ...updatedPayload,
          content: newContent  // Update content too
        }
      }]
    });
    
    console.log(`✅ Updated agent ${agentId} with ${capabilities.length} capabilities`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating agent capabilities:`, error);
    return false;
  }
}

/**
 * Main migration function
 */
async function migrateCapabilities() {
  console.log('🚀 Starting Agent Capabilities Migration');
  console.log('=====================================\n');
  
  try {
    // Initialize client
    const client = createQdrantClient();
    console.log('✅ Connected to Qdrant');
    
    // Ensure capabilities collection exists
    await ensureCollection(client, CAPABILITIES_COLLECTION);
    
    // Ensure agents collection exists (in case it doesn't)
    await ensureCollection(client, AGENTS_COLLECTION);
    
    // Get agent data
    console.log(`🔍 Looking for agent: ${AGENT_ID}`);
    const agentData = await getAgentData(client, AGENT_ID);
    
    if (agentData) {
      console.log(`✅ Found agent: ${agentData.name || 'Unknown'}`);
      console.log(`   Description: ${agentData.description || 'No description'}`);
    } else {
      console.log(`⚠️ Agent ${AGENT_ID} not found in database, proceeding with migration anyway`);
    }
    
    // Migrate capabilities
    console.log(`\n📦 Migrating ${KLEO_CAPABILITIES.length} capabilities for Kleo agent...`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const capability of KLEO_CAPABILITIES) {
      // Check if capability already exists
      const exists = await capabilityExists(client, capability.id);
      
      if (exists) {
        console.log(`⏭️ Skipped (already exists): ${capability.name}`);
        skippedCount++;
        continue;
      }
      
      // Store the capability
      const success = await storeCapability(client, capability, AGENT_ID);
      if (success) {
        migratedCount++;
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Migrated: ${migratedCount} capabilities`);
    console.log(`   ⏭️ Skipped: ${skippedCount} capabilities`);
    console.log(`   📦 Total: ${KLEO_CAPABILITIES.length} capabilities`);
    
    // Update agent with capabilities
    if (agentData || migratedCount > 0) {
      console.log(`\n🔄 Updating agent with capability references...`);
      await updateAgentCapabilities(client, AGENT_ID, KLEO_CAPABILITIES);
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Test the AgentRegistrationForm to ensure capabilities are loaded');
    console.log('   2. Verify capabilities appear in the capability selection UI');
    console.log('   3. Check that new agents can add these capabilities');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

/**
 * List capabilities in collection for verification
 */
async function listCapabilities() {
  try {
    const client = createQdrantClient();
    
    console.log('\n🔍 Listing capabilities in collection...');
    
    const searchResult = await client.search(CAPABILITIES_COLLECTION, {
      vector: await generateEmbedding('dummy'),
      limit: 100,
      with_payload: true
    });
    
    console.log(`Found ${searchResult.length} capabilities:`);
    
    const groupedByType = {};
    
    searchResult.forEach(point => {
      const payload = point.payload;
      const type = payload.type || 'unknown';
      
      if (!groupedByType[type]) {
        groupedByType[type] = [];
      }
      
      groupedByType[type].push({
        id: payload.id,
        name: payload.name,
        level: payload.level,
        agentId: payload.agentId
      });
    });
    
    Object.entries(groupedByType).forEach(([type, capabilities]) => {
      console.log(`\n📁 ${type.toUpperCase()} (${capabilities.length}):`);
      capabilities.forEach(cap => {
        console.log(`   • ${cap.name} (${cap.level}) - Agent: ${cap.agentId}`);
      });
    });
    
  } catch (error) {
    console.error('Error listing capabilities:', error);
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  if (command === 'list') {
    await listCapabilities();
  } else {
    await migrateCapabilities();
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  migrateCapabilities,
  listCapabilities,
  KLEO_CAPABILITIES
}; 