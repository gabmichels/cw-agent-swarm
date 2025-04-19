import os
from dotenv import load_dotenv
from apps.agents.shared.llm_router import get_llm, log_model_response

# Load environment variables
print("Loading environment variables...")
load_dotenv("apps/hq-ui/.env")

# Ensure environment variable is set
if 'OPENROUTER_API_KEY' not in os.environ and 'OPENAI_API_KEY' not in os.environ:
    print("Please set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable")
    exit(1)

print("\n=== Testing LLM Routers with Different Tasks ===")

# Test only a couple of tasks to avoid excessive API usage
tasks = ["default", "marketing"]  # Limited to just two tasks

for task in tasks:
    print(f"\n--- Testing {task.upper()} task ---")
    try:
        llm = get_llm(task, temperature=0.1)  # Low temperature for consistent results
        print(f"✅ LLM initialized successfully for {task}!")
        print(f"Model: {llm.model_name}")
        
        # Send a simple prompt
        prompt = f"Write a very short message (one sentence) about '{task}' tasks."
        print(f"Sending prompt: '{prompt}'")
        
        response = llm.invoke(prompt)
        print(f"Response: {response.content}")
        
        # Log model details
        try:
            log_model_response(response)
        except Exception as e:
            print(f"Note: Couldn't log model details: {e}")
            
    except Exception as e:
        print(f"❌ Error with {task} task: {str(e)}")
    
    print(f"--- End of {task.upper()} test ---")

print("\n=== All tests completed ===") 