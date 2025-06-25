# Error Communication and Logging Implementation Plan

## 🎯 **Goal and Objectives**

**Primary Goal**: Create a comprehensive error communication system that provides real-time user feedback, centralized logging, and actionable error reporting to eliminate silent failures and improve user experience.

**What We Want to Achieve**:
- ✅ Real-time user notifications for tool failures and errors
- ✅ Recovery progress communication ("Retrying email send: attempt 2 of 3...")
- ✅ Clear failure explanations when all recovery attempts fail
- ✅ Centralized error logging with searchable dashboard
- ✅ Integration with existing notification system
- ✅ Proper error categorization and routing
- ✅ Anti-hallucination measures for error scenarios

## 🚨 **Current Problem Cases**

**Critical Issues We're Solving**:
1. **Silent Email Failures**: Agents claim to send emails but use fallback executors, providing no user feedback
2. **Tool Execution Errors**: Database connection errors, API failures, and workspace permission issues fail silently
3. **Missing User Communication**: Users have no visibility into retry attempts, error recovery, or failure reasons
4. **Scattered Error Handling**: Error handling is spread across multiple files without centralized coordination
5. **No Error Analytics**: No systematic way to analyze error patterns or system health
6. **Debugging Difficulties**: Hard-to-spot logs make troubleshooting time-consuming

## 🏗️ **Architecture Overview**

Following IMPLEMENTATION_GUIDELINES.md principles:
- **ULID IDs** for all error records
- **Strict TypeScript typing** with no `any` types
- **Dependency injection** for all services
- **Pure functions** for error processing
- **Interface-first design** for extensibility
- **Immutable data patterns** for error records

## 📋 **Implementation Checklist**

### **Phase 1: Database Schema and Core Infrastructure**

#### **1.1 Error Logging Database Schema**
- [x] **Add Error Log Tables to Prisma Schema**
  - [x] Create `ErrorType` model (TOOL_EXECUTION, API_FAILURE, PERMISSION_DENIED, etc.)
  - [x] Create `ErrorSeverity` model (LOW, MEDIUM, HIGH, CRITICAL)
  - [x] Create `ErrorStatus` model (NEW, IN_PROGRESS, RESOLVED, IGNORED)
  - [x] Create `ErrorLog` model with ULID IDs
    - [x] Add error type, severity, status fields
    - [x] Add context data (agentId, userId, toolId, operation)
    - [x] Add stackTrace, message, and error details
    - [x] Add retry attempt tracking
    - [x] Add resolution tracking
  - [x] Create `ErrorResolution` model for tracking fixes
  - [x] Add proper indexes for querying and analytics

#### **1.2 Error Type System**
- [x] **Create Typed Error Hierarchy**
  - [x] Define `BaseError` interface with required fields
  - [x] Create `ToolExecutionError` for tool failures
  - [x] Create `WorkspacePermissionError` for access issues
  - [ ] Create `APIConnectionError` for external service failures
  - [ ] Create `DatabaseError` for persistence issues
  - [ ] Create `ValidationError` for input validation failures
  - [x] Add proper error codes and categorization

#### **1.3 Error Context System**
- [x] **Create Error Context Interface**
  - [x] Define `ErrorContext` interface with agent, user, and operation data
  - [x] Create `ToolExecutionContext` for tool-specific errors
  - [x] Create `WorkspaceContext` for workspace-related errors
  - [x] Implement context builders with validation

### **Phase 2: Centralized Error Management Service**

#### **2.1 Core Error Management Service**
- [x] **Create `ErrorManagementService` Interface**
  - [x] Define methods for logging, categorizing, and routing errors
  - [x] Define retry policy management
  - [x] Define user notification routing logic
  - [x] Define error escalation rules

- [x] **Implement `DefaultErrorManagementService`**
  - [x] Use constructor dependency injection
  - [x] Implement error logging with ULID generation
  - [x] Add error categorization logic
  - [x] Add automatic retry policy selection
  - [x] Add user notification routing
  - [x] Include structured logging with context

#### **2.2 Error Classification Engine**
- [x] **Create Error Classification System**
  - [x] Implement error pattern matching
  - [x] Create severity assessment logic
  - [x] Add user-impact scoring
  - [x] Implement auto-categorization rules
  - [x] Add known error detection

#### **2.3 Recovery Strategy Manager**
- [x] **Create Recovery Strategy Interface**
  - [x] Define retry policies for different error types
  - [x] Define fallback strategies
  - [x] Define escalation paths

- [x] **Implement Recovery Strategies**
  - [x] Tool execution retry with exponential backoff
  - [x] Workspace permission auto-refresh
  - [x] API connection retry with circuit breaker
  - [x] Graceful degradation patterns

