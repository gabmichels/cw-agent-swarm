# Coda Implementation Plan for DefaultAgent

## 🎯 **OBJECTIVE**
Restore full Coda capabilities to DefaultAgent by properly integrating existing Coda tools with the new tool management system.

## 📋 **IMPLEMENTATION GUIDELINES REMINDERS**
- ✅ **REPLACE, DON'T EXTEND**: Clean implementation, no legacy compatibility layers
- ✅ **TEST-DRIVEN**: Write tests before implementing changes
- ✅ **STRICT TYPE SAFETY**: No 'any' types, proper interfaces
- ✅ **INTERFACE-FIRST**: Define interfaces before classes
- ✅ **NO PLACEHOLDER IMPLEMENTATIONS**: Full implementations only
- ✅ **KEEP IT SIMPLE**: Don't overengineer

## 🔍 **REFERENCE IMPLEMENTATIONS**
**IMPORTANT**: Use these working Chloe implementations as the source of truth for functionality:
- **Primary Reference**: `src/agents/chloe/tools/coda.ts` - Working Coda integration
- **Tool Implementations**: `src/agents/chloe/tools/index.ts` - CodaDocumentTool, ReActCodaDocumentTool
- **Workflow Support**: `src/agents/chloe/tools/codaWorkflow.ts` - LLM-powered workflows
- **Integration Layer**: `src/agents/shared/tools/integrations/coda/` - Reusable infrastructure

**API Keys**: Available in root `.env` file - `CODA_API_KEY` already configured for testing

---

## 🚀 **PHASE 1: IMMEDIATE FIXES (High Priority)**

### **Task 1.1: Fix Tool Registration System**
- [ ] **Remove Stubbed Registration** - Update `AgentInitializer.ts` line 427
  - [ ] Remove placeholder comment about "module doesn't exist"
  - [ ] Implement actual `registerSharedTools()` method
  - [ ] Add proper error handling for tool registration failures
  - [ ] **Reference**: Study how Chloe tools were registered in `src/agents/chloe/tools/index.ts`

### **Task 1.2: Create Coda Tool Adapters**
- [ ] **Create CodaToolAdapter** - Bridge existing tools to new system
  - [ ] File: `src/agents/shared/tools/adapters/CodaToolAdapter.ts`
  - [ ] Implement interface: `Tool` from new tool system
  - [ ] **Port functionality from**: `CodaDocumentTool`, `ReActCodaDocumentTool` in Chloe
  - [ ] **Preserve operations**: `list_documents`, `read_document`, `create_document`, `update`
  - [ ] Add proper typing and validation

### **Task 1.3: Update SharedToolRegistry**
- [ ] **Register Coda Tools** - Add to shared registry
  - [ ] Update `src/agents/shared/tools/registry/SharedToolRegistry.ts`
  - [ ] Add Coda tools to `registerDefaultTools()` method
  - [ ] Ensure proper categorization (`ToolCategory.DOCUMENT`)
  - [ ] **Copy cost estimates** from Chloe implementations
  - [ ] Add usage limits based on Coda API constraints

---

## 🔧 **PHASE 2: CORE IMPLEMENTATION (Medium Priority)**

### **Task 2.1: Test Coverage**
- [ ] **Create Integration Tests**
  - [ ] File: `src/tests/tools/coda-integration.test.ts`
  - [ ] **Test scenarios from**: Existing test in `src/tests/autonomy/real-tool-integration.test.ts`
  - [ ] Test document creation, reading, updating (mirror Chloe functionality)
  - [ ] Test error scenarios (invalid API key, network failures)
  - [ ] Test with DefaultAgent end-to-end
  - [ ] **Use .env CODA_API_KEY** for real API testing
  - [ ] Achieve >95% coverage

### **Task 2.2: Enhanced Tool Implementation**
- [ ] **Create Enhanced Coda Tools**
  - [ ] File: `src/agents/shared/tools/implementations/CodaTools.ts`
  - [ ] **Port and enhance** `CodaDocumentTool` operations from Chloe
  - [ ] Implement `CreateCodaDocumentTool` with new interface
  - [ ] Implement `ReadCodaDocumentTool` with new interface
  - [ ] Implement `UpdateCodaDocumentTool` with new interface
  - [ ] Implement `ListCodaDocumentsTool` with new interface
  - [ ] **Preserve input formats**: `action|title|content` pattern from Chloe

### **Task 2.3: Configuration Management**
- [ ] **Coda Configuration Schema**
  - [ ] File: `src/agents/shared/tools/config/CodaToolsConfigSchema.ts`
  - [ ] Define validation schema for Coda settings
  - [ ] **Reference .env setup** from root folder
  - [ ] Include API key validation
  - [ ] Add timeout and retry configurations

---

## 🏗️ **PHASE 3: ADVANCED FEATURES (Lower Priority)**

### **Task 3.1: ReAct Pattern Support**
- [ ] **Restore ReAct Workflows**
  - [ ] File: `src/agents/shared/tools/workflows/CodaWorkflow.ts`
  - [ ] **Port from**: `src/agents/chloe/tools/codaWorkflow.ts`
  - [ ] **Port from**: `ReActCodaDocumentTool` and `createCodaDocumentFromContent`
  - [ ] Implement enhanced document creation with LLM
  - [ ] **Preserve auto-titling** logic from Chloe implementation
  - [ ] Support multi-step document operations

