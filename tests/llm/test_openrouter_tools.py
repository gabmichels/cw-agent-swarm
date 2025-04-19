"""
Test script to verify OpenRouter works with tools instead of functions.
"""
import os
import sys
from dotenv import load_dotenv
from langchain_core.tools import Tool, tool
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

# Load environment variables
load_dotenv("apps/hq-ui/.env")

# Add the parent directory to the path so we can import our modules
sys.path.append(".")

# Import the LLM router
from apps.agents.shared.llm_router import get_llm

# Define a simple tool using the 'tool' decorator
@tool
def get_weather(location: str) -> str:
    """Get the weather for a specific location."""
    return f"The weather in {location} is sunny and 72 degrees."

def main():
    """Main test function to verify OpenRouter with tools."""
    print("\n=== TESTING OPENROUTER WITH TOOLS ===\n")
    
    # Check environment variables
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if not openrouter_key:
        print("❌ Error: OPENROUTER_API_KEY not found in environment")
        return
    
    print("✓ OpenRouter API key found")
    
    try:
        # Get the LLM for marketing task type
        llm = get_llm("marketing", temperature=0.4)
        print(f"✓ Successfully created LLM with model: {llm.model_name}")
        print(f"✓ LLM class: {llm.__class__.__name__}")
        
        # Create a simple prompt template
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "You are a helpful AI assistant. Use tools when needed."),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        
        # Create tools array
        tools = [get_weather]
        
        # Create the agent using tools agent (not functions agent)
        print("\nCreating agent with tools...")
        agent = create_openai_tools_agent(llm, tools, prompt_template)
        
        # Create the agent executor
        agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
        
        # Invoke the agent
        print("\nInvoking agent with a query that should use the weather tool...")
        response = agent_executor.invoke({
            "input": "What's the weather like in San Francisco?",
            "chat_history": []
        })
        
        # Print the response
        print("\n=== AGENT RESPONSE ===")
        if isinstance(response, dict) and "output" in response:
            print(f"Response: {response['output']}")
        else:
            print(f"Response: {response}")
        
        print("\n✓ Test completed successfully")
        
    except Exception as e:
        print(f"\n❌ Error during test: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 