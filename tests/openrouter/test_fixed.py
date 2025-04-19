import os
import sys
from langchain_core.messages import HumanMessage
from dotenv import load_dotenv

# Add the parent directory to the path so we can import from apps
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load environment variables
load_dotenv("apps/hq-ui/.env")

# Import the LLM router
from apps.agents.shared.llm_router import get_llm, log_model_response

# Check environment variables
openai_key = os.getenv("OPENAI_API_KEY")
openrouter_key = os.getenv("OPENROUTER_API_KEY")
print(f"OpenAI API key set: {'Yes' if openai_key else 'No'}")
print(f"OpenRouter API key set: {'Yes' if openrouter_key else 'No'}")

if not openrouter_key:
    # Set a test key for demonstration (this won't actually work)
    os.environ["OPENROUTER_API_KEY"] = "test_key_for_debugging"
    print("WARNING: Using test key for demonstration purposes only")

# Create an LLM instance
print("\n=== Creating LLM instance ===")
llm = get_llm("marketing", temperature=0.4)

# Inspect the LLM
print(f"LLM model name: {llm.model_name}")
print(f"LLM class: {llm.__class__.__name__}")
print(f"LLM default_headers: {getattr(llm, 'default_headers', 'No default_headers attribute')}")

# Try a direct test with hardcoded parameters to confirm the structure
print("\n=== Testing direct initialization ===")
try:
    from langchain_openai import ChatOpenAI
    from apps.agents.shared.patched_chat_openai import PatchedChatOpenAI
    
    # Create with correct headers parameter
    headers = {
        "HTTP-Referer": "https://crowd-wisdom.com",
        "X-Title": "Chloe AI CMO"
    }
    
    print("\nTesting direct ChatOpenAI initialization:")
    direct_llm = ChatOpenAI(
        model="openai/gpt-3.5-turbo",
        temperature=0.2,
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY", "test_key"),
        default_headers=headers  # This is the correct parameter
    )
    
    print(f"Direct LLM default_headers: {getattr(direct_llm, 'default_headers', 'No default_headers attribute')}")
    
    print("\nTesting PatchedChatOpenAI initialization:")
    patched_llm = PatchedChatOpenAI(
        model="openai/gpt-3.5-turbo",
        temperature=0.2,
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY", "test_key"),
        default_headers=headers  # This is the correct parameter
    )
    
    print(f"Patched LLM default_headers: {getattr(patched_llm, 'default_headers', 'No default_headers attribute')}")
    
except Exception as e:
    print(f"Error in direct test: {str(e)}")

# Try an invocation if we have a real API key
if openrouter_key:
    print("\n=== Testing LLM invocation with real API key ===")
    try:
        response = llm.invoke("Write a very short marketing slogan for a coffee shop.")
        print(f"Response content: {response.content}")
        print("Model information:")
        log_model_response(response)
    except Exception as e:
        print(f"Error in invocation: {str(e)}")
else:
    print("\nSkipping invocation test - no real API key available")

print("\n=== Test completed ===") 