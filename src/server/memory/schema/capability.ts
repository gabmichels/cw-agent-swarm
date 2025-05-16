/**
 * Capability Schema
 * 
 * This module defines the schema for capabilities in the multi-agent system.
 */

import { JSONSchema7 } from "json-schema";
import { BaseMemoryEntity, SchemaType } from "./types";
import { StructuredId } from "../../../utils/ulid";
import { SchemaImpl } from "./schema";
import { SchemaVersionImpl } from "./version";

/**
 * Capability type enum
 */
export enum CapabilityType {
  SKILL = 'skill',
  DOMAIN = 'domain',
  ROLE = 'role',
  TAG = 'tag'
}

/**
 * Capability level enum
 */
export enum CapabilityLevel {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

/**
 * Capability usage statistics interface
 */
export interface CapabilityUsageStats {
  totalUsageCount: number;
  successCount: number;
  failureCount: number;
  lastUsed: Date;
  averageResponseTime: number;
}

/**
 * Capability memory entity
 */
export interface CapabilityMemoryEntity extends BaseMemoryEntity {
  // Core identity
  name: string;
  description: string;
  
  // Classification
  type: CapabilityType;
  
  // Version tracking
  version: string;
  
  // Optional parameters
  parameters?: Record<string, unknown>;
  
  // Usage statistics
  usageStats?: CapabilityUsageStats;
  
  // Related capabilities (for recommendations)
  relatedCapabilityIds?: string[];
  
  // Metadata for search and filtering
  tags: string[];
  domains: string[];
}

/**
 * Capability schema JSON definition
 */
export const capabilitySchemaJSON: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["id", "name", "description", "type", "version", "tags", "domains", "content", "schemaVersion"],
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
      enum: Object.values(CapabilityType)
    },
    version: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    schemaVersion: { type: "string" },
    parameters: { 
      type: "object",
      additionalProperties: true
    },
    usageStats: {
      type: "object",
      properties: {
        totalUsageCount: { type: "number" },
        successCount: { type: "number" },
        failureCount: { type: "number" },
        lastUsed: { type: "string", format: "date-time" },
        averageResponseTime: { type: "number" }
      },
      required: ["totalUsageCount", "successCount", "failureCount", "lastUsed", "averageResponseTime"]
    },
    relatedCapabilityIds: {
      type: "array",
      items: { type: "string" }
    },
    tags: {
      type: "array",
      items: { type: "string" }
    },
    domains: {
      type: "array",
      items: { type: "string" }
    }
  }
};

// Default capability values
const capabilityDefaults: Partial<CapabilityMemoryEntity> = {
  description: "",
  content: "",
  version: "1.0.0",
  parameters: {},
  tags: [],
  domains: [],
  usageStats: {
    totalUsageCount: 0,
    successCount: 0,
    failureCount: 0,
    lastUsed: new Date(),
    averageResponseTime: 0
  }
};

/**
 * Capability schema implementation
 */
export const capabilitySchema = new SchemaImpl<CapabilityMemoryEntity>(
  "capability",
  SchemaVersionImpl.create(1, 0),
  SchemaType.ENTITY,
  capabilitySchemaJSON,
  capabilityDefaults
);

/**
 * Creates a capability ID from a name
 */
export function createCapabilityId(
  type: CapabilityType,
  name: string,
  structuredId?: StructuredId
): string {
  const safeName = name.toLowerCase().replace(/\s+/g, '_');
  return `${type}.${safeName}`;
} 