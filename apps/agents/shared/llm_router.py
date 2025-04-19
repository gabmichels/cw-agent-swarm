import os
from typing import Dict, Optional, Any
from langchain_openai import ChatOpenAI

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

def get_llm(task_type: str = "default", temperature: float = 0.4) -> ChatOpenAI:
    """
    Get a configured LLM instance for a specific task type.
    
    Args:
        task_type: The type of task being performed
        temperature: Temperature parameter for the LLM
    
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
            # Create OpenRouter-specific LLM
            print("DEBUG LLM_ROUTER: Creating ChatOpenAI with OpenRouter")
            
            # Clean, minimal OpenRouter params
            return ChatOpenAI(
                model=model_name,
                temperature=temperature,
                base_url="https://openrouter.ai/api/v1",
                api_key=api_key,
                default_headers=headers
            )
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
    fallback_model = "gpt-4o" if using_openrouter else model_name  # Use gpt-4o as fallback model
    print(f"DEBUG LLM_ROUTER: Creating ChatOpenAI with direct OpenAI using model={fallback_model}")
    
    # Clean, minimal OpenAI params
    return ChatOpenAI(
        model=fallback_model,
        temperature=temperature,
        api_key=api_key
    )

def log_model_response(response: Any) -> None:
    """
    Log information about the model response.
    
    Args:
        response: The response from the model
    """
    try:
        # Debug all response attributes
        print(f"DEBUG Model Response Type: {type(response)}")
        
        # First check additional_kwargs for OpenRouter's response format
        if hasattr(response, "additional_kwargs") and isinstance(response.additional_kwargs, dict):
            # Debug
            print(f"DEBUG Response additional_kwargs: {response.additional_kwargs}")
            
            # OpenRouter specific model field in metadata
            if "model" in response.additional_kwargs:
                print(f"Model used: {response.additional_kwargs['model']}")
                return
            
            # Check nested metadata for model information
            if "metadata" in response.additional_kwargs:
                metadata = response.additional_kwargs["metadata"]
                print(f"DEBUG Response metadata: {metadata}")
                if isinstance(metadata, dict) and "model" in metadata:
                    print(f"Model used: {metadata['model']}")
                    return
                
        # Fall back to standard model_name or model attributes
        model_name = getattr(response, "model_name", 
                    getattr(response, "model", None))
        
        if model_name:
            print(f"Model used: {model_name}")
        else:
            # Try to find model in OpenRouter response format (direct attribute)
            for attr_name in ["_model", "model_id", "model_name", "id"]:
                if hasattr(response, attr_name):
                    model = getattr(response, attr_name)
                    if model:
                        print(f"Model used: {model}")
                        return
            
            # Last attempt - check all attributes
            print("DEBUG Checking all response attributes:")
            for attr in dir(response):
                if not attr.startswith('_') and not callable(getattr(response, attr)):
                    try:
                        value = getattr(response, attr)
                        if isinstance(value, dict) and "model" in value:
                            print(f"Model found in {attr}: {value['model']}")
                            return
                    except:
                        pass
                        
            print("Could not determine model used - no model information found in response")
    except Exception as e:
        print(f"Error determining model: {str(e)}")
        print("Could not determine model used due to error") 