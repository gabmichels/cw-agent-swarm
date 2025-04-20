"""
Test with a custom patched agent that correctly uses the tools format with OpenRouter.
"""

import os
import json
from dotenv import load_dotenv
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, SystemMessage

# Load environment variables
print("Loading environment variables...")
load_dotenv("apps/hq-ui/.env")

# Define a simple tool
@tool
def get_weather(location: str) -> str:
    """Get the weather for a specific location."""
    return f"The weather in {location} is sunny and 72 degrees."

@tool
def get_time(timezone: str) -> str:
    """Get the current time in a specific timezone."""
    return f"The current time in {timezone} is 10:30 AM."

# Create the prompt template with agent_scratchpad
prompt = ChatPromptTemplate.from_messages([
    ("system", """You are an assistant that helps with weather forecasts and time.
You have access to tools to get weather information and time info. Use them when needed."""),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

# Check environment variables
openrouter_key = os.getenv("OPENROUTER_API_KEY")
print(f"OPENROUTER_API_KEY set: {'Yes' if openrouter_key else 'No'}")

if not openrouter_key:
    print("ERROR: No OPENROUTER_API_KEY found. Please set it in your environment.")
    exit(1)

# Create a patched ChatOpenAI class that uses tools format internally
class PatchedChatOpenAI(ChatOpenAI):
    def _convert_dict_to_message(self, message: dict):
        """Override to handle function_call -> tool_choice conversion."""
        if "function_call" in message:
            # Convert to tool_call format
            function_call = message.pop("function_call")
            if isinstance(function_call, dict) and "name" in function_call:
                message["tool_calls"] = [{
                    "type": "function",
                    "function": {
                        "name": function_call["name"],
                        "arguments": function_call.get("arguments", "{}")
                    }
                }]
        return super()._convert_dict_to_message(message)

    def _prepare_params(self, params):
        """Override to convert functions to tools format for API calls."""
        params = params.copy()
        
        # Convert functions to tools
        if "functions" in params:
            functions = params.pop("functions")
            tools = []
            for func in functions:
                tool = {"type": "function", "function": func}
                tools.append(tool)
            params["tools"] = tools
            
        # Convert function_call to tool_choice
        if "function_call" in params:
            function_call = params.pop("function_call")
            if function_call == "auto":
                params["tool_choice"] = "auto"
            elif isinstance(function_call, dict) and "name" in function_call:
                params["tool_choice"] = {
                    "type": "function",
                    "function": {"name": function_call["name"]}
                }
        
        return params
    
    def invoke(self, *args, **kwargs):
        """Pre-process kwargs to convert functions to tools."""
        if "functions" in kwargs or "function_call" in kwargs:
            kwargs = self._prepare_params(kwargs)
        return super().invoke(*args, **kwargs)

    def _create_chat_completion(self, *args, **kwargs):
        """Pre-process kwargs for chat completion."""
        if "functions" in kwargs or "function_call" in kwargs:
            kwargs = self._prepare_params(kwargs)
        return super()._create_chat_completion(*args, **kwargs)
    
tools = [get_weather, get_time]

# Test with patched OpenRouter
try:
    print("\n=== Testing with patched OpenRouter ===")
    
    # Create OpenRouter headers
    headers = {
        "HTTP-Referer": "https://crowd-wisdom.com", 
        "X-Title": "Chloe AI CMO"
    }
    
    # Create model with tools
    patched_llm = PatchedChatOpenAI(
        model="openai/gpt-3.5-turbo",  # Using a cheaper model for testing
        temperature=0.1,
        base_url="https://openrouter.ai/api/v1",
        api_key=openrouter_key,
        default_headers=headers
    )
    
    # Create agent with tools
    agent = create_openai_tools_agent(patched_llm, tools, prompt)
    agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
    
    # Run agent
    response = agent_executor.invoke({"input": "What's the weather like in Tokyo and what time is it there?"})
    print(f"Agent response: {response['output']}")
    
except Exception as e:
    print(f"Error with patched OpenRouter: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n=== Test completed ===") 
 