"use strict";
/**
 * Reflection Manager Configuration Schema
 *
 * This module defines the configuration schema for reflection managers,
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
exports.ReflectionManagerPresets = exports.ReflectionManagerConfigSchema = void 0;
exports.createReflectionManagerConfig = createReflectionManagerConfig;
var ReflectionManager_1 = require("../../../../lib/agents/base/managers/ReflectionManager");
/**
 * Schema for reflection manager configuration
 */
exports.ReflectionManagerConfigSchema = {
    type: 'object',
    properties: {
        // Base manager options
        enabled: {
            type: 'boolean',
            description: 'Whether this manager is enabled',
            default: true
        },
        // Reflection depth options
        reflectionDepth: {
            type: 'string',
            enum: ['light', 'standard', 'deep'],
            description: 'Depth/thoroughness level for reflections',
            default: 'standard'
        },
        // Reflection frequency settings
        reflectionFrequency: {
            type: 'object',
            description: 'Settings for reflection frequency',
            properties: {
                interval: {
                    type: 'number',
                    description: 'How often to perform reflections (in ms)',
                    default: 3600000 // 1 hour
                },
                afterEachInteraction: {
                    type: 'boolean',
                    description: 'Whether to reflect after each interaction',
                    default: false
                },
                afterErrors: {
                    type: 'boolean',
                    description: 'Whether to reflect after errors',
                    default: true
                },
                minIntervalMs: {
                    type: 'number',
                    description: 'Minimum time between reflections (in ms)',
                    default: 60000 // 1 minute
                }
            },
            default: {
                interval: 3600000,
                afterEachInteraction: false,
                afterErrors: true,
                minIntervalMs: 60000
            }
        },
        // Adaptive behavior options
        adaptiveBehavior: {
            type: 'boolean',
            description: 'Whether to adapt behavior based on reflections',
            default: true
        },
        adaptationRate: {
            type: 'number',
            description: 'How aggressively to change behavior based on reflections (0-1)',
            minimum: 0,
            maximum: 1,
            default: 0.3
        },
        // Storage options
        persistReflections: {
            type: 'boolean',
            description: 'Whether to persist reflections across sessions',
            default: true
        },
        maxHistoryItems: {
            type: 'number',
            description: 'Maximum reflection history items to maintain',
            default: 100
        },
        // Metrics to track
        metricsToTrack: {
            type: 'array',
            description: 'Metrics to track for reflection',
            items: {
                type: 'string'
            },
            default: ['success', 'efficiency', 'satisfaction', 'errors']
        },
        // Improvement goals
        improvementGoals: {
            type: 'array',
            description: 'Self-improvement goals',
            items: {
                type: 'string'
            },
            default: []
        },
        // Enhanced options
        enablePeriodicReflections: {
            type: 'boolean',
            description: 'Whether to enable periodic reflections',
            default: false
        },
        periodicReflectionSchedule: {
            type: 'string',
            description: 'Default periodic reflection schedule (cron expression or interval)',
            default: '0 0 * * *' // Daily at midnight
        },
        enableSelfImprovement: {
            type: 'boolean',
            description: 'Whether to enable self-improvement capabilities',
            default: false
        },
        defaultImprovementAreas: {
            type: 'array',
            description: 'Default improvement areas to focus on',
            items: {
                type: 'string',
                enum: ['knowledge', 'skill', 'strategy', 'behavior', 'tool', 'process']
            },
            default: ['knowledge', 'skill', 'behavior']
        }
    },
    required: ['enabled'],
    additionalProperties: true
};
/**
 * Reflection manager configuration presets for different agent roles
 */
