"use strict";
/**
 * Qdrant Filter Builder
 *
 * A utility for building optimized Qdrant filters from application-specific filter conditions.
 * Designed for performance and type safety.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.QdrantFilterBuilder = exports.FilterError = void 0;
var base_1 = require("../../../../lib/errors/base");
var types_1 = require("./types");
/**
 * Error class for filter-related errors
 */
var FilterError = /** @class */ (function (_super) {
    __extends(FilterError, _super);
    function FilterError(message, context) {
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, message, 'FILTER_ERROR', context) || this;
        _this.name = 'FilterError';
        return _this;
    }
    return FilterError;
}(base_1.AppError));
exports.FilterError = FilterError;
/**
 * QdrantFilterBuilder class
 *
 * Builds optimized filters for Qdrant queries
 */
var QdrantFilterBuilder = /** @class */ (function () {
    function QdrantFilterBuilder() {
    }
    /**
     * Build a Qdrant filter from application filter conditions
     *
     * @param filter The filter conditions to convert
     * @returns A Qdrant-compatible filter
     */
    QdrantFilterBuilder.prototype.build = function (filter) {
        // Handle composite filters (with must/should/must_not)
        if (this.isCompositeFilter(filter)) {
            return this.buildCompositeFilter(filter);
        }
        // Handle simple filter conditions
        return this.buildConditionsFilter(filter);
    };
    /**
     * Check if a filter is a composite filter
     */
    QdrantFilterBuilder.prototype.isCompositeFilter = function (filter) {
        var compositeKeys = ['must', 'should', 'must_not'];
        var filterKeys = Object.keys(filter);
        return compositeKeys.some(function (key) { return filterKeys.includes(key); });
    };
    /**
     * Build a filter from composite conditions (must/should/must_not)
     */
    QdrantFilterBuilder.prototype.buildCompositeFilter = function (filter) {
        var _this = this;
        var result = {};
        // Handle 'must' conditions (AND)
        if (filter.must && filter.must.length > 0) {
            result.must = filter.must.map(function (condition) {
                if (_this.isCompositeFilter(condition)) {
                    return _this.buildCompositeFilter(condition);
                }
                else {
                    return _this.buildConditionsToQdrantConditions(condition);
                }
            }).flat();
        }
        // Handle 'should' conditions (OR)
        if (filter.should && filter.should.length > 0) {
            result.should = filter.should.map(function (condition) {
                if (_this.isCompositeFilter(condition)) {
                    return _this.buildCompositeFilter(condition);
                }
                else {
                    return _this.buildConditionsToQdrantConditions(condition);
                }
            }).flat();
        }
        // Handle 'must_not' conditions (NOT)
        if (filter.must_not && filter.must_not.length > 0) {
            result.must_not = filter.must_not.map(function (condition) {
                if (_this.isCompositeFilter(condition)) {
                    return _this.buildCompositeFilter(condition);
                }
                else {
                    return _this.buildConditionsToQdrantConditions(condition);
                }
            }).flat();
        }
        return result;
    };
    /**
     * Build a filter from simple conditions
     */
    QdrantFilterBuilder.prototype.buildConditionsFilter = function (conditions) {
        var qdrantConditions = this.buildConditionsToQdrantConditions(conditions);
        // If there are conditions, wrap them in a 'must' clause
        if (qdrantConditions.length > 0) {
            return {
                must: qdrantConditions
            };
        }
        // Return empty filter if no conditions
        return {};
    };
    /**
     * Convert filter conditions to Qdrant conditions
     */
    QdrantFilterBuilder.prototype.buildConditionsToQdrantConditions = function (conditions) {
        var _this = this;
        return Object.entries(conditions).map(function (_a) {
            var field = _a[0], condition = _a[1];
            // Handle nested paths with dots
            var key = _this.normalizeFieldPath(field);
            return _this.buildSingleCondition(key, condition);
        });
    };
    /**
     * Build a single Qdrant condition from a filter condition
     */
    QdrantFilterBuilder.prototype.buildSingleCondition = function (key, condition) {
        var operator = condition.operator, value = condition.value;
        switch (operator) {
            case types_1.FilterOperator.EQUALS:
                return this.buildEqualsCondition(key, value);
            case types_1.FilterOperator.NOT_EQUALS:
                return {
                    must_not: [this.buildEqualsCondition(key, value)]
                };
            case types_1.FilterOperator.CONTAINS:
                if (typeof value !== 'string') {
                    throw new FilterError('CONTAINS operator requires string value', { key: key, value: value });
                }
                // For string contains, use a match with the text field
                return {
                    key: "".concat(key),
                    match: { value: { $contains: value } }
                };
            case types_1.FilterOperator.GREATER_THAN:
                return {
                    key: key,
                    range: { gt: value }
                };
            case types_1.FilterOperator.GREATER_THAN_OR_EQUAL:
                return {
                    key: key,
                    range: { gte: value }
                };
            case types_1.FilterOperator.LESS_THAN:
                return {
                    key: key,
                    range: { lt: value }
                };
            case types_1.FilterOperator.LESS_THAN_OR_EQUAL:
                return {
                    key: key,
                    range: { lte: value }
                };
            case types_1.FilterOperator.IN:
                if (!Array.isArray(value)) {
                    throw new FilterError('IN operator requires array value', { key: key, value: value });
                }
                return {
                    key: key,
                    match: { any: value }
                };
            case types_1.FilterOperator.NOT_IN:
                if (!Array.isArray(value)) {
                    throw new FilterError('NOT_IN operator requires array value', { key: key, value: value });
                }
                return {
                    must_not: [{
                            key: key,
                            match: { any: value }
                        }]
                };
            case types_1.FilterOperator.EXISTS:
                return {
                    must_not: [{
                            is_null: { key: key }
                        }]
                };
            case types_1.FilterOperator.NOT_EXISTS:
                return {
                    is_null: { key: key }
                };
            default:
                throw new FilterError("Unsupported filter operator: ".concat(operator), { key: key, value: value });
        }
    };
    /**
     * Build an equals condition
     */
    QdrantFilterBuilder.prototype.buildEqualsCondition = function (key, value) {
        return {
            key: key,
            match: { value: value }
        };
    };
    /**
     * Normalize field path for Qdrant
     * Prefixes fields with metadata. if they don't already have a prefix
     */
    QdrantFilterBuilder.prototype.normalizeFieldPath = function (field) {
        // Special fields that don't need metadata prefix
        var specialFields = ['id', 'type', 'vector'];
        // Don't modify fields that already have a prefix or are special
        if (field.includes('.') || specialFields.includes(field)) {
            return field;
        }
        // Prefix with metadata. by default
        return "metadata.".concat(field);
    };
    /**
     * Create a filter that only returns non-deleted items
     */
    QdrantFilterBuilder.createNonDeletedFilter = function () {
        return {
            must_not: [{
                    key: 'is_deleted',
                    match: { value: true }
                }]
        };
    };
    /**
     * Merge multiple Qdrant filters with AND logic
     */
    QdrantFilterBuilder.mergeFilters = function () {
        var filters = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            filters[_i] = arguments[_i];
        }
        var result = {};
        // Collect all conditions
        var mustConditions = [];
        var shouldConditions = [];
        var mustNotConditions = [];
        // Merge all filters
        for (var _a = 0, filters_1 = filters; _a < filters_1.length; _a++) {
            var filter = filters_1[_a];
            if (filter.must)
                mustConditions.push.apply(mustConditions, filter.must);
            if (filter.should)
                shouldConditions.push.apply(shouldConditions, filter.should);
            if (filter.must_not)
                mustNotConditions.push.apply(mustNotConditions, filter.must_not);
        }
        // Add non-empty condition arrays to result
        if (mustConditions.length > 0)
            result.must = mustConditions;
        if (shouldConditions.length > 0)
            result.should = shouldConditions;
        if (mustNotConditions.length > 0)
            result.must_not = mustNotConditions;
        return result;
    };
    return QdrantFilterBuilder;
}());
exports.QdrantFilterBuilder = QdrantFilterBuilder;
