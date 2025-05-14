"use strict";
/**
 * Configuration Factory
 *
 * This module provides a factory class for creating validated configurations
 * from schemas with support for defaults, validation, and inheritance.
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
exports.ConfigFactory = exports.ConfigDefaultsProvider = void 0;
exports.createConfigFactory = createConfigFactory;
var types_1 = require("./types");
var validators_1 = require("./validators");
var errors_1 = require("./errors");
/**
 * Default provider implementation
 */
var ConfigDefaultsProvider = /** @class */ (function () {
    function ConfigDefaultsProvider(schema) {
        this.schema = schema;
    }
    /**
     * Apply defaults to a configuration
     */
    ConfigDefaultsProvider.prototype.applyDefaults = function (config) {
        var result = __assign({}, config);
        for (var _i = 0, _a = Object.entries(this.schema); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], schema = _b[1];
            if (result[key] === undefined && schema.default !== undefined) {
                result[key] = schema.default;
            }
        }
        return result;
    };
    /**
     * Get the default value for a property
     */
    ConfigDefaultsProvider.prototype.getDefaultValue = function (propertyPath) {
        var schema = this.schema[propertyPath];
        return schema === null || schema === void 0 ? void 0 : schema.default;
    };
    /**
     * Check if a property has a default value
     */
    ConfigDefaultsProvider.prototype.hasDefaultValue = function (propertyPath) {
        var schema = this.schema[propertyPath];
        return (schema === null || schema === void 0 ? void 0 : schema.default) !== undefined;
    };
    return ConfigDefaultsProvider;
}());
exports.ConfigDefaultsProvider = ConfigDefaultsProvider;
/**
 * Configuration factory implementation
 */
