import crypto from 'crypto';
import https from 'https';
import http from 'http';

// Reuse the same UUID conversion logic as in agent-service.ts
function getUuidForAgentId(agentId: string): string {
  const md5Hash = crypto.createHash('md5').update(agentId).digest('hex');
  return `${md5Hash.substring(0, 8)}-${md5Hash.substring(8, 12)}-${md5Hash.substring(12, 16)}-${md5Hash.substring(16, 20)}-${md5Hash.substring(20, 32)}`;
}

interface ApiResponse {
  status: number;
  body: any;
}

async function makeRequest(url: string, options: http.RequestOptions, data: string | null = null): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const request = (isHttps ? https : http).request(url, options, (response) => {
      let responseData = '';
      response.on('data', (chunk) => {
        responseData += chunk;
      });
      response.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({ status: response.statusCode || 500, body: parsedData });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${(error as Error).message}`));
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

// This is meant to be run manually as an integration test
// Usage: npx ts-node tests/api/multi-agent/agent-api-integration.test.ts
async function testAgentCreation(): Promise<void> {
  console.log('Testing agent API endpoint...');
  
  const testAgent = {
    name: 'API_Test_Agent_' + Date.now(),
    description: 'Test agent created via API',
    status: 'active',
    capabilities: [
      { name: 'basic_conversation', description: 'Can have a basic conversation' }
    ],
    parameters: {
      model: 'gpt-3.5-turbo'
    },
    metadata: {
      test: true
    }
  };
  
  try {
    console.log('Sending agent creation request:', JSON.stringify(testAgent, null, 2));
    
    const requestData = JSON.stringify(testAgent);
    const response = await makeRequest('http://localhost:3000/api/multi-agent/agents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    }, requestData);
    
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(response.body, null, 2));
    
    if (response.status === 200 && response.body.success) {
      console.log('✅ Agent creation test PASSED');
      
      // Store the created agent ID and calculate its expected UUID
      const createdAgentId = response.body.agent.id;
      const createdAgentName = response.body.agent.name;
      const createdAgentUuid = getUuidForAgentId(createdAgentId);
      
      console.log('Original ID:', createdAgentId);
      console.log('Expected UUID in database:', createdAgentUuid);
      
      // Wait a short time to ensure the agent is fully persisted
      console.log('Waiting 1 second before testing retrieval...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify we can retrieve all agents
      console.log('\nVerifying agent retrieval (all agents)...');
      const getResponse = await makeRequest('http://localhost:3000/api/multi-agent/agents', {
        method: 'GET'
      });
      
      if (getResponse.status === 200 && getResponse.body.success) {
        console.log('Found', getResponse.body.agents.length, 'agents in the system');
        console.log('Agents in system:', JSON.stringify(getResponse.body.agents.map((agent: any) => {
          return { id: agent.id, name: agent.name };
        }), null, 2));
        
        // Try finding by name or by UUID (depending on how server returns it)
        const foundAgent = getResponse.body.agents.find((agent: any) => 
          agent.id === createdAgentUuid || 
          agent.id === createdAgentId || 
          agent.name === createdAgentName
        );
        
        if (foundAgent) {
          console.log('✅ Successfully found our agent in the list!');
          console.log('Found agent:', JSON.stringify(foundAgent, null, 2));
          console.log('✅ Agent retrieval test PASSED');
        } else {
          console.log('❌ Our newly created agent was not found in the list');
          console.log('❌ Agent retrieval test FAILED');
        }
      } else {
        console.log('❌ Agent retrieval test FAILED');
        console.log('Response:', JSON.stringify(getResponse.body, null, 2));
      }
    } else {
      console.log('❌ Agent creation test FAILED');
    }
  } catch (error) {
    console.error('Error during API test:', error);
    console.log('❌ Agent creation test FAILED due to error');
  }
}

// Self-executing function to run the test
(async () => {
  await testAgentCreation();
})(); 