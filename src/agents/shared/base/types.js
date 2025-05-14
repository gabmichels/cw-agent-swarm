"use strict";
/**
 * types.ts - Core types for agent base implementation
 *
 * This file defines the core types and interfaces for the agent base system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentCapabilityLevel = exports.AgentStatus = void 0;
// Canonical agent config and related types (imported from schema)
var agent_1 = require("../../../server/memory/schema/agent");
Object.defineProperty(exports, "AgentStatus", { enumerable: true, get: function () { return agent_1.AgentStatus; } });
/**
 * Capability levels for agents
 */
var AgentCapabilityLevel;
(function (AgentCapabilityLevel) {
    AgentCapabilityLevel["BASIC"] = "basic";
    AgentCapabilityLevel["INTERMEDIATE"] = "intermediate";
    AgentCapabilityLevel["ADVANCED"] = "advanced";
})(AgentCapabilityLevel || (exports.AgentCapabilityLevel = AgentCapabilityLevel = {}));
