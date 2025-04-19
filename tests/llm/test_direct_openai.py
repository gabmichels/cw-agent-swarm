import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

# Load environment variables
print("Loading environment variables...")
load_dotenv("apps/hq-ui/.env")

# Check API key
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    print("ERROR: No OPENAI_API_KEY found")
    exit(1)

print(f"Found OpenAI API key: {api_key[:8]}...")

# Create a direct OpenAI client
print("Creating ChatOpenAI client...")
try:
    llm = ChatOpenAI(
        model="gpt-3.5-turbo",  # Use a simpler model for testing
        temperature=0.1,
        api_key=api_key
    )
    
    print(f"LLM created successfully with model: {llm.model_name}")
    
    # Try a simple completion
    print("\nTesting completion...")
    response = llm.invoke("Say hello in exactly 5 words")
    print(f"Response: {response.content}")
    
    print("Test completed successfully!")
except Exception as e:
    print(f"Error: {str(e)}")
    import traceback
    traceback.print_exc() 