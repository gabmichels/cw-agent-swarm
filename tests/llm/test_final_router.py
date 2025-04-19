"""
Final test to verify the updated LLM router works with function/tool calls.
"""

import os
import json
from dotenv import load_dotenv
from langchain_core.tools import tool
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from apps.agents.shared.llm_router import get_llm, log_model_response
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, FunctionMessage

# Load environment variables
print("Loading environment variables...")
load_dotenv("apps/hq-ui/.env")

# Define simple tools
@tool
def get_weather(location: str) -> str:
    """Get the weather for a specific location."""
    return f"The weather in {location} is sunny and 72 degrees."

# Create the prompt template with agent_scratchpad
prompt = ChatPromptTemplate.from_messages([
    ("system", """You are an assistant that helps with weather forecasts. 
You have access to tools to get weather information. Use them when needed."""),
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

tools = [get_weather]

# Test with our updated router - simpler direct LLM call first
try:
    print("\n=== Testing direct function call using function format ===")
    
    # Get LLM with our router
    llm = get_llm("default", temperature=0.1)
    print(f"Created LLM with model: {llm.model_name}")
    
    # Define a simple function
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
    
    # Force function call using functions format (should be converted to tools)
    print("\nMaking direct function call...")
    
    response = llm.invoke([
        SystemMessage(content="You are a helpful weather assistant."),
        HumanMessage(content="What's the weather like in London?")
    ], functions=functions, function_call={"name": "get_weather"})
    
    print("\nResponse type:", type(response))
    print("Response content:", response.content)
    
    # Check for function or tool calls
    if hasattr(response, "additional_kwargs") and "function_call" in response.additional_kwargs:
        fc = response.additional_kwargs["function_call"]
        print("\nFunction call detected:")
        print(f"Name: {fc.get('name')}")
        print(f"Arguments: {fc.get('arguments')}")
    elif hasattr(response, "tool_calls") and response.tool_calls:
        print("\nTool calls detected:", response.tool_calls)
    else:
        print("\nNo function or tool calls detected")
    
    # Now try with agent
    print("\n=== Testing with agent executor ===")
    
    # Create agent with functions (should be converted to tools)
    print("\nCreating agent with functions...")
    agent = create_openai_tools_agent(llm, tools, prompt)
    agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
    
    # Run agent
    print("\nRunning agent...")
    response = agent_executor.invoke({"input": "What's the weather like in London?"})
    print(f"\nFinal response: {response['output']}")
    
except Exception as e:
    print(f"Error with updated router: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n=== Test completed ===") 