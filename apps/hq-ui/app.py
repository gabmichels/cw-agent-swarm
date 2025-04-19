import streamlit as st
import json
import os
from datetime import datetime, timedelta
from langchain_openai import OpenAI
import random
from pathlib import Path

from apps.agents.departments.marketing.cmo_executor import run_agent_loop
from apps.agents.shared.tools.memory_loader import retrieve_similar_chats
from apps.agents.shared.memory.reflection import reflection_system

# === Layout + Config ===
st.set_page_config(page_title="Crowd Wisdom HQ", layout="wide")

# === Custom CSS ===
st.markdown("""
<style>
    /* Message styling */
    .user-bubble {
        background-color: #7D8F69;
        color: white;
        border-radius: 15px;
        padding: 10px 15px;
        margin: 5px 0;
        display: inline-block;
        max-width: 80%;
        float: right;
        clear: both;
    }
    
    .agent-bubble {
        background-color: #444444;
        color: white;
        border-radius: 15px;
        padding: 10px 15px;
        margin: 5px 0;
        display: inline-block;
        max-width: 80%;
        float: left;
        clear: both;
    }
    
    /* Style for name within bubbles */
    .message-sender {
        font-weight: bold;
        margin-bottom: 5px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.3);
        padding-bottom: 5px;
        display: flex;
        justify-content: space-between;
    }
    
    /* Badge styling */
    .badge {
        display: inline-block;
        padding: 2px 6px;
        font-size: 11px;
        border-radius: 10px;
        margin-left: 5px;
        font-weight: normal;
    }
    
    .badge-task {
        background-color: #3498db;
    }
    
    .badge-model {
        background-color: #2ecc71;
    }
    
    .badge-default {
        background-color: #95a5a6;
    }
    
    .badge-marketing {
        background-color: #9b59b6;
    }
    
    .badge-writing {
        background-color: #f39c12;
    }
    
    .badge-finance {
        background-color: #1abc9c;
    }
    
    .badge-research {
        background-color: #e74c3c;
    }
    
    .badge-tool {
        background-color: #34495e;
    }
    
    .badge-error {
        background-color: #e74c3c;
    }
    
    /* Timestamp styling */
    .timestamp {
        font-size: 11px;
        opacity: 0.8;
        font-weight: normal;
    }
    
    /* Add extra space at bottom to prevent content from being hidden */
    .content-padding {
        padding-bottom: 30px;
    }
    
    /* Style the chat messages area */
    .chat-messages {
        max-height: 600px;
        overflow-y: auto;
    }
    
    /* Hide the sidebar-form text */
    .sidebar-form-text {
        display: none;
        visibility: hidden;
    }
    
    /* Make input taller */
    .stTextInput textarea {
        height: 80px !important;
        min-height: 80px !important;
    }
    
    /* Style the send button */
    [data-testid="stForm"] .stButton button {
        width: 100%;
        margin-top: 10px;
        background-color: #4CAF50;
        color: white;
    }
    
    /* Additional form styling */
    [data-testid="stForm"] {
        background: #333;
        padding: 15px;
        border-radius: 8px;
        margin-top: 20px;
    }
</style>
""", unsafe_allow_html=True)

st.title("🤖 Crowd Wisdom HQ")

# === Agent Registry ===
AGENT_REGISTRY = {
    "Marketing": ["Chloe (CMO)"],
    # "Support": ["Support Agent"], etc.
}

# === Sidebar: Department + Agent Selection ===
st.sidebar.header("Departments")
selected_dept = st.sidebar.selectbox("Select Department", list(AGENT_REGISTRY.keys()))
selected_agent = st.sidebar.radio("Employees", AGENT_REGISTRY[selected_dept])

# === Chat Memory Path ===
MEMORY_DIR = Path("./apps/hq-ui/history/")
MEMORY_DIR.mkdir(parents=True, exist_ok=True)
chat_file = MEMORY_DIR / f"{selected_agent.lower().replace(' ', '_').replace('(', '').replace(')', '')}_chat.json"

# === Load Chat History ===
if chat_file.exists():
    chat_history = json.loads(chat_file.read_text())
else:
    chat_history = []

# === Add Chat Input to Sidebar ===
st.sidebar.markdown("---")
st.sidebar.markdown("### 💬 Chat with Chloe")

# Use form directly without the HTML wrapper
with st.sidebar.form(key="sidebar_chat_form", clear_on_submit=True):
    # Use text_area instead of text_input for more height
    user_input = st.text_area("Your message", placeholder="Type your message here...", height=80, max_chars=1000, key="sidebar_input")
    # Add a processing status indicator that will show after submission
    status_placeholder = st.empty()
    submitted = st.form_submit_button("Send")

# === Process new messages ===
if submitted and user_input.strip() != "":
    # Simple approach - show a message in the main area
    loading_message = st.empty()
    loading_message.info("Processing your message... This might take a moment.")
    
    # Process the message
    agent_response = run_agent_loop(user_input)
    
    # Get last message from chat history (from the agent object)
    from apps.agents.departments.marketing.cmo_executor import chat_history as agent_chat_history
    
    # Extract the last AI message metadata if available
    metadata = {}
    if agent_chat_history and len(agent_chat_history) > 0:
        last_message = agent_chat_history[-1]
        # Copy metadata if available
        if hasattr(last_message, "metadata") and last_message.metadata:
            metadata = last_message.metadata
    
    # Update history with timestamp for user message
    from datetime import datetime
    user_msg = {"role": "user", "message": user_input, "timestamp": datetime.now().isoformat()}
    chat_history.append(user_msg)
    
    # Add agent response with metadata
    agent_msg = {"role": "agent", "message": agent_response, "metadata": metadata}
    chat_history.append(agent_msg)
    
    # Save to file
    with open(chat_file, "w", encoding="utf-8") as f:
        json.dump(chat_history, f, indent=2)
    
    # Clear the loading message
    loading_message.empty()
    
    # Refresh the page to show new messages
    st.rerun()

