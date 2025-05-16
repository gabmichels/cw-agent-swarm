/**
 * Chat Creation Test Script
 * 
 * This script tests:
 * 1. Creating an agent through the API
 * 2. Verifying that a chat is automatically created with that agent
 * 3. Retrieving the chat from Qdrant
 */

const http = require('http');
const crypto = require('crypto');

// Helper function for UUID conversion - same as in our system
function getUuidForAgentId(agentId) {
  const md5Hash = crypto.createHash('md5').update(agentId).digest('hex');
  return `${md5Hash.substring(0, 8)}-${md5Hash.substring(8, 12)}-${md5Hash.substring(12, 16)}-${md5Hash.substring(16, 20)}-${md5Hash.substring(20, 32)}`;
}

// Helper function to make HTTP requests
async function makeRequest(url, options, data = null) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, options, (response) => {
      let responseData = '';
      response.on('data', (chunk) => {
        responseData += chunk;
      });
      response.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({ status: response.statusCode, body: parsedData });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    if (data) {
      request.write(data);
    }

    request.end();
  });
}

// Test function
async function testChatCreationAndRetrieval() {
  console.log('====== TESTING CHAT CREATION AND RETRIEVAL ======');
  console.log('Step 1: Creating a test agent...');
  
  const testAgentName = `Test_Agent_${Date.now()}`;
  
  const testAgent = {
    name: testAgentName,
    description: 'Agent created for chat testing',
    status: 'active',
    capabilities: [
      { name: 'chat', description: 'Can participate in chat conversations' }
    ],
    parameters: {
      model: process.env.OPENAI_MODEL_NAME
    },
    metadata: {
      tags: ['test', 'chat']
    }
  };
  
  try {
    // 1. Create an agent
    console.log('Creating agent:', JSON.stringify(testAgent, null, 2));
    
    const agentResponse = await makeRequest('http://localhost:3000/api/multi-agent/agents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(testAgent))
      }
    }, JSON.stringify(testAgent));
    
    console.log(`Agent creation response status: ${agentResponse.status}`);
    
    if (agentResponse.status !== 200 || !agentResponse.body.success) {
      console.error('❌ Agent creation failed:', agentResponse.body.error || 'Unknown error');
      return;
    }
    
    const createdAgent = agentResponse.body.agent;
    console.log('✅ Agent created successfully with ID:', createdAgent.id);
    
    // Wait a moment to ensure the chat is created
    console.log('Waiting for chat creation to complete...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. Check if a chat was created for this agent
    const userId = 'user_admin'; // The default user ID we're using
    
    const chatsResponse = await makeRequest(`http://localhost:3000/api/multi-agent/chats?userId=${userId}&agentId=${createdAgent.id}`, {
      method: 'GET'
    });
    
    console.log(`Chat retrieval response status: ${chatsResponse.status}`);
    
    if (chatsResponse.status !== 200 || !chatsResponse.body.success) {
      console.error('❌ Chat retrieval failed:', chatsResponse.body.error || 'Unknown error');
      
      // Try creating a chat manually as fallback
      console.log('Creating a chat manually as fallback...');
      await createChatManually(userId, createdAgent.id, testAgentName);
      return;
    }
    
    const chats = chatsResponse.body.chats;
    console.log(`Found ${chats.length} chats for the user and agent`);
    
    if (chats.length === 0) {
      console.log('⚠️ No chat was automatically created during agent creation');
      
      // Create a chat manually
      console.log('Creating a chat manually...');
      await createChatManually(userId, createdAgent.id, testAgentName);
    } else {
      // Chat was automatically created
      const chat = chats[0];
      console.log('✅ Chat was automatically created with ID:', chat.id);
      console.log('Chat details:', JSON.stringify(chat, null, 2));
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Helper function to create a chat manually
async function createChatManually(userId, agentId, agentName) {
  try {
    const chatData = {
      name: `Chat with ${agentName}`,
      description: `Test conversation with ${agentName}`,
      settings: {
        visibility: 'private',
        allowAnonymousMessages: false,
        enableBranching: false,
        recordTranscript: true
      },
      metadata: {
        userId: userId,
        agentId: agentId,
        tags: ['test'],
        category: ['one-on-one'],
        priority: 'medium',
        sensitivity: 'internal',
        language: ['en'],
        version: '1.0'
      }
    };
    
    console.log('Creating chat with data:', JSON.stringify(chatData, null, 2));
    
    const chatResponse = await makeRequest('http://localhost:3000/api/multi-agent/chats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(chatData))
      }
    }, JSON.stringify(chatData));
    
    console.log(`Manual chat creation response status: ${chatResponse.status}`);
    
    if (chatResponse.status !== 200 || !chatResponse.body.success) {
      console.error('❌ Manual chat creation failed:', chatResponse.body.error || 'Unknown error');
      return;
    }
    
    const createdChat = chatResponse.body.chat;
    console.log('✅ Chat created manually with ID:', createdChat.id);
    
    // Verify the chat was stored
    console.log('Verifying the chat was stored in Qdrant...');
    const verifyResponse = await makeRequest(`http://localhost:3000/api/multi-agent/chats?id=${createdChat.id}`, {
      method: 'GET'
    });
    
    if (verifyResponse.status === 200 && verifyResponse.body.success && verifyResponse.body.chats.length > 0) {
      console.log('✅ Chat verified in storage');
    } else {
      console.error('❌ Failed to verify chat in storage');
    }
    
  } catch (error) {
    console.error('Error creating chat manually:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  console.log('Starting test - make sure your server is running on port 3000');
  testChatCreationAndRetrieval();
}

// Export functions for use in other tests
module.exports = {
  testChatCreationAndRetrieval,
  createChatManually,
  makeRequest,
  getUuidForAgentId
}; 