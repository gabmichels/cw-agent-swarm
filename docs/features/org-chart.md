# Organizational Chart Feature Implementation Plan

## Construction Prompt

**GOAL**: Implement an optional organizational chart system that allows visualization, planning, and management of agent departments and hierarchies, with capabilities to spawn agents from organizational templates and copy configurations. The system must gracefully support both organizational/company contexts and personal/individual use cases.

**CRITICAL REMINDER**: Follow all guidelines specified in `@IMPLEMENTATION_GUIDELINES.md` including:
- REPLACE, DON'T EXTEND legacy patterns
- Use ULID for all identifiers  
- STRICT TYPE SAFETY - no 'any' types
- Test-driven development with >95% coverage
- Interface-first design with dependency injection
- No placeholder implementations - aim for full implementations
- Performance-conscious implementation

---

## Feature Overview

The Organizational Chart feature will provide:
1. **Visual Organization Structure** - Interactive org chart showing departments and agents (when organizational mode is enabled)
2. **Planning Mode** - Drag-and-drop interface for reorganizing structure
3. **Agent Configuration Templates** - Save and reuse agent configurations (available in both modes)
4. **Agent Spawning** - Launch new agents from templates with copied configurations (available in both modes)
5. **Department Management** - Create, modify, and manage organizational departments (organizational mode only)
6. **Flexible Platform Modes** - Support for both organizational/company and personal/individual contexts

## Platform Modes

### Personal Mode (`PLATFORM_MODE=personal`)
- No organizational features (departments, hierarchies, reporting)
- Agents are simply categorized by functionality/purpose (e.g., "Finance", "Health", "Productivity")
- Simple agent templates and spawning capabilities
- Flat agent structure focused on individual use cases

### Organizational Mode (`PLATFORM_MODE=organizational`)
- Full organizational chart with departments and hierarchies
- Reporting relationships and management structures
- Team-based agent management
- Company-focused categorization and workflows

## Implementation Checklist

### Phase 1: Schema & Data Models
- [ ] **Platform Mode Configuration**
  - [ ] Add `PLATFORM_MODE` environment variable (personal|organizational)
  - [ ] Create configuration service to handle mode-specific logic
  - [ ] Add runtime mode detection and validation
  - [ ] Plan for future client-specific settings storage

- [ ] **Extend Agent Schema with Optional Organizational Properties**
  - [ ] Add `department?: string` to AgentMetadata interface (optional in personal mode)
  - [ ] Add `category?: string` for personal mode grouping (e.g., "Finance", "Health")
  - [ ] Add `position?: string` for job titles (organizational mode only)
  - [ ] Add `reportingTo?: StructuredId` for manager relationships (organizational mode only)
  - [ ] Add `managedAgents?: StructuredId[]` for direct reports (organizational mode only)
  - [ ] Add `organizationLevel?: number` for hierarchy depth (organizational mode only)
  - [ ] Update agent schema validation rules to be mode-aware

- [ ] **Create Organizational Data Models**
  - [ ] Define `Department` interface with ULID
  - [ ] Define `OrganizationChart` interface
  - [ ] Define `OrgHierarchyNode` interface
  - [ ] Define `AgentConfigTemplate` interface
  - [ ] Create comprehensive TypeScript types (no 'any' usage)

- [ ] **Database Schema Updates**
  - [ ] Create migration script for existing agents
  - [ ] Update Qdrant collections for organizational data
  - [ ] Create indexes for organizational queries
  - [ ] Implement validation constraints

### Phase 2: Core Services & Logic
- [ ] **Organization Service Implementation**
  - [ ] Create `OrganizationService` class with dependency injection
  - [ ] Implement department CRUD operations
  - [ ] Implement agent-department assignment logic
  - [ ] Implement hierarchy calculation algorithms
  - [ ] Add comprehensive error handling with custom error types

- [ ] **Agent Template System**
  - [ ] Create `AgentTemplateService` class
  - [ ] Implement configuration extraction from existing agents
  - [ ] Implement template storage and retrieval
  - [ ] Implement agent spawning from templates
  - [ ] Add validation for template integrity

