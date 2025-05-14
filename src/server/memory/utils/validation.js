"use strict";
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
exports.validateRequired = validateRequired;
exports.validateString = validateString;
exports.validateMemoryType = validateMemoryType;
exports.validateTimestamp = validateTimestamp;
exports.validateObject = validateObject;
exports.throwIfInvalid = throwIfInvalid;
exports.validateSchema = validateSchema;
exports.validateAddMemoryParams = validateAddMemoryParams;
exports.validateGetMemoryParams = validateGetMemoryParams;
exports.validateUpdateMemoryParams = validateUpdateMemoryParams;
exports.validateDeleteMemoryParams = validateDeleteMemoryParams;
exports.validateRollbackMemoryParams = validateRollbackMemoryParams;
/**
 * Validation utilities for memory schemas
 */
var config_1 = require("../config");
var error_handler_1 = require("./error-handler");
/**
 * Validates that a value is not null or undefined
 * @param value Value to check
 * @param fieldName Name of the field for error reporting
 * @returns ValidationResult
 */
function validateRequired(value, fieldName) {
    if (value === null || value === undefined) {
        return {
            valid: false,
            errors: [{ field: fieldName, message: "".concat(fieldName, " is required") }]
        };
    }
    return { valid: true };
}
/**
 * Validates that a value is a non-empty string
 * @param value Value to check
 * @param fieldName Name of the field for error reporting
 * @returns ValidationResult
 */
function validateString(value, fieldName) {
    if (typeof value !== 'string') {
        return {
            valid: false,
            errors: [{ field: fieldName, message: "".concat(fieldName, " must be a string") }]
        };
    }
    if (value.trim().length === 0) {
        return {
            valid: false,
            errors: [{ field: fieldName, message: "".concat(fieldName, " cannot be empty") }]
        };
    }
    return { valid: true };
}
/**
 * Validates that a value is a valid MemoryType
 * @param value Value to check
 * @param fieldName Name of the field for error reporting
 * @returns ValidationResult
 */
function validateMemoryType(value, fieldName) {
    if (fieldName === void 0) { fieldName = 'type'; }
    if (typeof value !== 'string') {
        return {
            valid: false,
            errors: [{ field: fieldName, message: "".concat(fieldName, " must be a string") }]
        };
    }
    var validTypes = Object.values(config_1.MemoryType);
    if (!validTypes.includes(value)) {
        return {
            valid: false,
            errors: [{
                    field: fieldName,
                    message: "".concat(fieldName, " must be one of: ").concat(validTypes.join(', '))
                }]
        };
    }
    return { valid: true };
}
/**
 * Validates that a value is a valid timestamp (ISO string or Date object)
 * @param value Value to check
 * @param fieldName Name of the field for error reporting
 * @returns ValidationResult
 */
function validateTimestamp(value, fieldName) {
    if (fieldName === void 0) { fieldName = 'timestamp'; }
    // Allow Date objects
    if (value instanceof Date) {
        return { valid: true };
    }
    // Allow ISO timestamp strings
    if (typeof value === 'string') {
        var date = new Date(value);
        if (!isNaN(date.getTime())) {
            return { valid: true };
        }
    }
    return {
        valid: false,
        errors: [{
                field: fieldName,
                message: "".concat(fieldName, " must be a valid timestamp")
            }]
    };
}
/**
 * Validates that an object has all required fields and optional fields match expected types
 * @param object Object to validate
 * @param requiredFields Fields that must be present
 * @param optionalFields Fields that may be present and their type validators
 * @returns ValidationResult
 */
function validateObject(object, requiredFields, optionalFields) {
    if (optionalFields === void 0) { optionalFields = {}; }
    // Check if object is actually an object
    if (!object || typeof object !== 'object') {
        return {
            valid: false,
            errors: [{ field: 'object', message: 'Must be an object' }]
        };
    }
    var errors = [];
    // Check required fields
    for (var _i = 0, requiredFields_1 = requiredFields; _i < requiredFields_1.length; _i++) {
        var field = requiredFields_1[_i];
        var fieldName = String(field);
        if (!(fieldName in object)) {
            errors.push({ field: fieldName, message: "Missing required field: ".concat(fieldName) });
        }
    }
    // Validate optional fields if present
    for (var _a = 0, _b = Object.entries(optionalFields); _a < _b.length; _a++) {
        var _c = _b[_a], field = _c[0], validator = _c[1];
        if (field in object) {
            // Type assertion required since TypeScript can't guarantee that the validator is a ValidatorFn
            var validatorFn = validator;
            var result = validatorFn(object[field]);
            if (!result.valid && result.errors) {
                errors.push.apply(errors, result.errors);
            }
        }
    }
    return errors.length > 0 ? { valid: false, errors: errors } : { valid: true };
}
/**
 * Throws if validation fails
 * @param validationResult Result to check
 * @throws ValidationError if validation fails
 */
