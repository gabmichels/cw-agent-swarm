"use strict";
/**
 * Tool Manager Configuration Schema
 *
 * This module defines the configuration schema for tool managers,
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
exports.ToolManagerPresets = exports.ToolManagerConfigSchema = void 0;
exports.createToolManagerConfig = createToolManagerConfig;
/**
 * Schema for tool manager configuration
 */
exports.ToolManagerConfigSchema = {
    enabled: {
        type: 'boolean',
        required: true,
        default: true,
        description: 'Whether the tool manager is enabled'
    },
    trackToolPerformance: {
        type: 'boolean',
        default: true,
        description: 'Whether to track tool performance metrics'
    },
    defaultToolTimeoutMs: {
        type: 'number',
        min: 1000, // Minimum 1 second
        max: 300000, // Maximum 5 minutes
        default: 30000, // Default 30 seconds
        description: 'Default tool execution timeout in milliseconds'
    },
    useAdaptiveToolSelection: {
        type: 'boolean',
        default: false,
        description: 'Whether to use adaptive tool selection'
    },
    maxToolRetries: {
        type: 'number',
        min: 0,
        max: 5,
        default: 1,
        description: 'Maximum number of retries for tool execution'
    }
};
/**
 * Tool manager configuration presets for different agent roles
 */
exports.ToolManagerPresets = {
    // Preset for agents that need reliability and performance tracking
    RELIABILITY_FOCUSED: {
        trackToolPerformance: true,
        defaultToolTimeoutMs: 60000, // 1 minute
        useAdaptiveToolSelection: true,
        maxToolRetries: 3
    },
    // Preset for agents that need fast tool execution
    PERFORMANCE_FOCUSED: {
        trackToolPerformance: true,
        defaultToolTimeoutMs: 15000, // 15 seconds
        useAdaptiveToolSelection: true,
        maxToolRetries: 1
    },
    // Preset for minimal tool usage
    MINIMAL: {
        trackToolPerformance: false,
        defaultToolTimeoutMs: 20000, // 20 seconds
        useAdaptiveToolSelection: false,
        maxToolRetries: 0
    },
    // Preset for experimental features
    EXPERIMENTAL: {
        trackToolPerformance: true,
        defaultToolTimeoutMs: 45000, // 45 seconds
        useAdaptiveToolSelection: true,
        maxToolRetries: 2
    }
};
/**
 * Factory function to create a tool manager configuration with a preset
 * @param preset Preset name or configuration object
 * @param overrides Configuration overrides
 * @returns The merged configuration
 */
function createToolManagerConfig(preset, overrides) {
    if (preset === void 0) { preset = 'RELIABILITY_FOCUSED'; }
    if (overrides === void 0) { overrides = {}; }
    // Get the preset configuration
    var presetConfig = typeof preset === 'string'
        ? exports.ToolManagerPresets[preset]
        : preset;
    // Merge with base defaults and overrides
    return __assign(__assign({ enabled: true, trackToolPerformance: true, defaultToolTimeoutMs: 30000, useAdaptiveToolSelection: false, maxToolRetries: 1 }, presetConfig), overrides);
}
