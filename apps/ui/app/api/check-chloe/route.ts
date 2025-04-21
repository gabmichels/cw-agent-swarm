import { NextResponse } from 'next/server';

interface ChloeCheckResults {
  timestamp: string;
  steps: string[];
  success: boolean;
  error: string | null;
}

export async function GET() {
  try {
    const results: ChloeCheckResults = {
      timestamp: new Date().toISOString(),
      steps: [],
      success: false,
      error: null
    };
    
    // Step 1: Try to get the require path
    try {
      results.steps.push('1. Checking if Chloe package is resolvable');
      const chloePath = require.resolve('@crowd-wisdom/agents-chloe');
      results.steps.push(`✅ Found Chloe package at: ${chloePath}`);
    } catch (error) {
      results.steps.push('❌ Failed to resolve Chloe package path');
      if (error instanceof Error) {
        results.steps.push(`Error: ${error.message}`);
      }
      throw error;
    }
    
    // Step 2: Try to import using dynamic import
    let chloeModule;
    try {
      results.steps.push('2. Attempting to dynamically import the package');
      chloeModule = await import('@crowd-wisdom/agents-chloe');
      const exports = Object.keys(chloeModule);
      results.steps.push(`✅ Successfully imported with exports: ${exports.join(', ')}`);
    } catch (error) {
      results.steps.push('❌ Failed to import Chloe package');
      if (error instanceof Error) {
        results.steps.push(`Error: ${error.message}`);
      }
      throw error;
    }
    
    // Step 3: Check for ChloeAgent class
    if (!chloeModule.ChloeAgent) {
      results.steps.push('❌ ChloeAgent class not found in exports');
      throw new Error('ChloeAgent class not found');
    } else {
      results.steps.push('✅ Found ChloeAgent class in exports');
    }
    
    // Step 4: Try to create an instance
    let instance;
    try {
      results.steps.push('3. Attempting to create a ChloeAgent instance');
      instance = new chloeModule.ChloeAgent();
      results.steps.push('✅ Successfully created ChloeAgent instance');
    } catch (error) {
      results.steps.push('❌ Failed to create ChloeAgent instance');
      if (error instanceof Error) {
        results.steps.push(`Error: ${error.message}`);
      }
      throw error;
    }
    
    // Step 5: Try to initialize
    try {
      results.steps.push('4. Attempting to initialize the ChloeAgent');
      // Wait for a maximum of 10 seconds
      const initPromise = instance.initialize();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Initialization timed out after 10 seconds')), 10000)
      );
      
      await Promise.race([initPromise, timeoutPromise]);
      results.steps.push('✅ Successfully initialized ChloeAgent');
    } catch (error) {
      results.steps.push('❌ Failed to initialize ChloeAgent');
      if (error instanceof Error) {
        results.steps.push(`Error: ${error.message}`);
      }
      throw error;
    }
    
    // Step 6: Check for required methods
    try {
      results.steps.push('5. Checking for required methods');
      if (typeof instance.processMessage !== 'function') {
        throw new Error('processMessage method is missing');
      }
      if (typeof instance.getMemory !== 'function') {
        throw new Error('getMemory method is missing');
      }
      
      results.steps.push('✅ All required methods are present');
    } catch (error) {
      results.steps.push('❌ Missing required methods');
      if (error instanceof Error) {
        results.steps.push(`Error: ${error.message}`);
      }
      throw error;
    }
    
    // Final step: success!
    results.success = true;
    results.steps.push('✅ Chloe agent works correctly!');
    
    return NextResponse.json(results);
  } catch (error: unknown) {
    // Return whatever steps we managed to complete
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorWithSteps = error as { steps?: string[] };
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      steps: errorWithSteps.steps || [],
      success: false,
      error: errorMessage
    });
  }
} 