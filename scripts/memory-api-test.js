/**
 * Script to test memory API endpoints
 * 
 * Run with: npm run memory:api-test
 */
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

// Base URL for API calls
const API_BASE = 'http://localhost:3000/api/memory';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Log a message with a colored prefix
 */
function log(message, type = 'info') {
  const prefix = {
    info: `${colors.blue}[INFO]${colors.reset}`,
    success: `${colors.green}[SUCCESS]${colors.reset}`,
    error: `${colors.red}[ERROR]${colors.reset}`,
    warning: `${colors.yellow}[WARNING]${colors.reset}`,
    step: `${colors.cyan}[STEP]${colors.reset}`,
  };
  
  console.log(`${prefix[type] || prefix.info} ${message}`);
}

/**
 * Run all API tests
 */
async function runTests() {
  log('Starting memory API tests', 'info');
  
  try {
    // Step 1: Check health endpoint
    log('Testing health endpoint', 'step');
    const healthResponse = await fetch(`${API_BASE}/health`);
    const healthData = await healthResponse.json();
    
    if (healthResponse.ok && healthData.status === 'ok') {
      log('Health endpoint working', 'success');
    } else {
      log(`Health check failed: ${JSON.stringify(healthData)}`, 'error');
      return;
    }
    
    // Step 2: Create a test memory
    log('Creating test memory', 'step');
    const testId = uuidv4();
    const testMemory = {
      type: 'message',
      content: 'This is a test memory created by the API test script',
      metadata: {
        tags: ['test', 'api'],
        testId,
        testRun: new Date().toISOString()
      },
      id: testId
    };
    
    const createResponse = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMemory)
    });
    
    const createData = await createResponse.json();
    
    if (createResponse.ok && createData.success) {
      log(`Memory created with ID: ${createData.id}`, 'success');
    } else {
      log(`Failed to create memory: ${JSON.stringify(createData)}`, 'error');
      return;
    }
    
    // Step 3: Get the memory by ID
    log('Retrieving memory by ID', 'step');
    const getResponse = await fetch(`${API_BASE}/${testId}`);
    const getData = await getResponse.json();
    
    if (getResponse.ok && getData.id === testId) {
      log('Successfully retrieved memory', 'success');
    } else {
      log(`Failed to get memory: ${JSON.stringify(getData)}`, 'error');
      return;
    }
    
    // Step 4: Update the memory
    log('Updating memory', 'step');
    const updateResponse = await fetch(`${API_BASE}/${testId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'message',
        content: 'This memory has been updated by the API test script',
        metadata: {
          tags: ['test', 'api', 'updated'],
          updated: true
        }
      })
    });
    
    const updateData = await updateResponse.json();
    
    if (updateResponse.ok && updateData.success) {
      log('Successfully updated memory', 'success');
    } else {
      log(`Failed to update memory: ${JSON.stringify(updateData)}`, 'error');
      return;
    }
    
    // Step 5: Get memory history
    log('Retrieving memory history', 'step');
    const historyResponse = await fetch(`${API_BASE}/history/${testId}`);
    const historyData = await historyResponse.json();
    
    if (historyResponse.ok) {
      log(`Retrieved ${historyData.history?.length || 0} history entries`, 'success');
    } else {
      log(`Failed to get memory history: ${JSON.stringify(historyData)}`, 'error');
    }
    
    // Step 6: Test search endpoint
    log('Testing search endpoint', 'step');
    const searchResponse = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'test memory',
        filter: {
          must: [
            {
              key: 'metadata.testId',
              match: {
                value: testId
              }
            }
          ]
        },
        limit: 5
      })
    });
    
    const searchData = await searchResponse.json();
    
    if (searchResponse.ok && searchData.results?.length > 0) {
      log(`Search found ${searchData.results.length} results`, 'success');
    } else {
      log(`Search did not find expected results: ${JSON.stringify(searchData)}`, 'error');
    }
    
    // Step 7: Test hybrid search endpoint
    log('Testing hybrid search endpoint', 'step');
    const hybridSearchResponse = await fetch(`${API_BASE}/hybrid-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'test memory',
        filter: {
          must: [
            {
              key: 'metadata.testId',
              match: {
                value: testId
              }
            }
          ]
        },
        limit: 5
      })
    });
    
    const hybridSearchData = await hybridSearchResponse.json();
    
    if (hybridSearchResponse.ok && hybridSearchData.results?.length > 0) {
      log(`Hybrid search found ${hybridSearchData.results.length} results`, 'success');
    } else {
      log(`Hybrid search did not find expected results: ${JSON.stringify(hybridSearchData)}`, 'error');
    }
    
    // Step 8: List all memories (limit to 5)
    log('Listing memories', 'step');
    const listResponse = await fetch(`${API_BASE}?limit=5`);
    const listData = await listResponse.json();
    
    if (listResponse.ok && Array.isArray(listData.memories)) {
      log(`Listed ${listData.memories.length} memories`, 'success');
    } else {
      log(`Failed to list memories: ${JSON.stringify(listData)}`, 'error');
    }
    
    // Step 9: Delete the test memory
    log('Deleting test memory', 'step');
    const deleteResponse = await fetch(`${API_BASE}/${testId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'message'
      })
    });
    
    const deleteData = await deleteResponse.json();
    
    if (deleteResponse.ok && deleteData.success) {
      log('Successfully deleted memory', 'success');
    } else {
      log(`Failed to delete memory: ${JSON.stringify(deleteData)}`, 'error');
      return;
    }
    
    // Final result
    log('All API tests completed successfully! 🎉', 'success');
    
  } catch (error) {
    log(`Test failed with error: ${error.message}`, 'error');
    console.error(error);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
}); 