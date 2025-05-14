"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOCUMENT_DEFAULTS = void 0;
/**
 * Document memory schema
 */
var config_1 = require("../config");
var metadata_1 = require("../../../types/metadata");
/**
 * Default values for document schema
 */
exports.DOCUMENT_DEFAULTS = {
    type: config_1.MemoryType.DOCUMENT,
    metadata: {
        schemaVersion: "1.0.0",
        source: metadata_1.DocumentSource.USER,
    }
};
