# OpenRouter Integration

This project has been upgraded to use OpenRouter for dynamic model selection based on task context.

## What is OpenRouter?

OpenRouter provides a unified API to access various AI models from different providers. 
It allows you to:

1. Use a single API key for multiple model providers
2. Dynamically route requests to the best model for specific tasks
3. Fallback to alternative models if your first choice is unavailable

## Configuration

1. Sign up at [OpenRouter](https://openrouter.ai/) and get your API key
2. Add your key to `.env`:
   ```
   OPENROUTER_API_KEY=your-key-here
   ```

## Task-Based Model Routing

Chloe now selects the most appropriate model for different types of tasks:

| Task Type | Model ID | Provider | Strengths |
|-----------|----------|----------|-----------|
| marketing | google/gemini-2.5-flash-preview | Google | Advanced marketing planning, audience analysis |  
| writing | openai/gpt-4.1 | OpenAI | Superior writing quality, tone consistency |
| default | openai/gpt-4.1 | OpenAI | General-purpose tasks |
| finance | deepseek/deepseek-chat-v3-0324 | DeepSeek | Financial analysis, data interpretation |
| tool_use | openrouter/command-r | Anthropic | Tool usage, function calling |
| research | openrouter/auto | OpenRouter | Research tasks, allows OpenRouter to select the best model |

## How It Works

The system uses a router module in `shared/llm_router.py` that selects the appropriate model:

```python
from apps.agents.shared.llm_router import get_llm

# Get a marketing-specialized model
marketing_llm = get_llm("marketing")

# Get a writing-specialized model
writing_llm = get_llm("writing")

# Get the default model
default_llm = get_llm()

# Get a model with custom parameters
custom_llm = get_llm("marketing", temperature=0.7)
```

## Model Response Logging

When debugging, you can see which model was actually used:

```python
from apps.agents.shared.llm_router import get_llm, log_model_response

llm = get_llm("marketing")
response = llm.invoke("Generate a marketing plan for a new product")
log_model_response(response)  # Will print: "Model used: google/gemini-2.5-flash-preview"
```

## Fallback Behavior

If OpenRouter cannot access your requested model, it will try to use a similar alternative.
If you don't have an OpenRouter API key, the system will fall back to using your OpenAI API key directly. 