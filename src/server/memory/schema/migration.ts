/**
 * Schema Migration System
 * 
 * This module implements the migration system for evolving schemas.
 */

import { Schema } from './types';
import { SchemaVersionError } from './errors';

/**
 * Interface for schema migrations
 */
export interface SchemaMigration<S, T> {
  /**
   * Source schema
   */
  sourceSchema: Schema<S>;
  
  /**
   * Target schema
   */
  targetSchema: Schema<T>;
  
  /**
   * Migrate data from source to target schema
   * 
   * @param data Data conforming to source schema
   * @returns Data conforming to target schema
   */
  migrate(data: S): T;
  
  /**
   * Check if this migration can handle the source data
   * 
   * @param data Data to check
   * @returns Type predicate indicating if data can be migrated
   */
  canMigrate(data: unknown): data is S;
}

/**
 * Schema migration service
 */
export class SchemaMigrationService {
  /**
   * Registered migrations
   */
  private migrations: SchemaMigration<any, any>[] = [];
  
  /**
   * Register a migration
   * 
   * @param migration Migration to register
   */
  register<S, T>(migration: SchemaMigration<S, T>): void {
    this.migrations.push(migration);
  }
  
  /**
   * Migrate data from one schema to another
   * 
   * @param data Data to migrate
   * @param targetSchema Target schema
   * @returns Migrated data
   * @throws SchemaVersionError if no migration path is found
   */
  migrate<T>(data: unknown, targetSchema: Schema<T>): T {
    // Nothing to do if data already conforms to target schema
    if (targetSchema.isValid(data)) {
      return data as T;
    }
    
    // Try to find a direct migration
    const directMigration = this.migrations.find(m => 
      m.canMigrate(data) && m.targetSchema.name === targetSchema.name
    );
    
    if (directMigration) {
      return directMigration.migrate(data);
    }
    
    // Find a migration path
    const path = this.findMigrationPath(data, targetSchema);
    if (path.length === 0) {
      throw new SchemaVersionError(
        `No migration path found from current schema to ${targetSchema.name} ${targetSchema.version.toString()}`,
        { targetSchemaName: targetSchema.name, targetSchemaVersion: targetSchema.version.toString() }
      );
    }
    
    // Apply migrations in sequence
    let result = data;
    for (const migration of path) {
      result = migration.migrate(result);
    }
    
    return result as T;
  }
  
  /**
   * Find a migration path from data to target schema
   * 
   * @param data Data to migrate
   * @param targetSchema Target schema
   * @returns Array of migrations to apply in sequence
   */
  private findMigrationPath(data: unknown, targetSchema: Schema<unknown>): SchemaMigration<any, any>[] {
    // Already in target schema
    if (targetSchema.isValid(data)) {
      return [];
    }
    
    // Find direct migration
    const directMigration = this.migrations.find(m => 
      m.canMigrate(data) && m.targetSchema.name === targetSchema.name
    );
    
    if (directMigration) {
      return [directMigration];
    }
    
    // Try multi-step migration (simple implementation)
    // Find a migration that can handle the source data
    const firstStepMigration = this.migrations.find(m => m.canMigrate(data));
    if (firstStepMigration) {
      // Try to find a path from the intermediate schema to the target
      const intermediateData = firstStepMigration.migrate(data);
      const remainingPath = this.findMigrationPath(intermediateData, targetSchema);
      
      // If a path is found, return the full path
      if (remainingPath.length > 0) {
        return [firstStepMigration, ...remainingPath];
      }
    }
    
    // No migration path found
    return [];
  }
}

/**
 * Create a new schema migration service
 */
export function createMigrationService(): SchemaMigrationService {
  return new SchemaMigrationService();
}

/**
 * Global default migration service
 */
export const defaultMigrationService = createMigrationService(); 