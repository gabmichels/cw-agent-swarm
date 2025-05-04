/**
 * Test script for the standardized memory API endpoints
 * Run with: npm run memory:api-test
 */

import fetch from 'node-fetch';
import * as chalk from 'chalk';

// Set the base URL for the API
const BASE_URL = 'http://localhost:3000/api/memory';

// Define interfaces for API responses
interface HealthResponse {
  status: string;
  collections?: Array<{ name: string; count: number }>;
}

interface MemoryResponse {
  success?: boolean;
  id?: string;
  payload?: {
    text?: string;
    type?: string;
    metadata?: {
      tags?: string[];
      [key: string]: any;
    };
  };
  memory?: {
    id: string;
    payload?: {
      text?: string;
      type?: string;
      metadata?: {
        tags?: string[];
        [key: string]: any;
      };
    };
  };
}

interface SearchResponse {
  results: Array<{
    score: number;
    point: {
      id: string;
      payload: {
        text?: string;
        type?: string;
        metadata?: {
          tags?: string[];
          [key: string]: any;
        };
      };
    };
  }>;
}

interface ListMemoriesResponse {
  memories: any[];
  total: number;
}

interface HistoryResponse {
  id: string;
  history: Array<{
    id: string;
    payload: {
      metadata: {
        edit_type: string;
      }
    }
  }>;
}

// Define test memory properties
const TEST_MEMORY = {
  type: 'message',
  content: 'This is a test message for the API test',
  metadata: {
    tags: ['test', 'api', 'verification'],
    importance: 'medium'
  }
};

// Track generated IDs
let createdMemoryId: string | null = null;

// Helper to log success or failure
function logResult(testName: string, success: boolean, details?: any) {
  if (success) {
    console.log(`${chalk.green('✓')} ${chalk.bold(testName)} - Success`);
  } else {
    console.log(`${chalk.red('✗')} ${chalk.bold(testName)} - Failed`);
    if (details) {
      console.error(chalk.red('  Error details:'), details);
    }
  }
}

