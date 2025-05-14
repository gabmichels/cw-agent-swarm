"use strict";
/**
 * Configuration System Validators
 *
 * This module provides functions for validating configuration values
 * against defined schemas and types.
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
exports.validateString = validateString;
exports.validateNumber = validateNumber;
exports.validateBoolean = validateBoolean;
exports.validateArray = validateArray;
exports.validateObject = validateObject;
exports.validateEnum = validateEnum;
exports.validateValue = validateValue;
exports.validateCrossProperties = validateCrossProperties;
exports.validateConfig = validateConfig;
var errors_1 = require("./errors");
/**
 * Validate a string value
 */
function validateString(value, schema, path) {
    // Type check
    if (typeof value !== 'string') {
        return new errors_1.ConfigTypeError(path, 'string', value);
    }
    // Pattern check if specified
    if (schema.pattern && !schema.pattern.test(value)) {
        return new errors_1.ConfigPatternError(path, schema.pattern, value);
    }
    // Length check if specified
    if (schema.min !== undefined && value.length < schema.min) {
        return new errors_1.ConfigRangeError(path, schema.min, undefined, value.length, { context: 'string length' });
    }
    if (schema.max !== undefined && value.length > schema.max) {
        return new errors_1.ConfigRangeError(path, undefined, schema.max, value.length, { context: 'string length' });
    }
    // Custom validation if specified
    if (schema.validate) {
        var result = schema.validate(value, path);
        if (typeof result === 'boolean') {
            if (!result) {
                return new errors_1.ValidationError("Failed custom validation", path);
            }
        }
        else if (!result.valid) {
            return new errors_1.ValidationError(result.error || 'Failed custom validation', path);
        }
    }
    return null;
}
/**
 * Validate a number value
 */
function validateNumber(value, schema, path) {
    // Type check
    if (typeof value !== 'number' || isNaN(value)) {
        return new errors_1.ConfigTypeError(path, 'number', value);
    }
    // Range check if specified
    if (schema.min !== undefined && value < schema.min) {
        return new errors_1.ConfigRangeError(path, schema.min, undefined, value);
    }
    if (schema.max !== undefined && value > schema.max) {
        return new errors_1.ConfigRangeError(path, undefined, schema.max, value);
    }
    // Custom validation if specified
    if (schema.validate) {
        var result = schema.validate(value, path);
        if (typeof result === 'boolean') {
            if (!result) {
                return new errors_1.ValidationError("Failed custom validation", path);
            }
        }
        else if (!result.valid) {
            return new errors_1.ValidationError(result.error || 'Failed custom validation', path);
        }
    }
    return null;
}
/**
 * Validate a boolean value
 */
function validateBoolean(value, schema, path) {
    // Type check
    if (typeof value !== 'boolean') {
        return new errors_1.ConfigTypeError(path, 'boolean', value);
    }
    // Custom validation if specified
    if (schema.validate) {
        var result = schema.validate(value, path);
        if (typeof result === 'boolean') {
            if (!result) {
                return new errors_1.ValidationError("Failed custom validation", path);
            }
        }
        else if (!result.valid) {
            return new errors_1.ValidationError(result.error || 'Failed custom validation', path);
        }
    }
    return null;
}
/**
 * Validate an array value
 */
function validateArray(value, schema, path) {
    // Type check
    if (!Array.isArray(value)) {
        return new errors_1.ConfigTypeError(path, 'array', value);
    }
    // Length check if specified
    if (schema.min !== undefined && value.length < schema.min) {
        return new errors_1.ConfigRangeError(path, schema.min, undefined, value.length, { context: 'array length' });
    }
    if (schema.max !== undefined && value.length > schema.max) {
        return new errors_1.ConfigRangeError(path, undefined, schema.max, value.length, { context: 'array length' });
    }
    // Validate array items if item schema specified
    if (schema.items) {
        var errors = [];
        for (var i = 0; i < value.length; i++) {
            var itemPath = "".concat(path, "[").concat(i, "]");
            var error = validateValue(value[i], schema.items, itemPath);
            if (error) {
                errors.push(error);
            }
        }
        if (errors.length > 0) {
            // Return only the first error to avoid overwhelming the error output
            return errors[0];
        }
    }
    // Custom validation if specified
    if (schema.validate) {
        var result = schema.validate(value, path);
        if (typeof result === 'boolean') {
            if (!result) {
                return new errors_1.ValidationError("Failed custom validation", path);
            }
        }
        else if (!result.valid) {
            return new errors_1.ValidationError(result.error || 'Failed custom validation', path);
        }
    }
    return null;
}
/**
 * Validate an object value
 */
function validateObject(value, schema, path) {
    // Type check
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return new errors_1.ConfigTypeError(path, 'object', value);
    }
    // Validate properties if schema properties specified
    if (schema.properties) {
        for (var _i = 0, _a = Object.entries(schema.properties); _i < _a.length; _i++) {
            var _b = _a[_i], propName = _b[0], propSchema = _b[1];
            var propPath = path ? "".concat(path, ".").concat(propName) : propName;
            var propValue = value[propName];
            // Check if property is required but missing
            if (propSchema.required && (propValue === undefined || propValue === null)) {
                return new errors_1.ConfigMissingPropertyError(propPath);
            }
            // Skip validation if property is not required and undefined
            if (propValue === undefined && !propSchema.required) {
                continue;
            }
            // Validate property value
            if (propValue !== undefined) {
                var error = validateValue(propValue, propSchema, propPath);
                if (error) {
                    return error;
                }
            }
        }
    }
    // Custom validation if specified
    if (schema.validate) {
        var result = schema.validate(value, path);
        if (typeof result === 'boolean') {
            if (!result) {
                return new errors_1.ValidationError("Failed custom validation", path);
            }
        }
        else if (!result.valid) {
            return new errors_1.ValidationError(result.error || 'Failed custom validation', path);
        }
    }
    return null;
}
/**
 * Validate an enum value
 */
