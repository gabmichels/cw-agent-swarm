/**
 * Agent Schema
 * 
 * This module defines the schema for agents in the multi-agent system.
 */

import { JSONSchema7 } from "json-schema";
import { BaseMemoryEntity, SchemaType } from "./types";
import { StructuredId } from "../../../utils/ulid";
import { SchemaImpl } from "./schema";
import { SchemaVersionImpl } from "./version";

/**
 * Agent status enum
 */
export enum AgentStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance'
}

/**
 * Agent capability interface
 */
export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  version: string;
  parameters?: Record<string, unknown>;
}

/**
 * Agent parameters interface
 */
export interface AgentParameters {
  model: string;
  temperature: number;
  maxTokens: number;
  tools: AgentTool[];
  customInstructions?: string;
  contextWindow?: number;
  systemMessages?: string[];
}

/**
 * Agent tool interface
 */
export interface AgentTool {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  requiredPermissions: string[];
}

/**
 * Agent metadata interface
 */
export interface AgentMetadata extends Record<string, unknown> {
  tags: string[];
  domain: string[];
  specialization: string[];
  performanceMetrics: {
    successRate: number;
    averageResponseTime: number;
    taskCompletionRate: number;
  };
  version: string;
  isPublic: boolean;
}

/**
 * Agent memory entity
 */
export interface AgentMemoryEntity extends BaseMemoryEntity {
  // Core identity
  name: string;
  description: string;
  
  // Creation and modification tracking
  createdBy: string; // UserID or SystemID
  
  // Configuration
  capabilities: AgentCapability[];
  parameters: AgentParameters;
  
  // State
  status: AgentStatus;
  lastActive: Date;
  
  // Relationships
  chatIds: StructuredId[];
  teamIds: StructuredId[];
  
  // Metadata for vector search and filtering
  metadata: AgentMetadata;
}

/**
 * Agent schema JSON definition
 */
export const agentSchemaJSON: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["id", "name", "capabilities", "parameters", "status", "metadata", "content", "type"],
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
      const: "agent"
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    createdBy: { type: "string" },
    schemaVersion: { type: "string" },
    capabilities: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "name", "description", "version"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          version: { type: "string" },
          parameters: { 
            type: "object",
            additionalProperties: true
          }
        }
      }
    },
    parameters: {
      type: "object",
      required: ["model", "temperature", "maxTokens", "tools"],
      properties: {
        model: { type: "string" },
        temperature: { 
          type: "number",
          minimum: 0,
          maximum: 1
        },
        maxTokens: { 
          type: "number",
          minimum: 1
        },
        tools: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "name", "description", "parameters", "requiredPermissions"],
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              parameters: { 
                type: "object",
                additionalProperties: true
              },
              requiredPermissions: {
                type: "array",
                items: { type: "string" }
              }
            }
          }
        },
        customInstructions: { type: "string" },
        contextWindow: { type: "number" },
        systemMessages: {
          type: "array",
          items: { type: "string" }
        }
      }
    },
    status: {
      type: "string",
      enum: Object.values(AgentStatus)
    },
    lastActive: { type: "string", format: "date-time" },
    chatIds: {
      type: "array",
      items: {
        type: "object",
        required: ["namespace", "type", "id"],
        properties: {
          namespace: { type: "string" },
          type: { type: "string" },
          id: { type: "string" },
          version: { type: "number" }
        }
      }
    },
    teamIds: {
      type: "array",
      items: {
        type: "object",
        required: ["namespace", "type", "id"],
        properties: {
          namespace: { type: "string" },
          type: { type: "string" },
          id: { type: "string" },
          version: { type: "number" }
        }
      }
    },
    metadata: {
      type: "object",
      required: ["tags", "domain", "specialization", "performanceMetrics", "version", "isPublic"],
      properties: {
        tags: {
          type: "array",
          items: { type: "string" }
        },
        domain: {
          type: "array",
          items: { type: "string" }
        },
        specialization: {
          type: "array",
          items: { type: "string" }
        },
        performanceMetrics: {
          type: "object",
          required: ["successRate", "averageResponseTime", "taskCompletionRate"],
          properties: {
            successRate: { 
              type: "number",
              minimum: 0,
              maximum: 1
            },
            averageResponseTime: { 
              type: "number",
              minimum: 0
            },
            taskCompletionRate: { 
              type: "number",
              minimum: 0,
              maximum: 1
            }
          }
        },
        version: { type: "string" },
        isPublic: { type: "boolean" }
      },
      additionalProperties: true
    }
  }
};

// Default agent values
const agentDefaults: Partial<AgentMemoryEntity> = {
  name: "Unnamed Agent",
  description: "",
  content: "",
  type: "agent",
  createdBy: "system",
  capabilities: [],
  parameters: {
    model: "default",
    temperature: 0.7,
    maxTokens: 1000,
    tools: []
  },
  status: AgentStatus.AVAILABLE,
  metadata: {
    tags: [],
    domain: [],
    specialization: [],
    performanceMetrics: {
      successRate: 0,
      averageResponseTime: 0,
      taskCompletionRate: 0
    },
    version: "1.0.0",
    isPublic: false
  }
};

// Export singleton instance
export const agentSchema = new SchemaImpl<AgentMemoryEntity>(
  "agent",
  SchemaVersionImpl.create(1, 0),
  SchemaType.ENTITY,
  agentSchemaJSON,
  agentDefaults
); 