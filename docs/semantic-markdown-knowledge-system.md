# Semantic Markdown Knowledge System

This document describes the enhanced semantic markdown knowledge system implemented in Chloe. This system enables Chloe to use markdown files as a source of structured knowledge that can be semantically queried and kept up-to-date in real-time.

## Overview

The Semantic Markdown Knowledge System consists of the following components:

1. **Markdown Memory Loader** - Parses and loads markdown files into structured memory entries
2. **Markdown File Watcher** - Monitors markdown files for changes and updates memory in real-time
3. **Enhanced Memory Retrieval** - Allows querying memory by type and metadata
4. **Planning Integration** - Injects relevant markdown knowledge into planning
5. **Knowledge Graph Integration** - Connects markdown knowledge to the knowledge graph

## Architecture

### Phase A — Markdown-Based Semantic Memory Usage

The system allows Chloe to semantically access markdown-based knowledge in memory:

- **Memory Types**: Supports `STRATEGY`, `VISION`, `PROCESS`, `KNOWLEDGE`, and `PERSONA` types
- **Memory Retrieval**: Uses `getRelevantMemoriesByType` to query specific types of markdown knowledge
- **Planning Integration**: Injects structured knowledge into planning prompts, grouped by type
- **Task Metadata**: Tracks which knowledge types were used during planning

Key files:
- `src/agents/chloe/knowledge/markdownMemoryLoader.ts` - Loads markdown files as memory entries
- `src/agents/chloe/memory.ts` - Enhanced with type-based memory retrieval
- `src/agents/chloe/graph/nodes/planTaskNode.ts` - Updated to use semantic markdown knowledge

### Phase B — Real-time Memory Synchronization

Keeps markdown-based knowledge up-to-date automatically:

- **File Watcher**: Uses `chokidar` to monitor markdown files for changes
- **Change Detection**: Detects file additions, modifications, and deletions
- **Version Management**: Marks superseded memories when files are updated
- **CLI Tools**: Provides scripts for manual memory reload and clearing

Key files:
- `src/agents/chloe/knowledge/markdownWatcher.ts` - Watches and processes markdown file changes
- `scripts/reload-md-memory.ts` - CLI script for manual memory reload

### Phase C — Knowledge Graph Integration

The system connects markdown knowledge to Chloe's knowledge graph:

- **Entity Extraction**: Extracts concepts, sections, and relationships from markdown
- **Graph Nodes**: Creates nodes for files, sections, and concepts
- **Graph Edges**: Creates edges for hierarchical and semantic relationships
- **Concept Linking**: Connects concepts across different markdown files

Key files:
- `src/agents/chloe/knowledge/markdownGraphIntegration.ts` - Integrates markdown with knowledge graph

## Usage

### Creating Markdown Knowledge Files

Structure markdown files with frontmatter and sections:

```markdown
---
title: "Marketing Strategy"
type: "STRATEGY"
importance: "high"
tags: ["marketing", "strategy", "planning"]
---

# Overview

This document outlines our marketing strategy...

# Key Principles

1. Customer-centric approach
2. Data-driven decision making
3. Agile marketing process

# Quarterly Focus

Our focus this quarter is...
```

Supported frontmatter fields:
- `title` - The document title
- `type` - Memory type (STRATEGY, VISION, PROCESS, KNOWLEDGE, PERSONA)
- `importance` - Importance level (high, medium, low)
- `tags` - Array of tags for categorization
- `category` - Category for grouping
- `source` - Source of the information

### File Organization

Organize markdown files in the following directory structure:
- `data/knowledge/company/` - Company-level knowledge
- `data/knowledge/domains/` - Domain-specific knowledge
- `data/knowledge/agents/` - Agent-specific knowledge

### Manual Memory Management

Use the following commands for manual memory management:
- `npm run memory:reload-md` - Reload all markdown files into memory
- `npm run memory:reload-md:clear` - Clear and reload markdown memory

## Implementation Details

### Memory Entry Structure

Each markdown file is parsed into one or more memory entries with the following structure:

```typescript
interface MemoryEntry {
  id: string;
  content: string;
  category: string; // The memory type
  metadata: {
    title: string;
    filePath: string;
    source: string;
    tags: string[];
    importance: string;
  };
}
```

### Memory Retrieval Process

1. User initiates a task with a goal
2. `planTaskNode` calls `getRelevantMemoriesByType` with the goal
3. Memory system retrieves semantic matches for each type
4. Results are grouped by type and injected into planning prompt
5. Planning uses the structured knowledge to create better plans

### Watcher Implementation

The file watcher uses a caching mechanism to track file changes:
1. On startup, all markdown files are processed
2. When a file changes, its timestamp is compared with the cached version
3. If newer, the file is re-processed and old memories are marked as superseded
4. If deleted, associated memories are marked as deleted

## Future Enhancements

Potential improvements to the system:

1. **Advanced Metadata Extraction** - Use AI to extract more metadata automatically
2. **Cross-Reference Detection** - Identify and link related concepts across documents
3. **Usage Analytics** - Track which markdown knowledge is most frequently used
4. **Knowledge Gaps Identification** - Identify areas where markdown knowledge is missing
5. **Automated Knowledge Updates** - Allow Chloe to suggest updates to markdown files

## Conclusion

The Semantic Markdown Knowledge System provides a flexible, maintainable way to provide Chloe with structured knowledge. By using markdown files, the system combines the benefits of human-authored content with semantic retrieval and real-time updates. 