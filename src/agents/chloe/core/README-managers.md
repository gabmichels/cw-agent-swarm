# Manager Standardization Guidelines

This document provides guidelines for creating and maintaining standardized manager components in the Chloe agent system.

## Core Principles

1. **Consistency**: All managers should follow the same patterns for initialization, logging, error handling, and cleanup.
2. **Type Safety**: All managers should implement proper interfaces and avoid using `any` types.
3. **Error Handling**: All managers should use consistent error handling patterns.
4. **Logging**: All managers should log their actions in a standardized way.

## Implementation Requirements

### 1. Interface Implementation

All managers must implement the `IManager` interface:

```typescript
export interface IManager {
  // Initialize the manager with necessary resources
  initialize(): Promise<void>;
  
  // Check if the manager has been initialized
  isInitialized(): boolean;

  // Get the ID of the agent this manager belongs to
  getAgentId(): string;
  
  // Shutdown the manager and cleanup resources
  shutdown?(): Promise<void>;
  
  // Log an action or event from the manager
  logAction?(action: string, metadata?: Record<string, unknown>): void;
}
```

### 2. Options Pattern

All manager options should extend the `BaseManagerOptions` interface:

```typescript
export interface BaseManagerOptions {
  agentId: string;
}

export interface YourManagerOptions extends BaseManagerOptions {
  // Manager-specific options
  logger?: TaskLogger;
  // ...other options
}
```

### 3. Standard Properties

All managers should have these standard properties:

```typescript
private agentId: string;
private initialized: boolean = false;
private taskLogger: TaskLogger | null = null;
```

### 4. Standardized Methods

#### Initialization

```typescript
async initialize(): Promise<void> {
  try {
    this.logAction('Initializing manager');
    
    // Manager-specific initialization
    
    this.initialized = true;
    this.logAction('Manager initialized successfully');
  } catch (error) {
    this.logAction('Error initializing manager', { error: String(error) });
    throw error;
  }
}
```

#### Shutdown

```typescript
async shutdown(): Promise<void> {
  try {
    this.logAction('Shutting down manager');
    
    // Manager-specific cleanup
    
    this.logAction('Manager shutdown complete');
  } catch (error) {
    this.logAction('Error during manager shutdown', { error: String(error) });
    throw error;
  }
}
```

#### Logging

```typescript
logAction(action: string, metadata?: Record<string, unknown>): void {
  if (this.taskLogger) {
    this.taskLogger.logAction(`ManagerName: ${action}`, metadata);
  } else {
    logger.info(`ManagerName: ${action}`, metadata);
  }
}
```

#### Status Check

```typescript
isInitialized(): boolean {
  return this.initialized;
}
```

### 5. Error Handling

Always catch errors, log them properly, and then re-throw if necessary:

```typescript
try {
  // Code that might throw an error
} catch (error) {
  this.logAction('Error description', { error: String(error) });
  throw error; // Re-throw if the error needs to propagate
}
```

## Template File

Refer to the `managerTemplate.ts` file for a complete template implementation that follows these guidelines.

## Standardized Managers

All managers in the system have been standardized to follow these guidelines:

1. MemoryManager
2. ToolManager
3. PlanningManager
4. MarketScannerManager
5. NotifierManager
6. ReflectionManager
7. ThoughtManager
8. KnowledgeGapsManager

## Benefits of Standardization

1. **Easier Maintenance**: Consistent patterns make code easier to maintain
2. **Better Error Handling**: Standardized error handling improves reliability
3. **Improved Logging**: Consistent logging makes debugging easier
4. **Type Safety**: Proper interfaces reduce bugs and improve IDE support
5. **Testing**: Standardized interfaces make testing more consistent 