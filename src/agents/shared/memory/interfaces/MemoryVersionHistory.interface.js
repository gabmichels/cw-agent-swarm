"use strict";
/**
 * Memory Version History Interface
 *
 * This module defines interfaces and types for managing memory version history
 * and implementing rollback functionality.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryChangeType = void 0;
/**
 * Type of change made to a memory entry
 */
var MemoryChangeType;
(function (MemoryChangeType) {
    MemoryChangeType["CREATED"] = "created";
    MemoryChangeType["UPDATED"] = "updated";
    MemoryChangeType["DELETED"] = "deleted";
    MemoryChangeType["RESTORED"] = "restored";
})(MemoryChangeType || (exports.MemoryChangeType = MemoryChangeType = {}));
