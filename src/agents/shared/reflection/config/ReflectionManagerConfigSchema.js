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
    enabled: {
        type: 'boolean',
        required: true,
        default: true,
        description: 'Whether the reflection manager is enabled'
    },
    reflectionFrequency: {
        type: 'object',
        properties: {
            interval: {
                type: 'number',
                min: 1000, // Minimum 1 second
                max: 86400000, // Maximum 24 hours
                default: 3600000, // Default 1 hour
                description: 'How often to perform reflections (in ms)'
            },
            afterEachInteraction: {
                type: 'boolean',
                default: false,
                description: 'Whether to reflect after each interaction'
            },
            afterErrors: {
                type: 'boolean',
                default: true,
                description: 'Whether to reflect after errors'
            },
            minIntervalMs: {
                type: 'number',
                min: 1000, // Minimum 1 second
                max: 86400000, // Maximum 24 hours
                default: 60000, // Default 1 minute
                description: 'Minimum time between reflections in milliseconds'
            }
        },
        default: {
            interval: 3600000,
            afterEachInteraction: false,
            afterErrors: true,
            minIntervalMs: 60000
        },
        description: 'Reflection frequency settings'
    },
    reflectionDepth: {
        type: 'enum',
        enum: ['light', 'standard', 'deep'],
        default: 'standard',
        description: 'Reflection depth/thoroughness level'
    },
    maxHistoryItems: {
        type: 'number',
        min: 1,
        max: 1000,
        default: 100,
        description: 'Maximum reflection history items to maintain'
    },
    adaptiveBehavior: {
        type: 'boolean',
        default: true,
        description: 'Whether to adapt behavior based on reflections'
    },
    adaptationRate: {
        type: 'number',
        min: 0,
        max: 1,
        default: 0.3,
        description: 'How aggressively to change behavior based on reflections (0-1)'
    },
    metricsToTrack: {
        type: 'array',
        items: {
            type: 'enum',
            enum: ['success', 'efficiency', 'satisfaction', 'errors', 'custom']
        },
        default: ['success', 'efficiency', 'satisfaction', 'errors'],
        description: 'Metrics to track for reflection'
    },
    improvementGoals: {
        type: 'array',
        items: {
            type: 'string'
        },
        default: [],
        description: 'Self-improvement goals'
    },
    persistReflections: {
        type: 'boolean',
        default: true,
        description: 'Whether to persist reflections across sessions'
    },
    enablePeriodicReflections: {
        type: 'boolean',
        default: true,
        description: 'Whether to enable periodic reflections'
    },
    periodicReflectionSchedule: {
        type: 'string',
        default: '0 0 * * *', // Default: Every day at midnight (cron expression)
        description: 'Default periodic reflection schedule (cron expression or interval)'
    },
    enableSelfImprovement: {
        type: 'boolean',
        default: true,
        description: 'Whether to enable self-improvement capabilities'
    },
    defaultImprovementAreas: {
        type: 'array',
        items: {
            type: 'enum',
            enum: Object.values(ReflectionManager_1.ImprovementAreaType)
        },
        default: [
            ReflectionManager_1.ImprovementAreaType.KNOWLEDGE,
            ReflectionManager_1.ImprovementAreaType.SKILL,
            ReflectionManager_1.ImprovementAreaType.PROCESS
        ],
        description: 'Default improvement areas to focus on'
    }
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
