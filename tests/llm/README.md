# OpenRouter Integration Tests

This directory contains tests for the OpenRouter API integration, including tests for function/tool calling.

## Important: Tools Format Required

OpenRouter requires the use of the newer Tools API format (`tools` and `tool_choice`) instead of the deprecated functions format (`functions` and `function_call`). 

We've updated our codebase to use `create_openai_tools_agent` instead of `create_openai_functions_agent` to ensure proper compatibility with OpenRouter's API requirements.

## Key Files

- `llm_router.py`: Handles routing to appropriate LLM providers with proper configuration
- `test_openrouter_tools.py`: Tests OpenRouter with tools-based agent
- `test_openrouter_simple.py`: Simple test of direct OpenRouter interaction
- `test_tools_patched_agent.py`: Tests the tools-based approach with agents

## Running the Tests

To run tests, first activate the virtual environment:

```bash
.\venv\Scripts\activate.ps1
```

Then run individual tests:

```bash
python tests/llm/test_openrouter_tools.py
```

## OpenRouter Response Format

OpenRouter returns responses in this format:

```json
{
  "id": "gen-12345",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "The content of the response..."
      }
    }
  ]
}
```

When using tool calling, the `finish_reason` will be "tool_calls" and you need to process the response appropriately.

## Debugging API Issues

If you encounter OpenRouter API errors, check:

1. The error message - if it mentions "functions and function_call are deprecated," ensure you're using tools-based approach
2. Verify that all agent code is using `create_openai_tools_agent` 
3. Check that response parsing properly handles the OpenRouter format
4. Examine debug logs for the specific error 