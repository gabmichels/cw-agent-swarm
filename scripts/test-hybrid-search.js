/**
 * Script to test the hybrid search functionality
 * 
 * Run with: npm run memory:test-hybrid-search
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
  magenta: '\x1b[35m',
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
    result: `${colors.magenta}[RESULT]${colors.reset}`,
  };
  
  console.log(`${prefix[type] || prefix.info} ${message}`);
}

/**
 * Creates a set of test memories for search tests
 */
async function createTestMemories() {
  const testId = uuidv4();
  log(`Creating test set with ID: ${testId}`, 'step');
  
  const testMemories = [
    {
      type: 'message',
      content: 'The quick brown fox jumps over the lazy dog',
      metadata: {
        tags: ['test', 'animals'],
        testId,
        keywords: ['fox', 'dog', 'jump'],
        sentiment: 'neutral'
      }
    },
    {
      type: 'message',
      content: 'A fox is a cunning animal with bushy tail and sharp senses',
      metadata: {
        tags: ['test', 'animals', 'fox'],
        testId,
        keywords: ['fox', 'animal', 'cunning'],
        sentiment: 'positive'
      }
    },
    {
      type: 'thought',
      content: 'Dogs are loyal companions and have been domesticated for thousands of years',
      metadata: {
        tags: ['test', 'animals', 'dog'],
        testId,
        keywords: ['dog', 'loyal', 'companion'],
        sentiment: 'positive'
      }
    },
    {
      type: 'document',
      content: 'Artificial intelligence and machine learning are transforming how we interact with technology',
      metadata: {
        tags: ['test', 'technology'],
        testId,
        keywords: ['ai', 'machine learning', 'technology'],
        sentiment: 'neutral'
      }
    },
    {
      type: 'thought',
      content: 'The future of AI is both promising and concerning for society',
      metadata: {
        tags: ['test', 'technology', 'future'],
        testId,
        keywords: ['ai', 'future', 'society'],
        sentiment: 'mixed'
      }
    }
  ];
  
  // Create memories
  const createdIds = [];
  for (const memory of testMemories) {
    const id = uuidv4();
    createdIds.push(id);
    
    const createResponse = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...memory,
        id
      })
    });
    
    const createData = await createResponse.json();
    
    if (createResponse.ok && createData.success) {
      log(`Created memory: ${id.substring(0, 8)}... - ${memory.content.substring(0, 30)}...`);
    } else {
      log(`Failed to create memory: ${JSON.stringify(createData)}`, 'error');
    }
  }
  
  log(`Created ${createdIds.length} test memories`, 'success');
  
  return {
    testId,
    createdIds
  };
}

/**
 * Run hybrid search tests with different parameters
 */
async function runHybridSearchTests(testId) {
  const testCases = [
    {
      name: 'Basic keyword match',
      query: 'fox',
      hybridRatio: 0.5,
      expectedKeywords: ['fox']
    },
    {
      name: 'Semantic similarity without keywords',
      query: 'canine pets',
      hybridRatio: 0.9, // Heavily favor vector similarity
      expectedKeywords: ['dog']
    },
    {
      name: 'Mixed keywords and semantics',
      query: 'intelligent systems future',
      hybridRatio: 0.7,
      expectedKeywords: ['ai', 'machine learning']
    },
    {
      name: 'Hybrid with type filter',
      query: 'animals',
      hybridRatio: 0.5,
      filter: {
        must: [
          {
            key: 'type',
            match: {
              value: 'thought'
            }
          }
        ]
      },
      expectedKeywords: ['dog']
    },
    {
      name: 'Hybrid with metadata filter',
      query: 'technology',
      hybridRatio: 0.5,
      filter: {
        must: [
          {
            key: 'metadata.sentiment',
            match: {
              value: 'mixed'
            }
          }
        ]
      },
      expectedKeywords: ['ai', 'future']
    }
  ];
  
  // Run each test case
  for (const testCase of testCases) {
    log(`Running test: ${testCase.name}`, 'step');
    
    const searchResponse = await fetch(`${API_BASE}/hybrid-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: testCase.query,
        hybridRatio: testCase.hybridRatio,
        filter: {
          must: [
            {
              key: 'metadata.testId',
              match: {
                value: testId
              }
            },
            ...(testCase.filter?.must || [])
          ],
          ...(testCase.filter?.should && { should: testCase.filter.should }),
          ...(testCase.filter?.must_not && { must_not: testCase.filter.must_not })
        },
        limit: 10
      })
    });
    
    const searchData = await searchResponse.json();
    
    if (searchResponse.ok) {
      log(`Found ${searchData.results?.length || 0} results`, 'success');
      
      // Display top results
      if (searchData.results && searchData.results.length > 0) {
        const topResults = searchData.results.slice(0, 3);
        
        for (const [i, result] of topResults.entries()) {
          const content = result.point.payload.text.substring(0, 50) + (result.point.payload.text.length > 50 ? '...' : '');
          log(`Result ${i+1} (score: ${result.score.toFixed(3)}): ${content}`, 'result');
        }
        
        // Check if expected keywords appear in results
        if (testCase.expectedKeywords && testCase.expectedKeywords.length > 0) {
          const allText = searchData.results.map(r => r.point.payload.text).join(' ').toLowerCase();
          const foundKeywords = testCase.expectedKeywords.filter(kw => allText.includes(kw.toLowerCase()));
          
          if (foundKeywords.length === testCase.expectedKeywords.length) {
            log(`All expected keywords found: ${foundKeywords.join(', ')}`, 'success');
          } else {
            log(`Only found ${foundKeywords.length}/${testCase.expectedKeywords.length} expected keywords: ${foundKeywords.join(', ')}`, 'warning');
          }
        }
      } else {
        log('No results found', 'warning');
      }
    } else {
      log(`Search failed: ${JSON.stringify(searchData)}`, 'error');
    }
    
    console.log(); // Add spacing between test cases
  }
}

/**
 * Clean up test memories
 */
async function cleanupTestMemories(createdIds) {
  log('Cleaning up test memories', 'step');
  
  let successCount = 0;
  for (const id of createdIds) {
    const deleteResponse = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'message' // We need a type but the server will determine the actual type
      })
    });
    
    if (deleteResponse.ok) {
      successCount++;
    } else {
      log(`Failed to delete memory ${id}`, 'warning');
    }
  }
  
  log(`Cleaned up ${successCount}/${createdIds.length} test memories`, 'success');
}

/**
 * Run all tests
 */
async function runTests() {
  log('Starting hybrid search tests', 'info');
  
  try {
    // Check health first
    const healthResponse = await fetch(`${API_BASE}/health`);
    const healthData = await healthResponse.json();
    
    if (!healthResponse.ok || healthData.status !== 'ok') {
      log(`Memory system health check failed! ${JSON.stringify(healthData)}`, 'error');
      return;
    }
    
    // Create test memories
    const { testId, createdIds } = await createTestMemories();
    
    // Wait a bit for embeddings to be available
    log('Waiting for embeddings to be generated...', 'info');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run tests
    await runHybridSearchTests(testId);
    
    // Clean up
    await cleanupTestMemories(createdIds);
    
    log('All hybrid search tests completed!', 'success');
    
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