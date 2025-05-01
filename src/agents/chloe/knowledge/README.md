# Chloe's Markdown Knowledge System

This module enables Chloe to semantically process and understand markdown files as structured memory.

## Overview

Chloe now automatically loads and processes markdown files from multiple sources:

- Existing Chloe agent information
- Company strategy and vision documents
- Domain-specific knowledge

The system intelligently scans these directories:
- `/data/knowledge/company/` - Company strategy, vision, etc.
- `/data/knowledge/domains/` - Domain-specific knowledge
- `/data/knowledge/agents/` - Other agent personas and capabilities
- The Chloe directory itself - For Chloe-specific information

These files are parsed, split into sections by headers, and vectorized in Qdrant for semantic search.

## Features

1. **Structured Memory Creation**
   - Parses `.md` files and converts them into structured memory entries
   - Extracts metadata from frontmatter (YAML headers)
   - Splits content by headers (##, ###) for granular retrieval

2. **Semantic Categorization**
   - Automatically categorizes content based on folder structure and content
   - Recognizes standard paths like `/company/general/` and `/chloe/`
   - Assigns importance levels based on content keywords or explicit metadata
   - Extracts hashtags from content for additional tagging

3. **Memory System Integration**
   - Stores parsed content as vectorized document memories
   - Uses custom metadata for filtering during retrieval
   - Enhances planning prompts with relevant knowledge

4. **Customizable Metadata**
   - `title`: Document title (defaults to filename)
   - `tags`: Array of tags for classification
   - `importance`: Priority level (low, medium, high, critical)
   - `type`: Override the auto-detected type (strategy, vision, process, persona, knowledge)

## Usage

### Creating Knowledge Files

Add markdown files to the appropriate directories or use the existing structure:

```
data/knowledge/
├── company/
│   ├── general/
│   │   └── strategy.md
│   └── vision/
│       └── vision_2025.md
├── domains/
│   ├── marketing/
│   │   └── content_strategy.md
│   └── sales/
│       └── pipeline.md
└── agents/
    └── assistant.md

src/agents/chloe/
└── [various markdown files with Chloe information]
```

### Markdown Format

Files should include:

```markdown
---
title: Document Title
tags: [tag1, tag2]
importance: high
type: strategy  # Optional: override auto-detection
---

# Main Title

Content goes here.

## Section Title

More content.

### Subsection

Even more content.
```

### Retrieval API

To retrieve relevant knowledge in your code:

```typescript
// Get knowledge relevant to a specific query
const memories = await memory.getRelevantMemories(
  "marketing strategy", 
  5, 
  [ChloeMemoryType.STRATEGY, ChloeMemoryType.VISION]
);
```

## Implementation Details

The system is implemented in:
- `src/agents/chloe/knowledge/markdownMemoryLoader.ts` - Main loader and parser
- `src/agents/chloe/core/agent.ts` - Integration with boot sequence
- `src/agents/chloe/core/planningManager.ts` - Integration with planning 