# Agent Registration Implementation Plan

This document outlines the implementation plan for enhancing the agent registration process and ensuring proper utilization of registered data by agents.

## Claude Prompt Section

**IMPORTANT INSTRUCTIONS FOR CLAUDE:**

When implementing file attachment functionality for the chat/[id] endpoint, follow these guidelines:

0. Don't overengineer things

1. Adhere strictly to the IMPLEMENTATION_GUIDELINES.md principles, particularly:
   - Replace, don't extend legacy code patterns
   - Eliminate anti-patterns completely
   - Follow strict type safety (never use 'any' type)
   - Use interface-first design
   - Create smaller, modular files (<300 lines per file)

2. Implement in a modular fashion:
   - Create focused components with clear responsibilities
   - Use dependency injection for all components
   - Define interfaces before implementations
   - Break functionality into smaller, reusable services
   - Extract reusable logic from main page implementation

3. Prioritize performance:
   - Optimize image storage and retrieval
   - Create efficient thumbnails
   - Consider memory usage for large files
   - Reuse efficient patterns from main implementation

4. Ensure comprehensive error handling:
   - Create custom error types for file operations
   - Handle all edge cases (file too large, invalid type, etc.)
   - Provide helpful error messages to users
   - Learn from error handling in main implementation

## Agent Utilization

### Prompt Construction
- [x] Modify the DefaultAgent's prompt construction to include:
  - [x] System prompt / custom instructions
  - [x] Persona information (background, personality, communication style)
  - [x] Relevant context based on the query
- [x] Create a formatter that properly combines these elements into the prompt template
- [x] Add a messaging module to handle formatting conversation history with persona context

### Memory Retrieval
- [x] Enhance memory retrieval to prioritize critical memories from uploaded files
- [x] Implement relevance scoring to include appropriate memories in prompts
- [x] Add memory refreshing mechanism to periodically remind the agent of critical information

### Capability Integration
- [x] Update the agent's skill selection based on registered capabilities
- [x] Implement capability-aware tool selection
- [x] Add capability level awareness to decision-making processes

### Knowledge Path Integration
- [x] ~~Implement knowledge path scanning during agent initialization~~ (Removed - not needed)
- [x] ~~Create a periodic scanning service to update knowledge when files in paths change~~ (Removed - not needed)
- [x] ~~Add a mechanism to reference knowledge path information in responses~~ (Removed - not needed)

## Testing

- [ ] Create unit tests for capability storage and retrieval
- [ ] Add integration tests for the complete registration process
- [ ] Develop end-to-end tests for agent creation and subsequent operation
- [ ] Add performance tests for knowledge processing with large files


## Agent Registration Process

### Capability Management
- [x] Create a new `capabilities` collection in the database
- [x] Modify the API endpoint to store new custom capabilities in this collection when agents are registered
- [x] Update the `AgentCapabilityManager` component to load capabilities from the database instead of hardcoded values
- [x] Add capability deduplication to prevent duplicate entries in the collection
- [x] Add capability versioning to track changes to capabilities over time

### Persona Information Processing
- [x] Update the agent registration handler to properly store persona information (background, personality, communication style, preferences)
- [x] Ensure persona information is easily retrievable for prompt construction
- [x] Add validation for persona fields to ensure quality data

### System Prompt / Custom Instructions
- [x] Ensure system prompts are properly stored and associated with the agent
- [x] Create a retrieval mechanism for system prompts that makes them accessible during agent operation

### Knowledge Processing
- [x] Create a preprocessing step that runs when "Finalize Agent" is clicked
- [x] Process all uploaded markdown files:
  - [x] Extract content and store as critical memories for the agent
  - [x] Use tagExtractor to identify and extract tags from content
  - [x] Associate extracted tags with stored memories
- [x] Process all files in the selected knowledge paths:
  - [x] Scan directories for markdown files
  - [x] Extract content and store as critical memories
  - [x] Use tagExtractor for tag extraction
  - [x] Associate tags with stored memories

### Progress Tracking
- [ ] Add a processing indicator during agent finalization
- [ ] Create a detailed log of processing steps for debugging
- [ ] Add error handling for failed processing attempts

## Next Steps

After implementing the above plan, we should evaluate the effectiveness of the enhancements and consider additional improvements such as:

1. Dynamic capability learning during agent operation
2. Automated persona refinement based on feedback
3. Knowledge path prioritization based on usage patterns
4. System prompt evolution through agent self-modification 

## Current Implementation Status (Added Section)

- [x] Completed initial code exploration to understand existing architecture
- [x] Analyzed current capability management system
- [x] Created schema for capability storage
- [x] Implemented capability memory service
- [x] Added API endpoints for capability management
- [x] Updated agent registration to store capabilities in the database
- [x] Updated the AgentCapabilityManager component to load capabilities from the database
- [x] Created PromptFormatter to support system prompts and persona information
- [x] Updated DefaultAgent to use the PromptFormatter for enhanced prompts
- [x] Created RelevanceScorer to score and retrieve relevant memories for prompts
- [x] Enhanced DefaultAgent with memory refreshing mechanism for critical information
- [x] Updated DefaultAgent with capability-aware tool selection
- [x] ~~Implemented knowledge path scanning and processing during agent initialization~~ (Removed - not needed)
- [x] ~~Added watcher to monitor knowledge paths for changes and update agent memories~~ (Removed - not needed)
- [x] ~~Enhanced DefaultAgent to use knowledge from files in prompt construction~~ (Removed - not needed)
- [x] Updated agent registration handler to properly store persona information
- [x] Ensured system prompts are properly stored and accessible by agents
- [x] Implemented Knowledge Processing - Created KnowledgeProcessor to extract content from uploaded files and store as memories
- [x] Created API endpoint for processing knowledge files during agent finalization
- [ ] Next task: Progress Tracking - Add a processing indicator during agent finalization