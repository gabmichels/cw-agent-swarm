/**
 * Memory Service Base Classes
 * 
 * This module provides the base classes and interfaces for memory services.
 * It includes repository and service abstractions with type safety,
 * validation, and proper error handling.
 */

// Re-export interfaces and types
export * from './types';

// Re-export base repository
export * from './repository';

// Re-export base service
export * from './service';

// Export a type for default options
export const DEFAULT_CREATE_OPTIONS = {
  applyDefaults: true,
  validation: {
    enabled: true,
    throwOnError: true
  }
};

export const DEFAULT_UPDATE_OPTIONS = {
  validate: true,
  mergeMetadata: true
};

export const DEFAULT_DELETE_OPTIONS = {
  hardDelete: false
};

export const DEFAULT_SEARCH_OPTIONS = {
  limit: 10,
  offset: 0,
  scoreThreshold: 0.0,
  includeDeleted: false
}; 