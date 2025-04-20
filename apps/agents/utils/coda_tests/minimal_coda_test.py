import os
import sys
from pathlib import Path
from dotenv import load_dotenv

print("Minimal Coda Test Starting...")

# Find and load environment variables
env_file = Path.cwd() / '.env'
if env_file.exists():
    print(f"Loading .env from {env_file}")
    load_dotenv(env_file)
else:
    print("Warning: .env file not found in current directory")
    # Try apps/hq-ui directory
    possible_locations = [
        Path.cwd() / 'apps' / 'hq-ui' / '.env',
        Path.cwd().parent / 'apps' / 'hq-ui' / '.env',
        Path.cwd().parent / '.env',
    ]
    for env_path in possible_locations:
        if env_path.exists():
            print(f"Loading .env from {env_path}")
            load_dotenv(str(env_path))
            break

# Ensure project root is in path
workspace_path = Path.cwd()
# Try to find workspace root (directory containing apps folder)
for _ in range(5):  # Check up to 5 levels
    if (workspace_path / 'apps').exists():
        print(f"Found workspace root: {workspace_path}")
        sys.path.insert(0, str(workspace_path))
        break
    workspace_path = workspace_path.parent

print("\n--- Environment Check ---")
print(f"Current directory: {Path.cwd()}")
print(f"Python sys.path[0]: {sys.path[0] if sys.path else None}")

# Manually check for Coda API token
coda_token = os.environ.get("CODA_API_TOKEN")
print(f"CODA_API_TOKEN present: {'Yes' if coda_token else 'No'}")

print("\n--- Direct Configuration Check ---")
try:
    print("Attempting to import config...")
    from apps.agents.shared.config import CODA_AVAILABLE
    print(f"CODA_AVAILABLE from config: {CODA_AVAILABLE}")
except ImportError as e:
    print(f"Import error: {str(e)}")
    print("Could not import config module. Check project structure.")

print("\n--- Testing Coda Client ---")
try:
    print("Attempting to import CodaClient...")
    from apps.agents.shared.tools.coda_client import CodaClient
    print("Successfully imported CodaClient")
    
    # Create client without doing anything else
    client = CodaClient()
    print(f"CodaClient instance created with token: {'Yes' if client.api_token else 'No'}")
    
    # List documents as a simple test
    try:
        print("Listing documents (max 5)...")
        docs = client.list_documents(limit=5)
        print(f"Found {len(docs)} documents")
        for i, doc in enumerate(docs):
            print(f"  {i+1}. {doc.get('name', 'Unnamed')} (ID: {doc.get('id', 'unknown')})")
    except Exception as doc_err:
        print(f"Error listing documents: {str(doc_err)}")
except ImportError:
    print("Could not import CodaClient directly. Trying through cmo_tools...")
    # Try through cmo_tools as fallback
    try:
        from apps.agents.shared.tools.cmo_tools import list_coda_documents
        print("Successfully imported list_coda_documents function")
        
        # Test the function
        try:
            print("Listing documents through cmo_tools...")
            result = list_coda_documents(limit=5)
            print(f"Function returned: {result}")
        except Exception as func_err:
            print(f"Error calling list_coda_documents: {str(func_err)}")
    except ImportError as ie:
        print(f"Also could not import from cmo_tools: {str(ie)}")

print("\nTest completed") 