### **Task 3.2: Tool Orchestration**
- [ ] **Complex Coda Operations**
  - [ ] **Study Chloe's** `CodaDocumentWorkflow` class
  - [ ] Implement document templates
  - [ ] Add batch operations support
  - [ ] Create document linking workflows
  - [ ] Support collaborative document creation

### **Task 3.3: Performance Optimization**
- [ ] **Caching and Performance**
  - [ ] Implement document metadata caching
  - [ ] Add rate limiting for API calls
  - [ ] Optimize for large document operations
  - [ ] Add metrics collection

---

## 🧪 **TESTING STRATEGY**

### **Unit Tests**
- [ ] Test each tool adapter individually
- [ ] Mock Coda API for consistent testing
- [ ] Test error handling and edge cases
- [ ] **Reference**: Existing Chloe test patterns
- [ ] Verify type constraints

### **Integration Tests**
- [ ] **Use root .env CODA_API_KEY** for real API testing
- [ ] Test DefaultAgent processing Coda requests
- [ ] **Replicate test scenarios** from `real-tool-integration.test.ts`
- [ ] Test tool fallback mechanisms
- [ ] Verify end-to-end workflows

### **Performance Tests**
- [ ] Benchmark document creation speed
- [ ] Test with large documents (>1MB)
- [ ] Measure memory usage patterns
- [ ] Test concurrent operations

---

## 📁 **FILE STRUCTURE**

```
src/agents/shared/tools/
├── adapters/
│   └── CodaToolAdapter.ts          # ✅ Bridge to new system
├── implementations/
│   └── CodaTools.ts               # ✅ Enhanced tool implementations
├── workflows/
│   └── CodaWorkflow.ts            # ✅ ReAct pattern workflows
├── config/
│   └── CodaToolsConfigSchema.ts   # ✅ Configuration validation
└── registry/
    └── SharedToolRegistry.ts      # ✅ Updated registration

tests/tools/
└── coda-integration.test.ts       # ✅ Comprehensive tests

## REFERENCE FILES (DO NOT MODIFY - FOR STUDY ONLY)
src/agents/chloe/tools/
├── coda.ts                        # 🔍 Primary reference
├── index.ts                       # 🔍 Tool implementations
└── codaWorkflow.ts               # 🔍 Workflow patterns
```

---

## 🎯 **SUCCESS CRITERIA**

### **Functional Requirements**
- [ ] **Match Chloe functionality**: All operations that worked in Chloe work in DefaultAgent
- [ ] DefaultAgent can create Coda documents via natural language
- [ ] DefaultAgent can read and summarize Coda documents  
- [ ] DefaultAgent can update existing Coda documents
- [ ] DefaultAgent can list and search Coda documents
- [ ] **Preserve input formats**: `action|title|content` pattern from Chloe
- [ ] All operations work through thinking → tool execution → response flow

### **Quality Requirements**
- [ ] >95% test coverage for Coda-related code
- [ ] Zero TypeScript 'any' types in implementation
- [ ] Proper error handling for all failure scenarios
- [ ] **Performance targets**: Match or exceed Chloe performance
- [ ] Memory usage: <50MB for typical operations

### **Integration Requirements**
- [ ] Works with existing DefaultAgent architecture
- [ ] Integrates with ToolManager and SharedToolRegistry
- [ ] Supports tool fallback mechanisms
- [ ] **Compatible with existing APIs**: All 11 Coda API endpoints still functional
- [ ] **Uses .env configuration**: CODA_API_KEY from root folder

---

## 🚨 **IMPLEMENTATION NOTES**

### **Key Principles**
1. **Study First**: Analyze working Chloe implementations before coding
2. **Port, Don't Recreate**: Use proven functionality as foundation
3. **Type Safety**: Every operation strongly typed with proper interfaces
4. **Error Handling**: Comprehensive error scenarios with structured context
5. **Testing**: Test-driven development with high coverage

### **Critical References**
- **`src/agents/chloe/tools/coda.ts`**: Complete Coda API wrapper
- **`src/agents/chloe/tools/index.ts`**: Tool implementations and patterns
- **`src/agents/chloe/tools/codaWorkflow.ts`**: LLM integration workflows
- **Root `.env`**: API key configuration (`CODA_API_KEY`)

### **Risk Mitigation**
- **Start with working code**: Port from Chloe rather than rebuild
- Test with mock API first, then real API using .env key
- Implement graceful degradation for API failures
- Add comprehensive logging for debugging
- Use feature flags for gradual rollout

### **Dependencies**
- Existing `DefaultCodaIntegration` (✅ Available)
- **Chloe Coda implementations** (✅ Working reference)
- Coda API endpoints (✅ Available)
- **Root .env CODA_API_KEY** (✅ Configured)
- SharedToolRegistry system (⚠️ Needs enhancement)
- DefaultAgent ToolManager (✅ Available)

---

## 📊 **PROGRESS TRACKING**

**Phase 1 Progress:** 0/3 tasks complete  
**Phase 2 Progress:** 0/3 tasks complete  
**Phase 3 Progress:** 0/3 tasks complete  

**Overall Progress:** 0% complete

**Next Action:** Start with Task 1.1 - Fix Tool Registration System
**Study First:** Review `src/agents/chloe/tools/coda.ts` and `index.ts` for working patterns 