from openai import OpenAI
import sys
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add the root directory to the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))
from shared.tools.memory_loader import get_memory_vectorstore

def plan_weekly_strategy():
    vectordb = get_memory_vectorstore()
    retriever = vectordb.as_retriever()
    
    # Use the newer invoke method instead of get_relevant_documents
    context = retriever.invoke("What should we prioritize this week?")
    docs_text = '\n\n'.join([doc.page_content for doc in context])

    client = OpenAI()
    
    prompt = f"""
    You are the Chief Marketing Officer of a startup called Crowd Wisdom.

    Based on the internal knowledge below, create a weekly strategy plan with:
    - Main goal of the week
    - 2–3 campaign ideas
    - Target audiences
    - Recommended channels
    - Metrics to track

    Internal knowledge:
    {docs_text}
    """

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.4,
    )
    
    # Return the strategy directly - Discord notification handled in main.py
    return response.choices[0].message.content
