/**
 * Example usage of the ULID implementation
 * This file demonstrates how to use the new ID system in the codebase
 */
import {
  IdGenerator,
  IdPrefix,
  createUserId,
  createChatId,
  createMessageId,
  migrateTimestampId,
  batchMigrateIds
} from '../id';

/**
 * Example memory document that uses the new ULID identifiers
 */
interface ExampleMemoryDocument {
  id: string;
  userId: string;
  chatId: string;
  content: string;
  createdAt: Date;
}

/**
 * Example function showing how to create a new memory document
 */
function createMemoryDocument(userId: string, chatId: string, content: string): ExampleMemoryDocument {
  // Create a new memory ID using the IdGenerator
  const memoryId = IdGenerator.generate(IdPrefix.MEMORY);
  
  return {
    id: memoryId.toString(),
    userId,
    chatId,
    content,
    createdAt: new Date()
  };
}

/**
 * Example showing how to parse a structured ID string back into an object
 */
function parseMemoryId(memoryIdString: string) {
  const structuredId = IdGenerator.parse(memoryIdString);
  
  if (!structuredId) {
    throw new Error('Invalid memory ID format');
  }
  
  if (structuredId.prefix !== IdPrefix.MEMORY) {
    throw new Error(`Expected memory ID prefix, got ${structuredId.prefix}`);
  }
  
  return structuredId;
}

/**
 * Example showing how to use factory functions for common ID types
 */
function createNewConversation(userName: string) {
  // Create user and chat IDs using factory functions
  const userId = createUserId();
  const chatId = createChatId();
  
  // Create a message ID
  const messageId = createMessageId();
  
  console.log(`Created new conversation for user ${userName}`);
  console.log(`- User ID: ${userId.toString()}`);
  console.log(`- Chat ID: ${chatId.toString()}`);
  console.log(`- First Message ID: ${messageId.toString()}`);
  
  // The IDs are automatically sortable by creation time
  // This makes it easy to retrieve items in chronological order
  return {
    userId: userId.toString(),
    chatId: chatId.toString(),
    firstMessageId: messageId.toString()
  };
}

/**
 * Example showing how to use the timestamp extraction feature
 */
function getMessageCreationTime(messageId: string) {
  const structuredId = IdGenerator.parse(messageId);
  
  if (!structuredId) {
    throw new Error('Invalid message ID format');
  }
  
  // Get the creation timestamp from the ID
  return structuredId.getTimestamp();
}

/**
 * Example showing migration from legacy IDs to new ULID format
 */
function migrateUserData(legacyUserId: string, legacyMessages: Array<{ id: string, content: string }>) {
  // Migrate a single user ID
  const newUserId = migrateTimestampId(legacyUserId, IdPrefix.USER, { preserveTimestamp: true });
  
  // Batch migrate message IDs
  const migratedMessages = batchMigrateIds(legacyMessages, 'id', IdPrefix.MESSAGE, { preserveTimestamp: true });
  
  return {
    userId: newUserId.toString(),
    messages: migratedMessages
  };
}

// Run the examples if this file is executed directly
if (require.main === module) {
  // Example 1: Create a new memory document
  const userId = createUserId().toString();
  const chatId = createChatId().toString();
  const document = createMemoryDocument(userId, chatId, 'Example memory content');
  console.log('Created memory document:', document);
  
  // Example 2: Parse an ID
  const memoryId = document.id;
  const parsedId = parseMemoryId(memoryId);
  console.log('Parsed memory ID:', parsedId);
  console.log('Creation time:', parsedId.getTimestamp());
  
  // Example 3: Create a new conversation
  const conversation = createNewConversation('John Doe');
  console.log('New conversation:', conversation);
  
  // Example 4: Migration example
  const legacyUserId = '1622505600000-johndoe';
  const legacyMessages = [
    { id: '1622505700000-msg1', content: 'Hello' },
    { id: '1622505800000-msg2', content: 'World' }
  ];
  
  const migratedData = migrateUserData(legacyUserId, legacyMessages);
  console.log('Migrated user data:', migratedData);
} 