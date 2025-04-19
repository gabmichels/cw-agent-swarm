print("=== Testing Chroma imports ===")

# Try the new approach
try:
    print("Trying langchain_community.vectorstores.Chroma")
    from langchain_community.vectorstores import Chroma
    print("✅ Success! This approach works.")
except Exception as e:
    print(f"❌ Error: {str(e)}")

# Try alternative
try:
    print("\nTrying chromadb directly")
    import chromadb
    print(f"✅ Success! chromadb version: {chromadb.__version__}")
except Exception as e:
    print(f"❌ Error: {str(e)}")
    print("You may need to install chromadb with: pip install chromadb")

# Final verdict
print("\n=== Recommendation ===")
print("1. If langchain_community.vectorstores worked: Keep using it")
print("2. If only chromadb worked: You need to configure the vectorstore differently")
print("3. If neither worked: Install the missing packages with pip")
print("Done!") 