# Documentation Directory

This directory contains all documentation for the cw-agent-swarm project. The documentation is organized into several categories for easier navigation.

## Directory Structure

- **[architecture/](./architecture/)** - System architecture documentation
  - **[memory/](./architecture/memory/)** - Memory system design and architecture
  - **[system/](./architecture/system/)** - Core system architecture components
  - **[designs/](./architecture/designs/)** - Detailed design documents for key components 
    - [SCHEMA_VERSIONING_STRATEGY.md](./refactoring/architecture/designs/SCHEMA_VERSIONING_STRATEGY.md) - Schema validation and versioning

- **[code-standards/](./code-standards/)** - Coding guidelines and standards
  - [TYPESCRIPT.md](./code-standards/TYPESCRIPT.md) - TypeScript coding standards
  - [TYPE_SAFETY.md](./code-standards/TYPE_SAFETY.md) - Type safety best practices
  - [POWER_TOOLS.md](./code-standards/POWER_TOOLS.md) - Power tools usage guidelines

- **[memory/](./memory/)** - Memory subsystem documentation
  - Contains detailed documentation on memory operations, schemas, and integration
  - [SCHEMA_VALIDATION.md](./memory/SCHEMA_VALIDATION.md) - Schema validation system usage

- **[project-planning/](./project-planning/)** - Project planning documents
  - [ROADMAP.md](./project-planning/ROADMAP.md) - Project roadmap
  - [CLEANUP_PLAN.md](./project-planning/CLEANUP_PLAN.md) - Code cleanup plans
  - [MCP.md](./project-planning/MCP.md) - Master Control Program documentation

- **[refactoring/](./refactoring/)** - Refactoring project documentation
  - **[metadata/](./refactoring/metadata/)** - Metadata refactoring project
    - [METADATA_REFACTORING_PLAN.md](./refactoring/metadata/METADATA_REFACTORING_PLAN.md) - Detailed refactoring plan
    - [METADATA_REFACTORING_TRACKER.md](./refactoring/metadata/METADATA_REFACTORING_TRACKER.md) - Implementation tracking
    - [METADATA_STYLE_GUIDE.md](./refactoring/metadata/METADATA_STYLE_GUIDE.md) - Metadata coding style guide
    - [API_DOCUMENTATION.md](./refactoring/metadata/API_DOCUMENTATION.md) - API documentation

- **[reports/](./reports/)** - Status reports and summaries
  - [recap.md](./reports/recap.md) - Project recap information

## Main Documentation Topics

### Architecture

The architecture documentation provides a high-level overview of the system design, component interactions, and key architectural decisions.

### Memory System

The memory system documentation covers the design and implementation of the agent memory system, including storage, retrieval, and integration with other system components.

#### Schema Validation System

The schema validation system provides robust data validation with versioning capabilities:

- **Type-Safety**: Strong TypeScript integration with type predicates
- **Versioning**: Support for schema evolution with major/minor versioning
- **Migration**: Schema migration framework for data transformations
- **Validation**: JSON Schema-based validation with detailed error reporting

See [src/server/memory/schema/README.md](../src/server/memory/schema/README.md) for detailed usage guides.

### Refactoring Projects

Documentation for major refactoring initiatives, organized by project. Each refactoring project includes a plan, implementation tracker, and related resources.

### Coding Standards

Guidelines and best practices for coding in the project, ensuring consistency and quality across the codebase.

## Contributing to Documentation

When adding new documentation:

1. Place it in the appropriate subfolder based on its content
2. Follow naming conventions: use UPPERCASE_WITH_UNDERSCORES.md for guideline/standard documents
3. Update this README.md if adding a new major category
4. Consider linking to the documentation from related code files 