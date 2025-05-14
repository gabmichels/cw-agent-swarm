"use strict";
/**
 * Periodic Task Runner Interface
 *
 * This file defines interfaces for running periodic tasks
 * like weekly reflections, daily summaries, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeriodicTaskStatus = exports.PeriodicTaskType = void 0;
/**
 * Periodic task type
 */
var PeriodicTaskType;
(function (PeriodicTaskType) {
    PeriodicTaskType["DAILY"] = "daily";
    PeriodicTaskType["WEEKLY"] = "weekly";
    PeriodicTaskType["MONTHLY"] = "monthly";
    PeriodicTaskType["QUARTERLY"] = "quarterly";
    PeriodicTaskType["YEARLY"] = "yearly";
    PeriodicTaskType["CUSTOM"] = "custom";
})(PeriodicTaskType || (exports.PeriodicTaskType = PeriodicTaskType = {}));
/**
 * Periodic task status
 */
var PeriodicTaskStatus;
(function (PeriodicTaskStatus) {
    PeriodicTaskStatus["PENDING"] = "pending";
    PeriodicTaskStatus["RUNNING"] = "running";
    PeriodicTaskStatus["COMPLETED"] = "completed";
    PeriodicTaskStatus["FAILED"] = "failed";
    PeriodicTaskStatus["CANCELED"] = "canceled";
    PeriodicTaskStatus["SKIPPED"] = "skipped";
})(PeriodicTaskStatus || (exports.PeriodicTaskStatus = PeriodicTaskStatus = {}));
