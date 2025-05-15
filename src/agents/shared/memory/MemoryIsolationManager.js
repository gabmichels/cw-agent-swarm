"use strict";
/**
 * MemoryIsolationManager.ts - Manager for agent memory isolation
 *
 * This module provides a manager for handling memory isolation and controlled
 * sharing between agents. It enforces access controls and maintains memory
 * boundaries.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryIsolationManager = exports.DEFAULT_MEMORY_ISOLATION_CONFIG = void 0;
var uuid_1 = require("uuid");
var MemoryScope_1 = require("./MemoryScope");
/**
 * Default memory isolation configuration
 */
exports.DEFAULT_MEMORY_ISOLATION_CONFIG = {
    enableIsolation: true,
    createDefaultPublicScope: true,
    defaultPublicScopeName: 'shared',
    requireSharingAcknowledgment: true,
    sharingRequestTimeoutMs: 1000 * 60 * 60 * 24, // 24 hours
    defaultScopeSettings: {
        accessLevel: MemoryScope_1.MemoryAccessLevel.PRIVATE,
        publicPermissions: [MemoryScope_1.MemoryPermission.READ]
    },
    trackAccessMetrics: true
};
/**
 * Manages memory isolation and controlled sharing between agents
 */
var MemoryIsolationManager = /** @class */ (function () {
    /**
     * Creates a new memory isolation manager
     * @param config Configuration options
     */
    function MemoryIsolationManager(config) {
        if (config === void 0) { config = {}; }
        this.scopes = new Map();
        this.agentScopes = new Map();
        this.sharingRequests = new Map();
        this.metrics = {
            totalRequests: 0,
            grantedRequests: 0,
            deniedRequests: 0,
            accessByAgent: new Map(),
            accessByScope: new Map()
        };
        this.config = __assign(__assign({}, exports.DEFAULT_MEMORY_ISOLATION_CONFIG), config);
        // Initialize the manager
        this.initialize();
    }
    /**
     * Initializes the manager
     */
    MemoryIsolationManager.prototype.initialize = function () {
        // Create default public scope if enabled
        if (this.config.createDefaultPublicScope) {
            var defaultPublicScope = this.createScope({
                name: this.config.defaultPublicScopeName,
                description: 'Default shared memory space accessible by all agents',
                accessLevel: MemoryScope_1.MemoryAccessLevel.PUBLIC,
                ownerAgentId: 'system',
                defaultPermissions: new Set(this.config.defaultScopeSettings.publicPermissions)
            });
            console.log("Created default public scope: ".concat(defaultPublicScope.scopeId.id, " (").concat(defaultPublicScope.scopeId.name, ")"));
        }
    };
    /**
     * Creates a new memory scope
     * @param options Scope creation options
     * @returns The created scope
     */
    MemoryIsolationManager.prototype.createScope = function (options) {
        var _a;
        // Generate a unique scope ID
        var scopeId = {
            id: "scope_".concat((0, uuid_1.v4)()),
            name: options.name,
            description: options.description
        };
        // Create the access policy
        var accessPolicy = {
            accessLevel: options.accessLevel,
            ownerAgentId: options.ownerAgentId,
            agentPermissions: options.agentPermissions || new Map(),
            defaultPermissions: options.defaultPermissions || new Set(),
            requireAcknowledgment: (_a = options.requireAcknowledgment) !== null && _a !== void 0 ? _a : this.config.requireSharingAcknowledgment
        };
        // Create the scope
        var newScope = {
            scopeId: scopeId,
            accessPolicy: accessPolicy,
            allowedMemoryTypes: options.allowedMemoryTypes,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: options.metadata || {}
        };
        // Store the scope
        this.scopes.set(scopeId.id, newScope);
        // Associate the scope with the owner agent
        this.addAgentToScope(options.ownerAgentId, scopeId.id);
        // If the scope is shared, add it to the specified agents
        if (options.accessLevel === MemoryScope_1.MemoryAccessLevel.SHARED && options.agentPermissions) {
            // Convert to array before iterating
            var agentIds = Array.from(options.agentPermissions.keys());
            for (var _i = 0, agentIds_1 = agentIds; _i < agentIds_1.length; _i++) {
                var agentId = agentIds_1[_i];
                this.addAgentToScope(agentId, scopeId.id);
            }
        }
        return newScope;
    };
    /**
     * Associates an agent with a scope
     * @param agentId The agent ID
     * @param scopeId The scope ID
     */
    MemoryIsolationManager.prototype.addAgentToScope = function (agentId, scopeId) {
        // Get or create the agent's scope set
        var agentScopeSet = this.agentScopes.get(agentId) || new Set();
        // Add the scope to the agent's scope set
        agentScopeSet.add(scopeId);
        // Store the updated scope set
        this.agentScopes.set(agentId, agentScopeSet);
    };
    /**
     * Gets all scopes for an agent
     * @param agentId The agent ID
     * @returns The scopes the agent has access to
     */
    MemoryIsolationManager.prototype.getScopesForAgent = function (agentId) {
        var result = [];
        // Get the agent's scope set
        var agentScopeSet = this.agentScopes.get(agentId);
        // If the agent has explicit scopes, add them
        if (agentScopeSet) {
            // Convert to array before iterating
            var scopeIds = Array.from(agentScopeSet);
            for (var _i = 0, scopeIds_1 = scopeIds; _i < scopeIds_1.length; _i++) {
                var scopeId = scopeIds_1[_i];
                var scope = this.scopes.get(scopeId);
                if (scope) {
                    result.push(scope);
                }
            }
        }
        // Add public scopes that the agent doesn't already have
        // Convert to array before iterating
        var allScopes = Array.from(this.scopes.values());
        var _loop_1 = function (scope) {
            // Only add public scopes that aren't already in the result
            if (scope.accessPolicy.accessLevel === MemoryScope_1.MemoryAccessLevel.PUBLIC &&
                !result.some(function (s) { return s.scopeId.id === scope.scopeId.id; })) {
                // Register the agent with this public scope to ensure proper access tracking
                this_1.addAgentToScope(agentId, scope.scopeId.id);
                result.push(scope);
            }
        };
        var this_1 = this;
        for (var _a = 0, allScopes_1 = allScopes; _a < allScopes_1.length; _a++) {
            var scope = allScopes_1[_a];
            _loop_1(scope);
        }
        return result;
    };
    /**
     * Checks if an agent has access to a scope
     * @param agentId The agent ID
     * @param scopeId The scope ID
     * @param requiredPermission The required permission
     * @returns Whether the agent has access
     */
    MemoryIsolationManager.prototype.checkAccess = function (agentId, scopeId, requiredPermission) {
        var _a;
        // Get the scope
        var scope = this.scopes.get(scopeId);
        // If the scope doesn't exist, deny access
        if (!scope) {
            return this.createDeniedResult(false, undefined, 'Scope does not exist', agentId);
        }
        // If memory isolation is disabled, grant access
        if (!this.config.enableIsolation) {
            return this.createGrantedResult(true, scope, agentId);
        }
        // If the agent is the owner, grant access
        if (scope.accessPolicy.ownerAgentId === agentId) {
            return this.createGrantedResult(true, scope, agentId);
        }
        // Check access level
        switch (scope.accessPolicy.accessLevel) {
            case MemoryScope_1.MemoryAccessLevel.PRIVATE:
                // Private scopes are only accessible by the owner
                return this.createDeniedResult(false, scope, 'Private scope is only accessible by the owner', agentId);
            case MemoryScope_1.MemoryAccessLevel.SHARED:
                // Shared scopes are accessible by specified agents
                var permissions = (_a = scope.accessPolicy.agentPermissions) === null || _a === void 0 ? void 0 : _a.get(agentId);
                if (!permissions) {
                    return this.createDeniedResult(false, scope, 'Agent does not have explicit access to this shared scope', agentId);
                }
                var hasPermission = permissions.has(requiredPermission);
                if (!hasPermission) {
                    return this.createDeniedResult(false, scope, "Agent does not have ".concat(requiredPermission, " permission on this scope"), agentId);
                }
                return this.createGrantedResult(true, scope, agentId);
            case MemoryScope_1.MemoryAccessLevel.PUBLIC:
                // Public scopes are accessible by all agents with default permissions
                var defaultPermissions = scope.accessPolicy.defaultPermissions;
                if (!defaultPermissions) {
                    return this.createDeniedResult(false, scope, 'Public scope does not have default permissions set', agentId);
                }
                var hasDefaultPermission = defaultPermissions.has(requiredPermission);
                if (!hasDefaultPermission) {
                    return this.createDeniedResult(false, scope, "Default permissions do not include ".concat(requiredPermission, " permission"), agentId);
                }
                return this.createGrantedResult(true, scope, agentId);
            default:
                return this.createDeniedResult(false, scope, 'Unknown access level', agentId);
        }
    };
    /**
     * Creates a granted access result
     * @param value The result value
     * @param scope The accessed scope
     * @param requestingAgentId The agent ID requesting access
     * @returns The access result
     */
    MemoryIsolationManager.prototype.createGrantedResult = function (value, scope, requestingAgentId) {
        // Create the result
        var result = {
            granted: true,
            value: value,
            scope: scope,
            timestamp: new Date()
        };
        // Update metrics if tracking is enabled
        if (this.config.trackAccessMetrics) {
            this.updateMetrics(true, requestingAgentId, scope.scopeId.id);
        }
        return result;
    };
    /**
     * Creates a denied access result
     * @param value The result value
     * @param scope The accessed scope
     * @param reason The denial reason
     * @param requestingAgentId The agent ID requesting access
     * @returns The access result
     */
    MemoryIsolationManager.prototype.createDeniedResult = function (value, scope, reason, requestingAgentId) {
        // Create the result
        var result = {
            granted: false,
            value: value,
            scope: scope,
            deniedReason: reason,
            timestamp: new Date()
        };
        // Update metrics if tracking is enabled
        if (this.config.trackAccessMetrics && scope && requestingAgentId) {
            this.updateMetrics(false, requestingAgentId, scope.scopeId.id);
        }
        return result;
    };
    /**
     * Updates access metrics
     * @param granted Whether access was granted
     * @param agentId The agent ID
     * @param scopeId The scope ID
     */
    MemoryIsolationManager.prototype.updateMetrics = function (granted, agentId, scopeId) {
        // Update total metrics
        this.metrics.totalRequests++;
        if (granted) {
            this.metrics.grantedRequests++;
        }
        else {
            this.metrics.deniedRequests++;
        }
        // Update agent metrics
        var agentCount = this.metrics.accessByAgent.get(agentId) || 0;
        this.metrics.accessByAgent.set(agentId, agentCount + 1);
        // Update scope metrics
        var scopeCount = this.metrics.accessByScope.get(scopeId) || 0;
        this.metrics.accessByScope.set(scopeId, scopeCount + 1);
    };
    /**
     * Creates a memory sharing request
     * @param requestingAgentId The requesting agent ID
     * @param targetAgentId The target agent ID
     * @param scopeId The scope ID
     * @param permissionsToGrant The permissions to grant
     * @param memoryIds Optional specific memory IDs to share
     * @returns The sharing request
     */
    MemoryIsolationManager.prototype.createSharingRequest = function (requestingAgentId, targetAgentId, scopeId, permissionsToGrant, memoryIds) {
        // Get the scope
        var scope = this.scopes.get(scopeId);
        // If the scope doesn't exist, return null
        if (!scope) {
            console.warn("Cannot create sharing request for non-existent scope: ".concat(scopeId));
            return null;
        }
        // Check if the requesting agent is the owner or has SHARE permission
        var accessResult = this.checkAccess(requestingAgentId, scopeId, MemoryScope_1.MemoryPermission.SHARE);
        if (!accessResult.granted) {
            console.warn("Agent ".concat(requestingAgentId, " does not have permission to share scope ").concat(scopeId));
            return null;
        }
        // Create the sharing request
        var request = {
            requestId: "share_".concat((0, uuid_1.v4)()),
            requestingAgentId: requestingAgentId,
            targetAgentId: targetAgentId,
            scopeId: scopeId,
            memoryIds: memoryIds,
            permissionsToGrant: permissionsToGrant,
            status: 'pending',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + this.config.sharingRequestTimeoutMs)
        };
        // Store the request
        this.sharingRequests.set(request.requestId, request);
        return request;
    };
    /**
     * Responds to a memory sharing request
     * @param requestId The request ID
     * @param approved Whether the request is approved
     * @param reason Optional reason for the response
     * @returns Whether the response was processed
     */
    MemoryIsolationManager.prototype.respondToSharingRequest = function (requestId, approved, reason) {
        // Get the request
        var request = this.sharingRequests.get(requestId);
        // If the request doesn't exist, return false
        if (!request) {
            console.warn("Cannot respond to non-existent sharing request: ".concat(requestId));
            return false;
        }
        // If the request is not pending, return false
        if (request.status !== 'pending') {
            console.warn("Cannot respond to ".concat(request.status, " sharing request: ").concat(requestId));
            return false;
        }
        // Update the request
        request.status = approved ? 'approved' : 'denied';
        request.respondedAt = new Date();
        request.responseReason = reason;
        // If approved, grant the permissions
        if (approved) {
            this.grantPermissions(request.targetAgentId, request.scopeId, request.permissionsToGrant);
        }
        return true;
    };
    /**
     * Grants permissions to an agent for a scope
     * @param agentId The agent ID
     * @param scopeId The scope ID
     * @param permissions The permissions to grant
     * @returns Whether the permissions were granted
     */
    MemoryIsolationManager.prototype.grantPermissions = function (agentId, scopeId, permissions) {
        // Get the scope
        var scope = this.scopes.get(scopeId);
        // If the scope doesn't exist, return false
        if (!scope) {
            console.warn("Cannot grant permissions for non-existent scope: ".concat(scopeId));
            return false;
        }
        // If the scope is not shared, return false
        if (scope.accessPolicy.accessLevel !== MemoryScope_1.MemoryAccessLevel.SHARED) {
            console.warn("Cannot grant permissions for non-shared scope: ".concat(scopeId));
            return false;
        }
        // Initialize agentPermissions if it doesn't exist
        if (!scope.accessPolicy.agentPermissions) {
            scope.accessPolicy.agentPermissions = new Map();
        }
        // Get or create the agent's permission set
        var agentPermissions = scope.accessPolicy.agentPermissions.get(agentId) || new Set();
        // Add the new permissions
        // Convert to array before iterating
        var permissionsArray = Array.from(permissions);
        for (var _i = 0, permissionsArray_1 = permissionsArray; _i < permissionsArray_1.length; _i++) {
            var permission = permissionsArray_1[_i];
            agentPermissions.add(permission);
        }
        // Store the updated permission set
        scope.accessPolicy.agentPermissions.set(agentId, agentPermissions);
        // Add the agent to the scope
        this.addAgentToScope(agentId, scopeId);
        // Update the scope's updated timestamp
        scope.updatedAt = new Date();
        return true;
    };
    /**
     * Revokes permissions from an agent for a scope
     * @param agentId The agent ID
     * @param scopeId The scope ID
     * @param permissions The permissions to revoke
     * @returns Whether the permissions were revoked
     */
    MemoryIsolationManager.prototype.revokePermissions = function (agentId, scopeId, permissions) {
        var _a;
        // Get the scope
        var scope = this.scopes.get(scopeId);
        // If the scope doesn't exist, return false
        if (!scope) {
            console.warn("Cannot revoke permissions for non-existent scope: ".concat(scopeId));
            return false;
        }
        // If the scope is not shared, return false
        if (scope.accessPolicy.accessLevel !== MemoryScope_1.MemoryAccessLevel.SHARED) {
            console.warn("Cannot revoke permissions for non-shared scope: ".concat(scopeId));
            return false;
        }
        // If the agent doesn't have permissions, return false
        if (!((_a = scope.accessPolicy.agentPermissions) === null || _a === void 0 ? void 0 : _a.has(agentId))) {
            console.warn("Agent ".concat(agentId, " does not have permissions for scope ").concat(scopeId));
            return false;
        }
        // Get the agent's permission set
        var agentPermissions = scope.accessPolicy.agentPermissions.get(agentId);
        // Remove the specified permissions
        // Convert to array before iterating
        var permissionsArray = Array.from(permissions);
        for (var _i = 0, permissionsArray_2 = permissionsArray; _i < permissionsArray_2.length; _i++) {
            var permission = permissionsArray_2[_i];
            agentPermissions.delete(permission);
        }
        // If the agent has no permissions left, remove them from the scope
        if (agentPermissions.size === 0) {
            scope.accessPolicy.agentPermissions.delete(agentId);
            // Remove the scope from the agent's scope set
            var agentScopeSet = this.agentScopes.get(agentId);
            if (agentScopeSet) {
                agentScopeSet.delete(scopeId);
                // If the agent has no scopes left, remove them from the agentScopes map
                if (agentScopeSet.size === 0) {
                    this.agentScopes.delete(agentId);
                }
                else {
                    this.agentScopes.set(agentId, agentScopeSet);
                }
            }
        }
        else {
            // Store the updated permission set
            scope.accessPolicy.agentPermissions.set(agentId, agentPermissions);
        }
        // Update the scope's updated timestamp
        scope.updatedAt = new Date();
        return true;
    };
    /**
     * Gets a scope by ID
     * @param scopeId The scope ID
     * @returns The scope, or undefined if it doesn't exist
     */
    MemoryIsolationManager.prototype.getScope = function (scopeId) {
        return this.scopes.get(scopeId);
    };
    /**
     * Gets all scopes
     * @returns All scopes
     */
    MemoryIsolationManager.prototype.getAllScopes = function () {
        return Array.from(this.scopes.values());
    };
    /**
     * Gets access metrics
     * @returns The access metrics
     */
    MemoryIsolationManager.prototype.getAccessMetrics = function () {
        return {
            totalRequests: this.metrics.totalRequests,
            grantedRequests: this.metrics.grantedRequests,
            deniedRequests: this.metrics.deniedRequests,
            accessByAgent: new Map(this.metrics.accessByAgent),
            accessByScope: new Map(this.metrics.accessByScope)
        };
    };
    /**
     * Gets all pending sharing requests for an agent
     * @param agentId The agent ID
     * @returns The pending sharing requests
     */
    MemoryIsolationManager.prototype.getPendingSharingRequests = function (agentId) {
        var result = [];
        // Check all sharing requests
        // Convert to array before iterating
        var requests = Array.from(this.sharingRequests.values());
        for (var _i = 0, requests_1 = requests; _i < requests_1.length; _i++) {
            var request = requests_1[_i];
            // If the request is for the specified agent and is pending, add it to the result
            if (request.targetAgentId === agentId && request.status === 'pending') {
                result.push(request);
            }
        }
        return result;
    };
    /**
     * Gets all sharing requests created by an agent
     * @param agentId The agent ID
     * @returns The sharing requests
     */
    MemoryIsolationManager.prototype.getCreatedSharingRequests = function (agentId) {
        var result = [];
        // Check all sharing requests
        // Convert to array before iterating
        var requests = Array.from(this.sharingRequests.values());
        for (var _i = 0, requests_2 = requests; _i < requests_2.length; _i++) {
            var request = requests_2[_i];
            // If the request was created by the specified agent, add it to the result
            if (request.requestingAgentId === agentId) {
                result.push(request);
            }
        }
        return result;
    };
    /**
     * Gets a sharing request by ID
     * @param requestId The request ID
     * @returns The sharing request, or undefined if it doesn't exist
     */
    MemoryIsolationManager.prototype.getSharingRequest = function (requestId) {
        return this.sharingRequests.get(requestId);
    };
    /**
     * Gets the agent IDs with access to a scope
     * @param scopeId The scope ID
     * @returns The agent IDs with access to the scope
     */
    MemoryIsolationManager.prototype.getAgentsWithAccess = function (scopeId) {
        var result = [];
        // Get the scope
        var scope = this.scopes.get(scopeId);
        // If the scope doesn't exist, return an empty array
        if (!scope) {
            return result;
        }
        // Add the owner
        result.push(scope.accessPolicy.ownerAgentId);
        // If the scope is shared, add all agents with permissions
        if (scope.accessPolicy.accessLevel === MemoryScope_1.MemoryAccessLevel.SHARED &&
            scope.accessPolicy.agentPermissions) {
            // Convert to array before iterating
            var agentIds = Array.from(scope.accessPolicy.agentPermissions.keys());
            for (var _i = 0, agentIds_2 = agentIds; _i < agentIds_2.length; _i++) {
                var agentId = agentIds_2[_i];
                if (!result.includes(agentId)) {
                    result.push(agentId);
                }
            }
        }
        return result;
    };
    return MemoryIsolationManager;
}());
exports.MemoryIsolationManager = MemoryIsolationManager;
