import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv("apps/hq-ui/.env")

# Add the parent directory to the path so we can import our modules
sys.path.append(".")

# Import the LLM router and other necessary modules
from apps.agents.shared.llm_router import get_llm

def test_model(task_type, prompt):
    """Test a specific task type model with a given prompt."""
    print(f"\n{'='*60}")
    print(f"TESTING MODEL TYPE: {task_type}")
    print(f"{'='*60}")
    
    try:
        # Get the LLM for this task type
        llm = get_llm(task_type, temperature=0.4)
        print(f"✓ Successfully got LLM for task type: {task_type}")
        print(f"  Model name: {llm.model_name}")
        print(f"  Model class: {llm.__class__.__name__}")
        
        # Invoke the LLM
        print(f"\nInvoking with prompt: '{prompt}'")
        response = llm.invoke(prompt)
        print(f"✓ Successfully got response of type: {type(response)}")
        
        # Analyze the response structure
        if hasattr(response, "content"):
            content = response.content
            print(f"✓ Response has 'content' attribute: {content[:100]}...")
        elif isinstance(response, dict):
            print("Response is a dictionary with keys:")
            for key in response.keys():
                print(f"  - {key}")
            
            if "output" in response:
                print(f"✓ Response has 'output' key: {response['output'][:100]}...")
            elif "choices" in response and len(response["choices"]) > 0:
                choices = response["choices"]
                print(f"✓ Response has 'choices' list with {len(choices)} items")
                if isinstance(choices[0], dict) and "message" in choices[0]:
                    message = choices[0]["message"]
                    if isinstance(message, dict) and "content" in message:
                        content = message["content"]
                        print(f"✓ Found in choices[0].message.content: {content[:100]}...")
        else:
            print(f"? Response has no recognized structure: {str(response)[:100]}...")
        
        print("\nTEST RESULT: SUCCESS")
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        print("\nTEST RESULT: FAILED")

# Test with various task types
task_types = ["default", "marketing", "writing", "research", "finance", "tool_use"]
test_prompt = "Write a short tagline for our company focused on crowd wisdom."

# Run tests for each task type
for task_type in task_types:
    test_model(task_type, test_prompt)

print("\n\nSUMMARY:")
print("This script tests each task type to identify which ones succeed and which ones fail.")
print("Check the logs above to see detailed results for each model type.")
print("Look for error patterns with non-default models.") 