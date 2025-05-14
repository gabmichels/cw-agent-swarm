"use strict";
/**
 * Object Utilities
 *
 * This module provides utility functions for working with objects.
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
exports.deepMerge = deepMerge;
exports.pick = pick;
exports.omit = omit;
/**
 * Deep merge objects
 *
 * @param target Target object
 * @param source Source object to merge into target
 * @returns Merged object
 */
function deepMerge(target, source) {
    // Return source if target is not an object
    if (target === null || typeof target !== 'object') {
        return source;
    }
    // Create a copy of the target
    var result = __assign({}, target);
    // If source is not an object, return target
    if (source === null || typeof source !== 'object') {
        return target;
    }
    // Merge properties
    for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            var sourceValue = source[key];
            var targetValue = target[key];
            // Deep merge if both values are objects
            if (targetValue !== null &&
                typeof targetValue === 'object' &&
                sourceValue !== null &&
                typeof sourceValue === 'object' &&
                !Array.isArray(targetValue) &&
                !Array.isArray(sourceValue)) {
                result[key] = deepMerge(targetValue, sourceValue);
            }
            // Handle arrays (replace rather than merge)
            else if (Array.isArray(sourceValue)) {
                result[key] = __spreadArray([], sourceValue, true);
            }
            // For other values, source overwrites target
            else if (sourceValue !== undefined) {
                result[key] = sourceValue;
            }
        }
    }
    return result;
}
/**
 * Pick specific properties from an object
 *
 * @param obj Source object
 * @param keys Keys to pick
 * @returns New object with only the picked properties
 */
function pick(obj, keys) {
    var result = {};
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            result[key] = obj[key];
        }
    }
    return result;
}
/**
 * Omit specific properties from an object
 *
 * @param obj Source object
 * @param keys Keys to omit
 * @returns New object without the omitted properties
 */
function omit(obj, keys) {
    var result = __assign({}, obj);
    for (var _i = 0, keys_2 = keys; _i < keys_2.length; _i++) {
        var key = keys_2[_i];
        delete result[key];
    }
    return result;
}
