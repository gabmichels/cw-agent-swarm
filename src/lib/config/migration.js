"use strict";
/**
 * Configuration Migration Manager
 *
 * This module provides functionality for migrating configurations between versions.
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.ConfigMigrationManager = exports.MigrationError = void 0;
/**
 * Error thrown for migration-related errors
 */
var MigrationError = /** @class */ (function (_super) {
    __extends(MigrationError, _super);
    function MigrationError(message, fromVersion, toVersion) {
        var _this = _super.call(this, message) || this;
        _this.fromVersion = fromVersion;
        _this.toVersion = toVersion;
        _this.name = 'MigrationError';
        return _this;
    }
    return MigrationError;
}(Error));
exports.MigrationError = MigrationError;
/**
 * Default implementation of MigrationManager
 */
var ConfigMigrationManager = /** @class */ (function () {
    /**
     * Create a new ConfigMigrationManager
     * @param initialMigrations Initial migrations to register
     * @param latestVersion Latest schema version
     */
    function ConfigMigrationManager(initialMigrations, latestVersion) {
        if (initialMigrations === void 0) { initialMigrations = []; }
        this.migrations = [];
        this.latestVersion = '1.0.0';
        // Register initial migrations
        if (initialMigrations.length > 0) {
            for (var _i = 0, initialMigrations_1 = initialMigrations; _i < initialMigrations_1.length; _i++) {
                var migration = initialMigrations_1[_i];
                this.registerMigration(migration);
            }
        }
        // Set latest version
        if (latestVersion) {
            this.latestVersion = latestVersion;
        }
    }
    /**
     * Register a migration
     */
    ConfigMigrationManager.prototype.registerMigration = function (migration) {
        // Validate migration
        if (!migration.fromVersion) {
            throw new MigrationError('Migration fromVersion is required');
        }
        if (!migration.toVersion) {
            throw new MigrationError('Migration toVersion is required');
        }
        if (!migration.migrate) {
            throw new MigrationError('Migration function is required');
        }
        // Add migration
        this.migrations.push(migration);
        // Return this for chaining
        return this;
    };
    /**
     * Get all registered migrations
     */
    ConfigMigrationManager.prototype.getMigrations = function () {
        return __spreadArray([], this.migrations, true);
    };
    /**
     * Migrate a configuration from one version to another
     */
    ConfigMigrationManager.prototype.migrateConfig = function (config, fromVersion, toVersion) {
        var targetVersion = toVersion || this.latestVersion;
        // Check if migration is needed
        if (fromVersion === targetVersion) {
            return config;
        }
        // Check if migration is possible
        if (!this.canMigrate(fromVersion, targetVersion)) {
            throw new MigrationError("No migration path found from ".concat(fromVersion, " to ").concat(targetVersion), fromVersion, targetVersion);
        }
        // Find direct migration
        var directMigration = this.migrations.find(function (m) { return m.fromVersion === fromVersion && m.toVersion === targetVersion; });
        if (directMigration) {
            return directMigration.migrate(config, fromVersion, targetVersion);
        }
        // Find migration path
        var path = this.findMigrationPath(fromVersion, targetVersion);
        if (!path || path.length === 0) {
            throw new MigrationError("Migration path calculation failed from ".concat(fromVersion, " to ").concat(targetVersion), fromVersion, targetVersion);
        }
        // Apply migrations in sequence
        var currentConfig = __assign({}, config);
        var currentVersion = fromVersion;
        var _loop_1 = function (step) {
            var migration = this_1.migrations.find(function (m) { return m.fromVersion === currentVersion && m.toVersion === step; });
            if (!migration) {
                throw new MigrationError("Missing migration step from ".concat(currentVersion, " to ").concat(step), currentVersion, step);
            }
            currentConfig = migration.migrate(currentConfig, currentVersion, step);
            currentVersion = step;
        };
        var this_1 = this;
        for (var _i = 0, path_1 = path; _i < path_1.length; _i++) {
            var step = path_1[_i];
            _loop_1(step);
        }
        return currentConfig;
    };
    /**
     * Check if migration is possible
     */
    ConfigMigrationManager.prototype.canMigrate = function (fromVersion, toVersion) {
        // Same version requires no migration
        if (fromVersion === toVersion) {
            return true;
        }
        // Check for direct migration
        var directMigration = this.migrations.find(function (m) { return m.fromVersion === fromVersion && m.toVersion === toVersion; });
        if (directMigration) {
            return true;
        }
        // Check for migration path
        var path = this.findMigrationPath(fromVersion, toVersion);
        return path.length > 0;
    };
    /**
     * Get the latest schema version
     */
    ConfigMigrationManager.prototype.getLatestVersion = function () {
        return this.latestVersion;
    };
    /**
     * Set the latest schema version
     */
    ConfigMigrationManager.prototype.setLatestVersion = function (version) {
        this.latestVersion = version;
    };
    /**
     * Find a migration path from one version to another
     * @private
     */
    ConfigMigrationManager.prototype.findMigrationPath = function (fromVersion, toVersion) {
        // Build graph of all possible migrations
        var graph = {};
        for (var _i = 0, _a = this.migrations; _i < _a.length; _i++) {
            var migration = _a[_i];
            if (!graph[migration.fromVersion]) {
                graph[migration.fromVersion] = [];
            }
            graph[migration.fromVersion].push(migration.toVersion);
        }
        // Use breadth-first search to find shortest path
        var queue = [
            { version: fromVersion, path: [] }
        ];
        var visited = new Set();
        while (queue.length > 0) {
            var _b = queue.shift(), version = _b.version, path = _b.path;
            if (version === toVersion) {
                return path;
            }
            if (visited.has(version)) {
                continue;
            }
            visited.add(version);
            var nextVersions = graph[version] || [];
            for (var _c = 0, nextVersions_1 = nextVersions; _c < nextVersions_1.length; _c++) {
                var nextVersion = nextVersions_1[_c];
                queue.push({
                    version: nextVersion,
                    path: __spreadArray(__spreadArray([], path, true), [nextVersion], false)
                });
            }
        }
        return [];
    };
    return ConfigMigrationManager;
}());
exports.ConfigMigrationManager = ConfigMigrationManager;
