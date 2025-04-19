import os
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
print("Loading environment variables...")
load_dotenv("apps/hq-ui/.env")

# Check API keys
print("\n=== Environment Variables ===")
openrouter_key = os.getenv("OPENROUTER_API_KEY")
print(f"OPENROUTER_API_KEY set: {'Yes' if openrouter_key else 'No'}")

if not openrouter_key:
    print("ERROR: No OpenRouter API key found!")
    exit(1)

print("\n=== Testing OpenRouter with Direct OpenAI Client ===")

# Create OpenRouter client using the OpenAI SDK directly
try:
    print("\nCreating OpenAI client with OpenRouter base URL...")
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=openrouter_key,
        # Headers are passed directly as HTTP headers
        default_headers={
            "HTTP-Referer": "https://crowd-wisdom.com",
            "X-Title": "Chloe AI CMO"
        }
    )
    
    print("Client created successfully!")
    
    # Try a simple completion
    print("\nTesting completion...")
    response = client.chat.completions.create(
        model="openai/gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": "Say hello in exactly 5 words"}
        ],
        temperature=0.1
    )
    
    content = response.choices[0].message.content
    print(f"OpenRouter Response: {content}")
    
    print("OpenRouter test completed successfully!")
except Exception as e:
    print(f"OpenRouter Error: {str(e)}")
    import traceback
    traceback.print_exc() 