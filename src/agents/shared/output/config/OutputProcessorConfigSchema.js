"use strict";
/**
 * Output Processor Configuration Schema
 *
 * This module defines the configuration schema for output processors,
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
exports.OutputProcessorPresets = exports.OutputProcessorConfigSchema = void 0;
exports.createOutputProcessorConfig = createOutputProcessorConfig;
/**
 * Schema for output processor configuration
 */
exports.OutputProcessorConfigSchema = {
    enabled: {
        type: 'boolean',
        required: true,
        default: true,
        description: 'Whether the output processor is enabled'
    },
    supportedModalities: {
        type: 'array',
        items: {
            type: 'enum',
            enum: ['text', 'markdown', 'html', 'json', 'image', 'audio', 'structured']
        },
        default: ['text', 'markdown'],
        description: 'Output modalities supported by the processor'
    },
    defaultFormat: {
        type: 'enum',
        enum: ['text', 'markdown', 'html', 'json', 'structured'],
        default: 'markdown',
        description: 'Default output format'
    },
    defaultLanguage: {
        type: 'string',
        default: 'en',
        description: 'Default language for output'
    },
    processingSteps: {
        type: 'array',
        items: {
            type: 'enum',
            enum: ['format', 'validate', 'transform', 'filter', 'custom']
        },
        default: ['format', 'validate'],
        description: 'Output processing steps to apply'
    },
    maintainHistory: {
        type: 'boolean',
        default: true,
        description: 'Whether to maintain output history'
    },
    maxHistoryItems: {
        type: 'number',
        min: 1,
        max: 1000,
        default: 100,
        description: 'Maximum history items to maintain'
    },
    contentModerationLevel: {
        type: 'enum',
        enum: ['none', 'low', 'medium', 'high'],
        default: 'medium',
        description: 'Content moderation level'
    },
    includeMetadata: {
        type: 'boolean',
        default: false,
        description: 'Whether to include metadata in output'
    },
    enableStreaming: {
        type: 'boolean',
        default: true,
        description: 'Whether to enable streaming output'
    },
    defaultTemplates: {
        type: 'object',
        properties: {},
        default: {},
        description: 'Default templates by type'
    },
    maxOutputSizeBytes: {
        type: 'number',
        min: 1024, // Minimum 1KB
        max: 104857600, // Maximum 100MB
        default: 1048576, // Default 1MB
        description: 'Maximum output size in bytes'
    },
    formatting: {
        type: 'object',
        properties: {
            formatCodeBlocks: {
                type: 'boolean',
                default: true,
                description: 'Auto-format code blocks'
            },
            codeBlockStyle: {
                type: 'string',
                default: 'markdown',
                description: 'Code block style (markdown, html, etc.)'
            },
            syntaxHighlighting: {
                type: 'boolean',
                default: true,
                description: 'Whether to include syntax highlighting'
            },
            indentSize: {
                type: 'number',
                min: 1,
                max: 8,
                default: 2,
                description: 'Default indent size'
            }
        },
        default: {
            formatCodeBlocks: true,
            codeBlockStyle: 'markdown',
            syntaxHighlighting: true,
            indentSize: 2
        },
        description: 'Formatting options'
    }
};
/**
 * Output processor configuration presets for different agent roles
 */
exports.OutputProcessorPresets = {
    // Preset for comprehensive output processing
    COMPREHENSIVE: {
        supportedModalities: ['text', 'markdown', 'html', 'json', 'image', 'audio', 'structured'],
        defaultFormat: 'markdown',
        processingSteps: ['format', 'validate', 'transform', 'filter'],
        maintainHistory: true,
        maxHistoryItems: 200,
        contentModerationLevel: 'medium',
        includeMetadata: true,
        enableStreaming: true,
        maxOutputSizeBytes: 10485760, // 10MB
        formatting: {
            formatCodeBlocks: true,
            codeBlockStyle: 'markdown',
            syntaxHighlighting: true,
            indentSize: 2
        }
    },
    // Preset for markdown-focused output
    MARKDOWN_FOCUSED: {
        supportedModalities: ['text', 'markdown'],
        defaultFormat: 'markdown',
        processingSteps: ['format', 'validate'],
        maintainHistory: true,
        maxHistoryItems: 100,
        contentModerationLevel: 'medium',
        includeMetadata: false,
        enableStreaming: true,
        maxOutputSizeBytes: 524288, // 512KB
        formatting: {
            formatCodeBlocks: true,
            codeBlockStyle: 'markdown',
            syntaxHighlighting: true,
            indentSize: 2
        }
    },
    // Preset for minimal output processing
    MINIMAL: {
        supportedModalities: ['text'],
        defaultFormat: 'text',
        processingSteps: ['validate'],
        maintainHistory: false,
        maxHistoryItems: 20,
        contentModerationLevel: 'low',
        includeMetadata: false,
        enableStreaming: false,
        maxOutputSizeBytes: 262144, // 256KB
        formatting: {
            formatCodeBlocks: false,
            codeBlockStyle: 'markdown',
            syntaxHighlighting: false,
            indentSize: 2
        }
    },
    // Preset for structured data output
    STRUCTURED_DATA: {
        supportedModalities: ['json', 'structured'],
        defaultFormat: 'json',
        processingSteps: ['format', 'validate'],
        maintainHistory: true,
        maxHistoryItems: 100,
        contentModerationLevel: 'low',
        includeMetadata: true,
        enableStreaming: false,
        maxOutputSizeBytes: 1048576, // 1MB
        formatting: {
            formatCodeBlocks: true,
            codeBlockStyle: 'json',
            syntaxHighlighting: true,
            indentSize: 2
        }
    },
    // Preset for high security output
    HIGH_SECURITY: {
        supportedModalities: ['text', 'markdown'],
        defaultFormat: 'markdown',
        processingSteps: ['format', 'validate', 'filter'],
        maintainHistory: true,
        maxHistoryItems: 50,
        contentModerationLevel: 'high',
        includeMetadata: false,
        enableStreaming: false,
        maxOutputSizeBytes: 524288, // 512KB
        formatting: {
            formatCodeBlocks: true,
            codeBlockStyle: 'markdown',
            syntaxHighlighting: true,
            indentSize: 2
        }
    }
};
/**
 * Factory function to create an output processor configuration with a preset
 * @param preset Preset name or configuration object
 * @param overrides Configuration overrides
 * @returns The merged configuration
 */
function createOutputProcessorConfig(preset, overrides) {
    if (preset === void 0) { preset = 'COMPREHENSIVE'; }
    if (overrides === void 0) { overrides = {}; }
    // Get the preset configuration
    var presetConfig = typeof preset === 'string'
        ? exports.OutputProcessorPresets[preset]
        : preset;
    // Merge with base defaults and overrides
    return __assign(__assign({ enabled: true, supportedModalities: ['text', 'markdown'], defaultFormat: 'markdown', defaultLanguage: 'en', processingSteps: ['format', 'validate'], maintainHistory: true, maxHistoryItems: 100, contentModerationLevel: 'medium', includeMetadata: false, enableStreaming: true, defaultTemplates: {}, maxOutputSizeBytes: 1048576, formatting: {
            formatCodeBlocks: true,
            codeBlockStyle: 'markdown',
            syntaxHighlighting: true,
            indentSize: 2
        } }, presetConfig), overrides);
}
