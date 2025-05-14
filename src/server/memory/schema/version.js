"use strict";
/**
 * Schema Versioning Implementation
 *
 * This module implements the SchemaVersion interface for managing schema versions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaVersionImpl = void 0;
/**
 * Schema version implementation
 */
var SchemaVersionImpl = /** @class */ (function () {
    /**
     * Create a new schema version
     *
     * @param major Major version for breaking changes
     * @param minor Minor version for backward-compatible additions
     */
    function SchemaVersionImpl(major, minor) {
        this.major = major;
        this.minor = minor;
        if (major < 0 || minor < 0) {
            throw new Error('Version numbers cannot be negative');
        }
    }
    /**
     * Get string representation of the version (vMAJOR.MINOR)
     */
    SchemaVersionImpl.prototype.toString = function () {
        return "v".concat(this.major, ".").concat(this.minor);
    };
    /**
     * Check if this version is newer than another
     *
     * @param other Version to compare with
     * @returns True if this version is newer
     */
    SchemaVersionImpl.prototype.isNewerThan = function (other) {
        if (this.major > other.major)
            return true;
        if (this.major === other.major && this.minor > other.minor)
            return true;
        return false;
    };
    /**
     * Check if this version is compatible with another.
     * Versions are compatible if they have the same major version.
     *
     * @param other Version to compare with
     * @returns True if versions are compatible
     */
    SchemaVersionImpl.prototype.isCompatibleWith = function (other) {
        // Only compatible if major versions match
        return this.major === other.major;
    };
    /**
     * Parse a version string into a SchemaVersion object
     *
     * @param versionString Version string (e.g., "v1.2" or "1.2")
     * @returns SchemaVersion object
     */
    SchemaVersionImpl.parse = function (versionString) {
        // Parse from string like "v1.2" or "1.2"
        var matches = versionString.match(/^v?(\d+)\.(\d+)$/);
        if (!matches) {
            throw new Error("Invalid version string: ".concat(versionString));
        }
        var major = parseInt(matches[1], 10);
        var minor = parseInt(matches[2], 10);
        return new SchemaVersionImpl(major, minor);
    };
    /**
     * Create a new version from separate major and minor components
     *
     * @param major Major version
     * @param minor Minor version
     * @returns SchemaVersion object
     */
    SchemaVersionImpl.create = function (major, minor) {
        return new SchemaVersionImpl(major, minor);
    };
    Object.defineProperty(SchemaVersionImpl, "initial", {
        /**
         * Get the initial version (v1.0)
         */
        get: function () {
            return new SchemaVersionImpl(1, 0);
        },
        enumerable: false,
        configurable: true
    });
    return SchemaVersionImpl;
}());
exports.SchemaVersionImpl = SchemaVersionImpl;
