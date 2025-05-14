"use strict";
/**
 * Structured ID system for consistent and informative identifiers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityType = exports.EntityNamespace = exports.IdPrefix = void 0;
exports.createStructuredId = createStructuredId;
exports.createEnumStructuredId = createEnumStructuredId;
exports.createUserId = createUserId;
exports.createAgentId = createAgentId;
exports.createChatId = createChatId;
exports.createThreadId = createThreadId;
exports.createSystemId = createSystemId;
exports.parseStructuredId = parseStructuredId;
exports.structuredIdToString = structuredIdToString;
exports.areStructuredIdsEqual = areStructuredIdsEqual;
exports.createAgentIdentifier = createAgentIdentifier;
// Prefix types for different entity types
var IdPrefix;
(function (IdPrefix) {
    IdPrefix["MESSAGE"] = "msg";
    IdPrefix["THOUGHT"] = "thght";
    IdPrefix["CHAT"] = "chat";
    IdPrefix["AGENT"] = "agnt";
    IdPrefix["USER"] = "user";
})(IdPrefix || (exports.IdPrefix = IdPrefix = {}));
// Namespace enum for structured identifiers
var EntityNamespace;
(function (EntityNamespace) {
    EntityNamespace["USER"] = "user";
    EntityNamespace["AGENT"] = "agent";
    EntityNamespace["SYSTEM"] = "system";
    EntityNamespace["CHAT"] = "chat";
    EntityNamespace["MEMORY"] = "memory";
})(EntityNamespace || (exports.EntityNamespace = EntityNamespace = {}));
// Entity type enum for structured identifiers
var EntityType;
(function (EntityType) {
    EntityType["USER"] = "user";
    EntityType["AGENT"] = "agent";
    EntityType["CHAT"] = "chat";
    EntityType["MESSAGE"] = "message";
    EntityType["THOUGHT"] = "thought";
    EntityType["THREAD"] = "thread";
})(EntityType || (exports.EntityType = EntityType = {}));
/**
 * Creates a structured ID with the namespace, type, id, and optional version
 * @param namespace The entity namespace
 * @param type The entity type
 * @param id The entity ID or name
 * @param version Optional version number
 * @returns A structured ID object
 */
function createStructuredId(namespace, type, id, version) {
    var structuredId = {
        namespace: namespace,
        type: type,
        id: id
    };
    if (version !== undefined) {
        structuredId.version = version;
    }
    return structuredId;
}
/**
 * Creates a structured ID with enum values for namespace and type
 * @param namespace The entity namespace enum value
 * @param type The entity type enum value
 * @param id The entity ID or name
 * @param version Optional version number
 * @returns A structured ID object
 */
function createEnumStructuredId(namespace, type, id, version) {
    return createStructuredId(namespace, type, id, version);
}
/**
 * Helper function to create a user ID
 * @param id The user ID or name
 * @param version Optional version number
 * @returns A structured user ID
 */
function createUserId(id, version) {
    return createEnumStructuredId(EntityNamespace.USER, EntityType.USER, id, version);
}
/**
 * Helper function to create an agent ID
 * @param id The agent ID or name
 * @param version Optional version number
 * @returns A structured agent ID
 */
function createAgentId(id, version) {
    return createEnumStructuredId(EntityNamespace.AGENT, EntityType.AGENT, id, version);
}
/**
 * Helper function to create a chat ID
 * @param id The chat ID or name
 * @param version Optional version number
 * @returns A structured chat ID
 */
function createChatId(id, version) {
    return createEnumStructuredId(EntityNamespace.CHAT, EntityType.CHAT, id, version);
}
/**
 * Helper function to create a thread ID
 * @param id The thread ID or name
 * @param version Optional version number
 * @returns A structured thread ID
 */
function createThreadId(id, version) {
    return createEnumStructuredId(EntityNamespace.CHAT, EntityType.THREAD, id, version);
}
/**
 * Helper function to create a system entity ID
 * @param type The entity type
 * @param id The entity ID or name
 * @param version Optional version number
 * @returns A structured system entity ID
 */
function createSystemId(type, id, version) {
    return createEnumStructuredId(EntityNamespace.SYSTEM, type, id, version);
}
/**
 * Parses a structured ID string into a StructuredId object
 * @param idString The structured ID string to parse (format: namespace:type:id[:version])
 * @returns The parsed StructuredId object or null if invalid
 */
function parseStructuredId(idString) {
    var parts = idString.split(':');
    if (parts.length < 3)
        return null;
    var namespace = parts[0];
    var type = parts[1];
    var id = parts[2];
    var structuredId = {
        namespace: namespace,
        type: type,
        id: id
    };
    // Parse version if it exists
    if (parts.length > 3) {
        var version = parseInt(parts[3], 10);
        if (!isNaN(version)) {
            structuredId.version = version;
        }
    }
    return structuredId;
}
/**
 * Converts a StructuredId object to a string
 * @param id The StructuredId object to convert
 * @returns A string representation (format: namespace:type:id[:version])
 */
function structuredIdToString(id) {
    var result = "".concat(id.namespace, ":").concat(id.type, ":").concat(id.id);
    if (id.version !== undefined) {
        result += ":".concat(id.version);
    }
    return result;
}
/**
 * Compares two StructuredId objects for equality
 * @param id1 The first StructuredId object
 * @param id2 The second StructuredId object
 * @returns True if the IDs are equal, false otherwise
 */
function areStructuredIdsEqual(id1, id2) {
    if (id1.namespace !== id2.namespace)
        return false;
    if (id1.type !== id2.type)
        return false;
    if (id1.id !== id2.id)
        return false;
    if (id1.version !== id2.version)
        return false;
    return true;
}
/**
 * Creates an agent identifier
 * @param id The agent ID or name
 * @param capabilities List of agent capabilities
 * @param domain List of domains the agent specializes in
 * @param trustLevel Trust level (0.0 to 1.0)
 * @param ownerUserId Owner's user ID
 * @returns An AgentIdentifier object
 */
function createAgentIdentifier(id, capabilities, domain, trustLevel, ownerUserId) {
    // Validate trust level
    if (trustLevel < 0.0 || trustLevel > 1.0) {
        throw new Error('Trust level must be between 0.0 and 1.0');
    }
    return {
        id: createAgentId(id),
        capabilities: capabilities,
        domain: domain,
        trustLevel: trustLevel,
        ownerUserId: ownerUserId
    };
}
/**
 * Generates a random alphanumeric string
 * @param length The length of the string to generate
 * @returns A random alphanumeric string
 */
function generateRandomString(length) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var result = '';
    for (var i = 0; i < length; i++) {
        var randomIndex = Math.floor(Math.random() * chars.length);
        result += chars.charAt(randomIndex);
    }
    return result;
}