- [ ] **Organizational Query Engine**
  - [ ] Implement efficient department lookups
  - [ ] Implement hierarchy traversal algorithms
  - [ ] Implement reporting relationship queries
  - [ ] Optimize query patterns for performance
  - [ ] Add caching layer for frequently accessed data

### Phase 3: Visualization Components
- [ ] **Extend Existing Visualization Infrastructure**
  - [ ] Create `OrgChartRenderer` extending `VisualizationRenderer`
  - [ ] Implement hierarchical layout algorithms (top-down tree)
  - [ ] Add department container nodes
  - [ ] Add individual agent nodes
  - [ ] Implement reporting relationship edges

- [ ] **Interactive Planning Interface**
  - [ ] Add drag-and-drop functionality for agents
  - [ ] Implement department creation via UI
  - [ ] Add visual feedback for proposed changes
  - [ ] Implement change preview and rollback
  - [ ] Add validation for organizational constraints

- [ ] **Node Customization & Styling**
  - [ ] Create department-specific visual themes
  - [ ] Add agent status indicators
  - [ ] Implement node size based on team size
  - [ ] Add agent photo/avatar support
  - [ ] Create responsive layout for different screen sizes

### Phase 4: User Interface Components
- [ ] **Mode-Aware UI Components**
  - [ ] Create conditional rendering based on platform mode
  - [ ] Design personal mode agent categorization interface
  - [ ] Design organizational mode hierarchical interface
  - [ ] Add mode indicator in dashboard header

- [ ] **Main Org Chart Page**
  - [ ] Create `/org-chart` route and page component (organizational mode)
  - [ ] Create `/agents` enhanced view for personal mode
  - [ ] Implement toolbar with planning mode toggle
  - [ ] Add export/import functionality
  - [ ] Integrate with existing dashboard layout
  - [ ] Add responsive design patterns

- [ ] **Planning Mode Interface**
  - [ ] Create planning mode toggle and controls
  - [ ] Implement change tracking and preview
  - [ ] Add bulk operations interface
  - [ ] Create confirmation dialogs for major changes
  - [ ] Add undo/redo functionality

- [ ] **Agent Configuration Panel**
  - [ ] Create template selection interface
  - [ ] Implement agent spawning form
  - [ ] Add configuration preview and validation
  - [ ] Create batch agent creation tools
  - [ ] Add template management interface

### Phase 5: API & Integration
- [ ] **REST API Endpoints**
  - [ ] `GET /api/organization/chart` - Fetch complete org chart
  - [ ] `POST /api/organization/departments` - Create department
  - [ ] `PUT /api/agents/{id}/department` - Assign agent to department
  - [ ] `GET /api/organization/templates` - List agent templates
  - [ ] `POST /api/organization/spawn-agent` - Create agent from template
  - [ ] `PUT /api/organization/apply-changes` - Apply planning changes

- [ ] **Integration with Existing Systems**
  - [ ] Update agent registry to include organizational data
  - [ ] Integrate with existing agent management APIs
  - [ ] Update dashboard to show organizational context
  - [ ] Add organizational filters to agent lists
  - [ ] Update monitoring to track organizational metrics

### Phase 6: Testing & Validation
- [ ] **Unit Tests (>95% Coverage)**
  - [ ] Test all service classes in isolation
  - [ ] Test organizational algorithms and calculations
  - [ ] Test template system functionality
  - [ ] Test error handling and edge cases
  - [ ] Test performance of critical operations

- [ ] **Integration Tests**
  - [ ] Test API endpoints with real data
  - [ ] Test UI component interactions
  - [ ] Test database operations and migrations
  - [ ] Test visualization rendering
  - [ ] Test drag-and-drop functionality

- [ ] **Performance Tests**
  - [ ] Benchmark org chart rendering with large datasets
  - [ ] Test query performance with complex hierarchies
  - [ ] Measure memory usage during operations
  - [ ] Test concurrent agent spawning
  - [ ] Validate caching effectiveness

