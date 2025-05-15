"use strict";
/**
 * ReflectionManager.interface.ts - Reflection Manager Interface
 *
 * This file defines the reflection manager interface that provides self-reflection
 * and improvement capabilities for agents. It extends the base manager interface
 * with reflection-specific functionality.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReflectionTrigger = void 0;
/**
 * Reflection triggers
 */
var ReflectionTrigger;
(function (ReflectionTrigger) {
    ReflectionTrigger["MANUAL"] = "manual";
    ReflectionTrigger["SCHEDULED"] = "scheduled";
    ReflectionTrigger["ERROR"] = "error";
    ReflectionTrigger["INTERACTION"] = "interaction";
    ReflectionTrigger["PERFORMANCE"] = "performance";
    ReflectionTrigger["PERIODIC"] = "periodic";
    ReflectionTrigger["INSIGHT"] = "insight";
    ReflectionTrigger["FEEDBACK"] = "feedback";
})(ReflectionTrigger || (exports.ReflectionTrigger = ReflectionTrigger = {}));
