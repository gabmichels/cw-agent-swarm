"""
LLM Router via OpenRouter
-----------------------
Shared LLM router for selecting and configuring the appropriate LLM through OpenRouter
based on task type.
"""

import os
from typing import Dict, Optional, Any
from langchain_openai import ChatOpenAI
import logging

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    
    # Check if there are environment variable overrides
    env_model = os.getenv(f"{task_type.upper()}_MODEL")
    if env_model:
        return env_model
    
    return task_model_map.get(task_type, task_model_map["default"])

def get_llm(task_type: str = "default", temperature: float = 0.4) -> ChatOpenAI:
    """
    Get a configured LLM instance for a specific task type via OpenRouter.
    
    Args:
        task_type: The type of task being performed
        temperature: Temperature parameter for the LLM
    
    Returns:
        A configured ChatOpenAI instance using OpenRouter
    """
    logger.debug(f"Getting LLM for task_type={task_type}")
    model_name = get_model_for_task(task_type)
    logger.debug(f"Selected model_name={model_name}")
    
    # Check for OpenRouter API key
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        logger.error("No OpenRouter API key found!")
        raise ValueError("No OpenRouter API key found. Set OPENROUTER_API_KEY in your environment.")
    
    # Headers for OpenRouter attribution
    headers = {
        "HTTP-Referer": "https://crowd-wisdom.com",
        "X-Title": "AI Agent"
    }
    
    # Get default parameters from environment if available
    default_temp = float(os.getenv("DEFAULT_TEMPERATURE", "0.4"))
    max_tokens = int(os.getenv("DEFAULT_MAX_TOKENS", "2048"))
    
    # Use provided temperature or default from environment
    temp_to_use = temperature or default_temp
    
    try:
        # Configure LLM with OpenRouter
        return ChatOpenAI(
            model=model_name,
            temperature=temp_to_use,
            max_tokens=max_tokens,
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
            default_headers=headers
        )
    except Exception as e:
        logger.error(f"Error initializing LLM via OpenRouter: {str(e)}")
        raise e

def log_model_response(response: Any) -> None:
    """
    Log information about the model response.
    
    Args:
        response: The response from the model
    """
    try:
        # Debug all response attributes
        logger.debug(f"Model Response Type: {type(response)}")
        
        # First check additional_kwargs for OpenRouter's response format
        if hasattr(response, "additional_kwargs") and isinstance(response.additional_kwargs, dict):
            # Debug
            logger.debug(f"Response additional_kwargs: {response.additional_kwargs}")
            
            # OpenRouter specific model field in metadata
            if "model" in response.additional_kwargs:
                logger.info(f"Model used: {response.additional_kwargs['model']}")
                return
            
            # Check nested metadata for model information
            if "metadata" in response.additional_kwargs:
                metadata = response.additional_kwargs["metadata"]
                logger.debug(f"Response metadata: {metadata}")
                if isinstance(metadata, dict) and "model" in metadata:
                    logger.info(f"Model used: {metadata['model']}")
                    return
                
        # Fall back to standard model_name or model attributes
        model_name = getattr(response, "model_name", 
                    getattr(response, "model", None))
        
        if model_name:
            logger.info(f"Model used: {model_name}")
        else:
            # Try to find model in OpenRouter response format (direct attribute)
            for attr_name in ["_model", "model_id", "model_name", "id"]:
                if hasattr(response, attr_name):
                    model = getattr(response, attr_name)
                    if model:
                        logger.info(f"Model used: {model}")
                        return
            
            # Last attempt - check all attributes
            logger.debug("Checking all response attributes")
            for attr in dir(response):
                if not attr.startswith('_') and not callable(getattr(response, attr)):
                    try:
                        value = getattr(response, attr)
                        if isinstance(value, dict) and "model" in value:
                            logger.info(f"Model found in {attr}: {value['model']}")
                            return
                    except:
                        pass
                        
            logger.warning("Could not determine model used - no model information found in response")
    except Exception as e:
        logger.error(f"Error determining model: {str(e)}")
        logger.warning("Could not determine model used due to error") 