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
/**
 * Implementation of a structured ID
 */
var StructuredIdImpl = /** @class */ (function () {
    function StructuredIdImpl(id, prefix, timestamp) {
        this.id = id;
        this.prefix = prefix;
        this.timestamp = timestamp;
    }
    /**
     * Get the string representation (prefix_ulid)
     */
    StructuredIdImpl.prototype.toString = function () {
        return "".concat(this.prefix, "_").concat(this.id);
    };
    /**
     * Get the raw ULID without prefix
     */
    StructuredIdImpl.prototype.toULID = function () {
        return this.id;
    };
    /**
     * Get the timestamp from the ULID
     */
    StructuredIdImpl.prototype.getTimestamp = function () {
        return this.timestamp;
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
     * Create a new ID with the given prefix
     * @param prefix The prefix to use (e.g., 'user', 'chat')
     * @returns A new structured ID
     */
    IdGenerator.generate = function (prefix) {
        var timestamp = new Date();
        var id = (0, ulid_1.ulid)(timestamp.getTime());
        return new StructuredIdImpl(id, prefix, timestamp);
    };
    /**
     * Create an ID with the given prefix at a specific timestamp
     * @param prefix The prefix to use
     * @param timestamp The timestamp to use
     * @returns A new structured ID with the specified timestamp
     */
    IdGenerator.generateWithTimestamp = function (prefix, timestamp) {
        var id = (0, ulid_1.ulid)(timestamp.getTime());
        return new StructuredIdImpl(id, prefix, timestamp);
    };
    /**
     * Parse an existing ID string into a StructuredId object
     * @param idString The ID string to parse (format: prefix_ulid)
     * @returns The parsed StructuredId or null if invalid
     */
    IdGenerator.parse = function (idString) {
        var parts = idString.split('_');
        if (parts.length !== 2)
            return null;
        var prefix = parts[0], id = parts[1];
        // Validate that the ID part is a valid ULID
        if (!IdGenerator.isValid(id))
            return null;
        var timestamp = IdGenerator.getTimestamp(id);
        return new StructuredIdImpl(id, prefix, timestamp);
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
// Helper factory functions for common types
/**
 * Create a new user ID
 * @returns A structured user ID
 */
function createUserId() {
    return IdGenerator.generate(IdPrefix.USER);
}
/**
 * Create a new agent ID
 * @returns A structured agent ID
 */
function createAgentId() {
    return IdGenerator.generate(IdPrefix.AGENT);
}
/**
 * Create a new chat ID
 * @returns A structured chat ID
 */
function createChatId() {
    return IdGenerator.generate(IdPrefix.CHAT);
}
/**
 * Create a new message ID
 * @returns A structured message ID
 */
function createMessageId() {
    return IdGenerator.generate(IdPrefix.MESSAGE);
}
/**
 * Create a new memory ID
 * @returns A structured memory ID
 */
function createMemoryId() {
    return IdGenerator.generate(IdPrefix.MEMORY);
}
/**
 * Create a new knowledge ID
 * @returns A structured knowledge ID
 */
function createKnowledgeId() {
    return IdGenerator.generate(IdPrefix.KNOWLEDGE);
}
/**
 * Create a new document ID
 * @returns A structured document ID
 */
function createDocumentId() {
    return IdGenerator.generate(IdPrefix.DOCUMENT);
}
/**
 * Create a new thought ID
 * @returns A structured thought ID
 */
function createThoughtId() {
    return IdGenerator.generate(IdPrefix.THOUGHT);
}
/**
 * Create a new embedding ID
 * @returns A structured embedding ID
 */
function createEmbeddingId() {
    return IdGenerator.generate(IdPrefix.EMBEDDING);
}
