import os
from typing import Dict, Optional, Any
from langchain_openai import ChatOpenAI
from apps.agents.shared.patched_chat_openai import PatchedChatOpenAI

def get_model_for_task(task_type: str = "default") -> str:
    """
    Get the appropriate model ID for a specific task type.
    
    Args:
        task_type: The type of task being performed
                  (marketing, writing, finance, tool_use, research, default)
    
    Returns:
        The model ID to use for the specified task type
    """
    task_model_map = {
        "marketing": "google/gemini-2.5-flash-preview",
        "writing": "openai/gpt-4.1",
        "finance": "deepseek/deepseek-chat-v3-0324",
        "tool_use": "openrouter/command-r",
        "research": "openrouter/auto",
        "default": "openai/gpt-4.1"
    }
    return task_model_map.get(task_type, task_model_map["default"])

def get_llm(task_type: str = "default", **kwargs) -> ChatOpenAI:
    """
    Get a configured LLM instance for a specific task type.
    
    Args:
        task_type: The type of task being performed
        **kwargs: Additional arguments to pass to the ChatOpenAI constructor
    
    Returns:
        A configured ChatOpenAI instance
    """
    print(f"DEBUG LLM_ROUTER: Getting LLM for task_type={task_type}")
    model_name = get_model_for_task(task_type)
    print(f"DEBUG LLM_ROUTER: Selected model_name={model_name}")
    
    # Check if we're using OpenRouter or direct OpenAI
    using_openrouter = os.getenv("OPENROUTER_API_KEY") is not None
    print(f"DEBUG LLM_ROUTER: Using OpenRouter: {using_openrouter}")
    
    if using_openrouter:
        # OpenRouter configuration
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            print("DEBUG LLM_ROUTER: No OpenRouter API key found!")
            raise ValueError("No OpenRouter API key found. Set OPENROUTER_API_KEY in your environment.")
        
        # Headers for OpenRouter attribution
        headers = {
            "HTTP-Referer": "https://crowd-wisdom.com",
            "X-Title": "Chloe AI CMO"
        }
        print(f"DEBUG LLM_ROUTER: Using OpenRouter with headers: {headers}")
        
        try:
            # Create OpenRouter-specific LLM using PatchedChatOpenAI for tools compatibility
            print("DEBUG LLM_ROUTER: Creating PatchedChatOpenAI with OpenRouter")
            
            # OpenRouter base params
            openrouter_params = {
                "model": model_name,
                "temperature": 0.4,
                "base_url": "https://openrouter.ai/api/v1",
                "api_key": api_key,
                "default_headers": headers
            }
            
            # Add remaining custom kwargs
            for key, value in kwargs.items():
                openrouter_params[key] = value
                print(f"DEBUG LLM_ROUTER: Adding custom param {key}")
            
            print(f"DEBUG LLM_ROUTER: OpenRouter params (excluding api_key): {', '.join([f'{k}={v}' for k, v in openrouter_params.items() if k != 'api_key'])}")
            # Use PatchedChatOpenAI instead of ChatOpenAI
            return PatchedChatOpenAI(**openrouter_params)
        except Exception as e:
            print(f"DEBUG LLM_ROUTER ERROR: OpenRouter initialization failed: {str(e)}")
            
            # If OpenAI fallback is available
            if os.getenv("OPENAI_API_KEY"):
                print("DEBUG LLM_ROUTER: Falling back to direct OpenAI")
                # Continue to OpenAI fallback below
            else:
                # No fallback available
                raise e
    
    # Direct OpenAI (either primary or fallback)
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("DEBUG LLM_ROUTER: No OpenAI API key found!")
        raise ValueError("No OpenAI API key found. Set OPENAI_API_KEY in your environment.")
    
    # Create a clean config for direct OpenAI (no headers, no base_url)
    openai_params = {
        "model": "gpt-4o" if using_openrouter else model_name,  # Use gpt-4o as fallback model
        "temperature": 0.4,
        "api_key": api_key
    }
    
    # Add custom kwargs
    for key, value in kwargs.items():
        if key != "default_headers":  # Skip headers for direct OpenAI
            openai_params[key] = value
            print(f"DEBUG LLM_ROUTER: Adding custom param {key}")
    
    print(f"DEBUG LLM_ROUTER: OpenAI params (excluding api_key): {', '.join([f'{k}={v}' for k, v in openai_params.items() if k != 'api_key'])}")
    
    try:
        print("DEBUG LLM_ROUTER: Creating ChatOpenAI with direct OpenAI")
        return ChatOpenAI(**openai_params)
    except Exception as e:
        print(f"DEBUG LLM_ROUTER ERROR: OpenAI initialization failed: {str(e)}")
        raise e

def log_model_response(response: Any) -> None:
    """
    Log information about the model response.
    
    Args:
        response: The response from the model
    """
    try:
        # Check for model_name first (newer attribute), then model (older attribute)
        model_name = getattr(response, "model_name", 
                      getattr(response, "model", "unknown"))
        print(f"Model used: {model_name}")
    except AttributeError:
        print("Could not determine model used") 