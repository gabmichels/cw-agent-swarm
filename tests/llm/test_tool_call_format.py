"""
Test for proper tool format with OpenRouter.

This test demonstrates the issue with deprecated function_call format
and shows the proper tools format that should be used with OpenRouter.
"""

import os
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

# Test with default settings (deprecated functions format)
try:
    print("\n=== Testing with default settings (using deprecated functions format) ===")
    
    # Create OpenRouter headers
    headers = {
        "HTTP-Referer": "https://crowd-wisdom.com", 
        "X-Title": "Chloe AI CMO"
    }
    
    # Create model with tools
    openrouter_llm = ChatOpenAI(
        model="openai/gpt-3.5-turbo",  # Using a cheaper model for testing
        temperature=0.1,
        base_url="https://openrouter.ai/api/v1",
        api_key=openrouter_key,
        default_headers=headers
    )
    
    # Create agent with tools
    agent = create_openai_tools_agent(openrouter_llm, [get_weather], prompt)
    agent_executor = AgentExecutor(agent=agent, tools=[get_weather], verbose=True)
    
    # Run agent
    response = agent_executor.invoke({"input": "What's the weather like in Paris?"})
    print(f"Response: {response['output']}")
    
except Exception as e:
    print(f"Error with default settings: {str(e)}")
    import traceback
    traceback.print_exc()

# Test with fixed settings (proper tools format)
try:
    print("\n=== Testing with fixed settings (proper tools format) ===")
    
    # Create OpenRouter headers
    headers = {
        "HTTP-Referer": "https://crowd-wisdom.com", 
        "X-Title": "Chloe AI CMO"
    }
    
    # Create model with tools - use the new tools format
    openrouter_llm = ChatOpenAI(
        model="openai/gpt-3.5-turbo",  # Using a cheaper model for testing
        temperature=0.1,
        base_url="https://openrouter.ai/api/v1",
        api_key=openrouter_key,
        default_headers=headers,
        model_kwargs={"conversion_mode": "tools"}  # Use the proper conversion mode
    )
    
    # Create agent with tools
    agent = create_openai_tools_agent(openrouter_llm, [get_weather], prompt)
    agent_executor = AgentExecutor(agent=agent, tools=[get_weather], verbose=True)
    
    # Run agent
    response = agent_executor.invoke({"input": "What's the weather like in Paris?"})
    print(f"Response: {response['output']}")
    
except Exception as e:
    print(f"Error with fixed settings: {str(e)}")
    import traceback
    traceback.print_exc() 