// Run all tests in sequence
async function runTests() {
  console.log(chalk.blue('=== Running Memory API Tests ==='));
  
  try {
    // --- Test 1: Health Check ---
    try {
      console.log(chalk.yellow('\nTesting Health Check...'));
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json() as HealthResponse;
      
      const success = response.ok && data.status === 'ok';
      logResult('Health Check', success, success ? null : data);
      
      if (success) {
        console.log('  Collections:', data.collections?.map((c) => `${c.name} (${c.count})`).join(', '));
      }
    } catch (error) {
      logResult('Health Check', false, error);
    }
    
    // --- Test 2: Create Memory ---
    try {
      console.log(chalk.yellow('\nTesting Create Memory...'));
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(TEST_MEMORY)
      });
      
      const data = await response.json() as MemoryResponse;
      
      const success = response.ok && data.success === true && typeof data.id === 'string';
      logResult('Create Memory', success, success ? null : data);
      
      if (success && data.id) {
        createdMemoryId = data.id;
        console.log(`  Created memory with ID: ${createdMemoryId}`);
      }
    } catch (error) {
      logResult('Create Memory', false, error);
    }
    
    // Skip remaining tests if memory creation failed
    if (!createdMemoryId) {
      console.log(chalk.red('\nCannot continue tests without created memory ID'));
      return;
    }
    
    // --- Test 3: Get Memory ---
    try {
      console.log(chalk.yellow('\nTesting Get Memory...'));
      const response = await fetch(`${BASE_URL}/${createdMemoryId}`);
      
      const data = await response.json() as MemoryResponse;
      
      const success = response.ok && data.id === createdMemoryId;
      logResult('Get Memory', success, success ? null : data);
      
      if (success) {
        console.log(`  Memory type: ${data.payload?.type}`);
        console.log(`  Content: "${data.payload?.text?.substring(0, 30)}..."`);
      }
    } catch (error) {
      logResult('Get Memory', false, error);
    }
    
    // --- Test 4: Update Memory ---
    try {
      console.log(chalk.yellow('\nTesting Update Memory...'));
      const updatedContent = `${TEST_MEMORY.content} (Updated)`;
      const updatedTags = [...TEST_MEMORY.metadata.tags, 'updated'];
      
      const response = await fetch(`${BASE_URL}/${createdMemoryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: TEST_MEMORY.type,
          content: updatedContent,
          metadata: {
            tags: updatedTags,
            importance: 'high' // Update importance
          }
        })
      });
      
      const data = await response.json() as MemoryResponse;
      
      const success = response.ok && data.success === true;
      logResult('Update Memory', success, success ? null : data);
      
      if (success) {
        console.log(`  Updated content: "${data.memory?.payload?.text?.substring(0, 30)}..."`);
        console.log(`  Updated tags: ${data.memory?.payload?.metadata?.tags?.join(', ')}`);
      }
    } catch (error) {
      logResult('Update Memory', false, error);
    }
    
    // --- Test 5: Search Memory ---
    try {
      console.log(chalk.yellow('\nTesting Search Memory...'));
      const response = await fetch(`${BASE_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: 'test message',
          filter: {
            must: [
              {
                key: 'type',
                match: {
                  value: TEST_MEMORY.type
                }
              }
            ]
          },
          limit: 5
        })
      });
      
      const data = await response.json() as SearchResponse;
      
      const success = response.ok && Array.isArray(data.results);
      logResult('Search Memory', success, success ? null : data);
      
      if (success) {
        console.log(`  Found ${data.results.length} results`);
        if (data.results.length > 0) {
          console.log(`  Top result score: ${data.results[0].score.toFixed(3)}`);
          console.log(`  Top result content: "${data.results[0].point?.payload?.text?.substring(0, 30)}..."`);
        }
      }
    } catch (error) {
      logResult('Search Memory', false, error);
    }
    
    // --- Test 6: Hybrid Search ---
    try {
      console.log(chalk.yellow('\nTesting Hybrid Search...'));
      const response = await fetch(`${BASE_URL}/hybrid-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: 'test',
          limit: 5
        })
      });
      
      const data = await response.json() as SearchResponse;
      
      const success = response.ok && Array.isArray(data.results);
      logResult('Hybrid Search', success, success ? null : data);
      
      if (success) {
        console.log(`  Found ${data.results.length} results`);
        if (data.results.length > 0) {
          console.log(`  Top result score: ${data.results[0].score.toFixed(3)}`);
          console.log(`  Top result content: "${data.results[0].point?.payload?.text?.substring(0, 30)}..."`);
        }
      }
    } catch (error) {
      logResult('Hybrid Search', false, error);
    }
    
    // --- Test 7: Get Memory History ---
    try {
      console.log(chalk.yellow('\nTesting Get Memory History...'));
      const response = await fetch(`${BASE_URL}/history/${createdMemoryId}`);
      
      const data = await response.json() as HistoryResponse;
      
      const success = response.ok && data.id === createdMemoryId;
      logResult('Get Memory History', success, success ? null : data);
      
      if (success) {
        console.log(`  History entries: ${data.history?.length || 0}`);
        if (data.history?.length > 0) {
          console.log(`  First entry type: ${data.history[0].payload?.metadata?.edit_type}`);
        }
      }
    } catch (error) {
      logResult('Get Memory History', false, error);
    }
    
    // --- Test 8: List Memories ---
    try {
      console.log(chalk.yellow('\nTesting List Memories...'));
      const response = await fetch(`${BASE_URL}?type=${TEST_MEMORY.type}&limit=10`);
      
      const data = await response.json() as ListMemoriesResponse;
      
      const success = response.ok && Array.isArray(data.memories);
      logResult('List Memories', success, success ? null : data);
      
      if (success) {
        console.log(`  Found ${data.memories.length} memories of type ${TEST_MEMORY.type}`);
        console.log(`  Total count: ${data.total}`);
      }
    } catch (error) {
      logResult('List Memories', false, error);
    }
    
    // --- Test 9: Delete Memory ---
    try {
      console.log(chalk.yellow('\nTesting Delete Memory...'));
      const response = await fetch(`${BASE_URL}/${createdMemoryId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: TEST_MEMORY.type
        })
      });
      
      const data = await response.json() as { success: boolean };
      
      const success = response.ok && data.success;
      logResult('Delete Memory', success, success ? null : data);
      
      if (success) {
        console.log(`  Successfully deleted memory with ID: ${createdMemoryId}`);
      }
    } catch (error) {
      logResult('Delete Memory', false, error);
    }
    
    console.log(chalk.blue('\n=== Memory API Tests Completed ==='));
    
  } catch (error) {
    console.error(chalk.red('\nUnexpected error during test execution:'), error);
  }
}

// Run the tests
runTests().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
}); 