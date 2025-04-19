"""
Patched version of ChatOpenAI that automatically converts functions to tools format.

This is needed for OpenRouter compatibility, as they only support the new tools API
and reject requests that use the deprecated functions format.
"""

from typing import Any, Dict, List, Optional, Union
from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage

class PatchedChatOpenAI(ChatOpenAI):
    """
    A patched version of ChatOpenAI that automatically converts functions to tools format.
    
    This is specifically designed to work with OpenRouter, which requires the use of
    the tools API instead of the deprecated functions API.
    """
    
    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> Any:
        """
        Override the _generate method to convert functions to tools.
        This is the core method that actually makes the API call.
        """
        # Convert functions to tools format if needed
        if "functions" in kwargs:
            functions = kwargs.pop("functions")
            tools = kwargs.get("tools", [])
            
            # Convert functions to tools
            for func in functions:
                tool = {"type": "function", "function": func}
                tools.append(tool)
            
            kwargs["tools"] = tools
        
        # Convert function_call to tool_choice
        if "function_call" in kwargs:
            function_call = kwargs.pop("function_call")
            
            if function_call == "auto":
                kwargs["tool_choice"] = "auto"
            elif isinstance(function_call, dict) and "name" in function_call:
                kwargs["tool_choice"] = {
                    "type": "function",
                    "function": {"name": function_call["name"]}
                }
        
        # Call parent implementation with fixed parameters
        return super()._generate(messages, stop, run_manager, **kwargs)
    
    def _create_chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> Any:
        """
        Override chat completion to ensure functions are converted to tools.
        This is called by both _generate and _stream methods.
        """
        # Convert functions to tools format if needed
        if "functions" in kwargs:
            functions = kwargs.pop("functions")
            tools = kwargs.get("tools", [])
            
            # Convert functions to tools
            for func in functions:
                tool = {"type": "function", "function": func}
                tools.append(tool)
            
            kwargs["tools"] = tools
        
        # Convert function_call to tool_choice
        if "function_call" in kwargs:
            function_call = kwargs.pop("function_call")
            
            if function_call == "auto":
                kwargs["tool_choice"] = "auto"
            elif isinstance(function_call, dict) and "name" in function_call:
                kwargs["tool_choice"] = {
                    "type": "function",
                    "function": {"name": function_call["name"]}
                }
        
        # Call parent implementation with fixed parameters
        return super()._create_chat_completion(messages, model, temperature, max_tokens, **kwargs)
    
    def _stream(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> Any:
        """
        Override streaming method to convert functions to tools.
        """
        # Convert functions to tools format if needed
        if "functions" in kwargs:
            functions = kwargs.pop("functions")
            tools = kwargs.get("tools", [])
            
            # Convert functions to tools
            for func in functions:
                tool = {"type": "function", "function": func}
                tools.append(tool)
            
            kwargs["tools"] = tools
        
        # Convert function_call to tool_choice
        if "function_call" in kwargs:
            function_call = kwargs.pop("function_call")
            
            if function_call == "auto":
                kwargs["tool_choice"] = "auto"
            elif isinstance(function_call, dict) and "name" in function_call:
                kwargs["tool_choice"] = {
                    "type": "function",
                    "function": {"name": function_call["name"]}
                }
        
        # Call parent implementation with fixed parameters
        return super()._stream(messages, stop, **kwargs) 