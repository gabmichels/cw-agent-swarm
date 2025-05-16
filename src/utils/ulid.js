"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdGenerator = exports.IdPrefix = void 0;
exports.createUserId = createUserId;
exports.createAgentId = createAgentId;
exports.createChatId = createChatId;
exports.createMessageId = createMessageId;
exports.createMemoryId = createMemoryId;
exports.createKnowledgeId = createKnowledgeId;
exports.createDocumentId = createDocumentId;
exports.createThoughtId = createThoughtId;
exports.createEmbeddingId = createEmbeddingId;
/**
 * ULID (Universally Unique Lexicographically Sortable Identifier) implementation
 * Replaces timestamp-based IDs with a robust, sortable, unique ID system
 */
var ulid_1 = require("ulid");
/**
 * Predefined prefix types for different entities
 */
var IdPrefix;
(function (IdPrefix) {
    IdPrefix["USER"] = "user";
    IdPrefix["AGENT"] = "agent";
    IdPrefix["CHAT"] = "chat";
    IdPrefix["MESSAGE"] = "msg";
    IdPrefix["MEMORY"] = "mem";
    IdPrefix["KNOWLEDGE"] = "know";
    IdPrefix["DOCUMENT"] = "doc";
    IdPrefix["THOUGHT"] = "thght";
    IdPrefix["EMBEDDING"] = "embd";
})(IdPrefix || (exports.IdPrefix = IdPrefix = {}));
// Add logging utility
function logDeprecatedUsage(functionName) {
    console.warn("[DEPRECATED] ".concat(functionName, " using StructuredId is deprecated and will be removed in a future version. ") +
        'Use string IDs directly instead.');
    // Log stack trace to help identify usage locations
    console.warn(new Error().stack);
}
/**
 * @deprecated Use IdGenerator.generate(prefix).toString() directly instead
 */
var StructuredIdImpl = /** @class */ (function () {
    function StructuredIdImpl(id, prefix, timestamp) {
        logDeprecatedUsage('StructuredIdImpl constructor');
        this.id = id;
        this.namespace = prefix;
        this.type = prefix;
    }
    /**
     * Get the string representation (prefix_ulid)
     */
    StructuredIdImpl.prototype.toString = function () {
        return "".concat(this.namespace, "_").concat(this.id);
    };
    /**
     * Get the raw ULID
     */
    StructuredIdImpl.prototype.toULID = function () {
        return this.id;
    };
    /**
     * Get the timestamp from the ULID
     */
    StructuredIdImpl.prototype.getTimestamp = function () {
        return new Date(this.id);
    };
    return StructuredIdImpl;
}());
/**
 * Generator for creating and parsing structured IDs
 */
var IdGenerator = /** @class */ (function () {
    function IdGenerator() {
    }
    /**
     * @deprecated Use generate(prefix).toString() directly instead
     */
    IdGenerator.parse = function (idString) {
        logDeprecatedUsage('IdGenerator.parse');
        var parts = idString.split('_');
        if (parts.length !== 2)
            return null;
        var prefix = parts[0], id = parts[1];
        // Validate that the ID part is a valid ULID
        if (!IdGenerator.isValid(id))
            return null;
        var timestamp = IdGenerator.getTimestamp(id);
        return IdGenerator.generate(prefix);
    };
    /**
     * Generate a new ID with the given prefix
     * @param prefix The prefix to use for the ID
     * @returns A StructuredId object
     */
    IdGenerator.generate = function (prefix) {
        var timestamp = new Date();
        var id = (0, ulid_1.ulid)(timestamp.getTime());
        return {
            // New properties
            namespace: prefix,
            type: prefix,
            id: id,
            // Legacy properties
            prefix: prefix,
            timestamp: timestamp,
            // Methods
            toString: function () {
                return "".concat(prefix, "_").concat(id);
            },
            toULID: function () {
                return id;
            },
            getTimestamp: function () {
                return timestamp;
            }
        };
    };
    /**
     * @deprecated Use generate(prefix) directly instead
     */
    IdGenerator.generateWithTimestamp = function (prefix, timestamp) {
        logDeprecatedUsage('IdGenerator.generateWithTimestamp');
        var id = (0, ulid_1.ulid)(timestamp.getTime());
        return {
            // New properties
            namespace: prefix,
            type: prefix,
            id: id,
            // Legacy properties
            prefix: prefix,
            timestamp: timestamp,
            // Methods
            toString: function () {
                return "".concat(prefix, "_").concat(id);
            },
            toULID: function () {
                return id;
            },
            getTimestamp: function () {
                return timestamp;
            }
        };
    };
    /**
     * Check if a string is a valid ULID
     * @param idString The string to check
     * @returns True if valid ULID, false otherwise
     */
    IdGenerator.isValid = function (idString) {
        // ULID is 26 characters in Crockford's Base32 (0-9, A-Z except I, L, O, U)
        return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(idString);
    };
    /**
     * Extract the timestamp from a ULID
     * @param ulidStr The ULID string
     * @returns The extracted timestamp
     */
    IdGenerator.getTimestamp = function (ulidStr) {
        // Use the decodeTime function from the ulid library to extract the timestamp
        var timestampMs = (0, ulid_1.decodeTime)(ulidStr);
        return new Date(timestampMs);
    };
    return IdGenerator;
}());
exports.IdGenerator = IdGenerator;
/**
 * @deprecated Use IdGenerator.generate('user').toString() directly
 */
function createUserId() {
    logDeprecatedUsage('createUserId');
    return IdGenerator.generate('user').toString();
}
/**
 * @deprecated Use IdGenerator.generate('agent').toString() directly
 */
function createAgentId() {
    logDeprecatedUsage('createAgentId');
    return IdGenerator.generate('agent').toString();
}
/**
 * @deprecated Use IdGenerator.generate('chat').toString() directly
 */
function createChatId() {
    logDeprecatedUsage('createChatId');
    return IdGenerator.generate('chat').toString();
}
/**
 * @deprecated Use IdGenerator.generate('message').toString() directly
 */
function createMessageId() {
    logDeprecatedUsage('createMessageId');
    return IdGenerator.generate('message').toString();
}
/**
 * @deprecated Use IdGenerator.generate('memory').toString() directly
 */
function createMemoryId() {
    logDeprecatedUsage('createMemoryId');
    return IdGenerator.generate('memory').toString();
}
/**
 * @deprecated Use IdGenerator.generate('knowledge').toString() directly
 */
function createKnowledgeId() {
    logDeprecatedUsage('createKnowledgeId');
    return IdGenerator.generate('knowledge').toString();
}
/**
 * @deprecated Use IdGenerator.generate('document').toString() directly
 */
function createDocumentId() {
    logDeprecatedUsage('createDocumentId');
    return IdGenerator.generate('document').toString();
}
/**
 * @deprecated Use IdGenerator.generate('thought').toString() directly
 */
function createThoughtId() {
    logDeprecatedUsage('createThoughtId');
    return IdGenerator.generate('thought').toString();
}
/**
 * @deprecated Use IdGenerator.generate('embedding').toString() directly
 */
function createEmbeddingId() {
    logDeprecatedUsage('createEmbeddingId');
    return IdGenerator.generate('embedding').toString();
}