function throwIfInvalid(validationResult) {
    var _a;
    if (!validationResult.valid) {
        var fields = (_a = validationResult.errors) === null || _a === void 0 ? void 0 : _a.reduce(function (acc, error) {
            var _a;
            return (__assign(__assign({}, acc), (_a = {}, _a[error.field] = error.message, _a)));
        }, {});
        throw (0, error_handler_1.createValidationError)('Validation failed', fields);
    }
}
/**
 * Validates and throws on failure
 * @param object Object to validate
 * @param schema Schema to validate against
 * @throws ValidationError if validation fails
 */
function validateSchema(object, schema) {
    var result = validateObject(object, schema.required, schema.optional || {});
    throwIfInvalid(result);
}
/**
 * Validate parameters for adding a memory
 */
function validateAddMemoryParams(params) {
    var errors = [];
    // Required fields
    if (!params.type) {
        errors.push({ field: 'type', message: 'Memory type is required' });
    }
    if (!params.content) {
        errors.push({ field: 'content', message: 'Content is required' });
    }
    // Type validation
    if (params.type && !Object.values(config_1.MemoryType).includes(params.type)) {
        errors.push({ field: 'type', message: "Invalid memory type: ".concat(params.type) });
    }
    // Embedding validation
    if (params.embedding && (!Array.isArray(params.embedding) || params.embedding.length === 0)) {
        errors.push({ field: 'embedding', message: 'Embedding must be a non-empty array' });
    }
    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
    };
}
/**
 * Validate parameters for getting a memory
 */
function validateGetMemoryParams(params) {
    var errors = [];
    // Required fields
    if (!params.type) {
        errors.push({ field: 'type', message: 'Memory type is required' });
    }
    if (!params.id) {
        errors.push({ field: 'id', message: 'Memory ID is required' });
    }
    // Type validation
    if (params.type && !Object.values(config_1.MemoryType).includes(params.type)) {
        errors.push({ field: 'type', message: "Invalid memory type: ".concat(params.type) });
    }
    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
    };
}
/**
 * Validate parameters for updating a memory
 */
function validateUpdateMemoryParams(params) {
    var errors = [];
    // Required fields
    if (!params.type) {
        errors.push({ field: 'type', message: 'Memory type is required' });
    }
    if (!params.id) {
        errors.push({ field: 'id', message: 'Memory ID is required' });
    }
    // At least one update field should be provided
    if (!params.content && !params.payload && !params.metadata) {
        errors.push({
            field: 'updates',
            message: 'At least one update field (content, payload, or metadata) is required'
        });
    }
    // Type validation
    if (params.type && !Object.values(config_1.MemoryType).includes(params.type)) {
        errors.push({ field: 'type', message: "Invalid memory type: ".concat(params.type) });
    }
    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
    };
}
/**
 * Validate parameters for deleting a memory
 */
function validateDeleteMemoryParams(params) {
    var errors = [];
    // Required fields
    if (!params.type) {
        errors.push({ field: 'type', message: 'Memory type is required' });
    }
    if (!params.id) {
        errors.push({ field: 'id', message: 'Memory ID is required' });
    }
    // Type validation
    if (params.type && !Object.values(config_1.MemoryType).includes(params.type)) {
        errors.push({ field: 'type', message: "Invalid memory type: ".concat(params.type) });
    }
    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
    };
}
/**
 * Validate parameters for rolling back a memory
 */
function validateRollbackMemoryParams(params) {
    var errors = [];
    // Required fields
    if (!params.id) {
        errors.push({ field: 'id', message: 'Memory ID is required' });
    }
    if (!params.versionId) {
        errors.push({ field: 'versionId', message: 'Version ID is required' });
    }
    // Type validation if provided
    if (params.type && !Object.values(config_1.MemoryType).includes(params.type)) {
        errors.push({ field: 'type', message: "Invalid memory type: ".concat(params.type) });
    }
    // Editor type validation if provided
    if (params.editorType && !['system', 'user', 'agent'].includes(params.editorType)) {
        errors.push({ field: 'editorType', message: "Invalid editor type: ".concat(params.editorType) });
    }
    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
    };
}
