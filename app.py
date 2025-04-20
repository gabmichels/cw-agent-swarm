"""
Chloe Agent UI
-------------
Streamlit interface for interacting with the Chloe agent.
"""

import streamlit as st
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Ensure proper imports from project root
script_dir = Path(os.path.dirname(os.path.abspath(__file__)))
project_root = script_dir  # Already at root
sys.path.insert(0, str(project_root))

# Load environment variables
load_dotenv()

# Import agent
from agents.chloe.main import run_chloe, AGENT_NAME

# Set page config
st.set_page_config(
    page_title=f"{AGENT_NAME} - CMO Agent",
    page_icon="🤖",
    layout="wide"
)

# Initialize session state for chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

# Header
st.title(f"💬 Chat with {AGENT_NAME}")
st.markdown(f"*Your AI Chief Marketing Officer*")

# Display chat messages
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.write(message["content"])

# Chat input
if prompt := st.chat_input("Ask me anything about marketing..."):
    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": prompt})
    
    # Display user message
    with st.chat_message("user"):
        st.write(prompt)
    
    # Generate AI response
    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            response = run_chloe(prompt)
            st.write(response)
    
    # Add AI response to chat history
    st.session_state.messages.append({"role": "assistant", "content": response})

# Sidebar
with st.sidebar:
    st.header(f"About {AGENT_NAME}")
    st.markdown("""
    ### Chief Marketing Officer AI
    
    Chloe specializes in:
    - Content strategy
    - Marketing planning
    - Campaign analysis
    - Brand management
    
    This agent uses a modular architecture with shared components for easy extension.
    """)
    
    # Clear chat button
    if st.button("Clear Chat"):
        st.session_state.messages = []
        st.experimental_rerun() 