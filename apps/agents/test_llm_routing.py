"""
Test script to demonstrate LLM routing capabilities.
This script will send test queries for each task type and display which model was used.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add the current directory to the path
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

# Load environment variables
load_dotenv()

# Import the router
from shared.llm_router import get_llm, log_model_response

def test_model_routing():
    """
    Test the model routing by sending a query to each task type.
    """
    # Define test prompts for each task type
    test_prompts = {
        "marketing": "Create a social media campaign for our new product launch targeting millennials",
        "writing": "Draft a blog post about the top 10 AI trends in 2025",
        "finance": "Analyze the ROI of our marketing campaigns for Q1 2025",
        "research": "Research recent developments in quantum computing and summarize key findings",
        "tool_use": "Execute the following function: get_sales_data(quarter=1, year=2025)",
        "default": "What's the weather like today?"
    }
    
    print("=" * 50)
    print("LLM ROUTING TEST")
    print("=" * 50)
    
    # Test each task type
    for task_type, prompt in test_prompts.items():
        print(f"\n[Testing '{task_type}' routing]")
        print(f"Prompt: {prompt}")
        
        try:
            # Get the LLM for this task type
            llm = get_llm(task_type)
            
            # Get model name
            model_name = get_llm(task_type).model
            print(f"Selected model: {model_name}")
            
            # We don't actually invoke the model to save API costs
            # In a real test, you would do:
            # response = llm.invoke(prompt)
            # log_model_response(response)
        except Exception as e:
            print(f"Error: {str(e)}")
    
    print("\n" + "=" * 50)
    print("TEST COMPLETE")
    print("=" * 50)

def run_single_task_test(task_type, prompt):
    """
    Run a single test with a specific task type and prompt.
    
    Args:
        task_type: The type of task (marketing, writing, etc.)
        prompt: The prompt to send to the model
    """
    print("=" * 50)
    print(f"TESTING: {task_type.upper()}")
    print("=" * 50)
    
    try:
        # Get the LLM for this task type
        llm = get_llm(task_type)
        
        # Get model name
        print(f"Selected model: {llm.model}")
        
        # Send the prompt and get a response
        print(f"\nPrompt: {prompt}\n")
        response = llm.invoke(prompt)
        
        # Log which model was actually used
        log_model_response(response)
        
        # Print the response
        print(f"\nResponse: {response.content}\n")
    except Exception as e:
        print(f"Error: {str(e)}")
    
    print("=" * 50)
    print("TEST COMPLETE")
    print("=" * 50)

if __name__ == "__main__":
    # Check for command-line arguments
    if len(sys.argv) > 1:
        # If task type is provided
        task_type = sys.argv[1].lower()
        
        # Get prompt from command line or use default
        if len(sys.argv) > 2:
            prompt = sys.argv[2]
        else:
            default_prompts = {
                "marketing": "Create a social media campaign for our new product launch",
                "writing": "Write a blog post introduction about AI",
                "finance": "Analyze the ROI of our marketing campaigns",
                "research": "Research recent developments in AI",
                "tool_use": "Execute a function to get data",
                "default": "Hello, how are you?"
            }
            prompt = default_prompts.get(task_type, default_prompts["default"])
        
        # Run single test
        run_single_task_test(task_type, prompt)
    else:
        # Run all tests
        test_model_routing() 