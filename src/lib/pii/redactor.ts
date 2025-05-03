/**
 * PII Redaction System
 * 
 * This module provides functionality to detect and redact personally identifiable
 * information (PII) before storing it in the memory system.
 */

/**
 * Types of PII that can be detected and redacted
 */
export enum PIIType {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  NAME = 'NAME',
  CREDIT_CARD = 'CREDIT_CARD',
  IP_ADDRESS = 'IP_ADDRESS',
  CRYPTO_WALLET = 'CRYPTO_WALLET',
  ADDRESS = 'ADDRESS',
  SSN = 'SSN',
  URL = 'URL',
  DATE_OF_BIRTH = 'DATE_OF_BIRTH',
  GENERIC = 'GENERIC'
}

/**
 * PII Detection Patterns
 */
const PII_PATTERNS = {
  // Email addresses
  [PIIType.EMAIL]: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  
  // Phone numbers (various formats)
  [PIIType.PHONE]: /\b(?:\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/g,
  
  // Credit card numbers (major providers)
  [PIIType.CREDIT_CARD]: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
  
  // IP addresses (v4 and v6)
  [PIIType.IP_ADDRESS]: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b|(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}/g,
  
  // Cryptocurrency wallet addresses (Bitcoin, Ethereum)
  [PIIType.CRYPTO_WALLET]: /\b(?:0x[a-fA-F0-9]{40}|bc1[a-zA-HJ-NP-Z0-9]{25,39}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g,
  
  // Social Security Numbers
  [PIIType.SSN]: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
  
  // URLs (simplified pattern)
  [PIIType.URL]: /\bhttps?:\/\/[^\s/$.?#].[^\s]*\b/g,
  
  // Date of birth
  [PIIType.DATE_OF_BIRTH]: /\b(?:\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4})\b/g,
  
  // Names (simple heuristic, may need enhancement)
  // This is a simplistic approach - real name detection would be more complex
  [PIIType.NAME]: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
};

/**
 * Interface for redaction options
 */
export interface RedactionOptions {
  /**
   * Types of PII to redact. If not specified, all types will be redacted.
   */
  types?: PIIType[];
  
  /**
   * Whether to use an LLM for more advanced detection.
   * This can be more accurate but slower and requires API access.
   */
  useLLM?: boolean;
  
  /**
   * The LLM model to use for detection, if useLLM is true
   */
  llmModel?: string;
  
  /**
   * Custom function to call LLM API
   */
  llmCallFunction?: (prompt: string) => Promise<string>;
}

/**
 * Interface for redaction result
 */
export interface RedactionResult {
  /**
   * The redacted content
   */
  redactedContent: string;
  
  /**
   * Whether any PII was detected and redacted
   */
  piiDetected: boolean;
  
  /**
   * Types of PII that were detected
   */
  detectedTypes: PIIType[];
  
  /**
   * Number of redactions made
   */
  redactionCount: number;
}

/**
 * Redacts sensitive personally identifiable information (PII) from the provided content
 * 
 * @param content The text content to redact PII from
 * @param options Configuration options for redaction
 * @returns Object containing redacted content and metadata about the redaction
 */
export async function redactSensitiveData(
  content: string,
  options: RedactionOptions = {}
): Promise<RedactionResult> {
  if (!content) {
    return {
      redactedContent: content,
      piiDetected: false,
      detectedTypes: [],
      redactionCount: 0
    };
  }

  let redactedContent = content;
  const detectedTypes: PIIType[] = [];
  let redactionCount = 0;
  
  // Determine which PII types to check for
  const typesToCheck = options.types || Object.values(PIIType);
  
  // First pass: Use regex patterns to detect and redact common PII
  for (const type of typesToCheck) {
    if (type in PII_PATTERNS) {
      const pattern = PII_PATTERNS[type as keyof typeof PII_PATTERNS];
      
      // Skip if pattern is undefined
      if (!pattern) continue;
      
      const matches = redactedContent.match(pattern);
      
      if (matches && matches.length > 0) {
        // Add this type to detected types if not already added
        if (!detectedTypes.includes(type)) {
          detectedTypes.push(type);
        }
        
        // Redact all instances of this PII type
        redactedContent = redactedContent.replace(pattern, `[REDACTED_${type}]`);
        redactionCount += matches.length;
      }
    }
  }
  
  // Second pass (optional): Use LLM to detect and redact more complex PII
  if (options.useLLM) {
    const llmResult = await useLLMForPIIRedaction(redactedContent, options);
    
    if (llmResult.piiDetected) {
      redactedContent = llmResult.redactedContent;
      
      // Add any new detected types
      for (const type of llmResult.detectedTypes) {
        if (!detectedTypes.includes(type)) {
          detectedTypes.push(type);
        }
      }
      
      redactionCount += llmResult.redactionCount;
    }
  }
  
  return {
    redactedContent,
    piiDetected: detectedTypes.length > 0,
    detectedTypes,
    redactionCount
  };
}

/**
 * Uses an LLM to detect and redact more complex forms of PII
 * 
 * @param content The already pattern-redacted content to check for additional PII
 * @param options Redaction options including LLM configuration
 * @returns Redaction result with updated content
 */
async function useLLMForPIIRedaction(
  content: string,
  options: RedactionOptions
): Promise<RedactionResult> {
  // If no LLM call function is provided, return the content unchanged
  if (!options.llmCallFunction) {
    console.warn('LLM redaction requested but no LLM call function provided');
    return {
      redactedContent: content,
      piiDetected: false,
      detectedTypes: [],
      redactionCount: 0
    };
  }

  try {
    // Create prompt for the LLM
    const prompt = `
Find and redact all personal or sensitive information in the following text by replacing 
each instance with [REDACTED_TYPE] where TYPE describes the kind of information.
For example: email→[REDACTED_EMAIL], phone→[REDACTED_PHONE], name→[REDACTED_NAME],
credit card→[REDACTED_CREDIT_CARD], address→[REDACTED_ADDRESS]

Examples of information to redact:
- Names of individuals
- Addresses, location details
- Phone numbers in any format
- Email addresses
- Financial information (account numbers, credit card details)
- Identification numbers (SSN, passport, drivers license)
- Dates of birth
- Any other personally identifiable information

Only output the redacted text with no explanations.

Text to redact:
${content}`;

    // Call LLM
    const llmRedactedContent = await options.llmCallFunction(prompt);
    
    // Count how many redactions were made
    const redactionMatches = llmRedactedContent.match(/\[REDACTED_[A-Z_]+\]/g) || [];
    
    // Extract the types of redactions that were made
    const detectedTypeStrings = redactionMatches.map(match => {
      const typeString = match.replace(/\[REDACTED_([A-Z_]+)\]/, '$1');
      return typeString as PIIType;
    });
    
    // Filter to only valid PIIType values
    const validDetectedTypes = detectedTypeStrings.filter(
      type => Object.values(PIIType).includes(type)
    );
    
    // Add GENERIC for any types that don't match our enum
    const uniqueValidTypes = Array.from(new Set([
      ...validDetectedTypes,
      ...(detectedTypeStrings.length > validDetectedTypes.length ? [PIIType.GENERIC] : [])
    ]));
    
    return {
      redactedContent: llmRedactedContent,
      piiDetected: redactionMatches.length > 0,
      detectedTypes: uniqueValidTypes,
      redactionCount: redactionMatches.length
    };
  } catch (error) {
    console.error('Error using LLM for PII redaction:', error);
    return {
      redactedContent: content, // Return original content on error
      piiDetected: false,
      detectedTypes: [],
      redactionCount: 0
    };
  }
} 