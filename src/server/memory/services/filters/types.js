"use strict";
/**
 * Type definitions for Qdrant filter builder
 * This provides the interface for building type-safe, optimized filters for Qdrant queries
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilterOperator = void 0;
/**
 * Supported filter operations
 */
var FilterOperator;
(function (FilterOperator) {
    /**
     * Equals comparison
     */
    FilterOperator["EQUALS"] = "equals";
    /**
     * Not equals comparison
     */
    FilterOperator["NOT_EQUALS"] = "notEquals";
    /**
     * Contains substring (for string fields)
     */
    FilterOperator["CONTAINS"] = "contains";
    /**
     * Greater than comparison (for numeric or date fields)
     */
    FilterOperator["GREATER_THAN"] = "greaterThan";
    /**
     * Greater than or equal comparison (for numeric or date fields)
     */
    FilterOperator["GREATER_THAN_OR_EQUAL"] = "greaterThanOrEqual";
    /**
     * Less than comparison (for numeric or date fields)
     */
    FilterOperator["LESS_THAN"] = "lessThan";
    /**
     * Less than or equal comparison (for numeric or date fields)
     */
    FilterOperator["LESS_THAN_OR_EQUAL"] = "lessThanOrEqual";
    /**
     * In array (value is one of the elements)
     */
    FilterOperator["IN"] = "in";
    /**
     * Not in array (value is not one of the elements)
     */
    FilterOperator["NOT_IN"] = "notIn";
    /**
     * Field exists and is not null
     */
    FilterOperator["EXISTS"] = "exists";
    /**
     * Field does not exist or is null
     */
    FilterOperator["NOT_EXISTS"] = "notExists";
    /**
     * Match a set of conditions with AND logic
     */
    FilterOperator["AND"] = "and";
    /**
     * Match a set of conditions with OR logic
     */
    FilterOperator["OR"] = "or";
    /**
     * Negate a condition
     */
    FilterOperator["NOT"] = "not";
})(FilterOperator || (exports.FilterOperator = FilterOperator = {}));
