# Managing Dependencies in the Crowd Wisdom Employees Project

This document provides guidance on managing dependencies in the Crowd Wisdom Employees monorepo.

## Workspace-level vs Package-level Dependencies

In this pnpm monorepo:

- **Workspace-level dependencies** are installed in the root `package.json` with the `-w` flag
- **Package-level dependencies** are defined in each package's `package.json`

## Shared External Dependencies

Some dependencies are required by multiple packages. To ensure consistency, these are typically installed at the workspace level:

```bash
pnpm install <package-name> -w
```

Key shared dependencies include:

- **discord.js** - For Discord integrations
- **cron** - For scheduling tasks
- **zod** - For validation
- **tsup** - For building packages
- **langchain packages** - For AI/LLM functionality

## Missing Module Errors

If you encounter "Cannot find module" errors, follow these steps:

1. **Check if the package is listed in package.json**
   - If not, add it with `pnpm install <package-name>`

2. **Check if the package is installed**
   - At workspace level: `pnpm list <package-name> -w`
   - At package level: `cd packages/<package> && pnpm list <package-name>`

3. **Use ambient declarations**
   - For persistent module resolution issues, add an ambient declaration in `types/ambient-modules.d.ts`
   
## Type Issues with External Packages

For type issues with external packages:

1. **Use skipLibCheck**
   - Add `"skipLibCheck": true` to your tsconfig.json

2. **Use @ts-ignore comments**
   - Add `// @ts-ignore` comments for problematic imports

3. **Create a build-specific tsconfig**
   - Use a separate `tsconfig.build.json` with more relaxed settings

4. **Disable TypeScript declarations in tsup.config**
   - Set `dts: false` in your tsup.config.js or tsup.config.ts files
   - This prevents issues with TypeScript declaration files during build

5. **Create ambient type declarations**
   - Create basic type definitions in `types/ambient-modules.d.ts`
   - Use more detailed interfaces for frequently used APIs

## Common Dependencies and Their Versions

| Dependency | Current Version | Purpose |
|------------|----------------|---------|
| discord.js | 14.14.1 | Discord bot integration |
| cron | 3.1.6 | Scheduling tasks |
| zod | 3.22.4 | Runtime validation |
| @langchain/core | 0.3.39+ | LangChain core functionality |
| @langchain/openai | 0.5.6+ | OpenAI integration |
| @langchain/langgraph | 0.0.24+ | LangChain graph functionality |

## Build Tools

The project uses tsup for building packages, with:

- CommonJS and ESM output formats
- Source maps enabled
- TypeScript declarations disabled for problematic packages

Example tsup.config.ts:
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false, // Disabled for packages with dependency issues
  sourcemap: true,
  clean: true,
  onSuccess: 'echo "Build completed without type checking"',
});
```

## TypeScript Project References

To ensure the TypeScript project references work correctly:

1. Each package should have its own tsconfig.json
2. The root tsconfig.json includes references to all packages
3. For non-TypeScript packages like eslint-config, create a minimal tsconfig.json with `allowJs: true`

## Troubleshooting

1. **"Cannot find module" errors even after installation**
   - Create ambient type declarations
   - Check path aliases in tsconfig.json

2. **TypeScript build errors**
   - Try building with `pnpm tsup` which skips type checking
   - Update tsconfig.build.json with more relaxed settings
   - Disable TypeScript declarations generation in tsup.config

3. **Dependency version conflicts**
   - Check for conflicting versions with `pnpm why <package-name>`
   - Consider updating all related packages to compatible versions

4. **StateGraph API TypeScript errors**
   - Use more detailed ambient declarations
   - Add explicit type annotations in the code
   - Use `// @ts-ignore` comments for remaining errors 