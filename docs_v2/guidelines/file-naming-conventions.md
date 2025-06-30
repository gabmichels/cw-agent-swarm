# File Naming Conventions

## 📋 Overview
Standardized file naming conventions for docs_v2 that prioritize clarity, consistency, and efficient LLM navigation.

## 🎯 Core Principles

### 1. **The "What" Principle**
File names must clearly reveal WHAT the content is about:
- ✅ `error-handling-patterns.md` (tells you exactly what's inside)
- ❌ `patterns.md` (too vague)
- ✅ `social-media-posting-flow.md` (specific UX flow)
- ❌ `flow.md` (unclear which flow)

### 2. **Kebab-Case Standard**
Use kebab-case (lowercase with dashes) for all files except README:
- ✅ `service-layer-architecture.md`
- ✅ `dual-id-strategy.md`
- ✅ `workspace-provider-integration.md`
- ❌ `ServiceLayerArchitecture.md`
- ❌ `service_layer_architecture.md`

### 3. **README Exception**
README files are always `README.md` (uppercase):
- ✅ `README.md` 
- ❌ `readme.md`
- ❌ `read-me.md`

## 📁 File Type Patterns

### **Architecture Documents**
```
Pattern: {domain}-{aspect}.md
Examples:
- service-layer-architecture.md
- error-handling-patterns.md
- dependency-injection-guide.md
- database-migration-strategy.md
```

### **Implementation Guides**
```
Pattern: {action}-{target}.md
Examples:
- creating-new-service.md
- implementing-oauth-provider.md
- adding-tool-integration.md
- deploying-to-production.md
```

### **Flow Documentation**
```
Pattern: {system}-{flow-type}-flow.md
Examples:
- user-input-processing-flow.md
- social-media-posting-flow.md
- memory-retrieval-flow.md
- workspace-connection-flow.md
```

### **Standards and Guidelines**
```
Pattern: {technology}-{aspect}.md
Examples:
- typescript-coding-standards.md
- react-component-patterns.md
- testing-best-practices.md
- api-design-guidelines.md
```

### **System Documentation**
```
Pattern: {system}-{component}.md
Examples:
- agent-manager-architecture.md
- tool-discovery-system.md
- memory-storage-patterns.md
- workspace-integration-guide.md
```

### **Initiative Documentation**
```
Pattern: {initiative-type}-{name}.md
Examples:
- feature-deep-research-prd.md
- refactor-unified-tools-plan.md
- integration-microsoft-365-guide.md
- infrastructure-monitoring-setup.md
```

## 🗂️ Folder Naming

### **Main Folders**
Use kebab-case for compound words:
- ✅ `knowledge-base/`
- ✅ `ux-flows/`
- ❌ `knowledgebase/`
- ❌ `ux_flows/`

### **Subfolders**
Follow same kebab-case pattern:
- ✅ `core-flows/`
- ✅ `user-journeys/`
- ✅ `interaction-patterns/`
- ✅ `architecture-decisions/`

## 📝 Content-Specific Naming

### **UX Flow Files**
```
Core Flows:
- user-input-processing.md
- tool-routing-discovery.md
- memory-retrieval.md
- agent-communication.md
- workspace-integration.md
- social-media-posting.md
- error-handling-flow.md

User Journeys:
- new-user-onboarding.md
- workspace-setup.md
- content-creation-workflow.md
- automation-setup.md

Interaction Patterns:
- approval-workflows.md
- notification-patterns.md
- real-time-updates.md
- error-states.md
```

### **Architecture Files**
```
Patterns:
- dependency-injection.md
- service-layer.md
- error-handling.md
- provider-patterns.md
- factory-patterns.md

Services:
- service-layer-guide.md
- integration-patterns.md
- cross-system-communication.md

Database:
- dual-id-strategy.md
- prisma-patterns.md
- qdrant-integration.md
- migration-strategies.md
```

### **Standards Files**
```
TypeScript:
- typing-patterns.md
- interface-design.md
- error-types.md
- testing-patterns.md

Naming:
- file-naming.md (this file)
- class-naming.md
- variable-naming.md
- constant-naming.md

Testing:
- unit-testing.md
- integration-testing.md
- e2e-testing.md
- test-data-management.md
```

## 🚫 What to Avoid

### **Vague Names**
- ❌ `guide.md` → ✅ `workspace-integration-guide.md`
- ❌ `patterns.md` → ✅ `error-handling-patterns.md`
- ❌ `setup.md` → ✅ `development-environment-setup.md`

### **Abbreviations**
- ❌ `db-patterns.md` → ✅ `database-patterns.md`
- ❌ `auth-guide.md` → ✅ `authentication-guide.md`
- ❌ `config.md` → ✅ `configuration-guide.md`

### **Version Numbers in Names**
- ❌ `api-v2-guide.md` → ✅ `api-integration-guide.md`
- ❌ `service-layer-v3.md` → ✅ `service-layer-architecture.md`

### **Inconsistent Casing**
- ❌ `ServiceLayer.md`
- ❌ `service_layer.md`
- ❌ `Service-Layer.md`
- ✅ `service-layer-architecture.md`

## 🔄 Migration Actions Needed

### **Current Files to Rename**
```
docs_v2/standards/:
- TYPESCRIPT.md → typescript-coding-standards.md
- TYPE_SAFETY.md → typescript-type-safety.md  
- POWER_TOOLS.md → development-tools-guide.md

docs_v2/architecture/:
- _PROMPT_INSTRUCTIONS.md → DELETE after use (temporary scaffolding)
```

### **Future File Creation**
All new files must follow these conventions from creation.

## 🎯 Benefits

### **For LLM Navigation**
- File names immediately reveal content scope
- Predictable naming patterns aid in file discovery
- Consistent structure improves cross-referencing

### **For Developers**
- No guessing what files contain
- Easy to find specific information
- Consistent patterns reduce cognitive load

### **For Maintenance**
- Clear naming prevents duplicate content
- Easy to identify outdated or misplaced files
- Consistent structure aids in reorganization

---

## 📋 Quick Reference

### **Standard Pattern**
`{domain}-{specific-aspect}.md`

### **Examples by Type**
- **Architecture**: `service-layer-architecture.md`
- **Implementation**: `creating-oauth-provider.md`
- **Flow**: `user-input-processing-flow.md`
- **Standards**: `typescript-coding-standards.md`
- **Guide**: `workspace-integration-guide.md`

### **Always Ask**
1. Does the filename clearly describe WHAT is inside?
2. Is it kebab-case (except README)?
3. Is it specific enough to be unique?
4. Does it follow the established patterns?

---

*These naming conventions ensure our documentation is discoverable, navigable, and maintainable.* 