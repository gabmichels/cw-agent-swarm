# OpenRouter Integration Tests

This directory contains tests for the OpenRouter API integration, including tests for function/tool calling.

## Important: Functions vs Tools Format

OpenRouter requires the use of the newer Tools API format (`tools` and `tool_choice`) instead of the deprecated functions format (`functions` and `function_call`). 

We've implemented a patched version of `ChatOpenAI` in `apps/agents/shared/patched_chat_openai.py` that automatically converts between the formats. This ensures compatibility with LangChain's agent frameworks that might still use the older format.

## Key Files

- `patched_chat_openai.py`: Contains the patched ChatOpenAI class that converts functions to tools format
- `llm_router.py`: Uses the patched class for OpenRouter integration
- `test_tools_patched_agent.py`: Direct test of the patched agent
- `test_final_router.py`: Test of the full LLM router with the patch

## Running the Tests

To run tests, first activate the virtual environment:

```bash
.\venv\Scripts\activate.ps1
```

Then run individual tests:

```bash
python tests/llm/test_final_router.py
```

## Debugging API Issues

If you encounter OpenRouter API errors related to tools/functions, check:

1. The error message - if it mentions "functions and function_call are deprecated," it's likely related to this issue
2. Verify that all agent code is using the patched version through the LLM router
3. Run tests to isolate the issue 