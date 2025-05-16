"use strict";
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
exports.ValidationError = exports.InfrastructureError = exports.ApiError = exports.ToolError = exports.MemoryError = exports.InfrastructureErrorCode = exports.ApiErrorCode = exports.ToolErrorCode = exports.MemoryErrorCode = void 0;
/**
 * Domain-specific error types and error codes
 */
var base_1 = require("./base");
/**
 * Memory error codes
 */
var MemoryErrorCode;
(function (MemoryErrorCode) {
    MemoryErrorCode["NOT_FOUND"] = "NOT_FOUND";
    MemoryErrorCode["INVALID_TYPE"] = "INVALID_TYPE";
    MemoryErrorCode["DUPLICATE"] = "DUPLICATE";
    MemoryErrorCode["VALIDATION_FAILED"] = "VALIDATION_FAILED";
    MemoryErrorCode["QUERY_FAILED"] = "QUERY_FAILED";
    MemoryErrorCode["EMBEDDING_FAILED"] = "EMBEDDING_FAILED";
    MemoryErrorCode["CONNECTION_FAILED"] = "CONNECTION_FAILED";
    MemoryErrorCode["TRANSACTION_FAILED"] = "TRANSACTION_FAILED";
    MemoryErrorCode["INVALID_OPERATION"] = "INVALID_OPERATION";
    MemoryErrorCode["UNKNOWN"] = "UNKNOWN";
})(MemoryErrorCode || (exports.MemoryErrorCode = MemoryErrorCode = {}));
/**
 * Tool error codes
 */
var ToolErrorCode;
(function (ToolErrorCode) {
    ToolErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ToolErrorCode["EXECUTION_FAILED"] = "EXECUTION_FAILED";
    ToolErrorCode["TIMEOUT"] = "TIMEOUT";
    ToolErrorCode["INVALID_INPUT"] = "INVALID_INPUT";
    ToolErrorCode["MISSING_DEPENDENCY"] = "MISSING_DEPENDENCY";
    ToolErrorCode["PERMISSION_DENIED"] = "PERMISSION_DENIED";
    ToolErrorCode["UNKNOWN"] = "UNKNOWN";
})(ToolErrorCode || (exports.ToolErrorCode = ToolErrorCode = {}));
/**
 * API error codes
 */
var ApiErrorCode;
(function (ApiErrorCode) {
    ApiErrorCode["BAD_REQUEST"] = "BAD_REQUEST";
    ApiErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ApiErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ApiErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ApiErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    ApiErrorCode["SERVER_ERROR"] = "SERVER_ERROR";
    ApiErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
})(ApiErrorCode || (exports.ApiErrorCode = ApiErrorCode = {}));
/**
 * Infrastructure error codes
 */
var InfrastructureErrorCode;
(function (InfrastructureErrorCode) {
    InfrastructureErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    InfrastructureErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    InfrastructureErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
    InfrastructureErrorCode["CONFIGURATION_ERROR"] = "CONFIGURATION_ERROR";
    InfrastructureErrorCode["RESOURCE_EXHAUSTED"] = "RESOURCE_EXHAUSTED";
    InfrastructureErrorCode["UNKNOWN"] = "UNKNOWN";
})(InfrastructureErrorCode || (exports.InfrastructureErrorCode = InfrastructureErrorCode = {}));
/**
 * Memory-related errors
 */
var MemoryError = /** @class */ (function (_super) {
    __extends(MemoryError, _super);
    function MemoryError(message, code, context) {
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, message, "MEMORY_".concat(code), context) || this;
        _this.name = 'MemoryError';
        return _this;
    }
    return MemoryError;
}(base_1.AppError));
exports.MemoryError = MemoryError;
/**
 * Tool/agent execution errors
 */
var ToolError = /** @class */ (function (_super) {
    __extends(ToolError, _super);
    function ToolError(message, code, context) {
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, message, "TOOL_".concat(code), context) || this;
        _this.name = 'ToolError';
        return _this;
    }
    return ToolError;
}(base_1.AppError));
exports.ToolError = ToolError;
/**
 * API-related errors
 */
var ApiError = /** @class */ (function (_super) {
    __extends(ApiError, _super);
    function ApiError(message, code, statusCode, context) {
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, message, "API_".concat(code), context) || this;
        _this.name = 'ApiError';
        _this.statusCode = statusCode;
        return _this;
    }
    return ApiError;
}(base_1.AppError));
exports.ApiError = ApiError;
/**
 * Infrastructure errors (database, external services)
 */
var InfrastructureError = /** @class */ (function (_super) {
    __extends(InfrastructureError, _super);
    function InfrastructureError(message, code, context) {
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, message, "INFRA_".concat(code), context) || this;
        _this.name = 'InfrastructureError';
        return _this;
    }
    return InfrastructureError;
}(base_1.AppError));
exports.InfrastructureError = InfrastructureError;
/**
 * Validation errors
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
    return ValidationError;
}(base_1.AppError));
exports.ValidationError = ValidationError;
