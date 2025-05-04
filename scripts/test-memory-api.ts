/**
 * Test script for memory API endpoints
 * 
 * Usage: pnpm memory:api-test
 */
import fetch from 'node-fetch';

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  message: string;
  data?: any;
}

const BASE_URL = 'http://localhost:3000/api/memory';
const results: TestResult[] = [];

/**
 * Run a test for an API endpoint
 */
async function testEndpoint(
  endpoint: string,
  method: string,
  body?: any,
  expectedStatus = 200
): Promise<TestResult> {
  try {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`Testing ${method} ${url}...`);
    
    const options: any = { method };
    
    if (body) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    const result: TestResult = {
      endpoint,
      method,
      status: response.status,
      success: response.status === expectedStatus,
      message: response.status === expectedStatus 
        ? 'Success' 
        : `Expected status ${expectedStatus}, got ${response.status}`,
      data
    };
    
    return result;
  } catch (error) {
    return {
      endpoint,
      method,
      status: 500,
      success: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Starting memory API tests...\n');
  
  // Test health endpoint
  results.push(await testEndpoint('/health', 'GET'));
  
  // Create a test memory
  const createResult = await testEndpoint('', 'POST', {
    type: 'MESSAGE',
    content: 'This is a test memory created by the API test script'
  }, 201);
  
  results.push(createResult);
  
  if (createResult.success && createResult.data?.id) {
    const memoryId = createResult.data.id;
    
    // Test getting the memory
    results.push(await testEndpoint(`/${memoryId}`, 'GET'));
    
    // Test updating the memory
    results.push(await testEndpoint(`/${memoryId}`, 'PATCH', {
      content: 'This is an updated test memory',
      metadata: { test: true }
    }));
    
    // Test getting history
    results.push(await testEndpoint(`/history/${memoryId}`, 'GET'));
    
    // Test deleting the memory
    results.push(await testEndpoint(`/${memoryId}?type=MESSAGE`, 'DELETE'));
  }
  
  // Test search
  results.push(await testEndpoint('/search?query=test', 'GET'));
  
  // Test hybrid search
  results.push(await testEndpoint('/hybrid-search', 'POST', {
    query: 'test hybrid search',
    limit: 5,
    hybridRatio: 0.5
  }));
  
  // Test list all memories
  results.push(await testEndpoint('', 'GET'));
  
  // Print results
  console.log('\nTest Results:');
  console.log('=============');
  
  let passed = 0;
  let failed = 0;
  
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${result.method} ${result.endpoint} | ${result.status} | ${result.message}`);
    
    if (result.success) {
      passed++;
    } else {
      failed++;
      if (result.data) {
        console.log('  Response:', JSON.stringify(result.data).substring(0, 100) + '...');
      }
    }
  });
  
  console.log('\nSummary:');
  console.log(`  Total: ${results.length}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
}); 