"use strict";
/**
 * MessageTypes.ts
 *
 * This file contains standardized types and enumerations related to messages
 * in the agent system. These types are used throughout the codebase to ensure
 * consistency in message handling.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageRole = void 0;
/**
 * Defines the possible roles in a message exchange.
 * This enum is used to identify the sender's role in a conversation.
 *
 * @enum {string}
 * @property {string} USER - Messages from human users
 * @property {string} ASSISTANT - Messages from AI assistants
 * @property {string} SYSTEM - System messages (instructions, errors, notifications)
 */
var MessageRole;
(function (MessageRole) {
    MessageRole["USER"] = "user";
    MessageRole["ASSISTANT"] = "assistant";
    MessageRole["SYSTEM"] = "system";
})(MessageRole || (exports.MessageRole = MessageRole = {}));
