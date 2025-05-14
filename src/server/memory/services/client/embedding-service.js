"use strict";
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
exports.EmbeddingService = void 0;
/**
 * Service for generating text embeddings
 */
var openai_1 = require("openai");
var config_1 = require("../../config");
var utils_1 = require("../../utils");
/**
 * Service for generating text embeddings
 */
var EmbeddingService = /** @class */ (function () {
    /**
     * Create a new embedding service
     */
    function EmbeddingService(options) {
        var _a;
        this.openai = null;
        this.embeddingModel = (options === null || options === void 0 ? void 0 : options.embeddingModel) ||
            process.env.OPENAI_EMBEDDING_MODEL ||
            config_1.DEFAULTS.EMBEDDING_MODEL;
        this.dimensions = (options === null || options === void 0 ? void 0 : options.dimensions) || config_1.DEFAULTS.DIMENSIONS;
        this.useRandomFallback = (_a = options === null || options === void 0 ? void 0 : options.useRandomFallback) !== null && _a !== void 0 ? _a : true;
        // Initialize OpenAI if API key is provided
        var openAIApiKey = (options === null || options === void 0 ? void 0 : options.openAIApiKey) || process.env.OPENAI_API_KEY;
        if (openAIApiKey) {
            try {
                this.openai = new openai_1.OpenAI({
                    apiKey: openAIApiKey
                });
                console.log("Initialized embedding service with model: ".concat(this.embeddingModel));
            }
            catch (error) {
                console.error('Error initializing OpenAI client:', error);
                this.openai = null;
            }
        }
        else {
            console.warn('No OpenAI API key provided, using random fallback embeddings');
            this.openai = null;
        }
    }
    /**
     * Generate an embedding for the given text
     */
    EmbeddingService.prototype.getEmbedding = function (text) {
        return __awaiter(this, void 0, void 0, function () {
            var response, embedding, normalizedEmbedding, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        // Check if text is empty or too short
                        if (!text || text.trim().length === 0) {
                            return [2 /*return*/, this.getRandomEmbedding('Empty text provided')];
                        }
                        // If OpenAI isn't initialized, use fallback
                        if (!this.openai) {
                            return [2 /*return*/, this.getRandomEmbedding('OpenAI not initialized')];
                        }
                        return [4 /*yield*/, this.openai.embeddings.create({
                                model: this.embeddingModel,
                                input: text,
                                encoding_format: 'float'
                            })];
                    case 1:
                        response = _a.sent();
                        embedding = response.data[0].embedding;
                        // Validate embedding
                        if (!Array.isArray(embedding) || embedding.length === 0) {
                            return [2 /*return*/, this.getRandomEmbedding('Invalid embedding received from API')];
                        }
                        // Update dimensions if needed
                        if (embedding.length !== this.dimensions) {
                            console.log("Updating embedding dimensions from ".concat(this.dimensions, " to ").concat(embedding.length));
                            this.dimensions = embedding.length;
                        }
                        normalizedEmbedding = this.normalizeVector(embedding);
                        return [2 /*return*/, {
                                embedding: normalizedEmbedding,
                                model: this.embeddingModel
                            }];
                    case 2:
                        error_1 = _a.sent();
                        console.error('Error generating embedding:', error_1);
                        // Use fallback if enabled
                        if (this.useRandomFallback) {
                            return [2 /*return*/, this.getRandomEmbedding("API error: ".concat(error_1 instanceof Error ? error_1.message : 'Unknown error'))];
                        }
                        // Otherwise, throw error
                        throw (0, utils_1.handleMemoryError)(error_1, 'getEmbedding');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Generate batch embeddings for multiple texts
     */
    EmbeddingService.prototype.getBatchEmbeddings = function (texts) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        // If OpenAI isn't initialized or batch is empty, use fallback
                        if (!this.openai || texts.length === 0) {
                            return [2 /*return*/, texts.map(function () { return _this.getRandomEmbedding('Batch fallback'); })];
                        }
                        return [4 /*yield*/, this.openai.embeddings.create({
                                model: this.embeddingModel,
                                input: texts,
                                encoding_format: 'float'
                            })];
                    case 1:
                        response = _a.sent();
                        // Process and validate results
                        return [2 /*return*/, response.data.map(function (item) {
                                var embedding = item.embedding;
                                // Validate embedding
                                if (!Array.isArray(embedding) || embedding.length === 0) {
                                    return _this.getRandomEmbedding('Invalid embedding in batch response');
                                }
                                // Normalize vector
                                var normalizedEmbedding = _this.normalizeVector(embedding);
                                return {
                                    embedding: normalizedEmbedding,
                                    model: _this.embeddingModel
                                };
                            })];
                    case 2:
                        error_2 = _a.sent();
                        console.error('Error generating batch embeddings:', error_2);
                        // Use fallback if enabled
                        if (this.useRandomFallback) {
                            return [2 /*return*/, texts.map(function () { return _this.getRandomEmbedding('Batch API error'); })];
                        }
                        // Otherwise, throw error
                        throw (0, utils_1.handleMemoryError)(error_2, 'getBatchEmbeddings');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Generate a random embedding (fallback)
     */
    EmbeddingService.prototype.getRandomEmbedding = function (reason) {
        console.warn("Using random embedding fallback: ".concat(reason));
        // Generate random vector
        var randomVector = Array.from({ length: this.dimensions }, function () { return (Math.random() * 2) - 1; });
        // Normalize to unit length
        var normalizedVector = this.normalizeVector(randomVector);
        return {
            embedding: normalizedVector,
            usedFallback: true
        };
    };
    /**
     * Normalize a vector to unit length
     */
    EmbeddingService.prototype.normalizeVector = function (vector) {
        var _this = this;
        try {
            // Calculate magnitude
            var squaredSum = vector.reduce(function (sum, val) { return sum + val * val; }, 0);
            var magnitude_1 = Math.sqrt(squaredSum);
            // Avoid division by zero
            if (magnitude_1 === 0 || !isFinite(magnitude_1)) {
                console.warn('Vector has zero magnitude, returning random unit vector');
                return Array.from({ length: this.dimensions }, function () { return (Math.random() * 2 - 1) / Math.sqrt(_this.dimensions); });
            }
            // Normalize each component
            return vector.map(function (val) {
                var normalized = val / magnitude_1;
                // Handle any NaN or Infinity values
                if (!isFinite(normalized)) {
                    return (Math.random() * 2 - 1) / Math.sqrt(_this.dimensions);
                }
                return normalized;
            });
        }
        catch (error) {
            console.error('Error normalizing vector:', error);
            // Return fallback random unit vector
            return Array.from({ length: this.dimensions }, function () { return (Math.random() * 2 - 1) / Math.sqrt(_this.dimensions); });
        }
    };
    return EmbeddingService;
}());
exports.EmbeddingService = EmbeddingService;
