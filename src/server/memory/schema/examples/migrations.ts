/**
 * Schema Migration Example
 * 
 * This module demonstrates how to create and use schema migrations.
 */

import { JSONSchema7 } from 'json-schema';
import { StructuredId } from '../../../../utils/ulid';
import { SchemaMigration, SchemaImpl, SchemaVersionImpl, SchemaType, defaultMigrationService } from '../index';
import { BaseMemoryEntity } from '../types';

/**
 * Entity type for v1.0
 */
interface NotificationV1 extends BaseMemoryEntity {
  type: 'notification';
  metadata: {
    userId: StructuredId;
    read: boolean;
    priority: 'low' | 'medium' | 'high';
  };
}

/**
 * Entity type for v2.0
 */
interface NotificationV2 extends BaseMemoryEntity {
  type: 'notification';
  metadata: {
    userId: StructuredId;
    read: boolean;
    priority: number; // Changed from string to number (0-100)
    category: string; // New required field
  };
}

/**
 * JSON Schema for v1.0
 */
const notificationSchemaV1: JSONSchema7 = {
  $id: 'notification_v1.0',
  type: 'object',
  required: ['id', 'content', 'type', 'createdAt', 'updatedAt', 'metadata', 'schemaVersion'],
  properties: {
    id: { type: 'object' },
    content: { type: 'string' },
    type: { type: 'string', enum: ['notification'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    schemaVersion: { type: 'string' },
    metadata: {
      type: 'object',
      required: ['userId', 'read', 'priority'],
      properties: {
        userId: { type: 'object' },
        read: { type: 'boolean' },
        priority: { 
          type: 'string', 
          enum: ['low', 'medium', 'high'] 
        }
      }
    }
  }
};

/**
 * JSON Schema for v2.0
 */
const notificationSchemaV2: JSONSchema7 = {
  $id: 'notification_v2.0',
  type: 'object',
  required: ['id', 'content', 'type', 'createdAt', 'updatedAt', 'metadata', 'schemaVersion'],
  properties: {
    id: { type: 'object' },
    content: { type: 'string' },
    type: { type: 'string', enum: ['notification'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    schemaVersion: { type: 'string' },
    metadata: {
      type: 'object',
      required: ['userId', 'read', 'priority', 'category'],
      properties: {
        userId: { type: 'object' },
        read: { type: 'boolean' },
        priority: { 
          type: 'number', 
          minimum: 0, 
          maximum: 100 
        },
        category: { 
          type: 'string',
          minLength: 1 
        }
      }
    }
  }
};

/**
 * Create schema implementations
 */
const notificationSchemaV1Impl = new SchemaImpl<NotificationV1>(
  'notification',
  SchemaVersionImpl.create(1, 0),
  SchemaType.ENTITY,
  notificationSchemaV1,
  {
    type: 'notification'
    // Don't set defaults for required fields that don't have sensible defaults
  }
);

const notificationSchemaV2Impl = new SchemaImpl<NotificationV2>(
  'notification',
  SchemaVersionImpl.create(2, 0),
  SchemaType.ENTITY,
  notificationSchemaV2,
  {
    type: 'notification'
    // Don't set defaults for required fields that don't have sensible defaults
  }
);

/**
 * Create migration from v1.0 to v2.0
 */
class NotificationV1ToV2Migration implements SchemaMigration<NotificationV1, NotificationV2> {
  sourceSchema = notificationSchemaV1Impl;
  targetSchema = notificationSchemaV2Impl;
  
  /**
   * Check if this migration can handle the data
   */
  canMigrate(data: unknown): data is NotificationV1 {
    return (
      this.sourceSchema.isValid(data) && 
      (data as any).schemaVersion === 'v1.0'
    );
  }
  
  /**
   * Migrate data from v1.0 to v2.0
   */
  migrate(data: NotificationV1): NotificationV2 {
    // Map priority string to number
    let priorityValue: number;
    switch (data.metadata.priority) {
      case 'low':
        priorityValue = 10;
        break;
      case 'medium':
        priorityValue = 50;
        break;
      case 'high':
        priorityValue = 90;
        break;
      default:
        priorityValue = 50;
    }
    
    // Create new entity with v2.0 structure
    const migratedData: NotificationV2 = {
      ...data,
      metadata: {
        ...data.metadata,
        priority: priorityValue,
        category: 'general' // Default value for the new required field
      },
      schemaVersion: 'v2.0'
    };
    
    return migratedData;
  }
}

/**
 * Register migration with the migration service
 */
export function registerNotificationMigration(): void {
  const migration = new NotificationV1ToV2Migration();
  defaultMigrationService.register(migration);
}

/**
 * Usage example
 */
export function migrationExample(userId: StructuredId): void {
  // Register migration
  registerNotificationMigration();
  
  // Create a v1.0 notification
  const notificationV1 = notificationSchemaV1Impl.create({
    content: 'This is a v1.0 notification',
    metadata: {
      userId,
      read: false,
      priority: 'high'
    }
  });
  
  console.log('Original v1.0 notification:', notificationV1);
  
  // Migrate to v2.0
  const notificationV2 = defaultMigrationService.migrate(notificationV1, notificationSchemaV2Impl);
  
  console.log('Migrated v2.0 notification:', notificationV2);
  // The priority 'high' was converted to 90 and category 'general' was added
} 