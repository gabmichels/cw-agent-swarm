import os
import sys
import json
from pathlib import Path
from dotenv import load_dotenv

# Add the parent directory to the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load environment variables
print("Loading environment variables...")
load_dotenv("apps/hq-ui/.env")

# Import the agent executor
from apps.agents.departments.marketing.cmo_executor import run_agent_loop

# Check environment variables
print("\n=== Environment Variables ===")
openai_key = os.getenv("OPENAI_API_KEY")
openrouter_key = os.getenv("OPENROUTER_API_KEY")
print(f"OPENAI_API_KEY set: {'Yes' if openai_key else 'No'}")
print(f"OPENROUTER_API_KEY set: {'Yes' if openrouter_key else 'No'}")

if not openrouter_key:
    print("WARNING: No OpenRouter API key found, test will likely fail")

# Test prompt
user_prompt = "Tell me what you know about our brand in 2-3 sentences."
print(f"\n=== Testing Agent Response ===")
print(f"User prompt: {user_prompt}")

try:
    # Run the agent loop
    print("\nCalling agent executor...")
    response = run_agent_loop(user_prompt)
    
    # Display the response
    print("\n=== Agent Response ===")
    print(response)
    
    # Check the chat history
    from apps.agents.departments.marketing.cmo_executor import chat_history
    
    print(f"\n=== Chat History (last 2 messages) ===")
    if chat_history and len(chat_history) > 0:
        for i, msg in enumerate(chat_history[-2:]):
            print(f"Message {i+1}:")
            print(f"  Type: {type(msg)}")
            print(f"  Content: {getattr(msg, 'content', 'No content')[:100]}...")
            
            if hasattr(msg, "metadata") and msg.metadata:
                print(f"  Metadata: {msg.metadata}")
            else:
                print("  No metadata")
    else:
        print("No chat history available")
    
    # Show how it would be displayed in the UI
    print("\n=== UI Display Simulation ===")
    
    # Get the last message metadata
    if chat_history and len(chat_history) > 0:
        last_message = chat_history[-1]
        metadata = getattr(last_message, "metadata", {})
        task_type = metadata.get("task_type", "default")
        model = metadata.get("model", "unknown")
        
        # Format model display name
        if "/" in model:
            model_short = model.split("/")[-1]
        else:
            model_short = model
            
        # Guard against "unknown" model
        if model_short == "unknown":
            if task_type == "marketing":
                model_display = "Gemini"
            elif task_type == "writing":
                model_display = "GPT-4.1"
            else:
                model_display = "GPT-4.1"
        else:
            model_display = model_short.replace("-", " ").replace("_", " ")
            
        print(f"Task Type Badge: {task_type}")
        print(f"Model Badge: {model_display}")
        print(f"Message Content: {getattr(last_message, 'content', 'No content')[:100]}...")
    else:
        print("No message to display")
    
except Exception as e:
    print(f"Error: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n=== Test completed ===") 