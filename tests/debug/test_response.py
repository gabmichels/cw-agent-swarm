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

# Import our test modules
from apps.agents.shared.llm_router import get_llm

print("\n=== Testing Direct LLM Response Handling ===")

# Check environment variables
openrouter_key = os.getenv("OPENROUTER_API_KEY")
print(f"OPENROUTER_API_KEY set: {'Yes' if openrouter_key else 'No'}")

if not openrouter_key:
    print("ERROR: No API key found. Please set OPENROUTER_API_KEY in your environment.")
    sys.exit(1)

# Test with a simple prompt
test_prompt = "Write a short paragraph about crowd wisdom."

try:
    # Get LLM directly (writing task type)
    print("\nGetting LLM for 'writing' task...")
    llm = get_llm("writing", temperature=0.7)
    print(f"Using model: {llm.model_name}")
    
    # Invoke the LLM directly (no agent)
    print("\nInvoking LLM directly...")
    response = llm.invoke(test_prompt)
    
    # Debug the response
    print("\n=== Response Debug ===")
    print(f"Response type: {type(response)}")
    print(f"Full response: {response}")
    
    if hasattr(response, "content"):
        print(f"Response content: {response.content}")
    
    if hasattr(response, "additional_kwargs"):
        print(f"Response additional_kwargs: {response.additional_kwargs}")
    
    # Try to extract content using all the methods from our parser
    print("\n=== Testing Content Extraction ===")
    
    # Method 1: Check for content attribute
    if hasattr(response, "content"):
        content = response.content
        print(f"Method 1 (content attribute): {content[:100]}...")
    else:
        print("Method 1 failed: No content attribute")
    
    # Method 2: Check for choices[0].message.content
    if isinstance(response, dict) and "choices" in response:
        choices = response["choices"]
        if choices and isinstance(choices[0], dict) and "message" in choices[0]:
            message = choices[0]["message"]
            if isinstance(message, dict) and "content" in message:
                content = message["content"]
                print(f"Method 2 (choices): {content[:100]}...")
            else:
                print("Method 2 failed: No message.content")
        else:
            print("Method 2 failed: No valid choices")
    else:
        print("Method 2 failed: Not a dict or no choices")
    
    # Method 3: Convert to string
    string_content = str(response)
    print(f"Method 3 (string conversion): {string_content[:100]}...")
    
    print("\n=== Content extraction test complete ===")
    
except Exception as e:
    print(f"Error: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n=== Test completed ===") 