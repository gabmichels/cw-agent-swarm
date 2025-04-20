# API Migration: OpenAI → OpenRouter

## Overview

This project has been migrated to exclusively use OpenRouter for API access, replacing direct OpenAI API access. 
This document describes the changes made and how to update your configuration.

## Changes Made

1. **Environment Variables**:
   - Removed all references to `OPENAI_API_KEY`
   - Now only using `OPENROUTER_API_KEY` for authentication

2. **LLM Router**:
   - Updated the LLM router to exclusively use OpenRouter
   - Removed fallback logic for OpenAI
   - Updated error messages and documentation

3. **Documentation**:
   - Updated README files to only mention OpenRouter API keys
   - Simplified Docker configuration examples

4. **Tests**:
   - Updated all test files to use OpenRouter
   - Removed legacy OpenAI-specific tests

## Migration Steps for Users

1. If you were using OpenAI directly, obtain an [OpenRouter API key](https://openrouter.ai/)

2. Update your `.env` file:
   ```
   # Remove this line:
   # OPENAI_API_KEY=your_openai_key_here
   
   # Add this line:
   OPENROUTER_API_KEY=your_openrouter_key_here
   ```

3. When running Docker containers, update your environment variable:
   ```bash
   # Old way
   docker run -p 8501:8501 -e OPENAI_API_KEY="your_key" crowd-wisdom-app
   
   # New way
   docker run -p 8501:8501 -e OPENROUTER_API_KEY="your_key" crowd-wisdom-app
   ```

## Benefits of OpenRouter

- Access to multiple LLM providers through a single API
- Automatic fallback if a provider is unavailable
- Ability to use specialized models for different tasks
- Cost optimization by routing to the best value model for each task

## Model Configuration

The default models used for different tasks are configured in the `shared/agent_core/llm_router.py` file:

```python
task_model_map = {
    "marketing": "google/gemini-2.5-flash-preview",
    "writing": "openai/gpt-4.1",
    "finance": "deepseek/deepseek-chat-v3-0324",
    "tool_use": "openrouter/command-r",
    "research": "openrouter/auto",
    "default": "openai/gpt-4.1"
}
```

These can be overridden with environment variables in the format: `TASK_TYPE_MODEL`, for example:
```
MARKETING_MODEL=anthropic/claude-3-opus
WRITING_MODEL=google/gemini-1.5-pro
DEFAULT_MODEL=mistral/mixtral-8x7b
``` 