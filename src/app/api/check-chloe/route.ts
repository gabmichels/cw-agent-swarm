import { NextResponse } from 'next/server';
import { ChloeAgent } from '../../../agents/chloe';

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
    
    // Step 1: Check if Chloe class is available
    try {
      results.steps.push('1. Checking if Chloe class is available');
      if (typeof ChloeAgent !== 'function') {
        throw new Error('ChloeAgent is not a constructor');
      }
      results.steps.push(`✅ Found ChloeAgent class`);
    } catch (error) {
      results.steps.push('❌ Failed to access ChloeAgent class');
      if (error instanceof Error) {
        results.steps.push(`Error: ${error.message}`);
      }
      throw error;
    }
    
    // Step 2: Try to create an instance
    let instance;
    try {
      results.steps.push('2. Attempting to create a ChloeAgent instance');
      instance = new ChloeAgent();
      results.steps.push('✅ Successfully created ChloeAgent instance');
    } catch (error) {
      results.steps.push('❌ Failed to create ChloeAgent instance');
      if (error instanceof Error) {
        results.steps.push(`Error: ${error.message}`);
      }
      throw error;
    }
    
    // Step 3: Try to initialize
    try {
      results.steps.push('3. Attempting to initialize the ChloeAgent');
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
    
    // Step 4: Check for required methods
    try {
      results.steps.push('4. Checking for required methods');
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