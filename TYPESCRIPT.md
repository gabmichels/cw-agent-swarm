# TypeScript Strategy for Crowd Wisdom Employees

This document outlines the TypeScript strategy and configuration for the Crowd Wisdom Employees project.

## Project Structure

This is a monorepo with multiple packages using TypeScript. The TypeScript configuration is managed as follows:

- **Root `tsconfig.json`**: Contains shared settings and project references
- **`@crowd-wisdom/typescript-config`**: Base configurations that packages extend
- **Package-specific configs**: Each package has its own `tsconfig.json` extending from the base

## Current TypeScript Configuration

### Base Configuration (`packages/typescript-config/base.json`)

- Target: ES2022
- Module: NodeNext
- Strict type checking enabled
- Path aliases for package resolution

### Package-specific Configurations

Each package extends the base configuration and adds:

- `outDir`: For build outputs
- `rootDir`: Points to the source directory
- `paths`: For resolving cross-package imports

## Dealing with External Dependencies

Some packages have dependencies with incomplete or incorrect type definitions. We handle these in several ways:

1. Using `// @ts-ignore` comments for specific problematic imports
2. Using more permissive settings for build configurations
3. Separating type checking from build process

### Common "Cannot find module" Errors

When you encounter a "Cannot find module" error:

1. **External Packages**: 
   - Check if the package is in package.json
   - Run `pnpm install` to ensure it's installed
   - Add `skipLibCheck: true` to your tsconfig.json if needed

2. **Special cases**:
   - **Discord.js**: Already includes its own type definitions (no @types needed)
   - **@langchain/langgraph**: Import paths need special handling
   - **Internal packages**: May need to update path aliases or project references

3. **Use targeted ts-ignore**:
   ```typescript
   // @ts-ignore missing or incorrect type declarations
   import { SomeType } from 'problematic-package';
   ```

## Type Checking Strategy

We have multiple scripts for type checking:

- `pnpm check-types`: Runs type checking for all packages individually
- `pnpm typecheck`: Runs type checking at the monorepo level

## Known Issues and Future Improvements

1. **LangChain API Types**: Some API types from LangChain and LangGraph need better type definitions
2. **Path Aliases**: Improve consistency in import paths across packages
3. **TypeScript Project References**: Ensure all packages correctly reference their dependencies
4. **Discord.js and other external dependencies**: Improve integration with TypeScript

## Recommended Practices

1. Always run `pnpm check-types` before committing changes
2. Add proper type annotations to function parameters and return types
3. When using `any`, add a comment explaining why it's necessary
4. Use extension interfaces to augment third-party types when needed
5. Use proper error handling with unknown type and type narrowing:
   ```typescript
   try {
     // Code
   } catch (error: unknown) {
     const errorMessage = error instanceof Error ? error.message : String(error);
     console.error('Error:', errorMessage);
   }
   ```

## Future Work

1. Create more specific type definitions for shared message formats
2. Implement proper type definitions for the LangGraph API
3. Move toward stricter TypeScript settings as the project matures
4. Create a script that automatically installs missing type packages when needed 