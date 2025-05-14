"use strict";
/**
 * Schema Implementation
 *
 * This module implements the Schema interface for data validation.
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
exports.SchemaImpl = void 0;
var ajv_1 = require("ajv");
var ajv_formats_1 = require("ajv-formats");
var errors_1 = require("./errors");
var object_utils_1 = require("../utils/object-utils");
/**
 * Schema implementation
 */
var SchemaImpl = /** @class */ (function () {
    /**
     * Create a new schema
     *
     * @param name Schema name
     * @param version Schema version
     * @param type Schema type
     * @param jsonSchema JSON Schema definition
     * @param defaultValues Default values for schema properties
     */
    function SchemaImpl(name, version, type, jsonSchema, defaultValues) {
        if (defaultValues === void 0) { defaultValues = {}; }
        this.name = name;
        this.version = version;
        this.type = type;
        this.jsonSchema = jsonSchema;
        this.defaultValues = defaultValues;
        // Check if the schema is valid
        if (!jsonSchema || typeof jsonSchema !== 'object') {
            throw new errors_1.SchemaDefinitionError('Invalid JSON Schema', { name: name, version: version.toString() });
        }
        // Initialize validator
        try {
            var ajv = new ajv_1.default({
                allErrors: true,
                verbose: true
            });
            // Add additional formats
            (0, ajv_formats_1.default)(ajv);
            // Compile the schema
            this.validator = ajv.compile(jsonSchema);
        }
        catch (error) {
            throw new errors_1.SchemaDefinitionError("Failed to compile schema: ".concat(error instanceof Error ? error.message : String(error)), { name: name, version: version.toString(), error: error });
        }
    }
    /**
     * Validate data against this schema
     *
     * @param data Data to validate
     * @returns Validation result
     */
    SchemaImpl.prototype.validate = function (data) {
        // Run validation
        var isValid = this.validator(data);
        // Return success if valid
        if (isValid) {
            return { valid: true };
        }
        // Extract errors
        var errors = (this.validator.errors || []).map(function (error) {
            var _a;
            // Different versions of Ajv use different property names
            var path = error.instancePath || error.dataPath || '';
            var field = path.replace(/^\//, '') || ((_a = error.params) === null || _a === void 0 ? void 0 : _a.missingProperty) || '(root)';
            var validationError = {
                field: String(field),
                message: error.message || 'Invalid value',
                rule: error.keyword
            };
            // Add expected value if available based on error type
            if (error.params) {
                if (error.keyword === 'format' && 'format' in error.params) {
                    validationError.expected = String(error.params.format);
                }
                else if (error.keyword === 'type' && 'type' in error.params) {
                    validationError.expected = String(error.params.type);
                }
                else if (error.keyword === 'maximum' && 'limit' in error.params) {
                    validationError.expected = "<= ".concat(error.params.limit);
                }
                else if (error.keyword === 'minimum' && 'limit' in error.params) {
                    validationError.expected = ">= ".concat(error.params.limit);
                }
            }
            return validationError;
        });
        // Return failure with errors
        return {
            valid: false,
            errors: errors
        };
    };
    /**
     * Check if data conforms to this schema (type guard)
     *
     * @param data Data to check
     * @returns Type predicate indicating if data conforms to schema
     */
    SchemaImpl.prototype.isValid = function (data) {
        return this.validate(data).valid;
    };
    /**
     * Get default values for this schema
     *
     * @returns Default values
     */
    SchemaImpl.prototype.getDefaults = function () {
        return __assign({}, this.defaultValues);
    };
    /**
     * Create an entity with defaults filled in
     *
     * @param data Initial data
     * @returns Entity with defaults
     * @throws ValidationError if the resulting entity is invalid
     */
    SchemaImpl.prototype.create = function (data) {
        // Get default values
        var defaults = this.getDefaults();
        // Merge defaults with provided data
        var entity = (0, object_utils_1.deepMerge)(defaults, data);
        // Add schema version if not present
        if (typeof entity === 'object' &&
            entity !== null &&
            !('schemaVersion' in entity)) {
            entity.schemaVersion = this.version.toString();
        }
        // Validate the entity
        var validation = this.validate(entity);
        // Throw error if invalid
        if (!validation.valid) {
            throw new errors_1.ValidationError("Invalid ".concat(this.name, " entity"), validation.errors, { schema: this.name, version: this.version.toString() });
        }
        return entity;
    };
    return SchemaImpl;
}());
exports.SchemaImpl = SchemaImpl;
