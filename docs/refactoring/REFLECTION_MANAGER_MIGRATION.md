# Migration Guide: EnhancedReflectionManager

This document provides guidance on migrating from the old inheritance-based `EnhancedReflectionManager` to the new composition-based implementation that follows the architecture guidelines.

## Overview of Changes

The `EnhancedReflectionManager` has been refactored to use composition instead of inheritance. This change provides several benefits:

1. **Cleaner architecture**: Removes complex inheritance chains
2. **Better type safety**: All methods and properties are properly typed
3. **Improved testability**: Components can be tested in isolation
4. **Greater flexibility**: Easier to modify or extend functionality

## Key Differences

### 1. Composition vs. Inheritance

#### Old approach (inheritance):
```typescript
// The old implementation extended DefaultReflectionManager
export class EnhancedReflectionManager extends DefaultReflectionManager {
  // Implementation
}
```

#### New approach (composition):
```typescript
// The new implementation uses a DefaultReflectionManager instance internally
export class EnhancedReflectionManager extends AbstractBaseManager implements ReflectionManager {
  private baseReflectionManager: ReflectionManager;
  
  constructor(agent: AgentBase, config: Partial<ReflectionManagerConfig> = {}) {
    super(/* ... */);
    this.baseReflectionManager = new DefaultReflectionManager(agent, this.config);
    // Additional initialization
  }
  
  // Delegate methods to baseReflectionManager
  async reflect(trigger: ReflectionTrigger, context?: Record<string, unknown>): Promise<ReflectionResult> {
    return this.baseReflectionManager.reflect(trigger, context);
  }
  
  // Additional enhanced methods
}
```

### 2. Enum Usage

The new implementation uses proper enum values for all constants:

```typescript
// Old code might have used string literals
manager.reflect('periodic', context);

// New code uses the enum
manager.reflect(ReflectionTrigger.PERIODIC, context);
```

### 3. Interface Compliance

The new implementation strictly follows the `ReflectionManager` interface and adds additional functionality in a type-safe manner.

## Migration Steps

### Step 1: Update Imports

```typescript
// Old import
import { EnhancedReflectionManager } from '../../agents/shared/reflection/managers/EnhancedReflectionManager';

// New import remains the same, but the implementation has changed
import { EnhancedReflectionManager } from '../../agents/shared/reflection/managers/EnhancedReflectionManager';
```

### Step 2: Update Enum Usage

```typescript
// Old code
manager.reflect('periodic', context);

// New code
import { ReflectionTrigger } from '../../agents/shared/base/managers/ReflectionManager.interface';
manager.reflect(ReflectionTrigger.PERIODIC, context);
```

### Step 3: Add Proper Type Annotations

```typescript
// Old code might have used 'any' or incorrect types
const result: any = await manager.reflect('periodic', {});

// New code uses proper types
import { ReflectionResult } from '../../agents/shared/base/managers/ReflectionManager.interface';
const result: ReflectionResult = await manager.reflect(ReflectionTrigger.PERIODIC, {});
```

### Step 4: Update Self-Improvement Method Usage

If you were using the enhanced self-improvement methods, update your code to use the proper enums:

```typescript
// Old code
const outcome = await manager.recordLearningOutcome({
  planId,
  type: 'knowledge',
  // Other properties
});

// New code
import { LearningOutcomeType } from '../../agents/shared/reflection/interfaces/SelfImprovement.interface';
const outcome = await manager.recordLearningOutcome({
  planId,
  type: LearningOutcomeType.KNOWLEDGE,
  // Other properties
});
```

### Step 5: Test Your Integration

The new implementation should be a drop-in replacement for the old one, but with improved type safety. Test your integration to ensure everything works as expected.

## Example: Complete Usage

```typescript
import { EnhancedReflectionManager } from '../../agents/shared/reflection/managers/EnhancedReflectionManager';
import { ReflectionTrigger } from '../../agents/shared/base/managers/ReflectionManager.interface';
import { LearningOutcomeType, ImprovementAreaType, ImprovementPriority } from '../../agents/shared/reflection/interfaces/SelfImprovement.interface';

// Create manager instance
const reflectionManager = new EnhancedReflectionManager(agent, {
  reflectionDepth: 'standard',
  adaptiveBehavior: true,
  enablePeriodicReflections: true,
  enableSelfImprovement: true
});

// Initialize
await reflectionManager.initialize();

// Use the reflection functionality
const reflectionResult = await reflectionManager.reflect(ReflectionTrigger.MANUAL, {
  topic: 'Learning performance',
  contextData: { recentInteractions: 5 }
});

// Use self-improvement features
const plan = await reflectionManager.createImprovementPlan({
  name: 'Performance Improvement Plan',
  description: 'Improve agent performance in knowledge areas',
  startDate: new Date(),
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
  sourceReflectionIds: [reflectionResult.id],
  targetAreas: [ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL],
  status: 'active',
  priority: ImprovementPriority.HIGH,
  progress: 0,
  successMetrics: ['accuracy', 'efficiency'],
  successCriteria: ['Improved response accuracy']
});

// Schedule a periodic reflection
await reflectionManager.schedulePeriodicReflection('0 0 * * *', { // Daily at midnight
  name: 'Daily Learning Review',
  depth: 'standard',
  focusAreas: ['knowledge', 'skills']
});
```

## Troubleshooting

If you encounter any issues during migration, check the following:

1. **Type errors**: Make sure you're using the correct enums and types
2. **Method signatures**: Verify that method parameters match the new interface
3. **Configuration**: Check that your configuration follows the expected format

If problems persist, review the implementation in `src/agents/shared/reflection/managers/EnhancedReflectionManager.ts` for detailed usage examples. 