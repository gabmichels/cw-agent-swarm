/**
 * Test script for memory hybrid search API
 * 
 * This script tests the hybrid search functionality of the memory system,
 * which combines vector similarity search with keyword matching.
 * 
 * Usage: pnpm tsx scripts/test-hybrid-search.ts
 */
import fetch from 'node-fetch';

// Configuration
const BASE_URL = 'http://localhost:3000/api/memory';
const HYBRID_SEARCH_ENDPOINT = `${BASE_URL}/hybrid-search`;

// Test cases with different hybrid ratios
const TEST_CASES = [
  { query: 'test memory', hybridRatio: 0.7, description: 'Default ratio (70% vector, 30% text)' },
  { query: 'test memory', hybridRatio: 1.0, description: 'Pure vector search' },
  { query: 'test memory', hybridRatio: 0.0, description: 'Pure text search' },
  { query: 'test memory', hybridRatio: 0.5, description: 'Balanced hybrid search' },
];

// Define response type for better type safety
interface SearchResult {
  payload?: {
    text?: string;
    [key: string]: any;
  };
  score?: number;
  [key: string]: any;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  error?: string;
  searchInfo?: {
    query: string;
    filter: Record<string, any>;
    limit: number;
    offset: number;
    hybridRatio: number;
  };
}

/**
 * Run hybrid search test with specific parameters
 */
async function runHybridSearchTest(params: {
  query: string;
  hybridRatio: number;
  description: string;
}) {
  try {
    console.log(`\nTesting hybrid search with ${params.description}:`);
    console.log(`- Query: "${params.query}"`);
    console.log(`- Hybrid ratio: ${params.hybridRatio} (${params.hybridRatio * 100}% vector, ${(1 - params.hybridRatio) * 100}% text)`);
    
    // Prepare the request body
    const requestBody = {
      query: params.query,
      limit: 5,
      hybridRatio: params.hybridRatio,
      filter: {} // No filter for basic test
    };
    
    // Make the request
    const start = Date.now();
    const response = await fetch(HYBRID_SEARCH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    const elapsed = Date.now() - start;
    
    // Parse the response
    const data = await response.json() as SearchResponse;
    
    // Log the results
    if (response.ok) {
      console.log(`✅ Success (${elapsed}ms) | Status: ${response.status} | Found: ${data.total} results`);
      
      if (data.results && data.results.length > 0) {
        console.log('\nTop 3 results:');
        data.results.slice(0, 3).forEach((result, index) => {
          console.log(`${index + 1}. ${result.payload?.text?.substring(0, 100) || '[No text]'}...`);
          
          if (result.score !== undefined) {
            console.log(`   Score: ${result.score}`);
          }
          
          console.log(''); // Add spacing
        });
      } else {
        console.log('No results found.');
      }
    } else {
      console.log(`❌ Error | Status: ${response.status} | Message: ${data.error || 'Unknown error'}`);
    }
    
    return {
      success: response.ok,
      status: response.status,
      data
    };
  } catch (error) {
    console.error('Test execution error:', error);
    return {
      success: false,
      status: 500,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('=== Memory Hybrid Search API Test ===');
  
  // Check if the server is running by calling the health endpoint
  try {
    const healthResponse = await fetch(`${BASE_URL}/health`);
    if (!healthResponse.ok) {
      console.error(`❌ Server check failed: ${healthResponse.status} ${healthResponse.statusText}`);
      console.error('Make sure the server is running at http://localhost:3000');
      process.exit(1);
    }
    
    console.log('✅ Server is running and health endpoint is responding');
  } catch (error) {
    console.error('❌ Server connection error:', error);
    console.error('Make sure the server is running at http://localhost:3000');
    process.exit(1);
  }
  
  // Run all test cases
  let failedTests = 0;
  
  for (const testCase of TEST_CASES) {
    const result = await runHybridSearchTest(testCase);
    if (!result.success) {
      failedTests++;
    }
  }
  
  // Print summary
  console.log('\n=== Test Summary ===');
  console.log(`Total tests: ${TEST_CASES.length}`);
  console.log(`Successful: ${TEST_CASES.length - failedTests}`);
  console.log(`Failed: ${failedTests}`);
  
  // Exit with appropriate code
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run the tests
main().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
}); 