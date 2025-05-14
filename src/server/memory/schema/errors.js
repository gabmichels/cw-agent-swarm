"use strict";
/**
 * Schema Validation Errors
 *
 * This module defines the error types used by the schema validation system.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaDefinitionError = exports.SchemaVersionError = exports.SchemaNotFoundError = exports.ValidationError = exports.SchemaError = void 0;
var base_1 = require("../../../lib/errors/base");
/**
 * Base error class for schema-related errors
 */
var SchemaError = /** @class */ (function (_super) {
    __extends(SchemaError, _super);
    function SchemaError(message, code, context) {
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, message, "SCHEMA_".concat(code), context) || this;
        _this.name = 'SchemaError';
        return _this;
    }
    return SchemaError;
}(base_1.AppError));
exports.SchemaError = SchemaError;
/**
 * Error thrown when a schema validation fails
 */
var ValidationError = /** @class */ (function (_super) {
    __extends(ValidationError, _super);
    function ValidationError(message, failures, context) {
        if (failures === void 0) { failures = []; }
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, message, 'VALIDATION_ERROR', __assign(__assign({}, context), { failures: failures })) || this;
        _this.name = 'ValidationError';
        _this.failures = failures;
        return _this;
    }
    /**
     * Get a string representation of the validation errors
     */
    ValidationError.prototype.formatErrors = function () {
        if (this.failures.length === 0) {
            return 'No validation errors';
        }
        return this.failures.map(function (failure) {
            var field = failure.field, message = failure.message, expected = failure.expected, received = failure.received;
            var errorMsg = "".concat(field, ": ").concat(message);
            if (expected !== undefined) {
                errorMsg += ", expected: ".concat(expected);
            }
            if (received !== undefined) {
                errorMsg += ", received: ".concat(received);
            }
            return errorMsg;
        }).join('\n');
    };
    return ValidationError;
}(SchemaError));
exports.ValidationError = ValidationError;
/**
 * Error thrown when a schema is not found
 */
var SchemaNotFoundError = /** @class */ (function (_super) {
    __extends(SchemaNotFoundError, _super);
    function SchemaNotFoundError(schemaName, version, context) {
        if (context === void 0) { context = {}; }
        var _this = this;
        var versionText = version ? " version ".concat(version) : '';
        _this = _super.call(this, "Schema ".concat(schemaName).concat(versionText, " not found"), 'NOT_FOUND', __assign(__assign({}, context), { schemaName: schemaName, version: version })) || this;
        _this.name = 'SchemaNotFoundError';
        return _this;
    }
    return SchemaNotFoundError;
}(SchemaError));
exports.SchemaNotFoundError = SchemaNotFoundError;
/**
 * Error thrown when there's a schema version conflict
 */
var SchemaVersionError = /** @class */ (function (_super) {
    __extends(SchemaVersionError, _super);
    function SchemaVersionError(message, context) {
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, message, 'VERSION_ERROR', context) || this;
        _this.name = 'SchemaVersionError';
        return _this;
    }
    return SchemaVersionError;
}(SchemaError));
exports.SchemaVersionError = SchemaVersionError;
/**
 * Error thrown when there's an error in the schema definition
 */
var SchemaDefinitionError = /** @class */ (function (_super) {
    __extends(SchemaDefinitionError, _super);
    function SchemaDefinitionError(message, context) {
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, message, 'DEFINITION_ERROR', context) || this;
        _this.name = 'SchemaDefinitionError';
        return _this;
    }
    return SchemaDefinitionError;
}(SchemaError));
exports.SchemaDefinitionError = SchemaDefinitionError;
