import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv("apps/hq-ui/.env")

# Get API key
api_key = os.getenv("OPENROUTER_API_KEY")
if not api_key:
    print("ERROR: No OPENROUTER_API_KEY found in environment variables")
    exit(1)

print(f"Found API key: {api_key[:8]}...{api_key[-4:]}")

# Define headers and test payload
headers = {
    "Authorization": f"Bearer {api_key}",
    "HTTP-Referer": "https://crowd-wisdom.com", 
    "X-Title": "Chloe AI CMO",
    "Content-Type": "application/json"
}

print(f"Using headers: {headers}")

payload = {
    "model": "openai/gpt-3.5-turbo",  # Using a smaller, faster model for testing
    "messages": [
        {
            "role": "user",
            "content": "Hello, this is a test. Please respond with a single sentence."
        }
    ]
}

# Make the API call
print("Making API call to OpenRouter...")
try:
    response = requests.post(
        url="https://openrouter.ai/api/v1/chat/completions",
        headers=headers,
        data=json.dumps(payload)
    )
    
    # Check response
    if response.status_code == 200:
        print("API call successful!")
        result = response.json()
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "No content")
        print(f"Response: {content}")
    else:
        print(f"API call failed with status code: {response.status_code}")
        print(f"Error: {response.text}")
except Exception as e:
    print(f"Exception occurred: {str(e)}") 