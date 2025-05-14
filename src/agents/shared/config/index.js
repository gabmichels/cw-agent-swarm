"use strict";
/**
 * Agent Configuration System
 *
 * This module exports all configuration schemas and utilities for agent managers
 * to provide a centralized access point for the configuration system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIncomingDependenciesForManager = exports.getOutgoingDependenciesForManager = exports.getAllDependenciesForManager = exports.getDependenciesForManagerTypes = exports.CommonConfigDependencies = exports.AgentConfigOrchestrator = exports.validateCrossProperties = exports.validateEnum = exports.validateObject = exports.validateArray = exports.validateBoolean = exports.validateNumber = exports.validateString = exports.validateValue = exports.validateConfig = exports.MigrationError = exports.ConfigMigrationManager = exports.ConfigDefaultsProvider = exports.createConfigFactory = exports.createOutputProcessorConfig = exports.OutputProcessorPresets = exports.OutputProcessorConfigSchema = exports.createInputProcessorConfig = exports.InputProcessorPresets = exports.InputProcessorConfigSchema = exports.createReflectionManagerConfig = exports.ReflectionManagerPresets = exports.ReflectionManagerConfigSchema = exports.createSchedulerManagerConfig = exports.SchedulerManagerPresets = exports.SchedulerManagerConfigSchema = exports.createKnowledgeManagerConfig = exports.KnowledgeManagerPresets = exports.KnowledgeManagerConfigSchema = exports.createToolManagerConfig = exports.ToolManagerPresets = exports.ToolManagerConfigSchema = exports.createPlanningManagerConfig = exports.PlanningManagerPresets = exports.PlanningManagerConfigSchema = exports.createMemoryManagerConfig = exports.MemoryManagerPresets = exports.MemoryManagerConfigSchema = void 0;
// Export memory manager configuration
var MemoryManagerConfigSchema_1 = require("../memory/config/MemoryManagerConfigSchema");
Object.defineProperty(exports, "MemoryManagerConfigSchema", { enumerable: true, get: function () { return MemoryManagerConfigSchema_1.MemoryManagerConfigSchema; } });
Object.defineProperty(exports, "MemoryManagerPresets", { enumerable: true, get: function () { return MemoryManagerConfigSchema_1.MemoryManagerPresets; } });
Object.defineProperty(exports, "createMemoryManagerConfig", { enumerable: true, get: function () { return MemoryManagerConfigSchema_1.createMemoryManagerConfig; } });
// Export planning manager configuration
var PlanningManagerConfigSchema_1 = require("../planning/config/PlanningManagerConfigSchema");
Object.defineProperty(exports, "PlanningManagerConfigSchema", { enumerable: true, get: function () { return PlanningManagerConfigSchema_1.PlanningManagerConfigSchema; } });
Object.defineProperty(exports, "PlanningManagerPresets", { enumerable: true, get: function () { return PlanningManagerConfigSchema_1.PlanningManagerPresets; } });
Object.defineProperty(exports, "createPlanningManagerConfig", { enumerable: true, get: function () { return PlanningManagerConfigSchema_1.createPlanningManagerConfig; } });
// Export tool manager configuration
var ToolManagerConfigSchema_1 = require("../tools/config/ToolManagerConfigSchema");
Object.defineProperty(exports, "ToolManagerConfigSchema", { enumerable: true, get: function () { return ToolManagerConfigSchema_1.ToolManagerConfigSchema; } });
Object.defineProperty(exports, "ToolManagerPresets", { enumerable: true, get: function () { return ToolManagerConfigSchema_1.ToolManagerPresets; } });
Object.defineProperty(exports, "createToolManagerConfig", { enumerable: true, get: function () { return ToolManagerConfigSchema_1.createToolManagerConfig; } });
// Export knowledge manager configuration
var KnowledgeManagerConfigSchema_1 = require("../knowledge/config/KnowledgeManagerConfigSchema");
Object.defineProperty(exports, "KnowledgeManagerConfigSchema", { enumerable: true, get: function () { return KnowledgeManagerConfigSchema_1.KnowledgeManagerConfigSchema; } });
Object.defineProperty(exports, "KnowledgeManagerPresets", { enumerable: true, get: function () { return KnowledgeManagerConfigSchema_1.KnowledgeManagerPresets; } });
Object.defineProperty(exports, "createKnowledgeManagerConfig", { enumerable: true, get: function () { return KnowledgeManagerConfigSchema_1.createKnowledgeManagerConfig; } });
// Export scheduler manager configuration
var SchedulerManagerConfigSchema_1 = require("../scheduler/config/SchedulerManagerConfigSchema");
Object.defineProperty(exports, "SchedulerManagerConfigSchema", { enumerable: true, get: function () { return SchedulerManagerConfigSchema_1.SchedulerManagerConfigSchema; } });
Object.defineProperty(exports, "SchedulerManagerPresets", { enumerable: true, get: function () { return SchedulerManagerConfigSchema_1.SchedulerManagerPresets; } });
Object.defineProperty(exports, "createSchedulerManagerConfig", { enumerable: true, get: function () { return SchedulerManagerConfigSchema_1.createSchedulerManagerConfig; } });
// Export reflection manager configuration
var ReflectionManagerConfigSchema_1 = require("../reflection/config/ReflectionManagerConfigSchema");
Object.defineProperty(exports, "ReflectionManagerConfigSchema", { enumerable: true, get: function () { return ReflectionManagerConfigSchema_1.ReflectionManagerConfigSchema; } });
Object.defineProperty(exports, "ReflectionManagerPresets", { enumerable: true, get: function () { return ReflectionManagerConfigSchema_1.ReflectionManagerPresets; } });
Object.defineProperty(exports, "createReflectionManagerConfig", { enumerable: true, get: function () { return ReflectionManagerConfigSchema_1.createReflectionManagerConfig; } });
// Export input processor configuration
var InputProcessorConfigSchema_1 = require("../input/config/InputProcessorConfigSchema");
Object.defineProperty(exports, "InputProcessorConfigSchema", { enumerable: true, get: function () { return InputProcessorConfigSchema_1.InputProcessorConfigSchema; } });
Object.defineProperty(exports, "InputProcessorPresets", { enumerable: true, get: function () { return InputProcessorConfigSchema_1.InputProcessorPresets; } });
Object.defineProperty(exports, "createInputProcessorConfig", { enumerable: true, get: function () { return InputProcessorConfigSchema_1.createInputProcessorConfig; } });
// Export output processor configuration
var OutputProcessorConfigSchema_1 = require("../output/config/OutputProcessorConfigSchema");
Object.defineProperty(exports, "OutputProcessorConfigSchema", { enumerable: true, get: function () { return OutputProcessorConfigSchema_1.OutputProcessorConfigSchema; } });
Object.defineProperty(exports, "OutputProcessorPresets", { enumerable: true, get: function () { return OutputProcessorConfigSchema_1.OutputProcessorPresets; } });
Object.defineProperty(exports, "createOutputProcessorConfig", { enumerable: true, get: function () { return OutputProcessorConfigSchema_1.createOutputProcessorConfig; } });
// Export factory and validation utilities from the core configuration system
var factory_1 = require("../../../lib/config/factory");
Object.defineProperty(exports, "createConfigFactory", { enumerable: true, get: function () { return factory_1.createConfigFactory; } });
Object.defineProperty(exports, "ConfigDefaultsProvider", { enumerable: true, get: function () { return factory_1.ConfigDefaultsProvider; } });
// Export migration utilities
var migration_1 = require("../../../lib/config/migration");
Object.defineProperty(exports, "ConfigMigrationManager", { enumerable: true, get: function () { return migration_1.ConfigMigrationManager; } });
Object.defineProperty(exports, "MigrationError", { enumerable: true, get: function () { return migration_1.MigrationError; } });
// Export validation utilities
var validators_1 = require("../../../lib/config/validators");
Object.defineProperty(exports, "validateConfig", { enumerable: true, get: function () { return validators_1.validateConfig; } });
Object.defineProperty(exports, "validateValue", { enumerable: true, get: function () { return validators_1.validateValue; } });
Object.defineProperty(exports, "validateString", { enumerable: true, get: function () { return validators_1.validateString; } });
Object.defineProperty(exports, "validateNumber", { enumerable: true, get: function () { return validators_1.validateNumber; } });
Object.defineProperty(exports, "validateBoolean", { enumerable: true, get: function () { return validators_1.validateBoolean; } });
Object.defineProperty(exports, "validateArray", { enumerable: true, get: function () { return validators_1.validateArray; } });
Object.defineProperty(exports, "validateObject", { enumerable: true, get: function () { return validators_1.validateObject; } });
Object.defineProperty(exports, "validateEnum", { enumerable: true, get: function () { return validators_1.validateEnum; } });
Object.defineProperty(exports, "validateCrossProperties", { enumerable: true, get: function () { return validators_1.validateCrossProperties; } });
// Export agent configuration orchestration
var AgentConfigOrchestrator_1 = require("./AgentConfigOrchestrator");
Object.defineProperty(exports, "AgentConfigOrchestrator", { enumerable: true, get: function () { return AgentConfigOrchestrator_1.AgentConfigOrchestrator; } });
// Export common configuration dependencies
var CommonConfigDependencies_1 = require("./CommonConfigDependencies");
Object.defineProperty(exports, "CommonConfigDependencies", { enumerable: true, get: function () { return CommonConfigDependencies_1.CommonConfigDependencies; } });
Object.defineProperty(exports, "getDependenciesForManagerTypes", { enumerable: true, get: function () { return CommonConfigDependencies_1.getDependenciesForManagerTypes; } });
Object.defineProperty(exports, "getAllDependenciesForManager", { enumerable: true, get: function () { return CommonConfigDependencies_1.getAllDependenciesForManager; } });
Object.defineProperty(exports, "getOutgoingDependenciesForManager", { enumerable: true, get: function () { return CommonConfigDependencies_1.getOutgoingDependenciesForManager; } });
Object.defineProperty(exports, "getIncomingDependenciesForManager", { enumerable: true, get: function () { return CommonConfigDependencies_1.getIncomingDependenciesForManager; } });
