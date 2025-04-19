import os
from dotenv import load_dotenv
from apps.agents.shared.llm_router import get_llm

# Load environment variables
print("Loading environment variables...")
load_dotenv("apps/hq-ui/.env")

# Ensure environment variable is set
if 'OPENROUTER_API_KEY' not in os.environ and 'OPENAI_API_KEY' not in os.environ:
    print("Please set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable")
    exit(1)

print("Testing LLM initialization...")
try:
    llm = get_llm('default')
    print("✅ LLM initialized successfully!")
    print(f"Model: {llm.model_name}")
except Exception as e:
    print(f"❌ Error: {str(e)}") 