var ConfigFactory = /** @class */ (function () {
    /**
     * Create a new configuration factory
     * @param schema Configuration schema
     * @param migrationManager Optional migration manager for versioned configs
     */
    function ConfigFactory(schema, migrationManager) {
        this.schema = schema;
        this.isVersioned = false;
        this.currentVersion = '1.0.0';
        this.defaultsProvider = new ConfigDefaultsProvider(schema);
        this.migrationManager = migrationManager;
        // Check if this is a versioned schema
        var versionedSchema = schema;
        if (versionedSchema.version) {
            this.isVersioned = true;
            if (versionedSchema.version.default) {
                this.currentVersion = versionedSchema.version.default;
            }
            // Set latest version in migration manager if provided
            if (this.migrationManager && this.currentVersion) {
                this.migrationManager.setLatestVersion(this.currentVersion);
            }
        }
    }
    /**
     * Create a validated configuration
     */
    ConfigFactory.prototype.create = function (config, options) {
        if (config === void 0) { config = {}; }
        if (options === void 0) { options = {}; }
        // Apply defaults
        var withDefaults = this.applyDefaults(config);
        // Handle versioned configuration
        if (this.isVersioned && this.migrationManager) {
            var versionedConfig = withDefaults;
            // If config has version and it's not current, migrate it
            if (versionedConfig.version && versionedConfig.version !== this.currentVersion) {
                var fromVersion = versionedConfig.version;
                var migrated = this.migrationManager.migrateConfig(versionedConfig, fromVersion, this.currentVersion);
                // Set current version
                migrated.version = this.currentVersion;
                // Validate migrated config
                return this.validateAndFinalize(migrated, options);
            }
            // Ensure version is set
            if (!versionedConfig.version) {
                versionedConfig.version = this.currentVersion;
            }
        }
        // Validate and return
        return this.validateAndFinalize(withDefaults, options);
    };
    /**
     * Validate a configuration
     */
    ConfigFactory.prototype.validate = function (config, options) {
        if (options === void 0) { options = {}; }
        return (0, validators_1.validateConfig)(config, this.schema, options);
    };
    /**
     * Apply defaults to a configuration
     */
    ConfigFactory.prototype.applyDefaults = function (config) {
        return this.defaultsProvider.applyDefaults(config);
    };
    /**
     * Update an existing configuration
     */
    ConfigFactory.prototype.update = function (current, updates, strategy, options) {
        if (strategy === void 0) { strategy = types_1.UpdateStrategy.MERGE; }
        if (options === void 0) { options = {}; }
        var merged;
        // Apply update strategy
        switch (strategy) {
            case types_1.UpdateStrategy.REPLACE:
                // Complete replacement with defaults for missing values
                merged = this.applyDefaults(updates);
                break;
            case types_1.UpdateStrategy.MERGE:
                // Simple merge
                merged = __assign(__assign({}, current), updates);
                break;
            case types_1.UpdateStrategy.DEEP_MERGE:
                // Deep merge
                merged = this.deepMerge(current, updates);
                break;
            default:
                throw new Error("Unsupported update strategy: ".concat(strategy));
        }
        // Validate
        var result = this.validate(merged, options);
        if (!result.valid) {
            if (options.throwOnError !== false) {
                throw new errors_1.ConfigValidationError('Configuration update validation failed', result.errors);
            }
            // Return unmodified config if validation failed but throwing is disabled
            return current;
        }
        return result.config;
    };
    /**
     * Serialize configuration to JSON string
     */
    ConfigFactory.prototype.serialize = function (config) {
        return JSON.stringify(config);
    };
    /**
     * Deserialize configuration from JSON string
     */
    ConfigFactory.prototype.deserialize = function (json, options) {
        if (options === void 0) { options = {}; }
        try {
            var parsed = JSON.parse(json);
            return this.create(parsed, options);
        }
        catch (error) {
            throw new Error("Failed to deserialize configuration: ".concat(error instanceof Error ? error.message : String(error)));
        }
    };
    /**
     * Set the migration manager
     */
    ConfigFactory.prototype.setMigrationManager = function (migrationManager) {
        this.migrationManager = migrationManager;
        // Set latest version
        if (this.isVersioned && this.currentVersion) {
            this.migrationManager.setLatestVersion(this.currentVersion);
        }
    };
    /**
     * Get the schema of this factory
     */
    ConfigFactory.prototype.getSchema = function () {
        return this.schema;
    };
    /**
     * Get the current schema version
     */
    ConfigFactory.prototype.getCurrentVersion = function () {
        return this.isVersioned ? this.currentVersion : undefined;
    };
    /**
     * Validate and finalize a configuration
     * @private
     */
    ConfigFactory.prototype.validateAndFinalize = function (config, options) {
        if (options === void 0) { options = {}; }
        var result = this.validate(config, __assign({ throwOnError: true, applyDefaults: true }, options));
        if (!result.valid || !result.config) {
            throw new errors_1.ConfigValidationError('Configuration validation failed', result.errors);
        }
        return result.config;
    };
    /**
     * Deep merge two objects
     */
    ConfigFactory.prototype.deepMerge = function (target, source) {
        var output = __assign({}, target);
        for (var key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                var sourceValue = source[key];
                var targetValue = target[key];
                if (sourceValue !== null &&
                    targetValue !== null &&
                    typeof sourceValue === 'object' &&
                    typeof targetValue === 'object' &&
                    !Array.isArray(sourceValue) &&
                    !Array.isArray(targetValue)) {
                    // Recursively merge objects
                    output[key] = this.deepMerge(targetValue, sourceValue);
                }
                else {
                    // Direct assignment for other types
                    output[key] = sourceValue;
                }
            }
        }
        return output;
    };
    return ConfigFactory;
}());
exports.ConfigFactory = ConfigFactory;
/**
 * Create a configuration factory
 * @param schema Configuration schema
 * @param migrationManager Optional migration manager
 * @returns Configuration factory
 */
function createConfigFactory(schema, migrationManager) {
    return new ConfigFactory(schema, migrationManager);
}
