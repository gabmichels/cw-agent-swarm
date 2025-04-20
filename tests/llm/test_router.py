import os
import sys
from pathlib import Path
import logging

# Set up proper imports
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root))

# Check for API key
if 'OPENROUTER_API_KEY' not in os.environ:
    print("Please set OPENROUTER_API_KEY environment variable")
    sys.exit(1)

# Import once path is set
from shared.agent_core.llm_router import get_llm, log_model_response, get_model_for_task

def test_basic_router():
    """Test the basic functionality of the LLM router"""
    print("\n=== Testing Basic LLM Router ===")
    
    llm = get_llm("marketing")
    print(f"LLM class: {llm.__class__.__name__}")
    print(f"LLM model: {llm.model}")
    
    response = llm.invoke("Hello, can you help me with a marketing strategy?")
    print(f"Response type: {type(response)}")
    print(f"Response content: {response.content[:100]}...")
    
    # Log the model that was used
    log_model_response(response)
    
    return True

def test_task_specific_models():
    """Test that different task types get different models"""
    print("\n=== Testing Task-Specific Model Selection ===")
    
    tasks = ["marketing", "writing", "finance", "tool_use", "research", "default"]
    
    for task in tasks:
        model_name = get_model_for_task(task)
        print(f"Task: {task} -> Model: {model_name}")
    
    return True

if __name__ == "__main__":
    # Run all tests
    test_basic_router()
    test_task_specific_models() 