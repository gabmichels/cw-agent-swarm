#!/usr/bin/env node

/**
 * Simple script to run the ChloeGraph tests
 * Usage: node runTest.js
 */

console.log('Starting ChloeGraph test runner...');

// Run tests using ts-node
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
  },
});

// Import and run the test
require('./test').testChloeGraph()
  .then(() => {
    console.log('✅ All tests completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }); 