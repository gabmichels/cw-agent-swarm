import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv("apps/hq-ui/.env")

# Check if environment variables are set
print("\n=== Environment Variables ===")
print(f"OPENAI_API_KEY set: {'Yes' if os.getenv('OPENAI_API_KEY') else 'No'}")
print(f"OPENROUTER_API_KEY set: {'Yes' if os.getenv('OPENROUTER_API_KEY') else 'No'}")

# Import our router
try:
    print("\n=== Testing LLM Router ===")
    from apps.agents.shared.llm_router import get_llm, get_model_for_task
    
    # Test model selection
    for task in ["default", "marketing", "writing", "finance", "tool_use", "research"]:
        model = get_model_for_task(task)
        print(f"Task: {task} -> Model: {model}")
    
    # Try to get a simple LLM
    print("\n=== Testing LLM Creation ===")
    try:
        llm = get_llm("default", temperature=0.1)
        print(f"LLM created successfully with model: {llm.model_name}")
        
        # Try a simple completion
        print("\n=== Testing Simple Completion ===")
        response = llm.invoke("Say hello in exactly 5 words")
        print(f"Response: {response.content}")
        print("Test completed successfully!")
    except Exception as e:
        print(f"Error creating or using LLM: {str(e)}")
        import traceback
        traceback.print_exc()
        
except ImportError as e:
    print(f"Import error: {str(e)}")
    sys.exit(1)
except Exception as e:
    print(f"Unexpected error: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1) 