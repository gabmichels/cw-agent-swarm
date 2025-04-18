import streamlit as st
from pathlib import Path
import json

from apps.agents.departments.marketing.cmo_executor import run_agent_loop
from apps.agents.shared.tools.memory_loader import retrieve_similar_chats

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
    submitted = st.form_submit_button("Send")

# === Process new messages ===
if submitted and user_input.strip() != "":
    with st.sidebar.spinner("Thinking..."):
        agent_response = run_agent_loop(user_input)
        # Update history
        chat_history.append({"role": "user", "message": user_input})
        chat_history.append({"role": "agent", "message": agent_response})
        with open(chat_file, "w", encoding="utf-8") as f:
            json.dump(chat_history, f, indent=2)
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
        reflections_path = Path("apps/agents/shared/memory/chloe_reflections.md")
        if reflections_path.exists():
            latest_reflection = reflections_path.read_text().strip().split("###")[-1]
            st.info(latest_reflection[:350] + "...")

    with col2:
        st.markdown("##### 💭 Thought Preview")
        thought = retrieve_similar_chats("what is Chloe currently thinking about?")[:300]
        st.success(thought + "...")

    with col3:
        st.markdown("##### 🔥 Important Updates")
        highlights = retrieve_similar_chats("what important marketing actions happened recently?")[:300]        
        st.warning(highlights + "...")

    # === Agent Files Row ===
    st.markdown("### Agent Files")
    file_col1, file_col2, file_col3, file_col4 = st.columns(4)

    with file_col1:
        st.markdown("**Agent Files:**")

    with file_col2:
        reflections_path = "apps/agents/shared/memory/chloe_reflections.md"
        st.markdown(f"[🧠 Reflections](file:///{Path(reflections_path).resolve()})")

    with file_col3:
        task_log_path = "apps/agents/shared/memory/task_log.md"
        st.markdown(f"[📋 Task Log](file:///{Path(task_log_path).resolve()})")

    with file_col4:
        goals_path = "apps/agents/shared/memory/marketing_goals.md"
        st.markdown(f"[🎯 Marketing Goals](file:///{Path(goals_path).resolve()})")

    # === Chat UI ===
    st.markdown("## 💬 Conversation History")
    
    # Chat messages in scrollable container
    st.markdown('<div class="chat-messages">', unsafe_allow_html=True)
    for msg in chat_history:
        if msg["role"] == "user":
            st.markdown(f'''
            <div class="user-bubble">
                <div class="message-sender">🧠 You</div>
                {msg["message"]}
            </div>
            ''', unsafe_allow_html=True)
        else:
            st.markdown(f'''
            <div class="agent-bubble">
                <div class="message-sender">🤖 Chloe</div>
                {msg["message"]}
            </div>
            ''', unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)
    
    st.markdown('</div>', unsafe_allow_html=True) 