### Phase 7: Documentation & Migration
- [ ] **API Documentation**
  - [ ] Document all public APIs with TypeScript docstrings
  - [ ] Create usage examples for common operations
  - [ ] Document error scenarios and handling
  - [ ] Add performance characteristics documentation

- [ ] **User Documentation**
  - [ ] Create user guide for org chart navigation
  - [ ] Document planning mode workflows
  - [ ] Create template system tutorials
  - [ ] Add troubleshooting guides

- [ ] **Migration & Deployment**
  - [ ] Create migration scripts for existing agents
  - [ ] Implement fallback strategies for missing data
  - [ ] Create deployment checklist
  - [ ] Plan rollback procedures

## Technical Specifications

### Data Models

```typescript
interface AgentMetadata extends BaseMetadata {
  // Existing properties...
  
  // Universal properties (both modes)
  category?: string; // For personal mode: "Finance", "Health", "Productivity"
  
  // Organizational properties (organizational mode only)
  department?: string; // For organizational mode: actual departments
  position?: string;
  reportingTo?: StructuredId;
  managedAgents?: StructuredId[];
  organizationLevel?: number;
}

interface PlatformConfig {
  mode: 'personal' | 'organizational';
  organizationName?: string; // Only for organizational mode
  personalUserName?: string; // Only for personal mode
}

interface Department {
  id: StructuredId;
  name: string;
  description?: string;
  parentDepartment?: StructuredId;
  headOfDepartment?: StructuredId;
  agents: StructuredId[];
  createdAt: Date;
  updatedAt: Date;
}

interface OrganizationChart {
  id: StructuredId;
  name: string;
  departments: Department[];
  hierarchy: OrgHierarchyNode[];
  lastUpdated: Date;
}

interface AgentConfigTemplate {
  id: StructuredId;
  name: string;
  description: string;
  sourceAgentId: StructuredId;
  capabilities: AgentCapability[];
  defaultDepartment?: string;
  defaultPosition?: string;
  configParams: Record<string, unknown>;
  createdAt: Date;
  createdBy: StructuredId;
}
```

### Performance Requirements

- **Org Chart Rendering**: < 2 seconds for organizations up to 1000 agents
- **Drag-and-Drop Response**: < 100ms for visual feedback
- **Agent Spawning**: < 5 seconds per agent
- **Department Queries**: < 500ms for complex hierarchy traversals
- **Template Operations**: < 1 second for template save/load

### Success Criteria

- [ ] Platform mode detection works correctly from environment variable
- [ ] Personal mode: Simple agent categorization without organizational complexity
- [ ] Organizational mode: Full org chart displays correctly for existing agents
- [ ] Planning mode allows drag-and-drop reorganization (both modes)
- [ ] Agent templates can be created and used to spawn new agents (both modes)
- [ ] UI gracefully adapts to the selected platform mode
- [ ] All operations maintain data integrity across both modes
- [ ] Performance meets specified requirements
- [ ] Test coverage exceeds 95%
- [ ] Full integration with existing dashboard and agent systems

## Risk Mitigation

1. **Legacy Data Migration**: Implement gradual migration with fallbacks for existing agents
2. **Performance at Scale**: Implement pagination and lazy loading for large agent counts
3. **UI Complexity**: Start with basic functionality, iterate based on feedback
4. **Integration Issues**: Maintain backward compatibility during transition
5. **User Adoption**: Provide comprehensive onboarding and documentation
6. **Mode Confusion**: Clear indicators and documentation about platform mode capabilities
7. **Feature Creep**: Maintain clear separation between personal and organizational features

## Future Enhancements

- **Setup Wizard**: Replace environment variable with initial setup wizard
- **Client-Specific Settings**: Store platform mode preference per client/organization
- **Hybrid Mode**: Allow personal users to optionally enable some organizational features
- **Import/Export**: Migrate between personal and organizational modes

---

*This document will be updated as implementation progresses. Check off completed items and update status as needed.* 