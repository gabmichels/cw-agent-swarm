# DateTimeProcessor Integration Plan

## Overview

This document outlines the plan for integrating the `DateTimeProcessor` across the codebase to ensure consistent date/time parsing and formatting throughout the application.

## Goals

1. Centralize all date/time parsing and formatting through the `DateTimeProcessor`
2. Replace direct usage of `new Date()`, `Date.parse()`, and manual date manipulation
3. Provide consistent date/time handling in all parts of the application
4. Support natural language processing for date/time expressions

## Integration Strategy

### Phase 1: Create DateTimeService

1. Create a singleton `DateTimeService` that wraps the `BasicDateTimeProcessor`:

```typescript
// src/services/datetime/DateTimeService.ts
import { BasicDateTimeProcessor } from '../lib/scheduler/implementations/datetime/BasicDateTimeProcessor';
import { DateTimeProcessor } from '../lib/scheduler/interfaces/DateTimeProcessor.interface';

/**
 * Singleton service for date/time processing across the application
 */
export class DateTimeService {
  private static instance: DateTimeService;
  private processor: DateTimeProcessor;

  private constructor() {
    this.processor = new BasicDateTimeProcessor();
  }

  static getInstance(): DateTimeService {
    if (!DateTimeService.instance) {
      DateTimeService.instance = new DateTimeService();
    }
    return DateTimeService.instance;
  }

  /**
   * Parse a date string or natural language expression
   */
  parse(value: string | Date | number, referenceDate?: Date): Date | null {
    if (value instanceof Date) return value;
    
    if (typeof value === 'number') {
      return new Date(value);
    }
    
    // Try natural language parsing first
    const nlpResult = this.processor.parseNaturalLanguage(value, referenceDate);
    if (nlpResult) return nlpResult;
    
    // Fall back to standard date parsing
    try {
      return new Date(value);
    } catch (e) {
      return null;
    }
  }

  /**
   * Format a date to a standardized string
   */
  format(date: Date, format?: string): string {
    return this.processor.formatDate(date, format);
  }

  /**
   * Get a relative time description (e.g., "2 days ago")
   */
  getRelativeTime(date: Date, referenceDate?: Date): string {
    const reference = referenceDate || new Date();
    return this.processor.getHumanReadableInterval(date, reference);
  }

  /**
   * Check if a date has passed
   */
  hasPassed(date: Date, referenceDate?: Date): boolean {
    return this.processor.hasPassed(date, referenceDate);
  }

  /**
   * Get the underlying processor
   */
  getProcessor(): DateTimeProcessor {
    return this.processor;
  }
}

// Export a convenient singleton instance
export const dateTime = DateTimeService.getInstance();
```

### Phase 2: Identify Integration Points

Key areas for integration:

1. **Server Components**:
   - `/src/server/memory/services/` - Date handling in memory services
   - `/src/server/memory/services/multi-agent/messaging/` - Timestamp handling in messaging

2. **Client Components**:
   - `/src/components/memory/MemoryItem.tsx` - Display of timestamps
   - `/src/components/tabs/MemoryTab.tsx` - Date sorting and filtering

3. **API Routes**:
   - `/src/app/api/memory/` - Timestamp handling in memory APIs
   - `/src/app/api/chat/` - Timestamp parsing in chat APIs

4. **Utility Functions**:
   - `/src/utils/` - Any date manipulation utilities

5. **Agent Components**:
   - `/src/agents/shared/memory/` - Date handling in agent memory
   - `/src/agents/shared/tools/` - Date handling in agent tools

### Phase 3: Implementation Plan

#### 1. Update Server-side Date Handling

Create utility functions for the server that use the DateTimeService:

```typescript
// src/server/utils/datetime.ts
import { dateTime } from '../../services/datetime/DateTimeService';

/**
 * Parse a date from various formats with server-specific handling
 */
export function parseDate(value: string | Date | number): Date {
  const result = dateTime.parse(value);
  return result || new Date(); // Default to current time if parsing fails
}

/**
 * Format a date for server responses
 */
export function formatDate(date: Date): string {
  return dateTime.format(date, 'ISO');
}

/**
 * Check if a date is within a time window
 */
export function isDateWithinWindow(date: Date, targetDate: Date, windowMs: number): boolean {
  return Math.abs(date.getTime() - targetDate.getTime()) < windowMs;
}
```

