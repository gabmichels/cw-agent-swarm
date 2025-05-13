/**
 * Direct Chat API Test Script
 * 
 * This script tests:
 * 1. Creating a chat directly through the API
 * 2. Retrieving the chat from Qdrant
 * 
 * This test isolates the chat functionality from agent creation.
 */

const http = require('http');

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
async function testDirectChatCreation() {
  console.log('====== TESTING DIRECT CHAT CREATION AND RETRIEVAL ======');
  
  // Use fixed IDs for testing
  const userId = 'user_admin';
  const agentId = 'test_agent_' + Date.now();
  const chatName = `Test Chat ${Date.now()}`;
  
  try {
    // 1. Create a chat directly
    const chatData = {
      name: chatName,
      description: 'Test direct chat creation',
      settings: {
        visibility: 'private',
        allowAnonymousMessages: false,
        enableBranching: false,
        recordTranscript: true
      },
      metadata: {
        userId: userId,
        agentId: agentId,
        tags: ['test', 'direct'],
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
    
    console.log(`Chat creation response status: ${chatResponse.status}`);
    console.log('Chat response body:', JSON.stringify(chatResponse.body, null, 2));
    
    if (chatResponse.status !== 200 || !chatResponse.body.success) {
      console.error('❌ Chat creation failed:', chatResponse.body.error || 'Unknown error');
      return;
    }
    
    const createdChat = chatResponse.body.chat;
    console.log('✅ Chat created successfully with ID:', createdChat.id);
    
    // 2. Retrieve the chat by ID
    console.log('Retrieving the chat by ID...');
    const getByIdResponse = await makeRequest(`http://localhost:3000/api/multi-agent/chats?id=${createdChat.id}`, {
      method: 'GET'
    });
    
    console.log(`Retrieval by ID response status: ${getByIdResponse.status}`);
    
    if (getByIdResponse.status !== 200 || !getByIdResponse.body.success) {
      console.error('❌ Chat retrieval by ID failed:', getByIdResponse.body.error || 'Unknown error');
    } else if (getByIdResponse.body.chats.length === 0) {
      console.error('❌ Chat not found by ID');
    } else {
      console.log('✅ Chat retrieved successfully by ID');
      console.log('Chat details:', JSON.stringify(getByIdResponse.body.chats[0], null, 2));
    }
    
    // 3. Retrieve the chat by userId and agentId
    console.log('Retrieving the chat by userId and agentId...');
    const getByUserAgentResponse = await makeRequest(`http://localhost:3000/api/multi-agent/chats?userId=${userId}&agentId=${agentId}`, {
      method: 'GET'
    });
    
    console.log(`Retrieval by user/agent response status: ${getByUserAgentResponse.status}`);
    
    if (getByUserAgentResponse.status !== 200 || !getByUserAgentResponse.body.success) {
      console.error('❌ Chat retrieval by user/agent failed:', getByUserAgentResponse.body.error || 'Unknown error');
    } else if (getByUserAgentResponse.body.chats.length === 0) {
      console.error('❌ Chat not found by user/agent combination');
    } else {
      console.log('✅ Chat retrieved successfully by user/agent combination');
      console.log(`Found ${getByUserAgentResponse.body.chats.length} chats`);
      console.log('First chat details:', JSON.stringify(getByUserAgentResponse.body.chats[0], null, 2));
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  console.log('Starting test - make sure your server is running on port 3000');
  testDirectChatCreation();
}

// Export the function for use in other tests
module.exports = {
  testDirectChatCreation,
  makeRequest
}; 