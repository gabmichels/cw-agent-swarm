import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

# Load environment variables
print("Loading environment variables...")
load_dotenv("apps/hq-ui/.env")

# Check API key
api_key = os.getenv("OPENROUTER_API_KEY")
if not api_key:
    print("ERROR: No OPENROUTER_API_KEY found")
    exit(1)

print(f"Found OpenRouter API key: {api_key[:8]}...")

# Define models to test
models_to_test = [
    "openai/gpt-3.5-turbo",
    "openai/gpt-4o",
]

# Test multiple models via OpenRouter
for model in models_to_test:
    print(f"\nTesting model: {model}")
    
    try:
        llm = ChatOpenAI(
            model=model,
            temperature=0.1,
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            default_headers={
                "HTTP-Referer": "https://crowd-wisdom.com",
                "X-Title": "Chloe AI CMO"
            }
        )
        
        print(f"LLM created successfully with model: {llm.model_name}")
        
        # Try a simple completion
        print("Testing completion...")
        response = llm.invoke("Say hello in exactly 5 words")
        print(f"Response: {response.content}")
        
        print(f"Test completed successfully for {model}!")
    except Exception as e:
        print(f"Error with {model}: {str(e)}")
        import traceback
        traceback.print_exc() 