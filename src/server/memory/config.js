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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportanceLevel = exports.MemoryError = exports.MemoryErrorCode = exports.COLLECTION_NAMES = exports.DEFAULTS = exports.MemoryType = void 0;
// Re-export MemoryType from config/types.ts
var types_1 = require("./config/types");
Object.defineProperty(exports, "MemoryType", { enumerable: true, get: function () { return types_1.MemoryType; } });
// Default values for memory operations
exports.DEFAULTS = {
    DIMENSIONS: 1536, // Default embedding dimensions
    CONNECTION_TIMEOUT: 5000, // Connection timeout in ms
    FETCH_TIMEOUT: 30000, // Fetch timeout in ms
    DEFAULT_USER_ID: 'default', // Default user ID
    DEFAULT_LIMIT: 10, // Default result limit
    MAX_LIMIT: 2000, // Maximum result limit
    EMBEDDING_MODEL: 'text-embedding-3-small', // Default embedding model
    SCHEMA_VERSION: '1.0.0', // Default schema version
};
// Define collection names
exports.COLLECTION_NAMES = {
    MESSAGE: 'messages',
    THOUGHT: 'thoughts',
    REFLECTION: 'reflections',
    INSIGHT: 'insights',
    DOCUMENT: 'documents',
    TASK: 'tasks',
};
// Export from types
var MemoryErrorCode;
(function (MemoryErrorCode) {
    MemoryErrorCode["NOT_FOUND"] = "MEMORY_NOT_FOUND";
    MemoryErrorCode["VALIDATION_ERROR"] = "MEMORY_VALIDATION_ERROR";
    MemoryErrorCode["DATABASE_ERROR"] = "MEMORY_DATABASE_ERROR";
    MemoryErrorCode["EMBEDDING_ERROR"] = "MEMORY_EMBEDDING_ERROR";
    MemoryErrorCode["INITIALIZATION_ERROR"] = "MEMORY_INITIALIZATION_ERROR";
    MemoryErrorCode["CONFIGURATION_ERROR"] = "MEMORY_CONFIGURATION_ERROR";
    MemoryErrorCode["OPERATION_ERROR"] = "MEMORY_OPERATION_ERROR";
})(MemoryErrorCode || (exports.MemoryErrorCode = MemoryErrorCode = {}));
var MemoryError = /** @class */ (function (_super) {
    __extends(MemoryError, _super);
    function MemoryError(message, code, cause) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.cause = cause;
        _this.name = 'MemoryError';
        return _this;
    }
    return MemoryError;
}(Error));
exports.MemoryError = MemoryError;
var ImportanceLevel;
(function (ImportanceLevel) {
    ImportanceLevel["LOW"] = "low";
    ImportanceLevel["MEDIUM"] = "medium";
    ImportanceLevel["HIGH"] = "high";
    ImportanceLevel["CRITICAL"] = "critical";
})(ImportanceLevel || (exports.ImportanceLevel = ImportanceLevel = {}));
