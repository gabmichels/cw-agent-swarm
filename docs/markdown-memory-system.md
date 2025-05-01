# Markdown Memory System

The Markdown Memory System allows Chloe to ingest and utilize structured knowledge from markdown files. This enhances Chloe's ability to reference knowledge documents, strategic guidance, and persona information during planning and reasoning.

## Features

- **Structured Memory Processing**: Parses markdown files into structured memory entries
- **YAML Frontmatter Support**: Extracts metadata from YAML frontmatter
- **Automatic Metadata Extraction**: Detects importance, tags, and categories
- **Section Splitting**: Breaks documents into sections by headers for finer-grained memory retrieval
- **Content Type Detection**: Automatically categorizes content based on file path and frontmatter
- **Enhanced Planning**: Provides relevant context for planning with source file information

## Memory Types

The system supports the following memory types:

- **Strategy**: High-level strategic guidance and approaches
- **Persona**: Information about Chloe's personality and behavior
- **Vision**: Vision statements and long-term objectives
- **Process**: Process documentation and workflows
- **Knowledge**: Domain-specific knowledge and information

## Using Markdown Files with Chloe

### File Organization

Markdown files should be organized in a structure like:

```
data/
└── knowledge/
    ├── company/
    │   ├── general/
    │   ├── strategy/
    │   ├── vision/
    │   └── process/
    ├── domains/
    │   └── [domain-specific-folders]/
    └── agents/
        └── [agent-specific-folders]/
```

### Frontmatter Format

You can include YAML frontmatter at the start of markdown files:

```yaml
---
title: Document Title
type: strategy|persona|vision|process|knowledge
importance: low|medium|high|critical
tags: [tag1, tag2, tag3]
---
```

### Section Headers

Use markdown headers (## and ###) to divide content into sections:

```markdown
## Section Title

Content for this section. You can include #hashtags which will be extracted as tags.
```

## How It Works

1. During Chloe's initialization, the `loadAllMarkdownAsMemory` function is called
2. All markdown files in the knowledge directory are found and processed
3. Each file is parsed into one or more memory entries based on sections
4. Memory entries are vectorized and stored in the memory system
5. When planning or answering questions, Chloe can retrieve relevant knowledge

## Integration with Planning

The planning system has been enhanced to use these structured memories:

- `getRelevantMemoriesByType`: Retrieves memories by type with source file information
- `planWithEnhancedContext`: Uses structured memories to create better plans

## Development

### Adding New Memory Types

To add new memory types:

1. Add the type to the `ChloeMemoryType` enum in `constants/memory.ts`
2. Update the `convertToBaseMemoryType` function in `memory.ts` if needed
3. Create appropriate markdown files with the new type

### Testing

Tests for the markdown memory system can be found in `tests/markdownMemoryLoader.test.ts`.

## Example Markdown File

```markdown
---
title: Marketing Strategy 2024
type: strategy
importance: high
tags: [marketing, strategy, 2024]
---

# Marketing Strategy 2024

Our marketing strategy for 2024 focuses on three key areas.

## Content Marketing

We will focus on creating high-quality content that establishes our expertise.

## Social Media

Our social media approach will emphasize community building and engagement.

## Analytics

We will implement comprehensive analytics to measure all marketing efforts.
``` 