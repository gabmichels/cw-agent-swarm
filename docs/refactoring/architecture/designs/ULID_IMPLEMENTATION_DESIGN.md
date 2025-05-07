# ULID Implementation Design

## Overview

This document outlines the design for implementing ULID (Universally Unique Lexicographically Sortable Identifier) as a replacement for the current timestamp-based ID system. The implementation follows the clean break approach specified in the refactoring guidelines with no backward compatibility support.

## Current Issues with Timestamp-Based IDs

1. **Lack of Guaranteed Uniqueness**: Timestamps alone don't guarantee uniqueness, especially for high-frequency operations
2. **Poor Sorting Characteristics**: Simple timestamp sorting can be problematic when precision is limited
3. **No Namespacing**: Current IDs don't have built-in type/namespace information
4. **Security Considerations**: Timestamps can reveal creation time information

## ULID Advantages

1. **Guaranteed Uniqueness**: Combines timestamp with random values for guaranteed uniqueness
2. **Lexicographic Sorting**: Maintains chronological order with millisecond precision
3. **Compact Representation**: 26-character Crockford Base32 encoding (128 bits)
4. **No Special Characters**: URL-safe, case-insensitive
5. **Timestamp Preservation**: Contains creation time information when needed

## Implementation Design

### Core Interface

```typescript
export interface StructuredId {
  // The complete ULID string (26 characters)
  id: string;
  
  // Namespace/type prefix (e.g., 'user', 'memory', 'chat')
  prefix: string;
  
  // Extracted timestamp from the ULID
  timestamp: Date;
  
  // String representation that combines prefix and ULID
  toString(): string;
  
  // Get raw ULID without prefix
  toULID(): string;
  
  // Get creation timestamp
  getTimestamp(): Date;
}
```

### IdGenerator Implementation

```typescript
export class IdGenerator {
  // Create a new ID with the given prefix
  static generate(prefix: string): StructuredId;
  
  // Create an ID with the given prefix at a specific timestamp
  static generateWithTimestamp(prefix: string, timestamp: Date): StructuredId;
  
  // Parse an existing ID string into a StructuredId object
  static parse(idString: string): StructuredId | null;
  
  // Check if a string is a valid ULID
  static isValid(idString: string): boolean;
  
  // Extract the timestamp from a ULID
  static getTimestamp(ulid: string): Date;
}
```

### Predefined Prefix Types

```typescript
export enum IdPrefix {
  USER = 'user',
  AGENT = 'agent',
  CHAT = 'chat',
  MESSAGE = 'msg',
  MEMORY = 'mem',
  KNOWLEDGE = 'know',
  DOCUMENT = 'doc',
  THOUGHT = 'thght',
  EMBEDDING = 'embd',
}
```

### Helper Factory Functions

```typescript
// User-friendly factory functions
export function createUserId(): StructuredId;
export function createAgentId(): StructuredId;
export function createChatId(): StructuredId;
export function createMessageId(): StructuredId;
export function createMemoryId(): StructuredId;
```

## Technical Implementation Details

### Using ULID Library

We will use the [`ulid`](https://github.com/ulid/javascript) library as the core implementation, which provides:

- Timestamp + Randomness for guaranteed uniqueness
- Crockford Base32 encoding
- Monotonicity option to prevent timestamp collision issues

### Storage Format

The string representation will follow the format:

```
{prefix}_{ulid}
```

Example: `user_01FGW4ZQVSX7AAY1BSXDQ8S4Z7`

### Migration Approach

Following the clean break approach, we will:

1. Create the new implementation with no backward compatibility
2. Implement a one-time migration utility to convert existing IDs
3. Remove all legacy ID generation and parsing code

### Performance Considerations

- ULID generation is highly performant (microseconds per ID)
- String parsing operations will be optimized for minimal overhead
- No runtime type checking in hot paths to maintain performance

## Usage Examples

### Creating a new ID

```typescript
// Create a user ID
const userId = IdGenerator.generate(IdPrefix.USER);
console.log(userId.toString()); // user_01FGW4ZQVSX7AAY1BSXDQ8S4Z7

// Using helper function
const chatId = createChatId();
console.log(chatId.toString()); // chat_01FGW4ZQVSX7AAY1BSXDQ8S4Z8
```

### Parsing an existing ID

```typescript
const parsedId = IdGenerator.parse("user_01FGW4ZQVSX7AAY1BSXDQ8S4Z7");
if (parsedId) {
  console.log(parsedId.prefix); // user
  console.log(parsedId.timestamp); // 2023-01-23T14:22:16.381Z
}
```

### Working with timestamps

```typescript
// Create ID for a specific time
const pastId = IdGenerator.generateWithTimestamp(
  IdPrefix.MEMORY, 
  new Date("2023-01-01T00:00:00Z")
);

// Extract timestamp from ID
const timestamp = IdGenerator.getTimestamp("01FGW4ZQVSX7AAY1BSXDQ8S4Z7");
```

## Testing Approach

1. **Unit Tests**:
   - Test ID generation with various prefixes
   - Test parsing with valid and invalid IDs
   - Test timestamp extraction accuracy
   - Test sorting behavior

2. **Property Tests**:
   - Verify uniqueness across high-volume generation
   - Verify lexicographic sorting maintains timestamp order
   - Verify cross-platform compatibility

3. **Performance Tests**:
   - Benchmark generation performance
   - Benchmark parsing performance
   - Compare with existing ID generation

## Implementation Tasks

1. Add ULID library to dependencies
2. Create the core `StructuredId` interface
3. Implement the `IdGenerator` class
4. Create factory functions for common ID types
5. Implement validation and parsing functions
6. Write comprehensive tests
7. Create migration utility for existing IDs

## Conclusion

This ULID implementation will provide a robust, future-proof identification system that maintains chronological ordering while guaranteeing uniqueness. By following the clean break approach, we'll ensure consistency throughout the system without the technical debt of maintaining backwards compatibility. 