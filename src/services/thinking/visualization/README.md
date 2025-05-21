# Thinking Visualization System

## Overview

The thinking visualization system provides a graphical representation of the agent's thinking processes. It enables users to understand how the agent processes requests, makes decisions, and generates responses.

## Architecture

The visualization system consists of the following components:

1. **ThinkingVisualizer** - The main service that creates and manages visualizations
2. **VisualizationTypes** - TypeScript types and interfaces for the visualization data model
3. **VisualizationStorage** - Interface for persistent storage of visualizations (future implementation)

## Important Note on Architecture

**Visualizations are NOT memories.** While visualizations may reference memories and thinking processes that are stored in the memory system, the visualizations themselves are a separate concept with their own dedicated storage and retrieval mechanisms.

- ✅ Visualizations represent the thinking process graph 
- ✅ Visualizations may reference memories (via IDs)
- ❌ Visualizations should NOT be stored as memories
- ❌ Visualizations should NOT be treated as a memory type

## Current Implementation

Currently, visualizations are stored in an in-memory Map. This is a temporary solution until the dedicated persistence layer is implemented.

## Future Implementation

A dedicated visualization storage service will be implemented in `visualization-storage.ts`. This service will:

1. Store visualizations in a dedicated database collection (not part of the memory system)
2. Provide efficient indexing and querying by chat, message, user, and agent IDs
3. Support retrieval of visualization graphs for UI rendering

## Usage Guidelines

When adding new agent capabilities that should be visualized:

1. Add appropriate calls to ThinkingVisualizer in your code
2. Use the existing node types or add new ones if needed
3. Reference memories by ID only, don't embed entire memories in visualizations
4. Follow the established node/edge pattern for representing thinking processes 