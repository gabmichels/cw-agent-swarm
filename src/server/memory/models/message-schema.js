"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MESSAGE_DEFAULTS = void 0;
/**
 * Message memory schema
 */
var config_1 = require("../config");
var MessageTypes_1 = require("../../../agents/shared/types/MessageTypes");
var structured_id_1 = require("../../../types/structured-id");
/**
 * Default values for message schema
 */
exports.MESSAGE_DEFAULTS = {
    type: config_1.MemoryType.MESSAGE,
    metadata: {
        schemaVersion: '1.0.0',
        source: 'system',
        timestamp: Date.now(),
        userId: (0, structured_id_1.createUserId)('default-user'),
        agentId: (0, structured_id_1.createAgentId)('default-agent'),
        chatId: (0, structured_id_1.createChatId)('chat-chloe-gab'),
        role: MessageTypes_1.MessageRole.ASSISTANT,
        messageType: 'chat',
        thread: {
            id: 'default-thread', // Simple string ID for thread
            position: 0
        }
    }
};
