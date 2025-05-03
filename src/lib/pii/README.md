# PII Redaction System

This module provides functionality to detect and redact personally identifiable information (PII) from text content before it is stored in the agent's memory system.

## Features

- **Automated PII Detection**: Identifies common PII patterns like email addresses, phone numbers, credit card numbers, and more
- **Hybrid Detection Method**: Uses both regex patterns and optional LLM-based detection
- **Type-Specific Redaction**: Replaces detected PII with descriptive placeholders (e.g., `[REDACTED_EMAIL]`) to maintain context
- **Metadata Tracking**: Records redaction information in memory metadata for auditing and filtering
- **Customizable**: Can be configured to only redact specific types of PII

## Integration with Memory System

The PII redaction is automatically applied in the `ChloeMemory.addMemory()` method before storing the content. This ensures all memory storage operations are protected by default.

## Usage

### Basic Usage

The PII redaction happens automatically when storing memories:

```typescript
await memory.addMemory(
  "My email is john.doe@example.com and my phone is 555-123-4567",
  'message',
  ImportanceLevel.MEDIUM
);
// Stored as: "My email is [REDACTED_EMAIL] and my phone is [REDACTED_PHONE]"
```

### Accessing Redaction Metadata

You can check if a memory has been redacted by examining its metadata:

```typescript
const memories = await memory.getRecentMemories();
for (const memory of memories) {
  if (memory.metadata?.pii_redacted) {
    console.log(`Memory ${memory.id} contains redacted PII of types: ${memory.metadata.pii_types_detected.join(', ')}`);
  }
}
```

### Using the Redaction Function Directly

You can also use the redaction function directly:

```typescript
import { redactSensitiveData } from '../../lib/pii/redactor';

const { redactedContent, piiDetected, detectedTypes } = await redactSensitiveData(
  "My credit card is 4111 1111 1111 1111"
);
// redactedContent: "My credit card is [REDACTED_CREDIT_CARD]"
// piiDetected: true
// detectedTypes: [PIIType.CREDIT_CARD]
```

### Advanced Configuration

For advanced use cases, you can configure the redaction options:

```typescript
const result = await redactSensitiveData(content, {
  // Only redact specific PII types
  types: [PIIType.EMAIL, PIIType.PHONE],
  
  // Use LLM for more advanced detection
  useLLM: true,
  
  // Provide a custom LLM call function
  llmCallFunction: async (prompt) => {
    // Custom implementation to call an LLM API
    return await someApiCall(prompt);
  }
});
```

## Supported PII Types

- `EMAIL`: Email addresses
- `PHONE`: Phone numbers in various formats
- `NAME`: Names of individuals
- `CREDIT_CARD`: Credit card numbers
- `IP_ADDRESS`: IP addresses (v4 and v6)
- `CRYPTO_WALLET`: Cryptocurrency wallet addresses
- `ADDRESS`: Physical addresses
- `SSN`: Social Security Numbers
- `URL`: Web URLs
- `DATE_OF_BIRTH`: Dates of birth
- `GENERIC`: Generic PII detected by the LLM

## Future Enhancements

- Encrypted audit log for original content
- LLM-based PII detection improvements
- More sophisticated name recognition
- Country-specific PII patterns
- Confidence scores for detected PII 