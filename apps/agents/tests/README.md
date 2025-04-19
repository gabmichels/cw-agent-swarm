# Agent Tests

This directory contains tests for various components of the agent system.

## Directory Structure

```
tests/
├── memory/           # Tests for the memory subsystem
│   ├── data/         # Test data for memory tests
│   ├── test_basic.py
│   ├── test_reflection.py
│   └── ...
├── notification/     # Tests for the notification subsystem
│   ├── integration_example.py
│   ├── test_simple.py
│   └── ...
├── perception/       # Tests for the perception subsystem
│   ├── test_query.py
│   ├── test_simple.py
│   └── ...
├── tools/            # Tests for the tools subsystem
│   ├── test_basic.py
│   ├── test_minimal.py
│   └── ...
└── run_tests.py      # Main test runner
```

## Running Tests

### Using the Test Runner

The `run_tests.py` script provides a unified way to run different groups of tests.

```bash
# Run all tests
python apps/agents/tests/run_tests.py --all

# Run all perception tests
python apps/agents/tests/run_tests.py perception --all

# Run simple perception tests
python apps/agents/tests/run_tests.py perception --simple

# Run notification integration test
python apps/agents/tests/run_tests.py notification --integration
```

### Running Individual Tests

Individual test files can also be run directly:

```bash
# Run a specific test file
python apps/agents/tests/perception/test_simple.py
```

## Test Categories

### Perception Tests

Tests for the perception subsystem, which allows agents to query and collect data from external sources.

### Memory Tests

Tests for the memory subsystem, which handles episodic memory and reflection capabilities.

### Notification Tests

Tests for the notification system, which handles Discord and other notification methods.

### Tools Tests

Tests for the tool subsystem, which provides various utilities for agents to interact with.

## Handling NumPy Issues on Windows

On Windows with Python 3.13+, you might encounter NumPy warnings or issues. To handle this:

1. For testing, the test runner automatically mocks the episodic_memory module
2. If running individual tests, you can add the following to your test script:

```python
import sys
from unittest.mock import MagicMock
sys.modules['apps.agents.shared.memory.episodic_memory'] = MagicMock()
sys.modules['apps.agents.shared.memory.episodic_memory'].store_memory = lambda *args, **kwargs: True
```

## Adding New Tests

When adding new tests:

1. Place the test in the appropriate subdirectory
2. Add a `main()` function if needed for standalone execution
3. Update `run_tests.py` if you want the test to be part of the test suite 