#### 2. Update Client-side Date Handling

Create utility functions for the client that use the DateTimeService:

```typescript
// src/client/utils/datetime.ts
import { dateTime } from '../../services/datetime/DateTimeService';

/**
 * Format a date for display in the UI
 */
export function formatDisplayDate(date: Date | string | number): string {
  const parsedDate = dateTime.parse(date);
  if (!parsedDate) return 'Invalid date';
  
  return parsedDate.toLocaleString();
}

/**
 * Get a human-readable relative time
 */
export function getRelativeTime(date: Date | string | number): string {
  const parsedDate = dateTime.parse(date);
  if (!parsedDate) return 'Unknown time';
  
  return dateTime.getRelativeTime(parsedDate);
}

/**
 * Compare two dates for sorting
 */
export function compareDates(a: Date | string | number, b: Date | string | number): number {
  const dateA = dateTime.parse(a);
  const dateB = dateTime.parse(b);
  
  if (!dateA && !dateB) return 0;
  if (!dateA) return 1;
  if (!dateB) return -1;
  
  return dateA.getTime() - dateB.getTime();
}
```

#### 3. Update MemoryTab Date Handling

Replace direct date handling in MemoryTab:

```typescript
// Update in /src/components/tabs/MemoryTab.tsx
import { compareDates, formatDisplayDate } from '../../client/utils/datetime';

// Replace this:
// const parsed = new Date(timestamp);
// With:
const formattedDate = formatDisplayDate(timestamp);

// Replace date comparison logic:
// if ((!timestampA && !timestampB) || (isNaN(Date.parse(timestampA)) && isNaN(Date.parse(timestampB)))) {
//   return 0;
// }
// if (!timestampA || isNaN(Date.parse(timestampA))) return 1;
// if (!timestampB || isNaN(Date.parse(timestampB))) return -1;
// const dateA = new Date(timestampA);
// const dateB = new Date(timestampB);
// return dateA.getTime() - dateB.getTime();

// With:
return compareDates(timestampA, timestampB);
```

#### 4. Update Memory Item Timestamp Display

Replace direct date handling in MemoryItem:

```typescript
// Update in /src/components/memory/MemoryItem.tsx
import { formatDisplayDate } from '../../client/utils/datetime';

// Replace this:
// return new Date(timestamp).toLocaleString();
// With:
return formatDisplayDate(timestamp);

// Replace this:
// const date = new Date(String(timestamp));
// With:
const formattedDate = formatDisplayDate(timestamp);
```

#### 5. Update API Routes

Update date handling in API routes:

```typescript
// Update in various API route files
import { parseDate, isDateWithinWindow } from '../../server/utils/datetime';

// Replace this:
// const searchDate = new Date(timestamp);
// With:
const searchDate = parseDate(timestamp);

// Replace this:
// (messageTimestamp && new Date(messageTimestamp).getTime() - new Date(timestamp).getTime() < 1000)
// With:
isDateWithinWindow(parseDate(messageTimestamp), parseDate(timestamp), 1000)
```

### Phase 4: Testing

1. Create unit tests for the new DateTimeService
2. Create integration tests for the server and client utility functions
3. Test all updated components to ensure proper date handling

### Phase 5: Documentation

1. Document the DateTimeService and its usage
2. Update existing documentation to reference the DateTimeService
3. Create examples of proper date handling for future development

## Implementation Schedule

1. Create DateTimeService and utility functions (1 day)
2. Update server-side components (1 day)
3. Update client-side components (1 day)
4. Testing and fixes (1 day)
5. Documentation (1 day)

## Expected Results

- Consistent date/time handling throughout the application
- Improved user experience with properly formatted dates
- Support for natural language date expressions
- Reduced code duplication for date parsing and formatting
- Centralized control over date/time formats and localization 