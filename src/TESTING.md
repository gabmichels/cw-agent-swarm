# Testing with Vitest

This project uses [Vitest](https://vitest.dev/) for testing. Vitest is a modern, lightweight and fast testing framework powered by Vite.

## Running Tests

### Run all tests

```bash
npm test
```

### Run specific tests

```bash
npm test -- path/to/test/file.test.ts
```

### Run tests in watch mode

```bash
npm run test:watch
```

### Run tests with coverage

```bash
npm run test:coverage
```

## Writing Tests

### Test Structure

Tests should be organized in a `__tests__` directory or named with a `.test.ts` or `.spec.ts` suffix. Here's a basic test structure:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Component or Feature Name', () => {
  beforeEach(() => {
    // setup
  });

  afterEach(() => {
    // cleanup
  });

  it('should do something specific', () => {
    // test
    expect(result).toBe(expectedValue);
  });
});
```

### Mocking

Vitest provides tools for mocking:

```typescript
import { vi } from 'vitest';

// Mock a module
vi.mock('module-name', () => ({
  someFunction: vi.fn().mockReturnValue('mocked result')
}));

// Mock a function
const mockFn = vi.fn().mockImplementation(() => 'result');

// Spy on a method
const spy = vi.spyOn(object, 'method');
```

### Skipping Tests

You can skip tests with `.skip`:

```typescript
it.skip('test to skip', () => {
  // This test will be skipped
});

describe.skip('suite to skip', () => {
  // All tests in this suite will be skipped
});
```

### Running Only Specific Tests

You can focus on specific tests with `.only`:

```typescript
it.only('only run this test', () => {
  // Only this test will run
});

describe.only('only run this suite', () => {
  // Only tests in this suite will run
});
```

## Configuration

The Vitest configuration is in `vitest.config.ts` at the project root. This configures test matching patterns, exclusions, and other Vitest settings.

## Migrating from Jest

If you're familiar with Jest, Vitest has a very similar API. The main differences:

- Import from `vitest` instead of global functions
- Use `vi` instead of `jest` for mocks, spies, etc.
- Use ESM imports/exports

## Troubleshooting

### ESM/CommonJS Issues

If you encounter errors like:

```
Vitest cannot be imported in a CommonJS module using require()
```

Make sure you're using ESM syntax (`import` instead of `require`) in your test files and that your modules are properly configured for ESM. 