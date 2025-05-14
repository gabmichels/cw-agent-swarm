"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TASK_DEFAULTS = void 0;
/**
 * Task memory schema
 */
var config_1 = require("../config");
var metadata_1 = require("../../../types/metadata");
var structured_id_1 = require("../../../types/structured-id");
/**
 * Default values for task schema
 */
exports.TASK_DEFAULTS = {
    type: config_1.MemoryType.TASK,
    metadata: {
        schemaVersion: "1.0.0",
        status: metadata_1.TaskStatus.PENDING,
        priority: metadata_1.TaskPriority.MEDIUM,
        title: "Untitled Task",
        createdBy: (0, structured_id_1.createEnumStructuredId)(structured_id_1.EntityNamespace.SYSTEM, structured_id_1.EntityType.USER, 'system')
    }
};
