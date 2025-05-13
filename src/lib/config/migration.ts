/**
 * Configuration Migration Manager
 * 
 * This module provides functionality for migrating configurations between versions.
 */

import {
  ConfigMigration,
  MigrationFunction,
  MigrationManager
} from './types';

/**
 * Error thrown for migration-related errors
 */
export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly fromVersion?: string,
    public readonly toVersion?: string
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * Default implementation of MigrationManager
 */
export class ConfigMigrationManager<T extends Record<string, unknown>> implements MigrationManager<T> {
  private migrations: ConfigMigration<T>[] = [];
  private latestVersion: string = '1.0.0';
  
  /**
   * Create a new ConfigMigrationManager
   * @param initialMigrations Initial migrations to register
   * @param latestVersion Latest schema version
   */
  constructor(
    initialMigrations: ConfigMigration<T>[] = [],
    latestVersion?: string
  ) {
    // Register initial migrations
    if (initialMigrations.length > 0) {
      for (const migration of initialMigrations) {
        this.registerMigration(migration);
      }
    }
    
    // Set latest version
    if (latestVersion) {
      this.latestVersion = latestVersion;
    }
  }
  
  /**
   * Register a migration
   */
  registerMigration(migration: ConfigMigration<T>): MigrationManager<T> {
    // Validate migration
    if (!migration.fromVersion) {
      throw new MigrationError('Migration fromVersion is required');
    }
    
    if (!migration.toVersion) {
      throw new MigrationError('Migration toVersion is required');
    }
    
    if (!migration.migrate) {
      throw new MigrationError('Migration function is required');
    }
    
    // Add migration
    this.migrations.push(migration);
    
    // Return this for chaining
    return this;
  }
  
  /**
   * Get all registered migrations
   */
  getMigrations(): ConfigMigration<T>[] {
    return [...this.migrations];
  }
  
  /**
   * Migrate a configuration from one version to another
   */
  migrateConfig(
    config: Partial<T>,
    fromVersion: string,
    toVersion?: string
  ): Partial<T> {
    const targetVersion = toVersion || this.latestVersion;
    
    // Check if migration is needed
    if (fromVersion === targetVersion) {
      return config;
    }
    
    // Check if migration is possible
    if (!this.canMigrate(fromVersion, targetVersion)) {
      throw new MigrationError(
        `No migration path found from ${fromVersion} to ${targetVersion}`,
        fromVersion,
        targetVersion
      );
    }
    
    // Find direct migration
    const directMigration = this.migrations.find(
      m => m.fromVersion === fromVersion && m.toVersion === targetVersion
    );
    
    if (directMigration) {
      return directMigration.migrate(config, fromVersion, targetVersion);
    }
    
    // Find migration path
    const path = this.findMigrationPath(fromVersion, targetVersion);
    
    if (!path || path.length === 0) {
      throw new MigrationError(
        `Migration path calculation failed from ${fromVersion} to ${targetVersion}`,
        fromVersion,
        targetVersion
      );
    }
    
    // Apply migrations in sequence
    let currentConfig = { ...config };
    let currentVersion = fromVersion;
    
    for (const step of path) {
      const migration = this.migrations.find(
        m => m.fromVersion === currentVersion && m.toVersion === step
      );
      
      if (!migration) {
        throw new MigrationError(
          `Missing migration step from ${currentVersion} to ${step}`,
          currentVersion,
          step
        );
      }
      
      currentConfig = migration.migrate(currentConfig, currentVersion, step);
      currentVersion = step;
    }
    
    return currentConfig;
  }
  
  /**
   * Check if migration is possible
   */
  canMigrate(fromVersion: string, toVersion: string): boolean {
    // Same version requires no migration
    if (fromVersion === toVersion) {
      return true;
    }
    
    // Check for direct migration
    const directMigration = this.migrations.find(
      m => m.fromVersion === fromVersion && m.toVersion === toVersion
    );
    
    if (directMigration) {
      return true;
    }
    
    // Check for migration path
    const path = this.findMigrationPath(fromVersion, toVersion);
    return path.length > 0;
  }
  
  /**
   * Get the latest schema version
   */
  getLatestVersion(): string {
    return this.latestVersion;
  }
  
  /**
   * Set the latest schema version
   */
  setLatestVersion(version: string): void {
    this.latestVersion = version;
  }
  
  /**
   * Find a migration path from one version to another
   * @private
   */
  private findMigrationPath(fromVersion: string, toVersion: string): string[] {
    // Build graph of all possible migrations
    const graph: Record<string, string[]> = {};
    
    for (const migration of this.migrations) {
      if (!graph[migration.fromVersion]) {
        graph[migration.fromVersion] = [];
      }
      
      graph[migration.fromVersion].push(migration.toVersion);
    }
    
    // Use breadth-first search to find shortest path
    const queue: Array<{ version: string; path: string[] }> = [
      { version: fromVersion, path: [] }
    ];
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      const { version, path } = queue.shift()!;
      
      if (version === toVersion) {
        return path;
      }
      
      if (visited.has(version)) {
        continue;
      }
      
      visited.add(version);
      
      const nextVersions = graph[version] || [];
      for (const nextVersion of nextVersions) {
        queue.push({
          version: nextVersion,
          path: [...path, nextVersion]
        });
      }
    }
    
    return [];
  }
} 