#!/usr/bin/env node

/**
 * SSE Chat System Test Runner
 * 
 * Runs all SSE-related tests and provides comprehensive reporting
 * Usage: node scripts/run-sse-tests.js [options]
 * 
 * Options:
 *   --verbose    Show detailed test output
 *   --coverage   Run with coverage reporting
 *   --watch      Run tests in watch mode
 *   --specific   Run specific test file (integration|hooks|e2e)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_FILES = {
  integration: 'tests/integration-tests/sse-chat-system.test.ts',
  hooks: 'tests/hooks/useChatWithFallback.test.ts',
  e2e: 'tests/e2e/sse-message-flow.test.ts'
};

const VALIDATION_SCRIPT = 'scripts/validate-sse-system.ts';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  verbose: args.includes('--verbose') || args.includes('-v'),
  coverage: args.includes('--coverage') || args.includes('-c'),
  watch: args.includes('--watch') || args.includes('-w'),
  specific: args.find(arg => arg.startsWith('--specific='))?.split('=')[1],
  help: args.includes('--help') || args.includes('-h')
};

if (options.help) {
  console.log(`
🧪 SSE CHAT SYSTEM TEST RUNNER
==================================================

Usage: node scripts/run-sse-tests.js [options]

Options:
  --verbose, -v           Show detailed test output
  --coverage, -c          Run with coverage reporting  
  --watch, -w             Run tests in watch mode
  --specific=<type>       Run specific test type (integration|hooks|e2e)
  --help, -h              Show this help message

Examples:
  node scripts/run-sse-tests.js                    # Run all tests
  node scripts/run-sse-tests.js --verbose          # Run with detailed output
  node scripts/run-sse-tests.js --coverage         # Run with coverage
  node scripts/run-sse-tests.js --specific=hooks   # Run only hook tests
  node scripts/run-sse-tests.js --watch            # Run in watch mode
`);
  process.exit(0);
}

console.log('🧪 SSE CHAT SYSTEM TEST RUNNER');
console.log('==================================================');

// Helper function to run a command
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.silent ? 'pipe' : 'inherit',
      shell: true,
      ...options
    });

    let stdout = '';
    let stderr = '';

    if (options.silent) {
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        reject({ code, stdout, stderr });
      }
    });

    child.on('error', (error) => {
      reject({ error, stdout, stderr });
    });
  });
}

// Check if test files exist
function checkTestFiles() {
  console.log('📁 Checking test files...');
  
  const missingFiles = [];
  const existingFiles = [];

  Object.entries(TEST_FILES).forEach(([type, filePath]) => {
    if (fs.existsSync(filePath)) {
      existingFiles.push({ type, filePath });
      console.log(`   ✅ ${type}: ${filePath}`);
    } else {
      missingFiles.push({ type, filePath });
      console.log(`   ❌ ${type}: ${filePath} (missing)`);
    }
  });

  // Check validation script
  if (fs.existsSync(VALIDATION_SCRIPT)) {
    console.log(`   ✅ validation: ${VALIDATION_SCRIPT}`);
  } else {
    console.log(`   ❌ validation: ${VALIDATION_SCRIPT} (missing)`);
  }

  console.log('');

  if (missingFiles.length > 0) {
    console.log('⚠️  Some test files are missing. Tests may not run completely.');
    console.log('');
  }

  return { existingFiles, missingFiles };
}

// Run specific test file
async function runTestFile(filePath, testType) {
  console.log(`🔍 Running ${testType} tests...`);
  
  try {
    const vitestArgs = [
      'test',
      filePath,
      '--reporter=verbose'
    ];

    if (options.coverage) {
      vitestArgs.push('--coverage');
    }

    if (options.watch) {
      vitestArgs.push('--watch');
    }

    const result = await runCommand('npm', vitestArgs);
    
    console.log(`✅ ${testType} tests completed successfully`);
    return { success: true, testType, result };
    
  } catch (error) {
    console.log(`❌ ${testType} tests failed`);
    if (options.verbose) {
      console.log('Error details:', error.stderr || error.stdout || error.error);
    }
    return { success: false, testType, error };
  }
}

// Run validation script
async function runValidation() {
  console.log('🔍 Running SSE system validation...');
  
  try {
    const result = await runCommand('npx', ['tsx', VALIDATION_SCRIPT]);
    console.log('✅ SSE system validation completed successfully');
    return { success: true, result };
  } catch (error) {
    console.log('❌ SSE system validation failed');
    if (options.verbose) {
      console.log('Error details:', error.stderr || error.stdout || error.error);
    }
    return { success: false, error };
  }
}

// Generate test report
function generateReport(results) {
  console.log('');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('==================================================');
  
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log('');
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const testName = result.testType || 'validation';
    console.log(`${status} ${testName}`);
    
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error.code || 'Unknown error'}`);
    }
  });
  
  console.log('');
  
  if (failedTests === 0) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('🚀 Your SSE Chat System is working correctly!');
  } else {
    console.log(`⚠️  ${failedTests} test(s) failed. Please review the issues above.`);
    console.log('💡 Run with --verbose flag for more details.');
  }
  
  return failedTests === 0;
}

// Main execution
async function main() {
  try {
    const startTime = Date.now();
    
    // Check test files
    const { existingFiles, missingFiles } = checkTestFiles();
    
    if (existingFiles.length === 0) {
      console.log('❌ No test files found. Please ensure test files exist.');
      process.exit(1);
    }
    
    const results = [];
    
    // Run specific test if requested
    if (options.specific) {
      const testFile = TEST_FILES[options.specific];
      if (!testFile) {
        console.log(`❌ Unknown test type: ${options.specific}`);
        console.log('Available types:', Object.keys(TEST_FILES).join(', '));
        process.exit(1);
      }
      
      if (fs.existsSync(testFile)) {
        const result = await runTestFile(testFile, options.specific);
        results.push(result);
      } else {
        console.log(`❌ Test file not found: ${testFile}`);
        process.exit(1);
      }
    } else {
      // Run all existing test files
      for (const { type, filePath } of existingFiles) {
        const result = await runTestFile(filePath, type);
        results.push(result);
      }
    }
    
    // Run validation script if it exists and we're not in watch mode
    if (!options.watch && fs.existsSync(VALIDATION_SCRIPT)) {
      const validationResult = await runValidation();
      results.push(validationResult);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('');
    console.log(`⏱️  Total Duration: ${duration}ms`);
    
    // Generate final report
    const allPassed = generateReport(results);
    
    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Handle watch mode
if (options.watch) {
  console.log('👀 Running in watch mode...');
  console.log('Press Ctrl+C to exit');
  console.log('');
}

// Run the main function
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
}); 