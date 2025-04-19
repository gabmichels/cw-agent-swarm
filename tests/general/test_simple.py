print("Testing imports...")
try:
    print("Importing Chroma...")
    from langchain_community.vectorstores import Chroma
    print("✅ Chroma imported successfully!")
except Exception as e:
    print(f"❌ Error importing Chroma: {str(e)}")

print("Done!") 