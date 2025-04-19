# Chloe AI Test Suite

This directory contains test files for the Chloe AI system, organized by functionality.

## Test Organization

- `llm/`: Tests for the LLM router and OpenRouter integration
- `memory/`: Tests for the memory system
- `db/`: Tests for database integrations (Chroma, etc.)
- `general/`: General utility tests

## Running Tests

Most test files are self-contained and can be run directly with Python:

```bash
# Activate the virtual environment first
.\venv\Scripts\activate.ps1

# Run a specific test
python tests/llm/test_openrouter_fixed.py

# Run test_router.py for LLM routing 
python tests/llm/test_router.py
```

## Environment Setup

All tests require environment variables to be loaded from `apps/hq-ui/.env`. 
This file should contain your API keys:

```
OPENAI_API_KEY=your-openai-key
OPENROUTER_API_KEY=your-openrouter-key
```

## Contributing New Tests

When adding new tests:
1. Place them in the appropriate subdirectory
2. Use the prefix `test_` for the filename
3. Add docstrings at the beginning of the file explaining what it tests
4. Make tests self-contained when possible 