function validateEnum(value, schema, path) {
    // Enum values check
    if (schema.enum && !schema.enum.includes(value)) {
        return new errors_1.ConfigEnumError(path, schema.enum, value);
    }
    // Custom validation if specified
    if (schema.validate) {
        var result = schema.validate(value, path);
        if (typeof result === 'boolean') {
            if (!result) {
                return new errors_1.ValidationError("Failed custom validation", path);
            }
        }
        else if (!result.valid) {
            return new errors_1.ValidationError(result.error || 'Failed custom validation', path);
        }
    }
    return null;
}
/**
 * Validate any value based on its schema type
 */
function validateValue(value, schema, path) {
    // Skip if value is undefined and property is not required
    if (value === undefined && !schema.required) {
        return null;
    }
    // Check if value is required but missing
    if (schema.required && (value === undefined || value === null)) {
        return new errors_1.ConfigMissingPropertyError(path);
    }
    // Skip validation if value is undefined
    if (value === undefined) {
        return null;
    }
    // Type-specific validation
    switch (schema.type) {
        case 'string':
            return validateString(value, schema, path);
        case 'number':
            return validateNumber(value, schema, path);
        case 'boolean':
            return validateBoolean(value, schema, path);
        case 'array':
            return validateArray(value, schema, path);
        case 'object':
            return validateObject(value, schema, path);
        case 'enum':
            return validateEnum(value, schema, path);
        case 'any':
            // No type checking for 'any', but run custom validation if specified
            if (schema.validate) {
                var result = schema.validate(value, path);
                if (typeof result === 'boolean') {
                    if (!result) {
                        return new errors_1.ValidationError("Failed custom validation", path);
                    }
                }
                else if (!result.valid) {
                    return new errors_1.ValidationError(result.error || 'Failed custom validation', path);
                }
            }
            return null;
        default:
            return new errors_1.ValidationError("Unsupported schema type: ".concat(schema.type), path);
    }
}
/**
 * Validate dependencies between configuration properties
 */
function validateCrossProperties(config, crossValidations, options) {
    if (crossValidations === void 0) { crossValidations = []; }
    if (options === void 0) { options = {}; }
    var errors = [];
    if (!crossValidations || crossValidations.length === 0) {
        return errors;
    }
    for (var _i = 0, crossValidations_1 = crossValidations; _i < crossValidations_1.length; _i++) {
        var validation = crossValidations_1[_i];
        try {
            var valid = validation.validate(config);
            if (!valid) {
                errors.push(new errors_1.ConfigDependencyError(validation.message || 'Cross-property validation failed', validation.properties.join(', ')));
            }
        }
        catch (error) {
            errors.push(new errors_1.ValidationError("Error during cross-property validation: ".concat(error instanceof Error ? error.message : String(error)), validation.properties.join(', ')));
        }
    }
    return errors;
}
/**
 * Validate a configuration object against a schema
 */
function validateConfig(config, schema, options) {
    if (options === void 0) { options = {}; }
    var errors = [];
    var validatedConfig = __assign({}, config);
    // Validate each property against its schema
    for (var _i = 0, _a = Object.entries(schema); _i < _a.length; _i++) {
        var _b = _a[_i], propName = _b[0], propSchema = _b[1];
        var propPath = propName;
        var propValue = config[propName];
        // Apply default if property is missing and defaults are enabled
        if ((propValue === undefined || propValue === null) &&
            propSchema.default !== undefined &&
            options.applyDefaults !== false) {
            validatedConfig[propName] = propSchema.default;
            continue;
        }
        // Check if property is required but missing
        if (propSchema.required && (propValue === undefined || propValue === null)) {
            errors.push(new errors_1.ConfigMissingPropertyError(propPath));
            continue;
        }
        // Skip validation if property is not required and undefined
        if (propValue === undefined && !propSchema.required) {
            continue;
        }
        // Validate property value
        if (propValue !== undefined) {
            var error = validateValue(propValue, propSchema, propPath);
            if (error) {
                errors.push(error);
            }
        }
    }
    // Validate cross-property dependencies if specified
    if (options.crossValidations && options.crossValidations.length > 0) {
        var crossErrors = validateCrossProperties(config, options.crossValidations, options);
        errors.push.apply(errors, crossErrors);
    }
    // Remove additional properties if specified
    if (options.removeAdditional) {
        for (var _c = 0, _d = Object.keys(config); _c < _d.length; _c++) {
            var propName = _d[_c];
            if (!(propName in schema)) {
                delete validatedConfig[propName];
            }
        }
    }
    // Return validation result
    var valid = errors.length === 0;
    if (!valid && options.throwOnError) {
        throw new Error("Configuration validation failed: ".concat(errors.map(function (e) { return e.message; }).join(', ')));
    }
    return {
        valid: valid,
        errors: errors.length > 0 ? errors : undefined,
        config: valid ? validatedConfig : undefined
    };
}