exports.ReflectionManagerPresets = {
    // Preset for agents focused on deep learning and improvement
    DEEP_LEARNER: {
        reflectionFrequency: {
            interval: 1800000, // 30 minutes
            afterEachInteraction: false,
            afterErrors: true,
            minIntervalMs: 60000 // 1 minute
        },
        reflectionDepth: 'deep',
        maxHistoryItems: 500,
        adaptiveBehavior: true,
        adaptationRate: 0.4,
        metricsToTrack: ['success', 'efficiency', 'satisfaction', 'errors', 'custom'],
        persistReflections: true,
        enablePeriodicReflections: true,
        periodicReflectionSchedule: '0 */4 * * *', // Every 4 hours
        enableSelfImprovement: true,
        defaultImprovementAreas: [
            ReflectionManager_1.ImprovementAreaType.KNOWLEDGE,
            ReflectionManager_1.ImprovementAreaType.SKILL,
            ReflectionManager_1.ImprovementAreaType.PROCESS,
            ReflectionManager_1.ImprovementAreaType.PERFORMANCE
        ]
    },
    // Preset for agents that need to be responsive
    RESPONSIVE: {
        reflectionFrequency: {
            interval: 7200000, // 2 hours
            afterEachInteraction: false,
            afterErrors: true,
            minIntervalMs: 300000 // 5 minutes
        },
        reflectionDepth: 'light',
        maxHistoryItems: 50,
        adaptiveBehavior: true,
        adaptationRate: 0.2,
        metricsToTrack: ['success', 'satisfaction', 'errors'],
        persistReflections: true,
        enablePeriodicReflections: true,
        periodicReflectionSchedule: '0 0 * * *', // Once a day at midnight
        enableSelfImprovement: true,
        defaultImprovementAreas: [
            ReflectionManager_1.ImprovementAreaType.PERFORMANCE,
            ReflectionManager_1.ImprovementAreaType.COMMUNICATION
        ]
    },
    // Preset for agents with minimal self-reflection
    MINIMAL: {
        reflectionFrequency: {
            interval: 86400000, // 24 hours
            afterEachInteraction: false,
            afterErrors: true,
            minIntervalMs: 3600000 // 1 hour
        },
        reflectionDepth: 'light',
        maxHistoryItems: 20,
        adaptiveBehavior: false,
        adaptationRate: 0.1,
        metricsToTrack: ['errors'],
        persistReflections: false,
        enablePeriodicReflections: false,
        enableSelfImprovement: false,
        defaultImprovementAreas: []
    },
    // Preset for error-focused learning
    ERROR_FOCUSED: {
        reflectionFrequency: {
            interval: 3600000, // 1 hour
            afterEachInteraction: false,
            afterErrors: true,
            minIntervalMs: 30000 // 30 seconds
        },
        reflectionDepth: 'standard',
        maxHistoryItems: 200,
        adaptiveBehavior: true,
        adaptationRate: 0.5,
        metricsToTrack: ['errors', 'efficiency'],
        persistReflections: true,
        enablePeriodicReflections: true,
        periodicReflectionSchedule: '0 */12 * * *', // Twice a day
        enableSelfImprovement: true,
        defaultImprovementAreas: [
            ReflectionManager_1.ImprovementAreaType.PROCESS,
            ReflectionManager_1.ImprovementAreaType.PERFORMANCE
        ]
    },
    // New preset for continuous improvement agents
    CONTINUOUS_IMPROVER: {
        reflectionFrequency: {
            interval: 3600000, // 1 hour
            afterEachInteraction: true,
            afterErrors: true,
            minIntervalMs: 60000 // 1 minute
        },
        reflectionDepth: 'deep',
        maxHistoryItems: 300,
        adaptiveBehavior: true,
        adaptationRate: 0.6,
        metricsToTrack: ['success', 'efficiency', 'satisfaction', 'errors', 'custom'],
        persistReflections: true,
        enablePeriodicReflections: true,
        periodicReflectionSchedule: '0 */2 * * *', // Every 2 hours
        enableSelfImprovement: true,
        defaultImprovementAreas: Object.values(ReflectionManager_1.ImprovementAreaType)
    }
};
/**
 * Factory function to create a reflection manager configuration with a preset
 * @param preset Preset name or configuration object
 * @param overrides Configuration overrides
 * @returns The merged configuration
 */
function createReflectionManagerConfig(preset, overrides) {
    if (preset === void 0) { preset = 'DEEP_LEARNER'; }
    if (overrides === void 0) { overrides = {}; }
    // Get the preset configuration
    var presetConfig = typeof preset === 'string'
        ? exports.ReflectionManagerPresets[preset]
        : preset;
    // Merge with base defaults and overrides
    return __assign(__assign({ enabled: true, reflectionFrequency: {
            interval: 3600000, // 1 hour
            afterEachInteraction: false,
            afterErrors: true,
            minIntervalMs: 60000 // 1 minute
        }, reflectionDepth: 'standard', maxHistoryItems: 100, adaptiveBehavior: true, adaptationRate: 0.3, metricsToTrack: ['success', 'efficiency', 'satisfaction', 'errors'], improvementGoals: [], persistReflections: true, enablePeriodicReflections: true, periodicReflectionSchedule: '0 0 * * *', enableSelfImprovement: true, defaultImprovementAreas: [
            ReflectionManager_1.ImprovementAreaType.KNOWLEDGE,
            ReflectionManager_1.ImprovementAreaType.SKILL,
            ReflectionManager_1.ImprovementAreaType.PROCESS
        ] }, presetConfig), overrides);
}
