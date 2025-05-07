# Structured Identifier System (ULID)

This module implements a robust, sortable, unique identifier system using ULID (Universally Unique Lexicographically Sortable Identifier) to replace the previous timestamp-based ID system.

## Key Features

- **Guaranteed Uniqueness**: Combines timestamp with random values for guaranteed uniqueness
- **Lexicographic Sorting**: IDs can be sorted lexicographically to maintain chronological order
- **Namespacing with Prefixes**: All IDs include a prefix for type identification (user, chat, message, etc.)
- **Timestamp Extraction**: Easily extract creation time from any ID
- **Compact Representation**: Uses 26-character Crockford Base32 encoding (128 bits)
- **Migration Utilities**: Tools for migrating from legacy timestamp-based IDs

## Basic Usage

### Creating Identifiers

The simplest way to create identifiers is using the helper factory functions:

```typescript
import { createUserId, createChatId, createMessageId } from '../id';

// Create a user ID
const userId = createUserId();
console.log(userId.toString()); // e.g., 'user_01H2X3Z5A7B9C0D1E2F3G4H5J6'

// Create a chat ID
const chatId = createChatId();

// Create a message ID
const messageId = createMessageId();
```

### Creating Custom Identifiers

You can create identifiers with custom prefixes using the `IdGenerator`:

```typescript
import { IdGenerator } from '../id';

// Create a custom ID with a specific prefix
const customId = IdGenerator.generate('custom');
console.log(customId.toString()); // e.g., 'custom_01H2X3Z5A7B9C0D1E2F3G4H5J6'

// Create an ID with a specific timestamp
const timestamp = new Date('2023-01-01T00:00:00Z');
const pastId = IdGenerator.generateWithTimestamp('event', timestamp);
```

### Parsing Identifiers

You can parse string representations back into structured IDs:

```typescript
import { IdGenerator } from '../id';

const idString = 'msg_01H2X3Z5A7B9C0D1E2F3G4H5J6';
const parsedId = IdGenerator.parse(idString);

if (parsedId) {
  console.log(parsedId.prefix); // 'msg'
  console.log(parsedId.timestamp); // Date object with creation time
}
```

### Working with Timestamps

You can extract creation timestamps from IDs:

```typescript
import { IdGenerator } from '../id';

// Parse an ID and get its timestamp
const idString = 'msg_01H2X3Z5A7B9C0D1E2F3G4H5J6';
const parsedId = IdGenerator.parse(idString);
if (parsedId) {
  const creationTime = parsedId.getTimestamp();
  console.log(`Message created at: ${creationTime.toISOString()}`);
}

// Extract timestamp directly from a ULID
const timestamp = IdGenerator.getTimestamp('01H2X3Z5A7B9C0D1E2F3G4H5J6');
console.log(`Created at: ${timestamp.toISOString()}`);
```

## Available Prefixes

The `IdPrefix` enum provides standard prefixes for different entity types:

```typescript
enum IdPrefix {
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

## Migrating from Legacy IDs

For migrating from the legacy timestamp-based IDs to the new ULID format, use the migration utilities:

```typescript
import { migrateTimestampId, batchMigrateIds, IdPrefix } from '../id';

// Migrate a single legacy ID
const legacyId = '1622505600000-some-suffix';
const newId = migrateTimestampId(legacyId, IdPrefix.USER, { preserveTimestamp: true });

// Batch migrate a collection of objects with IDs
const legacyItems = [
  { id: '1622505600000-item1', name: 'Item 1' },
  { id: '1622592000000-item2', name: 'Item 2' }
];
const migratedItems = batchMigrateIds(legacyItems, 'id', IdPrefix.MESSAGE, { preserveTimestamp: true });
```

## Best Practices

1. **Use Factory Functions**: Prefer the helper factory functions for creating standard entity IDs
2. **Store as Strings**: Store IDs as strings in the database, use the `toString()` method
3. **Parse on Usage**: Parse IDs back to structured objects when you need to access properties
4. **Validate IDs**: Use `IdGenerator.parse()` to validate and parse incoming ID strings
5. **Preserve Timestamps in Migration**: Use `{ preserveTimestamp: true }` when migrating to maintain chronology

## Implementation Details

- The ULID format is a 26-character Crockford Base32 string (128 bits)
- The first 10 characters encode the timestamp in milliseconds since Unix epoch
- The remaining 16 characters contain random values for uniqueness
- The complete string representation follows the format: `{prefix}_{ulid}` 