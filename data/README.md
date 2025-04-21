# Data Directory

This directory contains static data files used by the agents in the system. This includes:

- Training data
- Initial memory documents
- Configuration files
- Other static resources

## Structure

- `memory/` - Initial memory for agents
- `config/` - Configuration files
- `resources/` - Shared resources

## Usage

Data in this directory is designed to be read by the `@crowd-wisdom/data` package,
which provides utilities for loading and interacting with these files in a
structured way.

```typescript
import { loadMemoryData } from '@crowd-wisdom/data';

// Load initial memory for Chloe
const chloeMemory = await loadMemoryData('chloe');
``` 