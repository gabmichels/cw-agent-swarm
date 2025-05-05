import { loadApiKey } from './server/memory/testing/load-api-key';

// Test the API key loading utility
async function testApiKeyLoading() {
  console.log('Testing API key loading utility...');
  
  // Current environment variables
  console.log('Initial OPENAI_API_KEY:', process.env.OPENAI_API_KEY || 'not set');
  
  // Load the API key
  const apiKey = loadApiKey();
  console.log('Loaded API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'not found');
  
  // Check if it's now set in process.env
  console.log('OPENAI_API_KEY now in env:', process.env.OPENAI_API_KEY ? 'yes' : 'no');
  
  console.log('Test completed!');
}

// Run the test
testApiKeyLoading().catch(console.error); 