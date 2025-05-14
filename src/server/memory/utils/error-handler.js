"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMemoryError = handleMemoryError;
exports.createNotFoundError = createNotFoundError;
exports.createValidationError = createValidationError;
exports.assert = assert;
/**
 * Error handling utilities for memory system
 */
var config_1 = require("../config");
/**
 * Creates a standardized memory error
 * @param error Original error to wrap
 * @param operation The operation that was being performed
 * @returns Standardized MemoryError
 */
function handleMemoryError(error, operation) {
    // If error is already a MemoryError, just return it
    if (error instanceof config_1.MemoryError) {
        return error;
    }
    // Handle standard Error objects
    if (error instanceof Error) {
        // Map certain error patterns to specific error codes
        if (error.message.includes('not found') || error.message.includes('404')) {
            return new config_1.MemoryError("Memory not found during ".concat(operation, ": ").concat(error.message), config_1.MemoryErrorCode.NOT_FOUND, error);
        }
        if (error.message.includes('validation') || error.message.includes('schema')) {
            return new config_1.MemoryError("Validation error during ".concat(operation, ": ").concat(error.message), config_1.MemoryErrorCode.VALIDATION_ERROR, error);
        }
        if (error.message.includes('connection') ||
            error.message.includes('timeout') ||
            error.message.includes('connect')) {
            return new config_1.MemoryError("Database connection error during ".concat(operation, ": ").concat(error.message), config_1.MemoryErrorCode.DATABASE_ERROR, error);
        }
        if (error.message.includes('embedding')) {
            return new config_1.MemoryError("Embedding error during ".concat(operation, ": ").concat(error.message), config_1.MemoryErrorCode.EMBEDDING_ERROR, error);
        }
        // Generic error handling
        return new config_1.MemoryError("Error during ".concat(operation, ": ").concat(error.message), config_1.MemoryErrorCode.OPERATION_ERROR, error);
    }
    // Handle unknown error types (not Error instances)
    var errorMessage = typeof error === 'string'
        ? error
        : (error ? JSON.stringify(error) : 'Unknown error');
    return new config_1.MemoryError("Unknown error during ".concat(operation, ": ").concat(errorMessage), config_1.MemoryErrorCode.OPERATION_ERROR);
}
/**
 * Creates a standardized not found error
 * @param id ID of the memory that was not found
 * @param type Optional memory type
 * @returns MemoryError with NOT_FOUND code
 */
function createNotFoundError(id, type) {
    var typeInfo = type ? " of type \"".concat(type, "\"") : '';
    return new config_1.MemoryError("Memory with ID \"".concat(id, "\"").concat(typeInfo, " not found"), config_1.MemoryErrorCode.NOT_FOUND);
}
/**
 * Creates a standardized validation error
 * @param message Validation error message
 * @param fields Optional fields that failed validation
 * @returns MemoryError with VALIDATION_ERROR code
 */
function createValidationError(message, fields) {
    var fieldsInfo = fields ? " Fields: ".concat(JSON.stringify(fields)) : '';
    return new config_1.MemoryError("".concat(message).concat(fieldsInfo), config_1.MemoryErrorCode.VALIDATION_ERROR);
}
/**
 * Throws if condition is not met
 * @param condition Condition to check
 * @param errorCode Error code to use if condition fails
 * @param message Error message to use if condition fails
 * @throws MemoryError if condition is not met
 */
function assert(condition, errorCode, message) {
    if (!condition) {
        throw new config_1.MemoryError(message, errorCode);
    }
}
