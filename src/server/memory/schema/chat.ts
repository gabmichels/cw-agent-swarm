/**
 * Chat Schema
 * 
 * This module defines the schema for chats in the multi-agent system.
 */

import { JSONSchema7 } from "json-schema";
import { BaseMemoryEntity, SchemaType } from "./types";
import { StructuredId } from "../../../utils/ulid";
import { SchemaImpl } from "./schema";
import { SchemaVersionImpl } from "./version";

/**
 * Chat participant role enum
 */
export enum ChatParticipantRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  OBSERVER = 'observer'
}

/**
 * Chat permission enum
 */
export enum ChatPermission {
  READ = 'read',
  WRITE = 'write',
  INVITE = 'invite',
  REMOVE = 'remove',
  MANAGE = 'manage'
}

/**
 * Chat status enum
 */
export enum ChatStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
  SCHEDULED = 'scheduled'
}

/**
 * Chat participant interface
 */
export interface ChatParticipant {
  id: string; // User or Agent ID
  type: 'user' | 'agent';
  role: ChatParticipantRole;
  joinedAt: Date;
  lastActiveAt: Date;
  permissions: ChatPermission[];
}

/**
 * Chat settings interface
 */
export interface ChatSettings {
  visibility: 'public' | 'private' | 'restricted';
  allowAnonymousMessages: boolean;
  retentionPeriod?: number; // Days to retain messages
  enableBranching: boolean;
  recordTranscript: boolean;
  maxParticipants?: number;
}

/**
 * Chat metadata interface
 */
export interface ChatMetadata extends Record<string, unknown> {
  tags: string[];
  category: string[];
  priority: 'low' | 'medium' | 'high';
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  language: string[];
  version: string;
}

/**
 * Chat memory entity
 */
export interface ChatMemoryEntity extends BaseMemoryEntity {
  // Core identity
  name: string;
  description?: string;
  
  // Creation and modification tracking
  createdBy: string; // UserID or SystemID
  
  // Participants
  participants: ChatParticipant[];
  
  // Configuration
  settings: ChatSettings;
  
  // State
  status: ChatStatus;
  lastMessageAt: Date;
  messageCount: number;
  
  // Context and purpose
  purpose: string;
  contextIds: string[]; // Related contexts or resources
  
  // Metadata for vector search and filtering
  metadata: ChatMetadata;
}

/**
 * Chat schema JSON definition
 */
export const chatSchemaJSON: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["id", "name", "participants", "settings", "status", "purpose", "metadata", "content", "type"],
  properties: {
    id: {
      type: "object",
      required: ["namespace", "type", "id"],
      properties: {
        namespace: { type: "string" },
        type: { type: "string" },
        id: { type: "string" },
        version: { type: "number" }
      }
    },
    name: { 
      type: "string",
      minLength: 1,
      maxLength: 100
    },
    description: { 
      type: "string",
      maxLength: 500
    },
    content: { type: "string" },
    type: { 
      type: "string",
      const: "chat"
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    createdBy: { type: "string" },
    schemaVersion: { type: "string" },
    participants: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "type", "role", "joinedAt", "lastActiveAt", "permissions"],
        properties: {
          id: { type: "string" },
          type: { 
            type: "string",
            enum: ["user", "agent"]
          },
          role: { 
            type: "string",
            enum: Object.values(ChatParticipantRole)
          },
          joinedAt: { type: "string", format: "date-time" },
          lastActiveAt: { type: "string", format: "date-time" },
          permissions: {
            type: "array",
            items: {
              type: "string",
              enum: Object.values(ChatPermission)
            }
          }
        }
      }
    },
    settings: {
      type: "object",
      required: ["visibility", "allowAnonymousMessages", "enableBranching", "recordTranscript"],
      properties: {
        visibility: { 
          type: "string",
          enum: ["public", "private", "restricted"]
        },
        allowAnonymousMessages: { type: "boolean" },
        retentionPeriod: { 
          type: "number",
          minimum: 1
        },
        enableBranching: { type: "boolean" },
        recordTranscript: { type: "boolean" },
        maxParticipants: { 
          type: "number",
          minimum: 2
        }
      }
    },
    status: {
      type: "string",
      enum: Object.values(ChatStatus)
    },
    lastMessageAt: { type: "string", format: "date-time" },
    messageCount: { 
      type: "number",
      minimum: 0
    },
    purpose: { 
      type: "string",
      maxLength: 500
    },
    contextIds: {
      type: "array",
      items: {
        type: "string"
      }
    },
    metadata: {
      type: "object",
      required: ["tags", "category", "priority", "sensitivity", "language", "version"],
      properties: {
        tags: {
          type: "array",
          items: { type: "string" }
        },
        category: {
          type: "array",
          items: { type: "string" }
        },
        priority: { 
          type: "string",
          enum: ["low", "medium", "high"]
        },
        sensitivity: { 
          type: "string",
          enum: ["public", "internal", "confidential", "restricted"]
        },
        language: {
          type: "array",
          items: { type: "string" }
        },
        version: { type: "string" }
      },
      additionalProperties: true
    }
  }
};

// Default chat values
const chatDefaults: Partial<ChatMemoryEntity> = {
  description: "",
  content: "",
  type: "chat",
  createdBy: "system",
  participants: [],
  settings: {
    visibility: "private",
    allowAnonymousMessages: false,
    enableBranching: false,
    recordTranscript: true
  },
  status: ChatStatus.ACTIVE,
  messageCount: 0,
  contextIds: [],
  metadata: {
    tags: [],
    category: [],
    priority: "medium",
    sensitivity: "internal",
    language: ["en"],
    version: "1.0.0"
  }
};

// Export singleton instance
export const chatSchema = new SchemaImpl<ChatMemoryEntity>(
  "chat",
  SchemaVersionImpl.create(1, 0),
  SchemaType.ENTITY,
  chatSchemaJSON,
  chatDefaults
); 