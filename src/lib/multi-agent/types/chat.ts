import { ulid } from 'ulid';

/**
 * Participant type enum
 */
export enum ParticipantType {
  USER = 'user',
  AGENT = 'agent',
  SYSTEM = 'system'
}

/**
 * Participant role enum
 */
export enum ParticipantRole {
  OWNER = 'owner',
  MEMBER = 'member',
  OBSERVER = 'observer'
}

/**
 * Chat visibility options
 */
export enum ChatVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  PROTECTED = 'protected'
}

/**
 * Chat settings configuration
 */
export interface ChatSettings {
  visibility: ChatVisibility;
  allowAnonymousMessages: boolean;
  enableBranching: boolean;
  recordTranscript: boolean;
}

/**
 * Chat metadata for additional information
 */
export interface ChatMetadata {
  tags: string[];
  category: string[];
  priority: 'low' | 'medium' | 'high';
  sensitivity: 'public' | 'internal' | 'confidential';
  language: string[];
  version: string;
}

/**
 * Complete chat profile structure
 */
export interface ChatProfile {
  id: string;
  name: string;
  description: string;
  settings: ChatSettings;
  metadata: ChatMetadata;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Chat participant profile
 */
export interface ChatParticipant {
  id: string;
  chatId: string;
  participantId: string;
  participantType: ParticipantType;
  role: ParticipantRole;
  joinedAt: Date;
  lastActiveAt: Date;
}

/**
 * Request to create a new chat
 */
export interface ChatCreationRequest {
  name: string;
  description: string;
  settings: ChatSettings;
  metadata: ChatMetadata;
}

/**
 * Response from chat creation
 */
export interface ChatCreationResponse {
  success: boolean;
  message: string;
  chat?: ChatProfile;
  error?: string;
}

/**
 * Request to add participants to a chat
 */
export interface AddParticipantsRequest {
  chatId: string;
  participants: {
    participantId: string;
    participantType: ParticipantType;
    role: ParticipantRole;
  }[];
}

/**
 * Response from adding participants
 */
export interface AddParticipantsResponse {
  success: boolean;
  message: string;
  participants?: ChatParticipant[];
  error?: string;
}

/**
 * Chat lookup parameters
 */
export interface ChatLookupParams {
  id?: string;
  name?: string;
  tags?: string[];
  category?: string;
  participantId?: string;
  visibility?: ChatVisibility;
}

/**
 * Chat search result
 */
export interface ChatSearchResult {
  chats: ChatProfile[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Generates a structured ID for a chat
 */
export function generateChatId(): string {
  return `chat_${ulid()}`;
} 