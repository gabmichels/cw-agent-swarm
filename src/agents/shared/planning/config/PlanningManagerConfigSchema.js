"use strict";
/**
 * Planning Manager Configuration Schema
 *
 * This module defines the configuration schema for planning managers,
 * including validation rules and default values.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanningManagerPresets = exports.PlanningManagerConfigSchema = void 0;
exports.createPlanningManagerConfig = createPlanningManagerConfig;
/**
 * Schema for planning manager configuration
 */
exports.PlanningManagerConfigSchema = {
    enabled: {
        type: 'boolean',
        required: true,
        default: true,
        description: 'Whether the planning manager is enabled'
    },
    enableAutoPlanning: {
        type: 'boolean',
        default: true,
        description: 'Whether automatic goal planning is enabled'
    },
    planningIntervalMs: {
        type: 'number',
        min: 1000, // Minimum 1 second
        max: 86400000, // Maximum 24 hours
        default: 300000, // Default 5 minutes
        description: 'Interval for automatic planning in milliseconds'
    },
    maxConcurrentPlans: {
        type: 'number',
        min: 1,
        max: 20,
        default: 5,
        description: 'Maximum number of concurrent plans'
    },
    minConfidenceThreshold: {
        type: 'number',
        min: 0,
        max: 1,
        default: 0.7,
        description: 'Minimum confidence threshold for plan execution'
    },
    enablePlanAdaptation: {
        type: 'boolean',
        default: true,
        description: 'Whether to enable plan adaptation'
    },
    maxAdaptationAttempts: {
        type: 'number',
        min: 1,
        max: 10,
        default: 3,
        description: 'Maximum number of plan adaptation attempts'
    },
    enablePlanValidation: {
        type: 'boolean',
        default: true,
        description: 'Whether to enable plan validation'
    },
    enablePlanOptimization: {
        type: 'boolean',
        default: true,
        description: 'Whether to enable plan optimization'
    }
};
/**
 * Planning manager configuration presets for different agent roles
 */
exports.PlanningManagerPresets = {
    // Preset for agents that need to be very deliberate and thorough in planning
    THOROUGH_PLANNER: {
        enableAutoPlanning: true,
        planningIntervalMs: 600000, // 10 minutes
        maxConcurrentPlans: 3,
        minConfidenceThreshold: 0.8,
        enablePlanAdaptation: true,
        maxAdaptationAttempts: 5,
        enablePlanValidation: true,
        enablePlanOptimization: true
    },
    // Preset for agents that need to be quick and adaptive
    ADAPTIVE_PLANNER: {
        enableAutoPlanning: true,
        planningIntervalMs: 180000, // 3 minutes
        maxConcurrentPlans: 7,
        minConfidenceThreshold: 0.6,
        enablePlanAdaptation: true,
        maxAdaptationAttempts: 5,
        enablePlanValidation: true,
        enablePlanOptimization: true
    },
    // Preset for minimal planning agents
    MINIMAL_PLANNER: {
        enableAutoPlanning: false,
        maxConcurrentPlans: 2,
        minConfidenceThreshold: 0.75,
        enablePlanAdaptation: false,
        enablePlanValidation: true,
        enablePlanOptimization: false
    },
    // Preset for real-time planning agents
    REALTIME_PLANNER: {
        enableAutoPlanning: true,
        planningIntervalMs: 60000, // 1 minute
        maxConcurrentPlans: 10,
        minConfidenceThreshold: 0.5,
        enablePlanAdaptation: true,
        maxAdaptationAttempts: 2,
        enablePlanValidation: true,
        enablePlanOptimization: true
    }
};
/**
 * Factory function to create a planning manager configuration with a preset
 * @param preset Preset name or configuration object
 * @param overrides Configuration overrides
 * @returns The merged configuration
 */
function createPlanningManagerConfig(preset, overrides) {
    if (preset === void 0) { preset = 'ADAPTIVE_PLANNER'; }
    if (overrides === void 0) { overrides = {}; }
    // Get the preset configuration
    var presetConfig = typeof preset === 'string'
        ? exports.PlanningManagerPresets[preset]
        : preset;
    // Merge with base defaults and overrides
    return __assign(__assign({ enabled: true, enableAutoPlanning: true, planningIntervalMs: 300000, maxConcurrentPlans: 5, minConfidenceThreshold: 0.7, enablePlanAdaptation: true, maxAdaptationAttempts: 3, enablePlanValidation: true, enablePlanOptimization: true }, presetConfig), overrides);
}
