"use strict";
/**
 * Export memory services
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
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
exports.getMemoryServices = getMemoryServices;
// Client services
__exportStar(require("./client/types"), exports);
__exportStar(require("./client/embedding-service"), exports);
__exportStar(require("./client/vector-db-adapter"), exports);
// Memory services
__exportStar(require("./memory/types"), exports);
__exportStar(require("./memory/memory-service"), exports);
// Enhanced Memory services
__exportStar(require("./multi-agent/enhanced-memory-service"), exports);
// Search services
__exportStar(require("./search/types"), exports);
__exportStar(require("./search/search-service"), exports);
// Query optimization services
__exportStar(require("./query/types"), exports);
__exportStar(require("./query/query-optimizer"), exports);
// Import query optimization types
var types_1 = require("./query/types");
// Do not re-export FilterOptions as it would conflict with the one from search/types
// Import cache manager
var dummy_cache_manager_1 = require("./cache/dummy-cache-manager");
// Service utilities
var qdrant_client_1 = require("./client/qdrant-client");
var embedding_service_1 = require("./client/embedding-service");
var vector_db_adapter_1 = require("./client/vector-db-adapter");
var enhanced_memory_service_1 = require("./multi-agent/enhanced-memory-service");
var search_service_1 = require("./search/search-service");
var query_optimizer_1 = require("./query/query-optimizer");
var filter_builder_1 = require("./filters/filter-builder");
// Singleton instances
var memoryClientInstance = null;
var embeddingServiceInstance = null;
var memoryServiceInstance = null;
var searchServiceInstance = null;
var queryOptimizerInstance = null;
var filterBuilderInstance = null;
var vectorDbAdapterInstance = null;
/**
 * Initialize and return memory services
 * Uses singleton pattern to avoid recreating services on each request
 */
function getMemoryServices() {
    return __awaiter(this, void 0, void 0, function () {
        var embeddingWrapper, error_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Return existing instances if available
                    if (memoryClientInstance && embeddingServiceInstance &&
                        memoryServiceInstance && searchServiceInstance &&
                        queryOptimizerInstance) {
                        return [2 /*return*/, {
                                client: memoryClientInstance,
                                embeddingService: embeddingServiceInstance,
                                memoryService: memoryServiceInstance,
                                searchService: searchServiceInstance,
                                queryOptimizer: queryOptimizerInstance
                            }];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    // Create QdrantMemoryClient
                    memoryClientInstance = new qdrant_client_1.QdrantMemoryClient({
                        qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
                        qdrantApiKey: process.env.QDRANT_API_KEY
                    });
                    // Create EmbeddingService
                    embeddingServiceInstance = new embedding_service_1.EmbeddingService({
                        openAIApiKey: process.env.OPENAI_API_KEY,
                        embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
                        useRandomFallback: true
                    });
                    // Initialize client
                    return [4 /*yield*/, memoryClientInstance.initialize()];
                case 2:
                    // Initialize client
                    _a.sent();
                    // Create filter builder
                    filterBuilderInstance = new filter_builder_1.QdrantFilterBuilder();
                    // Create vector database adapter
                    vectorDbAdapterInstance = new vector_db_adapter_1.VectorDatabaseAdapter(memoryClientInstance);
                    embeddingWrapper = {
                        embedText: function (text) { return __awaiter(_this, void 0, void 0, function () {
                            var result;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!embeddingServiceInstance) {
                                            throw new Error("Embedding service not initialized");
                                        }
                                        return [4 /*yield*/, embeddingServiceInstance.getEmbedding(text)];
                                    case 1:
                                        result = _a.sent();
                                        return [2 /*return*/, result.embedding];
                                }
                            });
                        }); }
                    };
                    // Create query optimizer
                    queryOptimizerInstance = new query_optimizer_1.QueryOptimizer(vectorDbAdapterInstance, filterBuilderInstance, embeddingWrapper, new dummy_cache_manager_1.DummyCacheManager(), {
                        defaultStrategy: types_1.QueryOptimizationStrategy.BALANCED,
                        defaultLimit: 10,
                        defaultMinScore: 0.6,
                        timeoutMs: 1000,
                        enableCaching: false,
                        cacheTtlSeconds: 300
                    });
                    // Create EnhancedMemoryService instead of base MemoryService
                    memoryServiceInstance = new enhanced_memory_service_1.EnhancedMemoryService(memoryClientInstance, embeddingServiceInstance);
                    // Create SearchService with query optimizer
                    // We'll pass the query optimizer separately to avoid type errors
                    searchServiceInstance = new search_service_1.SearchService(memoryClientInstance, embeddingServiceInstance, memoryServiceInstance);
                    // Attach the query optimizer to the search service if it has support for it
                    if (searchServiceInstance && 'setQueryOptimizer' in searchServiceInstance) {
                        searchServiceInstance.setQueryOptimizer(queryOptimizerInstance);
                    }
                    return [2 /*return*/, {
                            client: memoryClientInstance,
                            embeddingService: embeddingServiceInstance,
                            memoryService: memoryServiceInstance,
                            searchService: searchServiceInstance,
                            queryOptimizer: queryOptimizerInstance
                        }];
                case 3:
                    error_1 = _a.sent();
                    console.error('Failed to initialize memory services:', error_1);
                    throw error_1;
                case 4: return [2 /*return*/];
            }
        });
    });
}
