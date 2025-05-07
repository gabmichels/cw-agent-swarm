/**
 * UUID utility functions
 */
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a new UUID
 * @returns A new UUID string
 */
export function generateUuid(): string {
  return uuidv4();
}

/**
 * Generate a UUID that's scoped to a user ID
 * This creates a predictable UUID based on the user ID
 * @param userId The user ID to create a scoped UUID for
 * @returns A UUID string prefixed with the user ID
 */
export function generateUserScopedUuid(userId: string): string {
  return `${userId}-${uuidv4().substring(0, 8)}`;
}

/**
 * Generate a chat ID for a user
 * @param userId The user ID
 * @returns A chat ID in UUID format
 */
export function generateChatId(userId: string): string {
  // Generate a proper UUID but ensure we store the user relation as metadata, not in the ID
  return generateUuid();
}

/**
 * Generate a chat ID for a specific user-agent combination
 * @param userId The user ID
 * @param agentId The agent ID
 * @returns A chat ID in UUID format
 */
export function generateAgentUserChatId(userId: string, agentId: string): string {
  // Generate a proper UUID for the chat
  // We'll track the user-agent relationship in metadata, not in the ID
  return generateUuid();
}

/**
 * Generate a completely new chat ID for a new conversation
 * This is useful when creating a new chat thread between the same user and agent
 * @param userId The user ID
 * @param agentId The agent ID
 * @returns A unique chat ID
 */
export function generateNewChatId(userId: string, agentId: string): string {
  // Always generate a fresh UUID for new conversations
  return generateUuid();
} 