# === Main Content Area ===
main_container = st.container()

with main_container:
    st.markdown('<div class="content-padding">', unsafe_allow_html=True)
    # === Top Dashboard Boxes ===
    st.markdown("### Weekly Summary")

    col1, col2, col3 = st.columns(3)

    with col1:
        st.markdown("##### 🧠 Reflection of the Week")
        try:
            latest_reflections = reflection_system.get_latest_reflections(1)
            if latest_reflections:
                reflection = latest_reflections[0]
                st.info(f"{reflection['content'][:350]}...")
            else:
                st.info("No reflections are available yet. Ask Chloe to run a reflection.")
        except Exception as e:
            st.info("Ask Chloe to reflect on recent work to see insights here.")

    with col2:
        st.markdown("##### 💭 Thought Preview")
        thought = retrieve_similar_chats("what is Chloe currently thinking about?")[:300]
        st.success(thought + "...")

    with col3:
        st.markdown("##### 🔥 Important Updates")
        # Try to get important memories first
        try:
            from apps.agents.shared.memory.episodic_memory import get_important_recent_memories, IMPORTANCE_HIGH
            important_memories = get_important_recent_memories(days=14, importance_level=IMPORTANCE_HIGH)
            
            if important_memories:
                memory = important_memories[0]
                highlights = memory.get('content', '')[:300]
                st.warning(highlights + "...")
            else:
                # Fallback to the old method
                highlights = retrieve_similar_chats("what important marketing actions happened recently?")[:300]        
                st.warning(highlights + "...")
        except Exception:
            # Fallback if memory module fails
            highlights = retrieve_similar_chats("what important marketing actions happened recently?")[:300]        
            st.warning(highlights + "...")

    # === Agent Files Row ===
    st.markdown("### Agent Files")
    file_col1, file_col2, file_col3, file_col4, file_col5 = st.columns(5)

    with file_col1:
        st.markdown("**Agent Files:**")

    with file_col2:
        reflections_path = Path("apps/agents/shared/memory/reflections.json")
        if reflections_path.exists():
            st.markdown("🧠 Reflections")
            if st.button("View Reflections", key="view_reflections"):
                with open(reflections_path, "r") as f:
                    reflection_data = json.load(f)
                    st.json(reflection_data)

    with file_col3:
        task_log_path = "apps/agents/shared/memory/task_log.md"
        if Path(task_log_path).exists():
            st.markdown("📋 Task Log")
            if st.button("View Tasks", key="view_tasks"):
                with open(task_log_path, "r") as f:
                    st.markdown(f.read())
        else:
            st.markdown("📋 Task Log (not yet created)")

    with file_col4:
        goals_path = "apps/agents/shared/memory/marketing_goals.md"
        if Path(goals_path).exists():
            st.markdown("🎯 Marketing Goals")
            if st.button("View Goals", key="view_goals"):
                with open(goals_path, "r") as f:
                    st.markdown(f.read())
        else:
            st.markdown("🎯 Marketing Goals (not yet created)")
        
    with file_col5:
        memory_path = Path("apps/agents/shared/memory/episodic_memories.json")
        if memory_path.exists():
            st.markdown("🧩 Episodic Memory")
            if st.button("View Memories", key="view_memories"):
                with open(memory_path, "r") as f:
                    memory_data = json.load(f)
                    st.json(memory_data)
        else:
            st.markdown("🧩 Episodic Memory (not yet created)")

    # === Chat UI ===
    st.markdown("## 💬 Conversation History")
    
    def format_timestamp(timestamp_str):
        """Format a ISO timestamp string to a readable format."""
        if not timestamp_str:
            return ""
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(timestamp_str)
            return dt.strftime("%b %d, %I:%M %p")
        except:
            return ""

    # Chat messages in scrollable container
    st.markdown('<div class="chat-messages">', unsafe_allow_html=True)
    for msg in chat_history:
        if msg["role"] == "user":
            st.markdown(f'''
            <div class="user-bubble">
                <div class="message-sender">
                    <span>🧠 You</span>
                    <span class="timestamp">{format_timestamp(msg.get("timestamp", ""))}</span>
                </div>
                {msg["message"]}
            </div>
            ''', unsafe_allow_html=True)
        else:
            # Get metadata if available
            metadata = msg.get("metadata", {})
            task_type = metadata.get("task_type", "default")
            model = metadata.get("model", "unknown")
            timestamp = metadata.get("timestamp", "")
            
            # Set default display text for error cases
            if task_type in ["error", "critical_error"]:
                badge_color = "badge-error"
                task_type_display = "Error"
                model_display = "N/A"
            else:
                badge_color = f"badge-{task_type.split()[0]}"  # Handle "default (fallback)" case
                task_type_display = task_type.replace("_", " ").title()
                
                # Format model to be more readable - extract just the model name without provider
                if "/" in model:
                    model_short = model.split("/")[-1]
                else:
                    model_short = model
                    
                # Format model to be more readable
                model_display = model_short.replace("-", " ").replace("_", " ")
            
            st.markdown(f'''
            <div class="agent-bubble">
                <div class="message-sender">
                    <span>
                        🤖 Chloe
                        <span class="badge {badge_color}">{task_type_display}</span>
                        <span class="badge badge-model">{model_display}</span>
                    </span>
                    <span class="timestamp">{format_timestamp(timestamp)}</span>
                </div>
                {msg["message"]}
            </div>
            ''', unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)
    
    st.markdown('</div>', unsafe_allow_html=True) 