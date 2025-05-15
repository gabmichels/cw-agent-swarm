"use strict";
/**
 * Default Conversation Summarizer Implementation
 *
 * This file implements the default conversation summarization capability
 * that can be used by memory managers.
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultConversationSummarizer = void 0;
/**
 * Default implementation of the ConversationSummarizer interface
 */
var DefaultConversationSummarizer = /** @class */ (function () {
    /**
     * Create a new DefaultConversationSummarizer
     *
     * @param options - Configuration options
     */
    function DefaultConversationSummarizer(options) {
        if (options === void 0) { options = {}; }
        this.modelProvider = options.modelProvider;
        this.logger = options.logger || console;
        this.defaultOptions = __assign({ maxEntries: 20, maxLength: 500, detailLevel: 'standard', extractTopics: true, includeActionItems: true, includeSystemMessages: false }, options.defaultOptions);
    }
    /**
     * Summarize a conversation
     *
     * @param options - Summarization options
     */
    DefaultConversationSummarizer.prototype.summarizeConversation = function () {
        return __awaiter(this, arguments, void 0, function (options) {
            var mergedOptions, messages, stats, summary, topics, actionItems, error_1;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 7, , 8]);
                        mergedOptions = __assign(__assign({}, this.defaultOptions), options);
                        this.logger.debug('Summarizing conversation', mergedOptions);
                        return [4 /*yield*/, this.getConversationMessages(mergedOptions)];
                    case 1:
                        messages = _a.sent();
                        // If no messages found, return minimal result
                        if (!messages || messages.length === 0) {
                            return [2 /*return*/, {
                                    summary: "No conversation messages found to summarize.",
                                    success: true,
                                    stats: {
                                        messageCount: 0,
                                        userMessageCount: 0,
                                        agentMessageCount: 0,
                                        systemMessageCount: 0,
                                    },
                                    conversationId: mergedOptions.conversationId,
                                }];
                        }
                        stats = this.calculateMessageStats(messages);
                        // Simple summarization if no model provider available
                        if (!this.modelProvider) {
                            return [2 /*return*/, this.generateSimpleSummary(messages, stats, mergedOptions)];
                        }
                        return [4 /*yield*/, this.generateModelBasedSummary(messages, mergedOptions)];
                    case 2:
                        summary = _a.sent();
                        topics = void 0;
                        if (!mergedOptions.extractTopics) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.extractTopicsFromMessages(messages, mergedOptions)];
                    case 3:
                        topics = _a.sent();
                        _a.label = 4;
                    case 4:
                        actionItems = void 0;
                        if (!mergedOptions.includeActionItems) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.extractActionItemsFromMessages(messages, mergedOptions)];
                    case 5:
                        actionItems = _a.sent();
                        _a.label = 6;
                    case 6: return [2 /*return*/, {
                            summary: summary,
                            success: true,
                            stats: stats,
                            topics: topics,
                            actionItems: actionItems,
                            conversationId: mergedOptions.conversationId,
                        }];
                    case 7:
                        error_1 = _a.sent();
                        this.logger.error('Error summarizing conversation:', error_1);
                        return [2 /*return*/, {
                                summary: "Error generating conversation summary.",
                                success: false,
                                error: error_1 instanceof Error ? error_1.message : String(error_1),
                                conversationId: options.conversationId,
                            }];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Summarize multiple conversations
     *
     * @param conversationIds - IDs of conversations to summarize
     * @param options - Summarization options
     */
    DefaultConversationSummarizer.prototype.summarizeMultipleConversations = function (conversationIds_1) {
        return __awaiter(this, arguments, void 0, function (conversationIds, options) {
            var results;
            var _this = this;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        results = {};
                        // Process each conversation ID in parallel
                        return [4 /*yield*/, Promise.all(conversationIds.map(function (id) { return __awaiter(_this, void 0, void 0, function () {
                                var result, error_2;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            _a.trys.push([0, 2, , 3]);
                                            return [4 /*yield*/, this.summarizeConversation(__assign(__assign({}, options), { conversationId: id }))];
                                        case 1:
                                            result = _a.sent();
                                            results[id] = result;
                                            return [3 /*break*/, 3];
                                        case 2:
                                            error_2 = _a.sent();
                                            // Handle any errors for individual conversations
                                            results[id] = {
                                                summary: "Error summarizing conversation ".concat(id),
                                                success: false,
                                                error: error_2 instanceof Error ? error_2.message : String(error_2),
                                                conversationId: id,
                                            };
                                            return [3 /*break*/, 3];
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 1:
                        // Process each conversation ID in parallel
                        _a.sent();
                        return [2 /*return*/, results];
                }
            });
        });
    };
    /**
     * Get conversation topics
     *
     * @param conversationId - ID of conversation to analyze
     * @param options - Topic extraction options
     */
    DefaultConversationSummarizer.prototype.getConversationTopics = function (conversationId_1) {
        return __awaiter(this, arguments, void 0, function (conversationId, options) {
            var messages, error_3;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.getConversationMessages({ conversationId: conversationId })];
                    case 1:
                        messages = _a.sent();
                        return [2 /*return*/, this.extractTopicsFromMessages(messages, {
                                maxTopics: options.maxTopics,
                                minConfidence: options.minConfidence,
                            })];
                    case 2:
                        error_3 = _a.sent();
                        this.logger.error('Error extracting conversation topics:', error_3);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Extract action items from conversation
     *
     * @param conversationId - ID of conversation to analyze
     * @param options - Action item extraction options
     */
    DefaultConversationSummarizer.prototype.extractActionItems = function (conversationId_1) {
        return __awaiter(this, arguments, void 0, function (conversationId, options) {
            var messages, error_4;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.getConversationMessages({ conversationId: conversationId })];
                    case 1:
                        messages = _a.sent();
                        return [2 /*return*/, this.extractActionItemsFromMessages(messages, {
                                maxItems: options.maxItems,
                                minConfidence: options.minConfidence,
                            })];
                    case 2:
                        error_4 = _a.sent();
                        this.logger.error('Error extracting action items:', error_4);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Private helper methods
    /**
     * Get conversation messages from a data source
     */
    DefaultConversationSummarizer.prototype.getConversationMessages = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // In a real implementation, this would retrieve messages from a data source
                // For now, we'll return a placeholder array
                return [2 /*return*/, [
                        { role: 'system', content: 'Conversation start', timestamp: new Date() },
                        { role: 'user', content: 'Hello assistant', timestamp: new Date() },
                        { role: 'assistant', content: 'Hello! How can I help you today?', timestamp: new Date() },
                        { role: 'user', content: 'I need to discuss our marketing strategy', timestamp: new Date() },
                        { role: 'assistant', content: 'I would be happy to discuss marketing strategy. What aspects are you interested in?', timestamp: new Date() },
                    ].slice(0, options.maxEntries || 20)];
            });
        });
    };
    /**
     * Calculate message statistics
     */
    DefaultConversationSummarizer.prototype.calculateMessageStats = function (messages) {
        var userMessageCount = messages.filter(function (m) { return m.role === 'user'; }).length;
        var agentMessageCount = messages.filter(function (m) { return m.role === 'assistant'; }).length;
        var systemMessageCount = messages.filter(function (m) { return m.role === 'system'; }).length;
        // Get earliest and latest timestamps if available
        var timestamps = messages
            .filter(function (m) { return m.timestamp; })
            .map(function (m) { return new Date(m.timestamp).getTime(); });
        var timespan = timestamps.length > 0 ? {
            start: new Date(Math.min.apply(Math, timestamps)),
            end: new Date(Math.max.apply(Math, timestamps)),
        } : undefined;
        return {
            messageCount: messages.length,
            userMessageCount: userMessageCount,
            agentMessageCount: agentMessageCount,
            systemMessageCount: systemMessageCount,
            timespan: timespan,
        };
    };
    /**
     * Generate a simple summary without using a model
     */
    DefaultConversationSummarizer.prototype.generateSimpleSummary = function (messages, stats, options) {
        var _a, _b, _c;
        // Extract simple topic keywords
        var allText = messages.map(function (m) { return m.content; }).join(' ').toLowerCase();
        var possibleTopics = [
            'marketing', 'strategy', 'planning', 'analytics', 'goals',
            'results', 'metrics', 'performance', 'website', 'social media',
            'campaign', 'budget', 'schedule', 'team', 'content',
            'design', 'development', 'launch', 'review', 'feedback'
        ];
        var topics = possibleTopics
            .filter(function (topic) { return allText.includes(topic); })
            .slice(0, 3);
        var topicsText = topics.length > 0
            ? "about ".concat(topics.join(', '))
            : '';
        // Ensure stats is defined with default values if needed
        var messageCount = (_a = stats === null || stats === void 0 ? void 0 : stats.messageCount) !== null && _a !== void 0 ? _a : messages.length;
        var userMessageCount = (_b = stats === null || stats === void 0 ? void 0 : stats.userMessageCount) !== null && _b !== void 0 ? _b : 0;
        var agentMessageCount = (_c = stats === null || stats === void 0 ? void 0 : stats.agentMessageCount) !== null && _c !== void 0 ? _c : 0;
        // Create a simple summary text
        var summary = "Conversation with ".concat(messageCount, " messages ") +
            "(".concat(userMessageCount, " from user, ").concat(agentMessageCount, " from assistant) ") +
            topicsText + '.';
        return {
            summary: summary,
            success: true,
            stats: stats !== null && stats !== void 0 ? stats : {
                messageCount: messages.length,
                userMessageCount: 0,
                agentMessageCount: 0,
                systemMessageCount: 0
            },
            topics: topics,
            conversationId: options.conversationId,
        };
    };
    /**
     * Generate a model-based summary
     */
    DefaultConversationSummarizer.prototype.generateModelBasedSummary = function (messages, options) {
        return __awaiter(this, void 0, void 0, function () {
            var conversationText, detailsPrompt, systemPrompt, response, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.modelProvider) {
                            throw new Error('Model provider required for model-based summarization');
                        }
                        conversationText = messages
                            .filter(function (m) { return m.role !== 'system' || options.includeSystemMessages; })
                            .map(function (m) { return "".concat(m.role, ": ").concat(m.content); })
                            .join('\n\n');
                        detailsPrompt = this.getDetailLevelPrompt(options.detailLevel || 'standard');
                        systemPrompt = "You are an expert conversation summarizer. \n    Analyze the following conversation and create a concise summary.\n    \n    ".concat(detailsPrompt, "\n    \n    Keep your summary under ").concat(options.maxLength || 500, " characters and focus only on the most important information.");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.modelProvider.invoke({
                                messages: [
                                    { role: 'system', content: systemPrompt },
                                    { role: 'user', content: conversationText }
                                ]
                            })];
                    case 2:
                        response = _a.sent();
                        return [2 /*return*/, response.content || 'Summary could not be generated.'];
                    case 3:
                        error_5 = _a.sent();
                        this.logger.error('Error calling model for summary:', error_5);
                        throw error_5;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get prompt details based on requested detail level
     */
    DefaultConversationSummarizer.prototype.getDetailLevelPrompt = function (detailLevel) {
        switch (detailLevel) {
            case 'brief':
                return 'Create a very short summary with just the main topic and 1-2 key points.';
            case 'detailed':
                return "Include:\n        1. The main topics discussed in detail\n        2. Key points made by each participant\n        3. All decisions or conclusions reached\n        4. Action items agreed upon\n        5. Open questions or unresolved issues";
            case 'standard':
            default:
                return "Include:\n        1. The main topics discussed\n        2. Key points or decisions made\n        3. Any actions agreed upon";
        }
    };
    /**
     * Extract topics from conversation messages
     */
    DefaultConversationSummarizer.prototype.extractTopicsFromMessages = function (messages, options) {
        return __awaiter(this, void 0, void 0, function () {
            var allText_1, possibleTopics, conversationText, systemPrompt, response, content, cleanContent, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.modelProvider) {
                            allText_1 = messages.map(function (m) { return m.content; }).join(' ').toLowerCase();
                            possibleTopics = [
                                'marketing', 'strategy', 'planning', 'analytics', 'goals',
                                'results', 'metrics', 'performance', 'website', 'social media',
                                'campaign', 'budget', 'schedule', 'team', 'content'
                            ];
                            return [2 /*return*/, possibleTopics
                                    .filter(function (topic) { return allText_1.includes(topic); })
                                    .slice(0, options.maxTopics || 5)];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        conversationText = messages
                            .map(function (m) { return "".concat(m.role, ": ").concat(m.content); })
                            .join('\n\n');
                        systemPrompt = "Extract the main topics from this conversation. \n      Return only a JSON array of strings, with each string being a topic.\n      Example: [\"marketing\", \"social media\", \"content strategy\"]\n      \n      Limit to ".concat(options.maxTopics || 5, " topics maximum.");
                        return [4 /*yield*/, this.modelProvider.invoke({
                                messages: [
                                    { role: 'system', content: systemPrompt },
                                    { role: 'user', content: conversationText }
                                ]
                            })];
                    case 2:
                        response = _a.sent();
                        // Parse the response as JSON
                        try {
                            content = response.content.trim();
                            cleanContent = content
                                .replace(/^```json/, '')
                                .replace(/^```/, '')
                                .replace(/```$/, '')
                                .trim();
                            return [2 /*return*/, JSON.parse(cleanContent)];
                        }
                        catch (parseError) {
                            this.logger.error('Error parsing topics JSON:', parseError);
                            // Fallback to simple extraction
                            return [2 /*return*/, response.content
                                    .split(',')
                                    .map(function (topic) { return topic.trim().replace(/["\[\]]/g, ''); })
                                    .filter(Boolean)
                                    .slice(0, options.maxTopics || 5)];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_6 = _a.sent();
                        this.logger.error('Error extracting topics with model:', error_6);
                        // Fallback to simple extraction
                        return [2 /*return*/, this.extractTopicsWithoutModel(messages, options.maxTopics || 5)];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Extract topics without using a model
     */
    DefaultConversationSummarizer.prototype.extractTopicsWithoutModel = function (messages, maxTopics) {
        var allText = messages.map(function (m) { return m.content; }).join(' ').toLowerCase();
        var possibleTopics = [
            'marketing', 'strategy', 'planning', 'analytics', 'goals',
            'results', 'metrics', 'performance', 'website', 'social media',
            'campaign', 'budget', 'schedule', 'team', 'content',
            'design', 'development', 'launch', 'review', 'feedback'
        ];
        return possibleTopics
            .filter(function (topic) { return allText.includes(topic); })
            .slice(0, maxTopics);
    };
    /**
     * Extract action items from conversation messages
     */
    DefaultConversationSummarizer.prototype.extractActionItemsFromMessages = function (messages, options) {
        return __awaiter(this, void 0, void 0, function () {
            var actionItemIndicators, actionItems, _i, messages_1, message, sentences, _loop_1, _a, sentences_1, sentence, conversationText, systemPrompt, response, content, cleanContent, error_7;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.modelProvider) {
                            actionItemIndicators = [
                                'need to', 'should', 'must', 'will', 'going to',
                                'todo', 'to-do', 'action item', 'take action', 'follow up'
                            ];
                            actionItems = [];
                            // Look for sentences that might contain action items
                            for (_i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
                                message = messages_1[_i];
                                if (message.role === 'assistant') {
                                    sentences = message.content.split(/[.!?]+/).filter(Boolean);
                                    _loop_1 = function (sentence) {
                                        var lowercaseSentence = sentence.toLowerCase().trim();
                                        if (actionItemIndicators.some(function (indicator) { return lowercaseSentence.includes(indicator); })) {
                                            actionItems.push(sentence.trim());
                                        }
                                    };
                                    for (_a = 0, sentences_1 = sentences; _a < sentences_1.length; _a++) {
                                        sentence = sentences_1[_a];
                                        _loop_1(sentence);
                                    }
                                }
                            }
                            return [2 /*return*/, actionItems.slice(0, options.maxItems || 5)];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        conversationText = messages
                            .map(function (m) { return "".concat(m.role, ": ").concat(m.content); })
                            .join('\n\n');
                        systemPrompt = "Extract action items from this conversation. \n      Return only a JSON array of strings, with each string being a clear action item.\n      Example: [\"Schedule meeting with marketing team\", \"Review campaign results\", \"Prepare report\"]\n      \n      Limit to ".concat(options.maxItems || 5, " action items maximum.\n      Only include clear tasks/actions that were discussed, not hypotheticals.");
                        return [4 /*yield*/, this.modelProvider.invoke({
                                messages: [
                                    { role: 'system', content: systemPrompt },
                                    { role: 'user', content: conversationText }
                                ]
                            })];
                    case 2:
                        response = _b.sent();
                        // Parse the response as JSON
                        try {
                            content = response.content.trim();
                            cleanContent = content
                                .replace(/^```json/, '')
                                .replace(/^```/, '')
                                .replace(/```$/, '')
                                .trim();
                            return [2 /*return*/, JSON.parse(cleanContent)];
                        }
                        catch (parseError) {
                            this.logger.error('Error parsing action items JSON:', parseError);
                            // Fallback to simple extraction
                            return [2 /*return*/, response.content
                                    .split('\n')
                                    .map(function (item) { return item.trim().replace(/^["\[\]-\s]+|["\[\]]+$/g, ''); })
                                    .filter(Boolean)
                                    .slice(0, options.maxItems || 5)];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_7 = _b.sent();
                        this.logger.error('Error extracting action items with model:', error_7);
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return DefaultConversationSummarizer;
}());
exports.DefaultConversationSummarizer = DefaultConversationSummarizer;
