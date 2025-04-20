# Reflection System

This system provides tools for creating, storing, and retrieving reflections, with optional integration to Coda for cloud-based storage and sharing.

## Overview

The reflection system allows Chloe to:

1. Create and store reflections (general or weekly)
2. Search and retrieve reflections
3. Publish reflections to Coda (when configured)
4. Maintain local copies for backup and offline access

Reflections serve as a way for Chloe to document her insights, learnings, and regular reviews of her work. They help with knowledge consolidation and provide a valuable resource for both Chloe and her users.

## Configuration

The reflection system uses configuration from the global `config.py` module, which loads settings from the `.env` file.

### Environment Variables

Add these settings to your `.env` file:

```
# Coda Integration
CODA_API_KEY=your_coda_api_token_here
CODA_DOC_ID=your_coda_document_id
CODA_REFLECTION_TABLE_ID=your_table_id
CODA_WEEKLY_REFLECTION_BLOCK_ID=your_weekly_block_id
```

### Local Storage

Reflections are stored locally in JSON files at:
```
apps/agents/data/reflections/
```

This allows for backup and offline access, even when Coda is not available.

## Usage

### Creating Reflections

You can create reflections using the tools in `reflection_tool.py`:

```python
from apps.agents.shared.tools.reflection_tool import create_reflection, create_weekly_reflection

# Create a general reflection
result = create_reflection(
    content="My reflection content in markdown format",
    title="Optional Title",
    reflection_type="general",
    tags=["tag1", "tag2"],
    importance="medium",
    publish_to_coda=True
)

# Create a weekly reflection
result = create_weekly_reflection(
    content="My weekly reflection content",
    title="Optional Weekly Title",
    tags=["additional_tag1"]
)
```

### Retrieving Reflections

```python
from apps.agents.shared.tools.reflection_tool import get_recent_reflections, search_reflections

# Get recent reflections
recent = get_recent_reflections(limit=5)

# Search reflections
results = search_reflections(query="important topic", limit=10)
```

### CMO Tool Integration

The reflection system is integrated with Chloe's CMO tools, providing the following functions:

- `create_reflection`: Create a general reflection
- `create_weekly_reflection`: Create a weekly reflection
- `get_recent_reflections`: Retrieve recent reflections
- `search_reflections`: Search for reflections by query

## Coda Integration

When Coda integration is configured, reflections are:

1. Stored locally in JSON files
2. Published to a Coda document table
3. Available for browsing/searching through the Coda interface

The system will automatically fall back to local storage if Coda is unavailable.

## File Structure

- `reflection_tool.py`: Main module with tools for creating and retrieving reflections
- `coda_reflection_tool.py`: Utility functions for Coda integration
- `coda_client.py`: Low-level Coda API client
- `config.py`: Global configuration settings including Coda-related environment variables

## Testing

Use the test script to verify the reflection system functionality:

```bash
python apps/agents/tests/reflection/test_reflection_system.py
```

This test script checks the creation, retrieval, and search functionality, as well as Coda integration when available.

## Development

### Adding New Reflection Types

To add a new reflection type:

1. Create a new function in `reflection_tool.py` similar to `create_weekly_reflection`
2. Customize the metadata (type, tags, importance) for the new reflection type
3. Add a corresponding CMO tool function if needed

### Extending Coda Integration

To extend the Coda integration:

1. Add new fields or tables in your Coda document
2. Update the `coda_reflection_tool.py` functions to handle the new data structure
3. Update the environment variables in `.env` as needed 