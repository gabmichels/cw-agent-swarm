# Type Safety Guide

This guide outlines our approach to maintaining complete type safety in the codebase.

## Core Principles

1. **No `any` Types**: Never use `any` type in new code. Use `unknown` instead when the type is truly indeterminate.
2. **Strong Interfaces**: Define clear interfaces for all data structures.
3. **Type Guards**: Use proper type guards to narrow types, especially when handling unknown data.
4. **Error Handling**: Always use `unknown` for error types in catch blocks.
5. **External Data**: Handle external data (API responses, file content) with proper type validation.

## Error Handling Best Practices

### Use `unknown` instead of `any` in catch blocks

```typescript
// ❌ Incorrect
try {
  // Code that might throw
} catch (error: any) {
  console.error(error.message); // Unsafe
}

// ✅ Correct
try {
  // Code that might throw
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
}
```

### Use the error handling utilities

We've created utilities in `src/lib/shared/errorHandling.ts` to handle errors consistently:

```typescript
import { logError, getErrorMessage } from '@/lib/shared/errorHandling';

try {
  // Code that might throw
} catch (error: unknown) {
  logError('Context for the error', error);
  return { success: false, message: getErrorMessage(error) };
}
```

### For API routes

```typescript
import { handleApiError } from '@/lib/shared/errorHandling';

export async function POST(req: Request) {
  try {
    // API route logic
  } catch (error: unknown) {
    const { error: errorMessage, status } = handleApiError(error, 'POST /api/endpoint');
    return Response.json({ error: errorMessage }, { status });
  }
}
```

## When Working with External Data

Always validate external data with Zod or similar libraries:

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number().optional()
});

type User = z.infer<typeof UserSchema>;

function processUserData(data: unknown): User {
  // This will throw if validation fails
  return UserSchema.parse(data);
}
```

## Handling `Record<string, unknown>` Types

When you need to access properties of a `Record<string, unknown>` object:

```typescript
// ❌ Incorrect
function getName(data: Record<string, unknown>): string {
  return data.name as string; // Unsafe cast
}

// ✅ Correct
function getName(data: Record<string, unknown>): string {
  if (typeof data.name === 'string') {
    return data.name;
  }
  throw new Error('Name is not a string');
}
```

## Type Assertion Best Practices

Use type assertions only when you can guarantee the type:

```typescript
// ❌ Avoid
const value = someValue as SomeType;

// ✅ Better
if (isSomeType(someValue)) {
  const value: SomeType = someValue;
}
```

## Maintaining Type Safety

1. Run TypeScript checks often with `npm run check-types`
2. Set up strict type checking in your IDE
3. Review PRs for type safety issues
4. Always add proper return types to functions
5. Document complex type logic with comments

## Type Safety Checklist for PRs

- [ ] No `any` types added
- [ ] Error handling uses `unknown` type
- [ ] External data is properly validated
- [ ] Type assertions are minimal and justified
- [ ] Return types are explicitly defined
- [ ] All interfaces are properly documented 