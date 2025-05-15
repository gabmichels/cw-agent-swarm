"use strict";
/**
 * MemoryScope.ts - Interface for agent memory scoping and isolation
 *
 * This module defines the interfaces and types needed for implementing
 * agent memory isolation and controlled memory sharing between agents.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryPermission = exports.MemoryAccessLevel = void 0;
exports.createPermissionSet = createPermissionSet;
exports.createReadOnlyPermissionSet = createReadOnlyPermissionSet;
exports.createReadWritePermissionSet = createReadWritePermissionSet;
exports.createFullPermissionSet = createFullPermissionSet;
/**
 * Access level for memory scoping
 */
var MemoryAccessLevel;
(function (MemoryAccessLevel) {
    /**
     * Memory is only accessible by the owner agent
     */
    MemoryAccessLevel["PRIVATE"] = "private";
    /**
     * Memory is accessible by the owner and explicitly granted agents
     */
    MemoryAccessLevel["SHARED"] = "shared";
    /**
     * Memory is accessible by all agents in the system
     */
    MemoryAccessLevel["PUBLIC"] = "public";
})(MemoryAccessLevel || (exports.MemoryAccessLevel = MemoryAccessLevel = {}));
/**
 * Permission type for memory access
 */
var MemoryPermission;
(function (MemoryPermission) {
    /**
     * Permission to read memory
     */
    MemoryPermission["READ"] = "read";
    /**
     * Permission to write/create memory
     */
    MemoryPermission["WRITE"] = "write";
    /**
     * Permission to update existing memory
     */
    MemoryPermission["UPDATE"] = "update";
    /**
     * Permission to delete memory
     */
    MemoryPermission["DELETE"] = "delete";
    /**
     * Permission to share memory with other agents
     */
    MemoryPermission["SHARE"] = "share";
})(MemoryPermission || (exports.MemoryPermission = MemoryPermission = {}));
/**
 * Creates a new set of permissions with the specified permissions
 */
function createPermissionSet() {
    var permissions = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        permissions[_i] = arguments[_i];
    }
    return new Set(permissions);
}
/**
 * Creates a read-only permission set
 */
function createReadOnlyPermissionSet() {
    return createPermissionSet(MemoryPermission.READ);
}
/**
 * Creates a read-write permission set
 */
function createReadWritePermissionSet() {
    return createPermissionSet(MemoryPermission.READ, MemoryPermission.WRITE, MemoryPermission.UPDATE);
}
/**
 * Creates a full permission set
 */
function createFullPermissionSet() {
    return createPermissionSet(MemoryPermission.READ, MemoryPermission.WRITE, MemoryPermission.UPDATE, MemoryPermission.DELETE, MemoryPermission.SHARE);
}