### **Phase 3: User Communication Integration**

#### **3.1 Real-time Error Notifications**
- [x] **Integrate with Existing Notification System**
  - [x] Use `DefaultNotificationManager` for error notifications
  - [x] Create error-specific notification templates
  - [x] Add progress notifications for retry attempts
  - [x] Implement failure summary notifications

#### **3.2 Progress Communication**
- [x] **Create Progress Notification Service**
  - [x] Send "Retrying operation: attempt X of Y" messages
  - [x] Send "Attempting alternative approach" messages
  - [x] Send recovery success/failure notifications
  - [x] Use WebSocket/SSE for real-time updates

#### **3.3 Error Explanation System**
- [x] **Create User-Friendly Error Messages**
  - [x] Create error message templates
  - [x] Add actionable suggestions for users
  - [x] Include "what went wrong" explanations
  - [x] Add "what we're doing about it" context

### **Phase 4: Tool System Integration** ✅ **COMPLETE**

#### **4.1 Enhanced Tool Execution Wrapper** ✅ **COMPLETE**
- [x] **Replace Fallback Executor Logic**
  - [x] Modify `ToolService.executeFallbackTool()` to log real failures
  - [x] Add proper error handling instead of simulation
  - [x] Integrate with error management service
  - [x] Add user notification on tool failures

#### **4.2 Workspace Tool Error Handling** ✅ **COMPLETE**
- [x] **Enhance Workspace Tool Integration**
  - [x] Add error handling to `WorkspaceAgentTools`
  - [x] Implement permission error detection and notification
  - [x] Add token refresh error handling
  - [x] Create workspace connection health checks

#### **4.3 Tool Registry Error Management** ✅ **COMPLETE**
- [x] **Improve Tool Registration Errors**
  - [x] Add validation for tool registration
  - [x] Implement tool availability checking
  - [x] Add tool permission verification
  - [x] Create tool health monitoring

### **Phase 5: Agent Integration**

#### **5.1 Agent Error Handling Enhancement**
- [ ] **Integrate Error Management into DefaultAgent**
  - [ ] Add error manager to agent initialization
  - [ ] Modify execution flow to use error management
  - [ ] Add error context tracking
  - [ ] Implement agent-specific error policies

#### **5.2 Agent Communication Error Handling**
- [ ] **Enhance Agent Communication Errors**
  - [ ] Add error handling to agent message processing
  - [ ] Implement conversation error recovery
  - [ ] Add user feedback for communication failures

### **Phase 6: Dashboard and Analytics**

#### **6.1 Error Analytics Dashboard**
- [ ] **Create Error Dashboard Page**
  - [ ] Add error log table with filtering
  - [ ] Create error trend charts
  - [ ] Add error category breakdowns
  - [ ] Implement error search functionality

#### **6.2 Error Reporting System**
- [ ] **Create Error Report Generation**
  - [ ] Daily/weekly error summaries
  - [ ] Error pattern analysis
  - [ ] System health reports
  - [ ] Performance impact analysis

#### **6.3 Error Monitoring Alerts**
- [ ] **Implement Error Threshold Monitoring**
  - [ ] High error rate alerts
  - [ ] Critical error immediate notifications
  - [ ] System degradation warnings
  - [ ] Recovery failure escalations

### **Phase 7: Testing and Validation**

#### **7.1 Unit Testing**
- [ ] **Test Error Management Service**
  - [ ] Test error classification logic
  - [ ] Test retry mechanism
  - [ ] Test notification routing
  - [ ] Test context preservation

#### **7.2 Integration Testing**
- [ ] **Test Tool Error Scenarios**
  - [ ] Simulate tool execution failures
  - [ ] Test workspace permission errors
  - [ ] Test API connection failures
  - [ ] Verify user notifications are sent

#### **7.3 End-to-End Testing**
- [ ] **Test Complete Error Flow**
  - [ ] Generate actual tool errors
  - [ ] Verify error logging to database
  - [ ] Verify user notifications appear
  - [ ] Test error dashboard functionality

### **Phase 8: Anti-Hallucination Integration**

#### **8.1 Error Scenario Anti-Hallucination**
- [ ] **Integrate with Existing Anti-Hallucination System**
  - [ ] Add error scenario prompts to `PromptFormatter`
  - [ ] Update LLM instructions for error communication
  - [ ] Add "I encountered an error" response patterns
  - [ ] Prevent agents from claiming success on failures

#### **8.2 Factual Error Reporting**
- [ ] **Ensure Accurate Error Communication**
  - [ ] Validate error messages before sending to users
  - [ ] Add fact-checking for error explanations
  - [ ] Implement error message templates to prevent hallucination

