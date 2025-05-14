"use strict";
/**
 * Schema Validation System - Type Definitions
 *
 * This module provides type definitions for the schema validation system.
 * It follows the schema versioning strategy and ensures type safety.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaType = void 0;
/**
 * Schema type enum
 */
var SchemaType;
(function (SchemaType) {
    /**
     * Entity schema (for database records)
     */
    SchemaType["ENTITY"] = "entity";
    /**
     * DTO schema (for API requests/responses)
     */
    SchemaType["DTO"] = "dto";
    /**
     * Config schema (for configuration)
     */
    SchemaType["CONFIG"] = "config";
})(SchemaType || (exports.SchemaType = SchemaType = {}));
