import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables if available
load_dotenv("apps/hq-ui/.env")

# Get API key - use environment variable or set directly here for testing
api_key = os.getenv("OPENROUTER_API_KEY", "test_key")

# OpenRouter endpoint
url = "https://openrouter.ai/api/v1/chat/completions"

# Headers
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {api_key}",
    "HTTP-Referer": "https://crowd-wisdom.com",
    "X-Title": "Chloe AI CMO"
}

# Request body
payload = {
    "model": "openai/gpt-3.5-turbo", # Using a cheaper model for testing
    "messages": [
        {"role": "system", "content": "You are Chloe, a helpful marketing assistant."},
        {"role": "user", "content": "Write a short marketing slogan for a coffee shop."}
    ]
}

# Print request details
print("=== OpenRouter API Direct Test ===")
print(f"URL: {url}")
print(f"Headers (excluding Authorization): {', '.join([f'{k}={v}' for k, v in headers.items() if k != 'Authorization'])}")
print(f"Payload: {json.dumps(payload, indent=2)}")

try:
    # Make the request
    print("\nSending request to OpenRouter...")
    response = requests.post(url, headers=headers, json=payload)
    
    # Check the response status
    print(f"Response status code: {response.status_code}")
    
    if response.status_code == 200:
        # Parse the response
        data = response.json()
        print("\n=== Response Data ===")
        print(f"Response ID: {data.get('id', 'N/A')}")
        print(f"Model: {data.get('model', 'Unknown')}")
        
        # Print the generated content
        if 'choices' in data and len(data['choices']) > 0:
            content = data['choices'][0].get('message', {}).get('content', 'No content available')
            print(f"\nGenerated content: {content}")
            
            # Show raw message data for debugging
            print("\nRaw message data:")
            print(json.dumps(data['choices'][0].get('message', {}), indent=2))
        else:
            print("No choices in response")
            
        # Print the full response for debugging
        print("\nFull response data:")
        print(json.dumps(data, indent=2))
    else:
        print(f"Error response: {response.text}")
except Exception as e:
    print(f"Error: {str(e)}")

print("\n=== Test completed ===") 