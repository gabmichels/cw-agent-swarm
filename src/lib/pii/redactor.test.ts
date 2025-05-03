/**
 * Tests for the PII redaction functionality
 */

import { redactSensitiveData, PIIType } from './redactor';
// Import Vitest testing functions
import { describe, test, expect, vi } from 'vitest';

describe('PII Redaction', () => {
  test('should not modify text without PII', async () => {
    const text = "This is a normal text without personal information.";
    const result = await redactSensitiveData(text);
    
    expect(result.redactedContent).toBe(text);
    expect(result.piiDetected).toBe(false);
    expect(result.detectedTypes).toHaveLength(0);
    expect(result.redactionCount).toBe(0);
  });

  test('should redact email addresses', async () => {
    const text = "Please contact me at john.doe@example.com for more information.";
    const result = await redactSensitiveData(text);
    
    expect(result.redactedContent).toBe("Please contact me at [REDACTED_EMAIL] for more information.");
    expect(result.piiDetected).toBe(true);
    expect(result.detectedTypes).toContain(PIIType.EMAIL);
    expect(result.redactionCount).toBe(1);
  });

  test('should redact phone numbers in different formats', async () => {
    const text = "Call me at +1 (555) 123-4567 or 555-987-6543.";
    const result = await redactSensitiveData(text);
    
    expect(result.redactedContent).toBe("Call me at [REDACTED_PHONE] or [REDACTED_PHONE].");
    expect(result.piiDetected).toBe(true);
    expect(result.detectedTypes).toContain(PIIType.PHONE);
    expect(result.redactionCount).toBe(2);
  });

  test('should redact credit card numbers', async () => {
    const text = "My card number is 4111 1111 1111 1111 and expires on 12/25.";
    const result = await redactSensitiveData(text);
    
    expect(result.redactedContent).toContain("[REDACTED_CREDIT_CARD]");
    expect(result.piiDetected).toBe(true);
    expect(result.detectedTypes).toContain(PIIType.CREDIT_CARD);
  });

  test('should redact multiple types of PII', async () => {
    const text = "Hi, I'm John Smith. My email is john.smith@example.com and my phone is 555-123-4567.";
    const result = await redactSensitiveData(text);
    
    expect(result.redactedContent).toContain("[REDACTED_NAME]");
    expect(result.redactedContent).toContain("[REDACTED_EMAIL]");
    expect(result.redactedContent).toContain("[REDACTED_PHONE]");
    expect(result.piiDetected).toBe(true);
    expect(result.detectedTypes).toContain(PIIType.NAME);
    expect(result.detectedTypes).toContain(PIIType.EMAIL);
    expect(result.detectedTypes).toContain(PIIType.PHONE);
    expect(result.redactionCount).toBe(3);
  });

  test('should handle empty strings', async () => {
    const text = "";
    const result = await redactSensitiveData(text);
    
    expect(result.redactedContent).toBe("");
    expect(result.piiDetected).toBe(false);
    expect(result.detectedTypes).toHaveLength(0);
    expect(result.redactionCount).toBe(0);
  });

  test('should redact IP addresses', async () => {
    const text = "The server IP is 192.168.1.1 and the IPv6 is 2001:0db8:85a3:0000:0000:8a2e:0370:7334";
    const result = await redactSensitiveData(text);
    
    expect(result.redactedContent).toContain("[REDACTED_IP_ADDRESS]");
    expect(result.piiDetected).toBe(true);
    expect(result.detectedTypes).toContain(PIIType.IP_ADDRESS);
  });

  test('should redact crypto wallet addresses', async () => {
    const text = "Send Bitcoin to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa or Ethereum to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
    const result = await redactSensitiveData(text);
    
    expect(result.redactedContent).toContain("[REDACTED_CRYPTO_WALLET]");
    expect(result.piiDetected).toBe(true);
    expect(result.detectedTypes).toContain(PIIType.CRYPTO_WALLET);
  });

  test('should handle null or undefined inputs', async () => {
    // @ts-ignore
    const result = await redactSensitiveData(null);
    
    expect(result.redactedContent).toBe(null);
    expect(result.piiDetected).toBe(false);
    expect(result.redactionCount).toBe(0);
  });

  test('should limit redaction to specified types', async () => {
    const text = "Email: test@example.com, Phone: 555-123-4567";
    const result = await redactSensitiveData(text, { types: [PIIType.EMAIL] });
    
    expect(result.redactedContent).toBe("Email: [REDACTED_EMAIL], Phone: 555-123-4567");
    expect(result.piiDetected).toBe(true);
    expect(result.detectedTypes).toContain(PIIType.EMAIL);
    expect(result.detectedTypes).not.toContain(PIIType.PHONE);
    expect(result.redactionCount).toBe(1);
  });

  // Test LLM redaction with mock
  test('should use LLM for complex PII detection when enabled', async () => {
    const mockLlmFunction = vi.fn().mockResolvedValue(
      "Hi, I'm [REDACTED_NAME]. I live at [REDACTED_ADDRESS]."
    );
    
    const text = "Hi, I'm David Johnson. I live at 123 Main St, Springfield IL.";
    const result = await redactSensitiveData(text, { 
      useLLM: true,
      llmCallFunction: mockLlmFunction
    });
    
    expect(mockLlmFunction).toHaveBeenCalled();
    expect(result.redactedContent).toContain("[REDACTED_NAME]");
    expect(result.redactedContent).toContain("[REDACTED_ADDRESS]");
    expect(result.piiDetected).toBe(true);
  });
}); 