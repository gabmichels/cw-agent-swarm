/**
 * Test runner script for memory integration tests.
 * This script:
 * 1. Ensures test collections exist in Qdrant
 * 2. Runs the memory integration tests
 */

import { spawn } from 'child_process';
import { setupTestCollections } from './setup-test-collections';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

/**
 * Run a command and return a promise
 */
function runCommand(command: string, args: string[]): Promise<{code: number, stdout: string, stderr: string}> {
  return new Promise((resolve, reject) => {
    console.log(`${colors.cyan}> ${command} ${args.join(' ')}${colors.reset}`);
    
    let stdout = '';
    let stderr = '';
    
    const childProcess = spawn(command, args, { 
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: process.platform === 'win32' // Use shell on Windows
    });
    
    childProcess.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });
    
    childProcess.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });
    
    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve({code, stdout, stderr});
      } else {
        reject(new Error(`Command exited with code ${code}`));
      }
    });
    
    childProcess.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Main test runner function
 */
async function runMemoryTests() {
  try {
    console.log(`${colors.bright}${colors.cyan}=== Memory Integration Test Runner ===${colors.reset}`);
    
    // Step 1: Setup collections
    console.log(`\n${colors.yellow}Setting up test collections...${colors.reset}`);
    await setupTestCollections();
    
    // Step 2: Run the tests
    console.log(`\n${colors.yellow}Running memory integration tests...${colors.reset}`);
    const result = await runCommand('npx', ['vitest', '--run', 'src/server/memory/testing/integration']);
    
    // Parse test results to count skipped tests
    const skippedMatch = result.stdout.match(/(\d+) skipped/);
    const skippedTests = skippedMatch ? parseInt(skippedMatch[1]) : 0;
    
    if (skippedTests > 0) {
      console.log(`\n${colors.blue}${colors.bright}Tests completed with ${skippedTests} skipped tests.${colors.reset}`);
      console.log(`${colors.blue}See docs/memory/TESTING_RESULTS.md for details on skipped tests.${colors.reset}`);
    } else {
      console.log(`\n${colors.green}${colors.bright}All tests completed successfully!${colors.reset}`);
    }
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}Test run failed:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run the tests if this script is executed directly
if (require.main === module) {
  runMemoryTests().catch(console.error);
}

export { runMemoryTests }; 