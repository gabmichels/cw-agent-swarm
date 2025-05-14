"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLLECTION_CONFIGS = exports.MEMORY_EDIT_COLLECTION = exports.TASK_COLLECTION = exports.DOCUMENT_COLLECTION = exports.THOUGHT_COLLECTION = exports.MESSAGE_COLLECTION = void 0;
exports.getCollectionConfig = getCollectionConfig;
exports.getCollectionName = getCollectionName;
/**
 * Memory collection configurations
 */
var types_1 = require("./types");
var constants_1 = require("./constants");
var models_1 = require("../models");
/**
 * Message collection configuration
 */
exports.MESSAGE_COLLECTION = {
    name: (0, constants_1.getCollectionNameWithFallback)(types_1.MemoryType.MESSAGE),
    schema: {}, // Type definition only, not used at runtime
    indices: (0, constants_1.getDefaultIndicesWithFallback)(types_1.MemoryType.MESSAGE),
    defaults: models_1.MESSAGE_DEFAULTS
};
/**
 * Thought collection configuration
 */
exports.THOUGHT_COLLECTION = {
    name: (0, constants_1.getCollectionNameWithFallback)(types_1.MemoryType.THOUGHT),
    schema: {}, // Type definition only, not used at runtime
    indices: (0, constants_1.getDefaultIndicesWithFallback)(types_1.MemoryType.THOUGHT),
    defaults: models_1.THOUGHT_DEFAULTS
};
/**
 * Document collection configuration
 */
exports.DOCUMENT_COLLECTION = {
    name: (0, constants_1.getCollectionNameWithFallback)(types_1.MemoryType.DOCUMENT),
    schema: {}, // Type definition only, not used at runtime
    indices: (0, constants_1.getDefaultIndicesWithFallback)(types_1.MemoryType.DOCUMENT),
    defaults: models_1.DOCUMENT_DEFAULTS
};
/**
 * Task collection configuration
 */
exports.TASK_COLLECTION = {
    name: (0, constants_1.getCollectionNameWithFallback)(types_1.MemoryType.TASK),
    schema: {}, // Type definition only, not used at runtime
    indices: (0, constants_1.getDefaultIndicesWithFallback)(types_1.MemoryType.TASK),
    defaults: models_1.TASK_DEFAULTS
};
/**
 * Memory edit collection configuration
 * Note: Defaults are created at runtime via createMemoryEditDefaults()
 */
exports.MEMORY_EDIT_COLLECTION = {
    name: (0, constants_1.getCollectionNameWithFallback)(types_1.MemoryType.MEMORY_EDIT),
    schema: {}, // Type definition only, not used at runtime
    indices: (0, constants_1.getDefaultIndicesWithFallback)(types_1.MemoryType.MEMORY_EDIT),
    defaults: {} // Defaults created at runtime
};
/**
 * Map of memory types to their collection configurations
 * Note: This is a selective subset of memory types that map to actual collections.
 * Other memory types are logically mapped to one of these core collections with appropriate metadata/tags.
 */
exports.COLLECTION_CONFIGS = (_a = {},
    _a[types_1.MemoryType.MESSAGE] = exports.MESSAGE_COLLECTION,
    _a[types_1.MemoryType.THOUGHT] = exports.THOUGHT_COLLECTION,
    _a[types_1.MemoryType.DOCUMENT] = exports.DOCUMENT_COLLECTION,
    _a[types_1.MemoryType.TASK] = exports.TASK_COLLECTION,
    _a[types_1.MemoryType.MEMORY_EDIT] = exports.MEMORY_EDIT_COLLECTION,
    _a[types_1.MemoryType.TOOL_EXECUTION_METRICS] = exports.DOCUMENT_COLLECTION,
    _a);
/**
 * Get collection configuration for a specific memory type
 * @param type Memory type
 * @returns Collection configuration
 */
function getCollectionConfig(type) {
    // If no direct configuration exists, use message collection as fallback
    return exports.COLLECTION_CONFIGS[type] || exports.COLLECTION_CONFIGS[types_1.MemoryType.MESSAGE] || exports.MESSAGE_COLLECTION;
}
/**
 * Get the collection name for a memory type
 * @param type Memory type
 * @returns Collection name
 */
function getCollectionName(type) {
    return (0, constants_1.getCollectionNameWithFallback)(type);
}
