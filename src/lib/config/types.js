"use strict";
/**
 * Configuration System Types
 *
 * This module defines the core types and interfaces for the configuration system,
 * including schema definitions and validation options.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateStrategy = void 0;
/**
 * Configuration update strategy
 */
var UpdateStrategy;
(function (UpdateStrategy) {
    /** Replace the configuration entirely */
    UpdateStrategy["REPLACE"] = "replace";
    /** Merge the new configuration into the existing one */
    UpdateStrategy["MERGE"] = "merge";
    /** Deep merge the new configuration into the existing one */
    UpdateStrategy["DEEP_MERGE"] = "deep_merge";
})(UpdateStrategy || (exports.UpdateStrategy = UpdateStrategy = {}));
