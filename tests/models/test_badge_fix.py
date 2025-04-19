import os
import sys
from dotenv import load_dotenv

# Add the parent directory to the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load environment variables
load_dotenv("apps/hq-ui/.env")

# Import our test modules
from apps.agents.shared.llm_router import get_llm
from apps.agents.departments.marketing.cmo_executor import run_agent_loop

# Test with a simple prompt
test_prompt = "What's our brand's target audience?"
print(f"\nTest prompt: {test_prompt}")

# Run the agent loop
print("\nRunning agent loop...")
response = run_agent_loop(test_prompt)

# Display the response
print("\n=== Agent Response ===")
print(response)

# Check the chat history
from apps.agents.departments.marketing.cmo_executor import chat_history

# Get the last message metadata
print("\n=== Checking Message Metadata ===")
if chat_history and len(chat_history) > 0:
    last_message = chat_history[-1]
    metadata = getattr(last_message, "metadata", {})
    
    print(f"Metadata: {metadata}")
    
    if "model" in metadata:
        model = metadata["model"]
        print(f"Model in metadata: {model}")
        
        # Check if it's a proper model name
        if "/" in model:
            print("✅ Success: Model name properly captured from the request")
        elif model == "unknown":
            print("❌ Failed: Model still showing as 'unknown'")
        else:
            print(f"⚠️ Partial success: Model recorded as '{model}'")
    else:
        print("❌ Failed: No model field in metadata")
else:
    print("❌ Failed: No chat history available") 