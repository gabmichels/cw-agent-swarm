"use strict";
/**
 * Configuration System Error Types
 *
 * This module defines error types used by the configuration system to provide
 * detailed information about validation and configuration issues.
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
exports.ConfigDependencyError = exports.ConfigEnumError = exports.ConfigPatternError = exports.ConfigRangeError = exports.ConfigTypeError = exports.ConfigMissingPropertyError = exports.ConfigValidationError = exports.ValidationError = exports.ConfigError = void 0;
/**
 * Base error class for all configuration-related errors
 */
var ConfigError = /** @class */ (function (_super) {
    __extends(ConfigError, _super);
    function ConfigError(message, code, context) {
        if (code === void 0) { code = 'CONFIG_ERROR'; }
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, message) || this;
        _this.name = _this.constructor.name;
        _this.code = code;
        _this.context = context;
        // Ensures proper prototype chain for instanceof checks
        Object.setPrototypeOf(_this, ConfigError.prototype);
        return _this;
    }
    return ConfigError;
}(Error));
exports.ConfigError = ConfigError;
/**
 * Error for individual validation failures
 */
var ValidationError = /** @class */ (function (_super) {
    __extends(ValidationError, _super);
    function ValidationError(message, path, expected, received, context) {
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, message, 'VALIDATION_ERROR', __assign({ path: path, expected: expected, received: received }, context)) || this;
        _this.path = path;
        _this.expected = expected;
        _this.received = received;
        // Ensures proper prototype chain for instanceof checks
        Object.setPrototypeOf(_this, ValidationError.prototype);
        return _this;
    }
    return ValidationError;
}(ConfigError));
exports.ValidationError = ValidationError;
/**
 * Error thrown when configuration validation fails, containing multiple validation errors
 */
var ConfigValidationError = /** @class */ (function (_super) {
    __extends(ConfigValidationError, _super);
    function ConfigValidationError(message, errors, context) {
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, message, 'CONFIG_VALIDATION_ERROR', __assign({ errors: errors }, context)) || this;
        _this.errors = errors;
        // Ensures proper prototype chain for instanceof checks
        Object.setPrototypeOf(_this, ConfigValidationError.prototype);
        return _this;
    }
    /**
     * Get a formatted message with all validation errors
     */
    ConfigValidationError.prototype.getFormattedMessage = function () {
        return __spreadArray([
            this.message,
            ''
        ], this.errors.map(function (error) {
            var msg = "- ".concat(error.path, ": ").concat(error.message);
            if (error.expected) {
                msg += " (expected: ".concat(error.expected);
                if (error.received !== undefined) {
                    msg += ", received: ".concat(JSON.stringify(error.received), ")");
                }
                else {
                    msg += ')';
                }
            }
            return msg;
        }), true).join('\n');
    };
    return ConfigValidationError;
}(ConfigError));
exports.ConfigValidationError = ConfigValidationError;
/**
 * Error thrown when a required configuration property is missing
 */
var ConfigMissingPropertyError = /** @class */ (function (_super) {
    __extends(ConfigMissingPropertyError, _super);
    function ConfigMissingPropertyError(propertyPath, context) {
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, "Required property '".concat(propertyPath, "' is missing"), propertyPath, 'defined value', undefined, context) || this;
        // Ensures proper prototype chain for instanceof checks
        Object.setPrototypeOf(_this, ConfigMissingPropertyError.prototype);
        return _this;
    }
    return ConfigMissingPropertyError;
}(ValidationError));
exports.ConfigMissingPropertyError = ConfigMissingPropertyError;
/**
 * Error thrown when a configuration property has the wrong type
 */
var ConfigTypeError = /** @class */ (function (_super) {
    __extends(ConfigTypeError, _super);
    function ConfigTypeError(propertyPath, expectedType, receivedValue, context) {
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, "Property '".concat(propertyPath, "' must be of type '").concat(expectedType, "'"), propertyPath, expectedType, receivedValue, context) || this;
        // Ensures proper prototype chain for instanceof checks
        Object.setPrototypeOf(_this, ConfigTypeError.prototype);
        return _this;
    }
    return ConfigTypeError;
}(ValidationError));
exports.ConfigTypeError = ConfigTypeError;
/**
 * Error thrown when a configuration property value is out of range
 */
var ConfigRangeError = /** @class */ (function (_super) {
    __extends(ConfigRangeError, _super);
    function ConfigRangeError(propertyPath, min, max, receivedValue, context) {
        if (context === void 0) { context = {}; }
        var _this = this;
        var message = "Property '".concat(propertyPath, "' is out of range");
        var expectedStr = '';
        if (min !== undefined && max !== undefined) {
            message = "Property '".concat(propertyPath, "' must be between ").concat(min, " and ").concat(max);
            expectedStr = "between ".concat(min, " and ").concat(max);
        }
        else if (min !== undefined) {
            message = "Property '".concat(propertyPath, "' must be at least ").concat(min);
            expectedStr = ">= ".concat(min);
        }
        else if (max !== undefined) {
            message = "Property '".concat(propertyPath, "' must be at most ").concat(max);
            expectedStr = "<= ".concat(max);
        }
        _this = _super.call(this, message, propertyPath, expectedStr, receivedValue, context) || this;
        // Ensures proper prototype chain for instanceof checks
        Object.setPrototypeOf(_this, ConfigRangeError.prototype);
        return _this;
    }
    return ConfigRangeError;
}(ValidationError));
exports.ConfigRangeError = ConfigRangeError;
/**
 * Error thrown when a configuration property value does not match a pattern
 */
var ConfigPatternError = /** @class */ (function (_super) {
    __extends(ConfigPatternError, _super);
    function ConfigPatternError(propertyPath, pattern, receivedValue, context) {
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, "Property '".concat(propertyPath, "' must match pattern ").concat(pattern), propertyPath, pattern.toString(), receivedValue, context) || this;
        // Ensures proper prototype chain for instanceof checks
        Object.setPrototypeOf(_this, ConfigPatternError.prototype);
        return _this;
    }
    return ConfigPatternError;
}(ValidationError));
exports.ConfigPatternError = ConfigPatternError;
/**
 * Error thrown when a configuration value is not among allowed values
 */
var ConfigEnumError = /** @class */ (function (_super) {
    __extends(ConfigEnumError, _super);
    function ConfigEnumError(propertyPath, allowedValues, receivedValue, context) {
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, "Property '".concat(propertyPath, "' must be one of: ").concat(allowedValues.join(', ')), propertyPath, "one of [".concat(allowedValues.join(', '), "]"), receivedValue, context) || this;
        // Ensures proper prototype chain for instanceof checks
        Object.setPrototypeOf(_this, ConfigEnumError.prototype);
        return _this;
    }
    return ConfigEnumError;
}(ValidationError));
exports.ConfigEnumError = ConfigEnumError;
/**
 * Error for cross-property dependency validation
 */
var ConfigDependencyError = /** @class */ (function (_super) {
    __extends(ConfigDependencyError, _super);
    /**
     * Create a new dependency error
     * @param message Error message
     * @param properties Properties involved in the dependency
     */
    function ConfigDependencyError(message, properties) {
        var _this = _super.call(this, message, properties) || this;
        _this.properties = properties;
        _this.name = 'ConfigDependencyError';
        return _this;
    }
    return ConfigDependencyError;
}(ValidationError));
exports.ConfigDependencyError = ConfigDependencyError;
