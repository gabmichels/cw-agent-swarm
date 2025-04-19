# Project Tests

This directory contains tests for various aspects of the project.

## Directory Structure

```
tests/
├── debug/           # Debug and troubleshooting utilities
│   ├── test_file_output.py
│   ├── test_response.py
│   ├── test_quick.py
│   └── troubleshoot_chloe.py
├── models/          # Tests for model integrations
│   ├── test_basic.py
│   ├── test_perception.py
│   ├── test_chat_history.py
│   ├── test_response_fix.py
│   └── test_badge_fix.py
├── openrouter/      # Tests for OpenRouter API integration
│   ├── test_basic.py
│   ├── test_fixed.py
│   └── test_local.py
└── README.md        # This file
```

## Running Tests

Individual test files can be run directly:

```bash
# Run a specific test file
python tests/models/test_basic.py
```

## Test Categories

### Models Tests

Tests for the model integrations and API interactions.

### Debug Tests

Debugging and troubleshooting utilities for working with the system.

### OpenRouter Tests

Tests specifically for the OpenRouter API integration.

## Adding New Tests

When adding new tests:

1. Place the test in the appropriate subdirectory
2. Add a `main()` function if needed for standalone execution
3. Follow the naming convention: `test_<what_is_being_tested>.py`

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