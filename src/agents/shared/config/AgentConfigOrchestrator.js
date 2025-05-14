"use strict";
/**
 * Agent Configuration Orchestrator
 *
 * This module provides a configuration orchestrator that handles agent-level
 * configuration management and dependency resolution between managers.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentConfigOrchestrator = void 0;
var factory_1 = require("../../../lib/config/factory");
var errors_1 = require("../../../lib/config/errors");
/**
 * Agent configuration orchestrator
 *
 * Handles agent-level configuration orchestration and dependency resolution
 */
var AgentConfigOrchestrator = /** @class */ (function () {
    /**
     * Create a new configuration orchestrator
     * @param agent The agent to manage configuration for
     * @param schema The agent configuration schema
     */
    function AgentConfigOrchestrator(agent, schema) {
        this.dependencies = [];
        this.agent = agent;
        this.schema = schema;
        this.configFactory = (0, factory_1.createConfigFactory)(schema.general);
    }
    /**
     * Register a configuration dependency
     * @param dependency The dependency to register
     * @returns The orchestrator instance for chaining
     */
    AgentConfigOrchestrator.prototype.registerDependency = function (dependency) {
        this.dependencies.push(dependency);
        return this;
    };
    /**
     * Register multiple configuration dependencies
     * @param dependencies The dependencies to register
     * @returns The orchestrator instance for chaining
     */
    AgentConfigOrchestrator.prototype.registerDependencies = function (dependencies) {
        var _a;
        (_a = this.dependencies).push.apply(_a, dependencies);
        return this;
    };
    /**
     * Get all registered dependencies
     * @returns The registered dependencies
     */
    AgentConfigOrchestrator.prototype.getDependencies = function () {
        return __spreadArray([], this.dependencies, true);
    };
    /**
     * Get dependencies for a specific manager
     * @param managerType The manager type to get dependencies for
     * @returns Dependencies where the manager is the source or target
     */
    AgentConfigOrchestrator.prototype.getDependenciesForManager = function (managerType) {
        return this.dependencies.filter(function (dep) { return dep.sourceManager === managerType || dep.targetManager === managerType; });
    };
    /**
     * Get incoming dependencies for a manager
     * @param managerType The manager type to get dependencies for
     * @returns Dependencies where the manager is the target
     */
    AgentConfigOrchestrator.prototype.getIncomingDependencies = function (managerType) {
        return this.dependencies.filter(function (dep) { return dep.targetManager === managerType; });
    };
    /**
     * Get outgoing dependencies for a manager
     * @param managerType The manager type to get dependencies for
     * @returns Dependencies where the manager is the source
     */
    AgentConfigOrchestrator.prototype.getOutgoingDependencies = function (managerType) {
        return this.dependencies.filter(function (dep) { return dep.sourceManager === managerType; });
    };
    /**
     * Apply registered dependencies to the agent's managers
     * @returns Object mapping manager types to their applied dependencies
     */
    AgentConfigOrchestrator.prototype.applyDependencies = function () {
        var result = {};
        var managers = this.getManagersMap();
        // Process dependencies in order
        for (var _i = 0, _a = this.dependencies; _i < _a.length; _i++) {
            var dependency = _a[_i];
            var sourceManager = dependency.sourceManager, sourceProperty = dependency.sourceProperty, targetManager = dependency.targetManager, targetProperty = dependency.targetProperty;
            // Get the source and target managers
            var source = managers[sourceManager];
            var target = managers[targetManager];
            if (!source || !target) {
                console.warn("Cannot apply dependency: ".concat(sourceManager, ".").concat(sourceProperty, " -> ").concat(targetManager, ".").concat(targetProperty));
                continue;
            }
            try {
                // Get the source configuration
                var sourceConfig = source.getConfig();
                // Get the source value
                var sourceValue = this.getPropertyValue(sourceConfig, sourceProperty);
                if (sourceValue === undefined && dependency.required) {
                    console.warn("Required dependency source value not found: ".concat(sourceManager, ".").concat(sourceProperty));
                    continue;
                }
                // Transform the value if needed
                var transformedValue = dependency.transform
                    ? dependency.transform(sourceValue)
                    : sourceValue;
                // Validate if needed
                if (dependency.validate && !dependency.validate(transformedValue)) {
                    console.warn("Dependency validation failed: ".concat(sourceManager, ".").concat(sourceProperty, " -> ").concat(targetManager, ".").concat(targetProperty));
                    continue;
                }
                // Get the target configuration
                var targetConfig = target.getConfig();
                // Create updated config with the dependency value
                var updatedConfig = __assign({}, targetConfig);
                // Set the property value
                this.setPropertyValue(updatedConfig, targetProperty, transformedValue);
                // Update the target manager configuration
                target.updateConfig(updatedConfig);
                // Track applied dependency
                if (!result[targetManager]) {
                    result[targetManager] = [];
                }
                result[targetManager].push(dependency);
            }
            catch (error) {
                console.error("Error applying dependency: ".concat(sourceManager, ".").concat(sourceProperty, " -> ").concat(targetManager, ".").concat(targetProperty), error);
            }
        }
        return result;
    };
    /**
     * Verify the agent's configuration for consistency and dependency satisfaction
     * @returns Verification result
     */
    AgentConfigOrchestrator.prototype.verifyConfiguration = function () {
        var result = {
            success: true
        };
        var errors = [];
        var conflicts = [];
        var unsatisfiedDependencies = [];
        var managers = this.getManagersMap();
        // Verify manager configurations against their schemas
        for (var _i = 0, _a = Object.entries(managers); _i < _a.length; _i++) {
            var _b = _a[_i], managerType = _b[0], manager = _b[1];
            // Skip if no schema for this manager
            if (!this.schema.managers[managerType]) {
                continue;
            }
            // Get the manager's configuration
            var config = manager.getConfig();
            // Verify against schema
            try {
                var schemaFactory = (0, factory_1.createConfigFactory)(this.schema.managers[managerType]);
                schemaFactory.validate(config, { throwOnError: true });
            }
            catch (error) {
                if (error instanceof errors_1.ConfigValidationError) {
                    errors.push.apply(errors, error.errors);
                    result.success = false;
                }
                else {
                    errors.push(new errors_1.ValidationError("Validation error for ".concat(managerType, ": ").concat(error instanceof Error ? error.message : String(error)), managerType));
                    result.success = false;
                }
            }
        }
        // Verify dependencies
        for (var _c = 0, _d = this.dependencies; _c < _d.length; _c++) {
            var dependency = _d[_c];
            var sourceManager = dependency.sourceManager, sourceProperty = dependency.sourceProperty, targetManager = dependency.targetManager, targetProperty = dependency.targetProperty, required = dependency.required;
            // Get the source and target managers
            var source = managers[sourceManager];
            var target = managers[targetManager];
            if (!source || !target) {
                if (required) {
                    unsatisfiedDependencies.push({
                        dependency: dependency,
                        reason: !source
                            ? "Source manager ".concat(sourceManager, " not found")
                            : "Target manager ".concat(targetManager, " not found")
                    });
                    result.success = false;
                }
                continue;
            }
            // Get the source configuration
            var sourceConfig = source.getConfig();
            // Get the source value
            var sourceValue = this.getPropertyValue(sourceConfig, sourceProperty);
            if (sourceValue === undefined && required) {
                unsatisfiedDependencies.push({
                    dependency: dependency,
                    reason: "Required source property ".concat(sourceProperty, " not found in ").concat(sourceManager)
                });
                result.success = false;
                continue;
            }
            // Transform the value if needed
            try {
                var transformedValue = dependency.transform
                    ? dependency.transform(sourceValue)
                    : sourceValue;
                // Validate if needed
                if (dependency.validate && !dependency.validate(transformedValue)) {
                    unsatisfiedDependencies.push({
                        dependency: dependency,
                        reason: "Validation failed for transformed value"
                    });
                    result.success = false;
                }
            }
            catch (error) {
                unsatisfiedDependencies.push({
                    dependency: dependency,
                    reason: "Error in transform function: ".concat(error instanceof Error ? error.message : String(error))
                });
                result.success = false;
            }
        }
        // Check for conflicts between managers
        for (var _e = 0, _f = this.dependencies; _e < _f.length; _e++) {
            var depA = _f[_e];
            for (var _g = 0, _h = this.dependencies; _g < _h.length; _g++) {
                var depB = _h[_g];
                // Skip if same dependency or different target properties
                if (depA === depB || depA.targetManager !== depB.targetManager || depA.targetProperty !== depB.targetProperty) {
                    continue;
                }
                // Get the source managers
                var sourceA = managers[depA.sourceManager];
                var sourceB = managers[depB.sourceManager];
                if (!sourceA || !sourceB) {
                    continue;
                }
                // Get the source values
                var sourceConfigA = sourceA.getConfig();
                var sourceConfigB = sourceB.getConfig();
                var sourceValueA = this.getPropertyValue(sourceConfigA, depA.sourceProperty);
                var sourceValueB = this.getPropertyValue(sourceConfigB, depB.sourceProperty);
                // Transform the values if needed
                var transformedValueA = depA.transform ? depA.transform(sourceValueA) : sourceValueA;
                var transformedValueB = depB.transform ? depB.transform(sourceValueB) : sourceValueB;
                // Check for conflict (only if both values are defined)
                if (transformedValueA !== undefined && transformedValueB !== undefined &&
                    JSON.stringify(transformedValueA) !== JSON.stringify(transformedValueB)) {
                    conflicts.push({
                        managerType: depA.sourceManager,
                        property: depA.sourceProperty,
                        value: transformedValueA,
                        conflictsWith: {
                            managerType: depB.sourceManager,
                            property: depB.sourceProperty,
                            value: transformedValueB
                        }
                    });
                    result.success = false;
                }
            }
        }
        // Add errors, conflicts, and unsatisfied dependencies to result
        if (errors.length > 0) {
            result.errors = errors;
        }
        if (conflicts.length > 0) {
            result.conflicts = conflicts;
        }
        if (unsatisfiedDependencies.length > 0) {
            result.unsatisfiedDependencies = unsatisfiedDependencies;
        }
        return result;
    };
    /**
     * Apply a configuration update across relevant managers
     * @param config The configuration update to apply
     * @returns Map of manager types to their validation results
     */
    AgentConfigOrchestrator.prototype.applyConfigurationUpdate = function (config) {
        var results = new Map();
        var managers = this.getManagersMap();
        // First, verify the provided configuration is valid
        var validation = this.configFactory.validate(config);
        if (!validation.valid) {
            results.set('agent', validation);
            return results;
        }
        // Apply manager-specific configurations
        if (config.managers && typeof config.managers === 'object') {
            for (var _i = 0, _a = Object.entries(config.managers); _i < _a.length; _i++) {
                var _b = _a[_i], managerType = _b[0], managerConfig = _b[1];
                // Skip if manager doesn't exist
                if (!managers[managerType]) {
                    continue;
                }
                // Get the manager
                var manager = managers[managerType];
                // Update the manager's configuration
                try {
                    manager.updateConfig(managerConfig);
                    results.set(managerType, { valid: true });
                }
                catch (error) {
                    results.set(managerType, {
                        valid: false,
                        errors: error instanceof errors_1.ConfigValidationError ? error.errors : [
                            new errors_1.ValidationError("Configuration validation failed: ".concat(error instanceof Error ? error.message : String(error)), managerType)
                        ]
                    });
                }
            }
        }
        // Re-apply dependencies to ensure consistency
        this.applyDependencies();
        return results;
    };
    /**
     * Get a map of manager types to manager instances
     * @private
     */
    AgentConfigOrchestrator.prototype.getManagersMap = function () {
        var result = {};
        // Get all managers from the agent
        var managers = this.agent.getManagers();
        for (var _i = 0, managers_1 = managers; _i < managers_1.length; _i++) {
            var manager = managers_1[_i];
            result[manager.getType()] = manager;
        }
        return result;
    };
    /**
     * Get a property value from an object using dot notation
     * @param obj The object to get the property from
     * @param path The property path (e.g., "foo.bar.baz")
     * @private
     */
    AgentConfigOrchestrator.prototype.getPropertyValue = function (obj, path) {
        var parts = path.split('.');
        var current = obj;
        for (var _i = 0, parts_1 = parts; _i < parts_1.length; _i++) {
            var part = parts_1[_i];
            if (current === undefined || current === null) {
                return undefined;
            }
            current = current[part];
        }
        return current;
    };
    /**
     * Set a property value in an object using dot notation
     * @param obj The object to set the property in
     * @param path The property path (e.g., "foo.bar.baz")
     * @param value The value to set
     * @private
     */
    AgentConfigOrchestrator.prototype.setPropertyValue = function (obj, path, value) {
        var parts = path.split('.');
        var lastPart = parts.pop();
        if (!lastPart) {
            return;
        }
        var current = obj;
        for (var _i = 0, parts_2 = parts; _i < parts_2.length; _i++) {
            var part = parts_2[_i];
            if (current[part] === undefined || current[part] === null || typeof current[part] !== 'object') {
                current[part] = {};
            }
            current = current[part];
        }
        current[lastPart] = value;
    };
    return AgentConfigOrchestrator;
}());
exports.AgentConfigOrchestrator = AgentConfigOrchestrator;