## 🔧 **Technical Implementation Details**

### **Database Schema Addition**
```prisma
model ErrorType {
  id          String   @id @default(uuid())
  name        String   @unique // TOOL_EXECUTION, API_FAILURE, PERMISSION_DENIED
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ErrorSeverity {
  id          String   @id @default(uuid())
  name        String   @unique // LOW, MEDIUM, HIGH, CRITICAL
  description String?
  priority    Int      // Numeric priority for sorting
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ErrorStatus {
  id          String   @id @default(uuid())
  name        String   @unique // NEW, IN_PROGRESS, RESOLVED, IGNORED
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ErrorLog {
  id                String   @id @default(uuid()) // Using ULID in service layer
  errorType         String   // References ErrorType.name
  severity          String   // References ErrorSeverity.name  
  status            String   // References ErrorStatus.name
  
  // Context information
  agentId           String?
  userId            String?
  sessionId         String?
  toolId            String?
  operation         String?
  
  // Error details
  message           String
  stackTrace        String?
  errorCode         String?
  errorData         String?  // JSON metadata
  
  // Retry tracking
  retryAttempt      Int      @default(0)
  maxRetries        Int      @default(3)
  retryStrategy     String?
  lastRetryAt       DateTime?
  
  // Resolution tracking
  resolvedAt        DateTime?
  resolvedBy        String?
  resolutionNotes   String?
  
  // User communication
  userNotified      Boolean  @default(false)
  notificationSent  DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([agentId])
  @@index([userId])
  @@index([errorType])
  @@index([severity])
  @@index([status])
  @@index([createdAt])
  @@index([operation])
}
```

### **Core Service Interfaces**
```typescript
interface IErrorManagementService {
  logError(error: ErrorInput, context: ErrorContext): Promise<string>;
  classifyError(error: Error): ErrorClassification;
  determineRecoveryStrategy(errorType: string): RecoveryStrategy;
  notifyUser(errorId: string, notificationType: NotificationType): Promise<void>;
  trackRetryAttempt(errorId: string, attempt: number): Promise<void>;
  resolveError(errorId: string, resolution: string): Promise<void>;
}

interface ErrorClassification {
  readonly type: string;
  readonly severity: string;
  readonly category: string;
  readonly userImpact: UserImpactLevel;
  readonly autoRetry: boolean;
  readonly requiresUserNotification: boolean;
}

interface RecoveryStrategy {
  readonly maxRetries: number;
  readonly retryDelay: number;
  readonly backoffMultiplier: number;
  readonly fallbackActions: readonly string[];
  readonly escalationThreshold: number;
}
```

## 📊 **Success Metrics**

### **User Experience Metrics**
- [ ] **Zero Silent Failures**: All tool execution failures result in user notifications
- [ ] **90%+ Error Resolution Rate**: Errors are either resolved or clearly explained to users
- [ ] **<5 Second Notification Delay**: Users receive error notifications within 5 seconds of failure
- [ ] **100% Error Logging**: All errors are logged to the database with full context

### **System Health Metrics**
- [ ] **Error Rate Tracking**: Monitor and alert on error rate increases
- [ ] **Recovery Success Rate**: Track percentage of errors successfully resolved through retry
- [ ] **Mean Time to Resolution**: Average time from error occurrence to resolution
- [ ] **User Satisfaction**: Measured through feedback on error communication clarity

## 🎯 **Anti-Hallucination Integration**

This implementation must integrate with the existing [anti-hallucination system][[memory:8427517432842006237]] to ensure agents never fabricate success when actual failures occur.

## 🔄 **Integration Points**

- **Notification System**: Uses existing `DefaultNotificationManager` and WebSocket/SSE infrastructure
- **Error Handlers**: Integrates with existing `StandardizedErrorHandler` and `AgentErrorHandler`
- **Database**: Extends current Prisma schema with error logging tables
- **Dashboard**: Creates new admin pages using existing UI components
- **Agent System**: Enhances `DefaultAgent` initialization and tool integration

## ⚡ **Priority Order**

1. **Phase 1 & 2**: Database schema and core error management (Foundation)
2. **Phase 4.1**: Tool system integration (Fixes silent failures)
3. **Phase 3**: User communication (Provides feedback)
4. **Phase 6.1**: Basic error dashboard (Enables monitoring)
5. **Remaining phases**: Analytics, advanced features, comprehensive testing

---

**Implementation follows IMPLEMENTATION_GUIDELINES.md**: Clean break from legacy code, test-driven development, ULID IDs, strict typing, dependency injection, pure functions, and comprehensive error handling. 