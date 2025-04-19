import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

# Load environment variables
print("Loading environment variables...")
load_dotenv("apps/hq-ui/.env")

# Check API keys
print("\n=== Environment Variables ===")
openai_key = os.getenv("OPENAI_API_KEY")
openrouter_key = os.getenv("OPENROUTER_API_KEY")
print(f"OPENAI_API_KEY set: {'Yes' if openai_key else 'No'}")
print(f"OPENROUTER_API_KEY set: {'Yes' if openrouter_key else 'No'}")

if not openrouter_key:
    print("ERROR: No OpenRouter API key found!")
    exit(1)

print("\n=== Testing OpenRouter Integration ===")

# Create OpenRouter headers according to documentation
headers = {
    "HTTP-Referer": "https://crowd-wisdom.com", 
    "X-Title": "Chloe AI CMO"
}
print(f"Using OpenRouter headers: {headers}")

# Create model with correct headers structure
try:
    print("\nCreating ChatOpenAI with OpenRouter...")
    openrouter_llm = ChatOpenAI(
        model="openai/gpt-3.5-turbo",  # Use a simple model for testing
        temperature=0.1,
        base_url="https://openrouter.ai/api/v1",
        api_key=openrouter_key,
        default_headers=headers  # Use default_headers instead of extra_kwargs
    )
    
    print(f"LLM created successfully with model: {openrouter_llm.model_name}")
    
    # Try a simple completion
    print("\nTesting completion with OpenRouter...")
    response = openrouter_llm.invoke("Say hello in exactly 5 words")
    print(f"OpenRouter Response: {response.content}")
    
    print("OpenRouter test completed successfully!")
except Exception as e:
    print(f"OpenRouter Error: {str(e)}")
    import traceback
    traceback.print_exc() 