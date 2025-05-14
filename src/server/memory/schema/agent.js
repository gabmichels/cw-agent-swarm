"use strict";
/**
 * Agent Schema
 *
 * This module defines the schema for agents in the multi-agent system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentSchema = exports.agentSchemaJSON = exports.AgentStatus = void 0;
var types_1 = require("./types");
var schema_1 = require("./schema");
var version_1 = require("./version");
/**
 * Agent status enum
 */
var AgentStatus;
(function (AgentStatus) {
    AgentStatus["AVAILABLE"] = "available";
    AgentStatus["BUSY"] = "busy";
    AgentStatus["OFFLINE"] = "offline";
    AgentStatus["MAINTENANCE"] = "maintenance";
})(AgentStatus || (exports.AgentStatus = AgentStatus = {}));
/**
 * Agent schema JSON definition
 */
exports.agentSchemaJSON = {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    required: ["id", "name", "capabilities", "parameters", "status", "metadata", "content", "type"],
    properties: {
        id: {
            type: "object",
            required: ["namespace", "type", "id"],
            properties: {
                namespace: { type: "string" },
                type: { type: "string" },
                id: { type: "string" },
                version: { type: "number" }
            }
        },
        name: {
            type: "string",
            minLength: 1,
            maxLength: 100
        },
        description: {
            type: "string",
            maxLength: 500
        },
        content: { type: "string" },
        type: {
            type: "string",
            const: "agent"
        },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        createdBy: { type: "string" },
        schemaVersion: { type: "string" },
        capabilities: {
            type: "array",
            items: {
                type: "object",
                required: ["id", "name", "description", "version"],
                properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    version: { type: "string" },
                    parameters: {
                        type: "object",
                        additionalProperties: true
                    }
                }
            }
        },
        parameters: {
            type: "object",
            required: ["model", "temperature", "maxTokens", "tools"],
            properties: {
                model: { type: "string" },
                temperature: {
                    type: "number",
                    minimum: 0,
                    maximum: 1
                },
                maxTokens: {
                    type: "number",
                    minimum: 1
                },
                tools: {
                    type: "array",
                    items: {
                        type: "object",
                        required: ["id", "name", "description", "parameters", "requiredPermissions"],
                        properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            description: { type: "string" },
                            parameters: {
                                type: "object",
                                additionalProperties: true
                            },
                            requiredPermissions: {
                                type: "array",
                                items: { type: "string" }
                            }
                        }
                    }
                },
                customInstructions: { type: "string" },
                contextWindow: { type: "number" },
                systemMessages: {
                    type: "array",
                    items: { type: "string" }
                }
            }
        },
        status: {
            type: "string",
            enum: Object.values(AgentStatus)
        },
        lastActive: { type: "string", format: "date-time" },
        chatIds: {
            type: "array",
            items: {
                type: "object",
                required: ["namespace", "type", "id"],
                properties: {
                    namespace: { type: "string" },
                    type: { type: "string" },
                    id: { type: "string" },
                    version: { type: "number" }
                }
            }
        },
        teamIds: {
            type: "array",
            items: {
                type: "object",
                required: ["namespace", "type", "id"],
                properties: {
                    namespace: { type: "string" },
                    type: { type: "string" },
                    id: { type: "string" },
                    version: { type: "number" }
                }
            }
        },
        metadata: {
            type: "object",
            required: ["tags", "domain", "specialization", "performanceMetrics", "version", "isPublic"],
            properties: {
                tags: {
                    type: "array",
                    items: { type: "string" }
                },
                domain: {
                    type: "array",
                    items: { type: "string" }
                },
                specialization: {
                    type: "array",
                    items: { type: "string" }
                },
                performanceMetrics: {
                    type: "object",
                    required: ["successRate", "averageResponseTime", "taskCompletionRate"],
                    properties: {
                        successRate: {
                            type: "number",
                            minimum: 0,
                            maximum: 1
                        },
                        averageResponseTime: {
                            type: "number",
                            minimum: 0
                        },
                        taskCompletionRate: {
                            type: "number",
                            minimum: 0,
                            maximum: 1
                        }
                    }
                },
                version: { type: "string" },
                isPublic: { type: "boolean" }
            },
            additionalProperties: true
        }
    }
};
// Default agent values
var agentDefaults = {
    name: "Unnamed Agent",
    description: "",
    content: "",
    type: "agent",
    createdBy: "system",
    capabilities: [],
    parameters: {
        model: "default",
        temperature: 0.7,
        maxTokens: 1000,
        tools: []
    },
    status: AgentStatus.AVAILABLE,
    metadata: {
        tags: [],
        domain: [],
        specialization: [],
        performanceMetrics: {
            successRate: 0,
            averageResponseTime: 0,
            taskCompletionRate: 0
        },
        version: "1.0.0",
        isPublic: false
    }
};
// Export singleton instance
exports.agentSchema = new schema_1.SchemaImpl("agent", version_1.SchemaVersionImpl.create(1, 0), types_1.SchemaType.ENTITY, exports.agentSchemaJSON, agentDefaults);
