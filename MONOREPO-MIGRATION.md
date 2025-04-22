# Monorepo to Single Package Migration

This project has been converted from a monorepo structure to a single package structure.

## Changes Made

1. **Consolidated Directory Structure**
   - All code is now in the `src` directory
   - Components in `src/components`
   - Application logic in `src/app`
   - Shared libraries in `src/lib`
   - Agent code in `src/agents`
   - Persona data in `src/persona`
   - Type definitions in `src/types`

2. **Dependency Management**
   - Removed workspace dependencies
   - All dependencies consolidated in a single `package.json`
   - Removed `pnpm-workspace.yaml`

3. **Import Paths**
   - Updated imports to use relative paths instead of package imports
   - For example: `import { ChloeAgent } from '@crowd-wisdom/agents-chloe'` is now `import { ChloeAgent } from '../agents/chloe'`

## How to Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Next Steps

- Ensure all agent and shared code is properly integrated
- Test functionality to ensure everything still works after migration
- Update any hardcoded paths that might still reference the old structure

## Removed Folders

The following folders can be safely deleted after migration:
- `apps/` - Moved to `src/app`
- `packages/` - Moved to `src/lib` and `src/agents`
- `.turbo/` - No longer needed for monorepo management
- `types/` - Moved to `src/types`
- `persona/` - Moved to `src/persona`
- `pnpm-workspace.yaml` - Removed as it's no longer a workspace
- `turbo.json` - No longer using Turborepo 