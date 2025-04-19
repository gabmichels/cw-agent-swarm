"""
Test the OpenRouter function to tools conversion.

This test verifies that our llm_router correctly converts functions format to tools format
for OpenRouter compatibility.
"""

import os
import json
from dotenv import load_dotenv
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, SystemMessage
from apps.agents.shared.llm_router import get_llm

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

# Check API keys
print("\n=== Environment Variables ===")
openai_key = os.getenv("OPENAI_API_KEY")
openrouter_key = os.getenv("OPENROUTER_API_KEY")
print(f"OPENAI_API_KEY set: {'Yes' if openai_key else 'No'}")
print(f"OPENROUTER_API_KEY set: {'Yes' if openrouter_key else 'No'}")

if not openrouter_key:
    print("ERROR: No OpenRouter API key found!")
    exit(1)

tools = [get_weather, get_time]

# Test with our router (should automatically detect and handle functions->tools conversion)
try:
    print("\n=== Testing with our custom router ===")
    
    # Get our llm with functions
    llm = get_llm("default", temperature=0.1)
    print(f"Created LLM with model: {llm.model_name}")
    
    # We'll explicitly use functions format, and our router should convert it to tools
    functions = [
        {
            "name": "get_weather",
            "description": "Get the weather for a specific location.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The location to get weather for."
                    }
                },
                "required": ["location"]
            }
        }
    ]
    
    # Create a direct message (non-agent) to test conversion
    try:
        print("\nTesting direct invocation with functions format...")
        response = llm.invoke([
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "What's the weather like in London?"}
        ], functions=functions, function_call={"name": "get_weather"})
        
        print("Response type:", type(response))
        print("Response content:", response.content)
        
        # Check if function call was made
        if hasattr(response, "additional_kwargs") and "function_call" in response.additional_kwargs:
            print("Function call detected in response:", 
                  json.dumps(response.additional_kwargs["function_call"], indent=2))
        elif hasattr(response, "tool_calls") and response.tool_calls:
            print("Tool calls detected in response:", response.tool_calls)
        else:
            print("No function/tool calls detected")
            
    except Exception as e:
        print(f"Error with direct invocation: {str(e)}")
        import traceback
        traceback.print_exc()
    
    # Create agent with tools
    try:
        print("\nTesting with agent executor...")
        agent = create_openai_functions_agent(llm, tools, prompt)
        agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
        
        # Run agent
        response = agent_executor.invoke({"input": "What's the weather like in Tokyo and what time is it there?"})
        print(f"Agent response: {response['output']}")
    except Exception as e:
        print(f"Error with agent executor: {str(e)}")
        import traceback
        traceback.print_exc()
    
except Exception as e:
    print(f"General error: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n=== Test completed ===") 