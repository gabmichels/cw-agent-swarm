import { ulid } from 'ulid';
import { ParticipantType } from './chat';

/**
 * Message role enum
 */
export enum MessageRole {
  USER = 'user',
  AGENT = 'agent',
  SYSTEM = 'system'
}

/**
 * Message type enum
 */
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  AUDIO = 'audio',
  VIDEO = 'video',
  ACTION = 'action',
  NOTIFICATION = 'notification'
}

/**
 * Message status enum
 */
export enum MessageStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

/**
 * Attachment interface
 */
export interface MessageAttachment {
  id: string;
  type: string;
  url?: string;
  filename?: string;
  contentType?: string;
  size?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Complete message structure
 */
export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderType: ParticipantType;
  content: string;
  type: MessageType;
  role: MessageRole;
  status: MessageStatus;
  attachments: MessageAttachment[];
  replyToId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Request to send a message
 */
export interface SendMessageRequest {
  chatId: string;
  senderId: string;
  senderType: ParticipantType;
  content: string;
  type: MessageType;
  attachments?: MessageAttachment[];
  replyToId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Response from sending a message
 */
export interface SendMessageResponse {
  success: boolean;
  message?: Message;
  error?: string;
}

/**
 * Message lookup parameters
 */
export interface MessageLookupParams {
  chatId: string;
  senderId?: string;
  senderType?: ParticipantType;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Message search result
 */
export interface MessageSearchResult {
  messages: Message[];
  total: number;
  hasMore: boolean;
}

/**
 * Generates a structured ID for a message
 */
export function generateMessageId(): string {
  return `msg_${ulid()}`;
} 