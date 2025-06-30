# Architecture Documentation - AI Assistant Instructions

## 📋 Purpose
Document the system architecture, design patterns, service architecture, and core implementation principles for the cw-agent-swarm platform.

## 🔍 What to Audit and Document

### Core Components to Investigate
1. **Implementation Guidelines Analysis** (`IMPLEMENTATION_GUIDELINES.md`)
   - Core principles and patterns currently in use
   - Service layer architecture and dependency injection patterns
   - Error handling hierarchy and patterns
   - Database patterns (Prisma, Qdrant, dual-ID strategy)
   - Testing requirements and patterns

2. **Service Architecture** (`src/services/`, `src/lib/`)
   - Service layer patterns and organization
   - Cross-system communication patterns
   - Integration patterns between services
   - Dependency injection implementation
   - Service lifecycle management

3. **Database Architecture** (`prisma/`, `src/lib/database/`)
   - Prisma schema patterns and conventions
   - Qdrant vector database integration
   - Dual-ID strategy (UUID/ULID) implementation
   - Migration strategies and patterns
   - Data validation and schema versioning

4. **Design Patterns** (throughout codebase)
   - Factory patterns for service creation
   - Provider patterns for integrations
   - Error handling patterns and hierarchy
   - Dependency injection patterns
   - Event handling patterns

### Key Questions to Answer
- What are the core architectural principles currently in use?
- How is the service layer organized and how do services communicate?
- What are the database patterns and how is data structured?
- What design patterns are consistently used across the codebase?
- How is error handling standardized across systems?
- What are the dependency injection patterns?

## 📁 Structure Guidelines

### Required Documents
- `README.md` - **CRITICAL**: Navigation hub for architecture documentation
- `core-principles.md` - Master reference file replacing IMPLEMENTATION_GUIDELINES.md
- `patterns/` - Design patterns used throughout the codebase
- `services/` - Service layer architecture and patterns
- `database/` - Database patterns and strategies
- `diagrams/` - System architecture diagrams

### README.md Requirements
Create a comprehensive navigation hub that includes:

```markdown
# Architecture Documentation

## 📋 Overview
System architecture, design patterns, and core implementation principles for the cw-agent-swarm platform.

## 📁 What's in This Folder

### 🎯 **Master Reference**
- [`core-principles.md`](./core-principles.md) - **START HERE**: Master implementation guidelines and principles

### 🏗️ **System Design**
- [`patterns/`](./patterns/) - Core design patterns and architectural patterns
- [`services/`](./services/) - Service layer architecture and communication patterns  
- [`database/`](./database/) - Database patterns, schemas, and data strategies
- [`diagrams/`](./diagrams/) - System architecture diagrams and visual documentation

## 🎯 Quick Start Guides

### For Developers
1. **Always start** with [`core-principles.md`](./core-principles.md) for implementation guidelines
2. Follow specific links to detailed patterns you need
3. Reference service-specific patterns in [`services/`](./services/)
4. Check database patterns in [`database/`](./database/) for data work

### For Architects
1. Review [`core-principles.md`](./core-principles.md) for architectural foundation
2. Examine [`patterns/`](./patterns/) for design pattern documentation
3. Study [`diagrams/`](./diagrams/) for system visualization
4. Reference [`services/`](./services/) for service architecture

## 🔍 Key Questions Answered
- What are the core architectural principles?
- How should services be structured and communicate?
- What are the standard design patterns?
- How is error handling standardized?
- What are the database patterns and strategies?

## 🔗 Related Documentation
- [`../standards/`](../standards/) - Code quality standards and patterns
- [`../systems/`](../systems/) - Individual system implementations
- [`../knowledge-base/decisions/`](../knowledge-base/decisions/) - Architecture Decision Records

## 📊 Implementation Status
- ⏳ Core Principles Migration - In Progress
- 📋 Design Patterns Documentation - Planned
- 📋 Service Architecture Documentation - Planned
- 📋 Database Patterns Documentation - Planned
```

### Core Principles File (core-principles.md)
This becomes the single source of truth that links to all other implementation guidelines:

```markdown
# Core Implementation Principles - Master Reference

**🎯 This is the main file to reference. It links to all other implementation guidelines.**

## Quick Reference Links
- [Design Patterns](./patterns/) - Core design patterns and architectural patterns
- [Service Architecture](./services/) - Service layer patterns and communication
- [Database Patterns](./database/) - Prisma, Qdrant, and data strategies
- [Error Handling](./patterns/error-handling.md) - Error handling hierarchy and patterns
- [TypeScript Standards](../standards/typescript/) - TypeScript patterns and conventions
- [Testing Requirements](../standards/testing/) - Testing standards and patterns

## Core Principles (Always Apply)
1. **Clean Break from Legacy Code** - REPLACE, DON'T EXTEND
2. **Test-Driven Development** - Tests before implementation  
3. **ULID/UUID Strategy** - [See detailed guide](./database/dual-id-strategy.md)
4. **Interface-First Design** - [See patterns](../standards/typescript/interface-design.md)
5. **Dependency Injection** - [See patterns](./patterns/dependency-injection.md)
6. **Error Handling Hierarchy** - [See patterns](./patterns/error-handling.md)

## Implementation Workflow
When implementing ANY feature:
1. Read this master file for overview
2. Follow links to specific guidelines you need
3. Cross-reference with system-specific documentation
4. Validate against testing standards and patterns

## Context-Aware Guidelines
Guidelines organized by what you're building:

### For Service Development
→ [Service Architecture](./services/) + [Dependency Injection](./patterns/dependency-injection.md)

### For Database Work  
→ [Database Patterns](./database/) + [Dual-ID Strategy](./database/dual-id-strategy.md)

### For Error Handling
→ [Error Patterns](./patterns/error-handling.md) + [TypeScript Error Types](../standards/typescript/error-types.md)

### For Testing
→ [Testing Standards](../standards/testing/) + [Service Testing](./patterns/service-testing.md)
```

## 🔗 Cross-References
When documenting architecture, reference:
- `standards/` - For code quality standards and patterns
- `systems/` - For system-specific implementations
- `knowledge-base/decisions/` - For Architecture Decision Records
- Current `IMPLEMENTATION_GUIDELINES.md` - For migration source

## 📊 Quality Standards
- All patterns must include working code examples
- Diagrams must reflect actual system implementation
- Cross-references must be accurate and current
- Examples must be tested and validated
- Migration from existing guidelines must preserve all critical information

## 🚀 **DELETE THIS FILE** after architecture documentation is complete and core-principles.md is populated! 