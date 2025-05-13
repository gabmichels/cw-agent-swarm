/**
 * Chat Integration Tests Runner
 * 
 * This script runs all chat-related integration tests.
 */

const { testDirectChatCreation } = require('./direct-chat.test');
const { testChatCreationAndRetrieval } = require('./chat-creation.test');

async function runAllTests() {
  console.log('=======================================================');
  console.log('           RUNNING CHAT INTEGRATION TESTS              ');
  console.log('=======================================================');
  
  console.log('\n1. Testing Direct Chat Creation and Retrieval:');
  await testDirectChatCreation();
  
  console.log('\n2. Testing Chat Creation via Agent Creation:');
  await testChatCreationAndRetrieval();
  
  console.log('\n=======================================================');
  console.log('           ALL CHAT TESTS COMPLETED                    ');
  console.log('=======================================================');
}

// Run all tests
runAllTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
}); 