from langchain.chat_models import ChatOpenAI
from langchain.prompts import PromptTemplate
from apps.agents.shared.tools.memory_loader import get_memory_vectorstore
from apps.agents.shared.tools.discord_notify import send_discord_dm
import datetime
import os

LOG_FILE = './apps/agents/shared/memory/task_log.md'

def ask_for_input():
    questions = (
        "Hi Gab 👋 It's your CMO.\n\n"
        "Before I plan this week's strategy, could you let me know:\n"
        "- Any product updates I should be aware of?\n"
        "- Should I prioritize any platform or campaign type?\n"
        "- Any feedback on last week's strategy?\n\n"
        "Reply in Discord and I'll finalize the plan."
    )
    send_discord_dm(questions)

def log_summary(text):
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    entry = f"\n### {today} – Weekly Strategy Log\n{text}\n"
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(entry)

def plan_weekly_strategy():
    vectordb = get_memory_vectorstore()
    retriever = vectordb.as_retriever()
    context_docs = retriever.get_relevant_documents("what does the CMO need to know for this week?")
    context = "\n\n".join([doc.page_content for doc in context_docs])

    if "no updates" in context.lower() or len(context_docs) < 3:
        ask_for_input()
        return "👀 Waiting on human input..."

    prompt = PromptTemplate.from_template("""
    You are the Chief Marketing Officer for Crowd Wisdom.
    Based on the internal knowledge below, create a full strategy for this week:

    Include:
    - Main marketing objective
    - 2–3 campaign ideas
    - Channel focus
    - Metrics to track
    - Tasks delegated to other agents
    - Anything you want to ask the founder before execution

    Internal knowledge:
    {context}
    """)

    llm = ChatOpenAI(temperature=0.3, model="gpt-4-1106-preview")
    chain = prompt | llm
    result = chain.invoke({"context": context})

    send_discord_dm("✅ Here's this week's strategy:\n\n" + result)
    log_summary(result)
    return result
