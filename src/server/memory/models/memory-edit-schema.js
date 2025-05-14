"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMemoryEditDefaults = createMemoryEditDefaults;
/**
 * Memory edit schema for version history
 */
var config_1 = require("../config");
/**
 * Create default values for a memory edit
 * This is a function instead of a constant because required fields
 * must be provided at creation time
 *
 * @param originalMemoryId The ID of the original memory
 * @param originalType The type of the original memory
 * @param originalTimestamp The timestamp of the original memory
 * @returns Partial memory edit schema with defaults
 */
function createMemoryEditDefaults(originalMemoryId, originalType, originalTimestamp) {
    return {
        type: config_1.MemoryType.MEMORY_EDIT,
        metadata: {
            schemaVersion: "1.0.0",
            original_memory_id: originalMemoryId,
            original_type: originalType,
            original_timestamp: originalTimestamp,
            edit_type: 'create',
            editor_type: 'system',
            current: false,
            _skip_logging: true
        }
    };
}
