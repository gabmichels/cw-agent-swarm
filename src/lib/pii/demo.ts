/**
 * PII Redaction Demo
 * 
 * This file demonstrates how the PII redaction system works with examples.
 */

import { redactSensitiveData, PIIType, RedactionOptions } from './redactor';

/**
 * Runs various examples of the PII redaction functionality
 */
async function runPIIRedactionDemo() {
  console.log('=== PII Redaction System Demo ===\n');

  // Example 1: Basic PII redaction
  await demonstrateBasicRedaction();

  // Example 2: Multiple types of PII
  await demonstrateMultiplePIITypes();

  // Example 3: Selective PII redaction
  await demonstrateSelectiveRedaction();

  // Example 4: Using with LLM (simulation)
  await demonstrateLLMRedaction();

  console.log('\n=== Demo Complete ===');
}

/**
 * Demonstrates basic PII redaction with a single type
 */
async function demonstrateBasicRedaction() {
  console.log('--- Example 1: Basic PII Redaction ---');
  
  const content = "Please contact me at john.doe@example.com for more information.";
  console.log('Original:', content);
  
  const result = await redactSensitiveData(content);
  
  console.log('Redacted:', result.redactedContent);
  console.log('PII Detected:', result.piiDetected);
  console.log('Types:', result.detectedTypes);
  console.log('Count:', result.redactionCount);
  console.log();
}

/**
 * Demonstrates redaction of multiple types of PII in a single text
 */
async function demonstrateMultiplePIITypes() {
  console.log('--- Example 2: Multiple PII Types ---');
  
  const content = `
Customer Information:
Name: John Smith
Email: jsmith@company.com
Phone: 555-123-4567
Credit Card: 4111 1111 1111 1111
IP Address: 192.168.1.1
`;
  
  console.log('Original:', content);
  
  const result = await redactSensitiveData(content);
  
  console.log('Redacted:', result.redactedContent);
  console.log('PII Detected:', result.piiDetected);
  console.log('Types:', result.detectedTypes);
  console.log('Count:', result.redactionCount);
  console.log();
}

/**
 * Demonstrates selective PII redaction
 */
async function demonstrateSelectiveRedaction() {
  console.log('--- Example 3: Selective PII Redaction ---');
  
  const content = `
Contact: 
Email: contact@company.com
Phone: 555-987-6543
`;
  
  console.log('Original:', content);
  
  // Only redact email addresses, leave phone numbers
  const options: RedactionOptions = {
    types: [PIIType.EMAIL]
  };
  
  const result = await redactSensitiveData(content, options);
  
  console.log('Redacted (emails only):', result.redactedContent);
  console.log('PII Detected:', result.piiDetected);
  console.log('Types:', result.detectedTypes);
  console.log('Count:', result.redactionCount);
  console.log();
}

/**
 * Demonstrates LLM-based redaction (simulated)
 */
async function demonstrateLLMRedaction() {
  console.log('--- Example 4: LLM-based Redaction (Simulated) ---');
  
  const content = `
My address is 123 Main Street, Springfield, IL 62701.
I was born on May 15, 1982.
My social security number is 123-45-6789.
`;
  
  console.log('Original:', content);
  
  // Simulate LLM redaction
  const mockLLMFunction = async (prompt: string): Promise<string> => {
    // This is a simulation of what an LLM might return
    return `
My address is [REDACTED_ADDRESS].
I was born on [REDACTED_DATE_OF_BIRTH].
My social security number is [REDACTED_SSN].
`;
  };
  
  const options: RedactionOptions = {
    useLLM: true,
    llmCallFunction: mockLLMFunction
  };
  
  const result = await redactSensitiveData(content, options);
  
  console.log('Redacted with LLM:', result.redactedContent);
  console.log('PII Detected:', result.piiDetected);
  console.log('Types:', result.detectedTypes);
  console.log('Count:', result.redactionCount);
  console.log();
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runPIIRedactionDemo().catch(console.error);
}

export { runPIIRedactionDemo }; 