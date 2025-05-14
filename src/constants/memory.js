"use strict";
/**
 * Re-exports from the canonical memory types source
 *
 * @deprecated Import directly from src/server/memory/config/types.ts instead
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryError = exports.MemoryErrorCode = exports.ExtendedMemorySource = exports.MemorySource = exports.MemorySourceType = exports.ImportanceLevel = exports.MemoryType = void 0;
// Re-export enums and classes
var types_1 = require("../server/memory/config/types");
Object.defineProperty(exports, "MemoryType", { enumerable: true, get: function () { return types_1.MemoryType; } });
Object.defineProperty(exports, "ImportanceLevel", { enumerable: true, get: function () { return types_1.ImportanceLevel; } });
Object.defineProperty(exports, "MemorySourceType", { enumerable: true, get: function () { return types_1.MemorySourceType; } });
Object.defineProperty(exports, "MemorySource", { enumerable: true, get: function () { return types_1.MemorySource; } });
Object.defineProperty(exports, "ExtendedMemorySource", { enumerable: true, get: function () { return types_1.ExtendedMemorySource; } });
Object.defineProperty(exports, "MemoryErrorCode", { enumerable: true, get: function () { return types_1.MemoryErrorCode; } });
Object.defineProperty(exports, "MemoryError", { enumerable: true, get: function () { return types_1.MemoryError; } });
