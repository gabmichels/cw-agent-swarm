"""
Comprehensive test script for all models in the LLM router.
Tests each model type with both direct invocation and tools usage.
"""
import os
import sys
from dotenv import load_dotenv
from langchain_core.tools import tool
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

# Load environment variables
load_dotenv("apps/hq-ui/.env")

# Add the parent directory to the path so we can import our modules
sys.path.append(".")

# Import the LLM router
from apps.agents.shared.llm_router import get_llm, get_model_for_task

# Define a simple tool
@tool
def get_weather(location: str) -> str:
    """Get the weather for a specific location."""
    return f"The weather in {location} is sunny and 72 degrees."

def test_direct_invocation(task_type: str):
    """Test direct LLM invocation for a specific task type."""
    print(f"\n{'='*60}")
    print(f"TESTING DIRECT INVOCATION FOR: {task_type}")
    print(f"{'='*60}")
    
    # Get the model name for this task type
    model_name = get_model_for_task(task_type)
    print(f"Model selected: {model_name}")
    
    try:
        # Get the LLM
        llm = get_llm(task_type, temperature=0.4)
        print(f"✓ Successfully initialized LLM")
        print(f"  Class: {llm.__class__.__name__}")
        print(f"  Model: {llm.model_name}")
        
        # Test direct invocation
        print("\nTesting direct invocation...")
        prompt = "Write a short tagline (max 10 words) for a coffee shop."
        response = llm.invoke(prompt)
        
        # Check response
        if hasattr(response, "content"):
            print(f"Response: {response.content}")
            print("✓ Direct invocation successful")
        else:
            print(f"Response format: {type(response)}")
            print(f"Response data: {response}")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

def test_tools_agent(task_type: str):
    """Test tools-based agent for a specific task type."""
    print(f"\n{'='*60}")
    print(f"TESTING TOOLS AGENT FOR: {task_type}")
    print(f"{'='*60}")
    
    # Get the model name for this task type
    model_name = get_model_for_task(task_type)
    print(f"Model selected: {model_name}")
    
    try:
        # Get the LLM
        llm = get_llm(task_type, temperature=0.4)
        print(f"✓ Successfully initialized LLM")
        
        # Create prompt template
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "You are a helpful AI assistant. Use tools when needed."),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        
        # Create tools array
        tools = [get_weather]
        
        # Create agent
        print("\nCreating tools-based agent...")
        agent = create_openai_tools_agent(llm, tools, prompt_template)
        
        # Create executor
        agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
        
        # Test invocation
        print("\nTesting agent with weather query...")
        response = agent_executor.invoke({
            "input": "What's the weather in Seattle?",
            "chat_history": []
        })
        
        # Check response
        if isinstance(response, dict) and "output" in response:
            print(f"\nResponse output: {response['output']}")
            print("✓ Tools agent invocation successful")
        else:
            print(f"\nResponse format: {type(response)}")
            print(f"Response data: {response}")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

def main():
    """Run tests for all task types."""
    print("\n=== TESTING ALL LLM MODELS ===\n")
    
    # Get API keys
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    
    print(f"OpenRouter API key available: {'Yes' if openrouter_key else 'No'}")
    print(f"OpenAI API key available: {'Yes' if openai_key else 'No'}")
    
    if not (openrouter_key or openai_key):
        print("❌ Error: Neither OpenRouter nor OpenAI API keys are available.")
        return
    
    # Define all task types
    task_types = ["default", "marketing", "writing", "finance", "tool_use", "research"]
    
    # Test each task type
    for task_type in task_types:
        # Test direct invocation
        test_direct_invocation(task_type)
        
        # Test tools agent
        test_tools_agent(task_type)
    
    print("\n=== ALL TESTS COMPLETED ===")

if __name__ == "__main__":
    main() 
 