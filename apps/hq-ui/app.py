import streamlit as st
from pathlib import Path
import json
from apps.agents.departments.marketing.cmo_executor import run_agent_loop

# === Settings ===
st.set_page_config(page_title="Crowd Wisdom HQ", layout="wide")
st.title("🤖 Crowd Wisdom HQ")

# === Agent Registry ===
AGENT_REGISTRY = {
    "Marketing": ["Chloe - CMO"],  # Later: "Content Agent", "Campaign Agent"
    # "Design": ["Design Lead"],
    # "Customer Support": ["Support Agent"]
}

# === Sidebar Navigation ===
st.sidebar.header("Departments")
selected_dept = st.sidebar.selectbox("Select Department", list(AGENT_REGISTRY.keys()))
selected_agent = st.sidebar.radio("Employees", AGENT_REGISTRY[selected_dept])

# === Chat Memory Path ===
MEMORY_DIR = Path("./apps/hq-ui/history/")
MEMORY_DIR.mkdir(parents=True, exist_ok=True)
chat_file = MEMORY_DIR / f"{selected_agent.lower().replace(' ', '_')}_chat.json"

# === Load Chat History ===
if chat_file.exists():
    chat_history = json.loads(chat_file.read_text())
else:
    chat_history = []

# === Chat UI ===
st.subheader(f"💬 Chat with {selected_agent}")
chat_container = st.container()

# Show history
for msg in chat_history:
    if msg["role"] == "user":
        chat_container.markdown(f"**🧠 You:** {msg['message']}")
    else:
        chat_container.markdown(f"**🤖 {selected_agent}:** {msg['message']}")

# Input form
with st.form(key="chat_form", clear_on_submit=True):
    user_input = st.text_input("Your message", "")
    submitted = st.form_submit_button("Send")

# === Run Agent and Save Response ===
if submitted and user_input.strip() != "":
    with st.spinner("Thinking..."):
        agent_response = run_agent_loop(user_input)
        # Update history
        chat_history.append({"role": "user", "message": user_input})
        chat_history.append({"role": "agent", "message": agent_response})
        # Save to file
        with open(chat_file, "w", encoding="utf-8") as f:
            json.dump(chat_history, f, indent=2)

    st.rerun()  # Refresh UI 