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
from apps.agents.shared.autonomy.behavior_loop import run_behavior_loop, LoopExecutionMode

# === Layout + Config ===
st.set_page_config(page_title="Crowd Wisdom HQ", layout="wide")

# === Initialize Session State ===
if 'current_view' not in st.session_state:
    st.session_state.current_view = 'chat'
if 'resource_title' not in st.session_state:
    st.session_state.resource_title = ''
if 'resource_content' not in st.session_state:
    st.session_state.resource_content = ''
if 'resource_type' not in st.session_state:
    st.session_state.resource_type = ''
if 'scroll_to_bottom' not in st.session_state:
    st.session_state.scroll_to_bottom = False

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
    
    /* Typing indicator animation */
    .typing-indicator {
        display: flex;
        align-items: center;
        margin-top: 5px;
    }
    
    .typing-indicator span {
        height: 8px;
        width: 8px;
        background: rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        display: inline-block;
        margin-right: 5px;
        animation: typing 1s infinite ease-in-out;
    }
    
    .typing-indicator span:nth-child(1) {
        animation-delay: 0s;
    }
    
    .typing-indicator span:nth-child(2) {
        animation-delay: 0.2s;
    }
    
    .typing-indicator span:nth-child(3) {
        animation-delay: 0.4s;
    }
    
    @keyframes typing {
        0% {
            transform: translateY(0px);
            opacity: 0.4;
        }
        50% {
            transform: translateY(-5px);
            opacity: 1;
        }
        100% {
            transform: translateY(0px);
            opacity: 0.4;
        }
    }
    
    /* Floating scroll to bottom button */
    .scroll-to-bottom-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background-color: #4CAF50;
        color: white;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        font-size: 24px;
        opacity: 0.8;
        transition: opacity 0.3s, transform 0.3s;
    }
    
    .scroll-to-bottom-btn:hover {
        opacity: 1;
        transform: scale(1.05);
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

# Function to switch to chat view
def switch_to_chat():
    st.session_state.current_view = 'chat'
    st.session_state.resource_title = ''
    st.session_state.resource_content = ''
    st.session_state.resource_type = ''

# === Add Dropdown Menu for Actions and File Access ===
st.sidebar.markdown("---")
st.sidebar.markdown("### 🔧 Actions & Resources")

# Create the dropdown menu for actions and file resources
action_option = st.sidebar.selectbox(
    "Select Action or Resource",
    [
        "Select an action...",
        "🚀 Run Daily Routine (Auto Mode)",
        "🔎 Run Daily Routine (Simulation Mode)",
        "👁️ View Reflections",
        "📋 View Tasks",
        "🧠 View Episodic Memory",
        "🎯 View Marketing Goals"
    ]
)

# Process the selected option
if action_option == "🚀 Run Daily Routine (Auto Mode)":
    if st.sidebar.button("Confirm Run"):
        # Start automatic behavior loop
        with st.spinner("Running Chloe's daily routine..."):
            try:
                result = run_behavior_loop(LoopExecutionMode.AUTOMATIC)
                st.sidebar.success(f"Completed action: {result['action']}")
                
                if result['action'] == 'task':
                    st.sidebar.info(f"Task: {result['task_title']}")
                elif result['action'] == 'idle':
                    st.sidebar.info(f"Idle activity: {result['activity']}")
                elif result['action'] == 'escalation':
                    st.sidebar.warning(f"Escalation reason: {result['reason']}")
            except Exception as e:
                st.sidebar.error(f"Error running routine: {str(e)}")

elif action_option == "🔎 Run Daily Routine (Simulation Mode)":
    if st.sidebar.button("Confirm Simulation"):
        # Start simulation behavior loop
        with st.spinner("Simulating Chloe's daily routine..."):
            try:
                result = run_behavior_loop(LoopExecutionMode.SIMULATION)
                st.sidebar.success(f"Simulated action: {result['action']}")
                
                if result['action'] == 'task':
                    st.sidebar.info(f"Task: {result['task_title']}")
                elif result['action'] == 'idle':
                    st.sidebar.info(f"Idle activity: {result['activity']}")
                elif result['action'] == 'escalation':
                    st.sidebar.warning(f"Escalation reason: {result['reason']}")
            except Exception as e:
                st.sidebar.error(f"Error simulating routine: {str(e)}")

elif action_option == "👁️ View Reflections":
    reflections_path = Path("apps/agents/shared/memory/reflections.json")
    if reflections_path.exists():
        if st.sidebar.button("Show Reflections"):
            with open(reflections_path, "r") as f:
                st.session_state.resource_title = "👁️ Reflections"
                st.session_state.resource_content = json.load(f)
                st.session_state.resource_type = 'json'
                st.session_state.current_view = 'resource'
    else:
        st.sidebar.warning("Reflections file not found")

elif action_option == "📋 View Tasks":
    task_log_path = "apps/agents/shared/memory/task_log.md"
    if Path(task_log_path).exists():
        if st.sidebar.button("Show Tasks"):
            with open(task_log_path, "r") as f:
                st.session_state.resource_title = "📋 Task Log"
                st.session_state.resource_content = f.read()
                st.session_state.resource_type = 'markdown'
                st.session_state.current_view = 'resource'
    else:
        st.sidebar.warning("Task log file not found")

elif action_option == "🧠 View Episodic Memory":
    memory_path = Path("apps/agents/shared/memory/episodic_memories.json")
    if memory_path.exists():
        if st.sidebar.button("Show Episodic Memory"):
            with open(memory_path, "r") as f:
                st.session_state.resource_title = "🧠 Episodic Memory"
                st.session_state.resource_content = json.load(f)
                st.session_state.resource_type = 'json'
                st.session_state.current_view = 'resource'
    else:
        st.sidebar.warning("Episodic memory file not found")

elif action_option == "🎯 View Marketing Goals":
    goals_path = "apps/agents/shared/memory/marketing_goals.md"
    if Path(goals_path).exists():
        if st.sidebar.button("Show Marketing Goals"):
            with open(goals_path, "r") as f:
                st.session_state.resource_title = "🎯 Marketing Goals"
                st.session_state.resource_content = f.read()
                st.session_state.resource_type = 'markdown'
                st.session_state.current_view = 'resource'
    else:
        st.sidebar.warning("Marketing goals file not found")

# Back button for resource views
if st.session_state.current_view == 'resource':
    if st.sidebar.button("← Back to Chat", key="sidebar_back_button"):
        switch_to_chat()

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
    # Switch back to chat view if in resource view
    switch_to_chat()
    
    # Add user message to session state immediately
    user_msg = {"role": "user", "message": user_input, "timestamp": datetime.now().isoformat()}
    chat_history.append(user_msg)
    
    # Save to file immediately so it persists between reruns
    with open(chat_file, "w", encoding="utf-8") as f:
        json.dump(chat_history, f, indent=2)
    
    # Set a session state flag to indicate we're processing
    st.session_state.processing = True
    st.session_state.processing_message = user_input
    
    # Force a rerun to show the processing indicator
    st.rerun()

# Check if we need to process a message (this will run after the rerun)
if hasattr(st.session_state, 'processing') and st.session_state.processing:
    # Get the message we're processing
    processing_message = st.session_state.processing_message
    
    # Process the message
    agent_response = run_agent_loop(processing_message)
    print(f"DEBUG APP: Agent response received: {agent_response[:100] if agent_response else 'EMPTY'}")
    
    # Get last message from chat history (from the agent object)
    from apps.agents.departments.marketing.cmo_executor import chat_history as agent_chat_history
    
    # Extract the last AI message metadata if available
    metadata = {}
    if agent_chat_history and len(agent_chat_history) > 0:
        last_message = agent_chat_history[-1]
        # Copy metadata if available
        if hasattr(last_message, "metadata") and last_message.metadata:
            metadata = last_message.metadata
    
    # Add agent response with metadata
    agent_msg = {"role": "agent", "message": agent_response, "metadata": metadata}
    chat_history.append(agent_msg)
    
    # Save the updated history
    with open(chat_file, "w", encoding="utf-8") as f:
        json.dump(chat_history, f, indent=2)
    
    # Clear the processing flag
    st.session_state.processing = False
    if 'processing_message' in st.session_state:
        del st.session_state.processing_message
    
    # Force a final rerun to show the completed conversation
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

    # Conditional display based on current view
    if st.session_state.current_view == 'resource':
        # Display resource content
        st.markdown(f"## {st.session_state.resource_title}")
        
        # Add a back to chat button
        if st.button("← Back to Chat", key="main_back_button"):
            switch_to_chat()
            st.rerun()
        
        # Display the correct content type
        if st.session_state.resource_type == 'markdown':
            st.markdown(st.session_state.resource_content)
        elif st.session_state.resource_type == 'json':
            st.json(st.session_state.resource_content)
        else:
            st.text(str(st.session_state.resource_content))
    else:
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

        # Determine which chat history to display
        display_history = chat_history
        show_loading_spinner = False
        
        # If we're processing a message, show the loading indicator
        if hasattr(st.session_state, 'processing') and st.session_state.processing:
            show_loading_spinner = True
            
        # Add auto-scroll to bottom JS
        st.markdown("""
        <script>
        // Auto-scroll function
        function scrollToBottom() {
            const chatArea = document.querySelector('.chat-messages');
            if (chatArea) {
                chatArea.scrollTop = chatArea.scrollHeight;
            }
        }
        
        // Call on load and after content changes
        window.addEventListener('load', scrollToBottom);
        const observer = new MutationObserver(scrollToBottom);
        observer.observe(document.body, { childList: true, subtree: true });
        </script>
        """, unsafe_allow_html=True)

        # Chat messages in scrollable container
        st.markdown('<div class="chat-messages">', unsafe_allow_html=True)
        for msg in display_history:
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
                        
                    # Guard against "unknown" model - provide more specific fallback values
                    if model_short == "unknown":
                        # Check if we can determine the task type from metadata
                        if task_type == "marketing":
                            model_display = "Gemini"
                        elif task_type == "writing":
                            model_display = "GPT-4.1"
                        elif task_type == "research":
                            model_display = "Auto"
                        else:
                            model_display = "GPT-4.1"  # Default fallback display name
                    else:    
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
        
        # Show loading spinner at the bottom if we're waiting for a response
        if show_loading_spinner:
            st.markdown(f'''
            <div class="agent-bubble">
                <div class="message-sender">
                    <span>
                        🤖 Chloe
                        <span class="badge badge-default">Thinking</span>
                    </span>
                    <span class="timestamp">{format_timestamp(datetime.now().isoformat())}</span>
                </div>
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
            ''', unsafe_allow_html=True)
        
        # Add an ID to the bottom of the chat for scrolling
        st.markdown('<div id="chat-bottom"></div>', unsafe_allow_html=True)
        
        st.markdown('</div>', unsafe_allow_html=True)
        
        # Create a button that links to the bottom of chat
        st.markdown('''
        <style>
        .floating-button {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
        }
        .floating-button a {
            display: block;
            width: 50px;
            height: 50px;
            background-color: #4CAF50;
            color: white;
            border-radius: 50%;
            text-align: center;
            line-height: 50px;
            font-size: 24px;
            text-decoration: none;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            opacity: 0.8;
            transition: opacity 0.3s, transform 0.3s;
        }
        .floating-button a:hover {
            opacity: 1;
            transform: scale(1.05);
        }
        </style>
        <div class="floating-button">
            <a href="#chat-bottom" title="Scroll to bottom">⬇️</a>
        </div>
        ''', unsafe_allow_html=True)
    
    st.markdown('</div>', unsafe_allow_html=True) 