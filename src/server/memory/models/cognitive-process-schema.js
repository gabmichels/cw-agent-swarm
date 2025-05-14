"use strict";
/**
 * Cognitive Process Schema
 *
 * This module defines the schemas for various cognitive processes like
 * thoughts, reflections, insights, planning, etc. It replaces the legacy
 * thought schema with a more comprehensive and strongly-typed structure.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLANNING_DEFAULTS = exports.INSIGHT_DEFAULTS = exports.REFLECTION_DEFAULTS = exports.THOUGHT_DEFAULTS = void 0;
var config_1 = require("../config");
var metadata_1 = require("../../../types/metadata");
var structured_id_1 = require("../../../types/structured-id");
// Default agent ID for system assistant
var DEFAULT_AGENT_ID = (0, structured_id_1.createEnumStructuredId)(structured_id_1.EntityNamespace.SYSTEM, structured_id_1.EntityType.AGENT, 'assistant');
/**
 * Default values for thought schema
 */
exports.THOUGHT_DEFAULTS = {
    type: config_1.MemoryType.THOUGHT,
    metadata: {
        schemaVersion: "1.0.0",
        processType: metadata_1.CognitiveProcessType.THOUGHT,
        agentId: DEFAULT_AGENT_ID
    }
};
/**
 * Default values for reflection schema
 */
exports.REFLECTION_DEFAULTS = {
    type: config_1.MemoryType.REFLECTION,
    metadata: {
        schemaVersion: "1.0.0",
        processType: metadata_1.CognitiveProcessType.REFLECTION,
        agentId: DEFAULT_AGENT_ID
    }
};
/**
 * Default values for insight schema
 */
exports.INSIGHT_DEFAULTS = {
    type: config_1.MemoryType.INSIGHT,
    metadata: {
        schemaVersion: "1.0.0",
        processType: metadata_1.CognitiveProcessType.INSIGHT,
        agentId: DEFAULT_AGENT_ID
    }
};
/**
 * Default values for planning schema
 */
exports.PLANNING_DEFAULTS = {
    type: config_1.MemoryType.TASK,
    metadata: {
        schemaVersion: "1.0.0",
        processType: metadata_1.CognitiveProcessType.PLANNING,
        agentId: DEFAULT_AGENT_ID
    }
};
