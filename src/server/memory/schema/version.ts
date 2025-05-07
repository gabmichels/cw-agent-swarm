/**
 * Schema Versioning Implementation
 * 
 * This module implements the SchemaVersion interface for managing schema versions.
 */

import { SchemaVersion } from './types';

/**
 * Schema version implementation
 */
export class SchemaVersionImpl implements SchemaVersion {
  /**
   * Create a new schema version
   * 
   * @param major Major version for breaking changes
   * @param minor Minor version for backward-compatible additions
   */
  constructor(
    public readonly major: number,
    public readonly minor: number
  ) {
    if (major < 0 || minor < 0) {
      throw new Error('Version numbers cannot be negative');
    }
  }
  
  /**
   * Get string representation of the version (vMAJOR.MINOR)
   */
  toString(): string {
    return `v${this.major}.${this.minor}`;
  }
  
  /**
   * Check if this version is newer than another
   * 
   * @param other Version to compare with
   * @returns True if this version is newer
   */
  isNewerThan(other: SchemaVersion): boolean {
    if (this.major > other.major) return true;
    if (this.major === other.major && this.minor > other.minor) return true;
    return false;
  }
  
  /**
   * Check if this version is compatible with another.
   * Versions are compatible if they have the same major version.
   * 
   * @param other Version to compare with
   * @returns True if versions are compatible
   */
  isCompatibleWith(other: SchemaVersion): boolean {
    // Only compatible if major versions match
    return this.major === other.major;
  }
  
  /**
   * Parse a version string into a SchemaVersion object
   * 
   * @param versionString Version string (e.g., "v1.2" or "1.2")
   * @returns SchemaVersion object
   */
  static parse(versionString: string): SchemaVersion {
    // Parse from string like "v1.2" or "1.2"
    const matches = versionString.match(/^v?(\d+)\.(\d+)$/);
    if (!matches) {
      throw new Error(`Invalid version string: ${versionString}`);
    }
    
    const major = parseInt(matches[1], 10);
    const minor = parseInt(matches[2], 10);
    
    return new SchemaVersionImpl(major, minor);
  }
  
  /**
   * Create a new version from separate major and minor components
   * 
   * @param major Major version
   * @param minor Minor version
   * @returns SchemaVersion object
   */
  static create(major: number, minor: number): SchemaVersion {
    return new SchemaVersionImpl(major, minor);
  }
  
  /**
   * Get the initial version (v1.0)
   */
  static get initial(): SchemaVersion {
    return new SchemaVersionImpl(1, 0);
  }
} 