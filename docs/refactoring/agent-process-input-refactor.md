# Agent Process Input Refactoring

## Implementation Guidelines

> SELF INSTRUCTION: This refactoring MUST strictly adhere to the principles in docs/refactoring/architecture/IMPLEMENTATION_GUIDELINES.md. Specifically:
> - Implement full functionality, NO placeholder implementations
> - Follow test-driven development practice - write tests first
> - Use strong typing throughout - NO 'any' types
> - Apply interface-first design - define interfaces before implementation
> - Use proper error handling with custom error types
> - Keep clean separation of concerns
> - Implement proper logging with structured data

## Problem Statement

Currently, the agent "thinking" logic is implemented within the API endpoint (`src/app/api/multi-agent/chats/[chatId]/messages/route.ts`) rather than within the agent itself. The current flow is:

1. User sends a message to `/api/multi-agent/chats/[chatId]/messages`
2. The messages route.ts performs preprocessing and "thinking" (lines ~398-550)
3. After preprocessing, route.ts calls `AgentService.processMessage()`
4. `AgentService.processMessage()` calls `/api/multi-agent/agents/[agentId]/process`
5. The process route.ts calls `agent.processInput()`

This creates several problems:
- Agent intelligence is split between API endpoint and agent class
- Testing requires going through API layers
- Can't reuse agent logic in other contexts (CLI, batch processing, etc.)
- API endpoints have too many responsibilities
- Multiple API calls for a single user request

## Solution Architecture

The refactored flow will be:

1. User sends a message to `/api/multi-agent/chats/[chatId]/messages`
2. The messages route.ts calls `agent.processUserInput()`
3. Inside the agent:
   - `processUserInput()` orchestrates the full pipeline
   - `think()` handles what was previously in route.ts (memory, context, thinking)
   - `getLLMResponse()` handles what was previously called `processInput` (LLM interaction)

The changes required are:

1. Rename the current `processInput` method to `getLLMResponse` in AgentBase
2. Create a new `think` method in AgentBase that implements the thinking logic from route.ts
3. Create a new `processUserInput` method in AgentBase that orchestrates the entire flow
4. Remove the redundant API endpoint calls
5. Move the thinking logic out of route.ts and into the agent

## Implementation Phases

### Phase 1: Method Definition in AgentBase
- [x] Define `processUserInput` method in AgentBase
- [x] Define `think` method in AgentBase
- [x] Rename current `processInput` to `getLLMResponse` in AgentBase
- [x] Create proper return types and parameter interfaces
- [x] Define error types for the agent processing flow

### Phase 2: Implementation in AgentBase
- [x] Implement `think` method with logic extracted from messages route.ts
- [x] Implement `processUserInput` as the orchestration method that calls both `think` and `getLLMResponse`
- [x] Add proper error handling and logging
- [x] Ensure all types are properly defined (no 'any')

### Phase 3: Testing
- [x] Write unit tests for the `think` method
- [x] Write unit tests for the `getLLMResponse` method
- [x] Write integration tests for the complete `processUserInput` flow
- [ ] Test error scenarios and edge cases
- [ ] Create performance tests for the critical paths

### Phase 4: API Endpoint Refactoring
- [x] Update messages route.ts to use the new agent `processUserInput` method
- [x] Remove duplicate thinking logic from the endpoint
- [x] Update error handling in the endpoint
- [x] Ensure proper context is passed to the agent
- [ ] Test the API endpoint with the refactored agent

### Phase 5: Documentation and Cleanup
- [x] Update API documentation
- [x] Create architecture documentation for the new flow
- [ ] Remove deprecated code
- [x] Clean up any remaining TODO comments
- [x] Verify all implementation guidelines are followed

## Implementation Details

### Current Flow Diagram
```
User → /chats/[chatId]/messages route.ts 
       → [thinking logic in route.ts]
       → AgentService.processMessage()
       → /agents/[agentId]/process route.ts
       → agent.processInput()
       → LLM call
```

### New Flow Diagram
```
User → /chats/[chatId]/messages route.ts
       → agent.processUserInput()
         → agent.think() [moved from route.ts]
         → agent.getLLMResponse() [renamed from processInput]
       → Return response
```

### Key Method Signatures

```typescript
// In AgentBase:

// New method that orchestrates everything
async processUserInput(
  message: string, 
  options: ProcessUserInputOptions
): Promise<AgentResponse> {
  // 1. Run thinking process (moved from route.ts)
  const thinkingResult = await this.think(message, options);
  
  // 2. Prepare enhanced options with thinking results
  const enhancedOptions = { ...options, thinkingResult };
  
  // 3. Get LLM response using the thinking context
  const llmResponse = await this.getLLMResponse(message, enhancedOptions);
  
  // 4. Return the complete response
  return llmResponse;
}

// New method containing thinking logic from route.ts
async think(
  message: string,
  options: ThinkOptions
): Promise<ThinkingResult> {
  // Implement thinking logic moved from route.ts
  // This includes memory retrieval, intent analysis, etc.
}

// Renamed from the current processInput
async getLLMResponse(
  message: string,
  options: GetLLMResponseOptions
): Promise<AgentResponse> {
  // This is the current processInput logic
  // It makes the actual LLM call
}
```

## Next Steps

1. ~~First, identify and extract all thinking-related logic from the messages route.ts~~
2. ~~Define the proper types for method parameters and return values in AgentBase~~
3. ~~Implement the new methods in AgentBase~~
4. ~~Update the message route.ts to use the new `processUserInput` method~~
5. ~~Test the full flow to ensure it works as expected~~
6. Complete the remaining test cases for error scenarios and edge cases
7. Test the API endpoint with the refactored agent
8. Clean up any deprecated code

## TODOs

### Remove Placeholders
- [x] Ensure ALL methods have full implementations (no placeholders)
- [x] Remove any FIXME or TODO comments that aren't immediately actionable
- [x] Convert any mock implementations to real ones

### Performance Considerations
- [x] Analyze and optimize memory usage in thinking process
- [ ] Consider caching strategies for repeated thinking patterns
- [x] Optimize LLM prompt construction to reduce token usage

### Error Handling
- [x] Create specific error types for thinking process failures
- [x] Implement structured logging for all errors
- [ ] Add telemetry for tracking thinking performance

### API Compatibility
- [x] Ensure backwards compatibility with existing client code
- [x] Properly document any breaking changes
- [ ] Consider versioning API endpoints during transition 