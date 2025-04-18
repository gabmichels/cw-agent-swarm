from langchain.chat_models import ChatOpenAI
from langchain.prompts import PromptTemplate
from apps.agents.shared.tools.memory_loader import retrieve_similar_chats
from pathlib import Path
import datetime

task_log = Path("apps/agents/shared/memory/task_log.md").read_text()
chat_summary = retrieve_similar_chats("weekly campaign themes")

prompt = PromptTemplate.from_template("""
You are Chloe, the Chief Marketing Officer of Crowd Wisdom.

Your goal is to reflect on the past week of marketing work based on:
- Task logs
- Team conversations

Summarize:
- What worked well
- What didn't
- Any insights for future strategy
- Key takeaways for Gab

Use a personal and thoughtful tone.

## Task Log
{task_log}

## Conversations
{chat_summary}
""")

llm = ChatOpenAI(temperature=0.5, model="gpt-4-1106-preview")
chain = prompt | llm

# Execute the chain and get Chloe's reflection
reflection = chain.invoke({"task_log": task_log, "chat_summary": chat_summary})

# Output reflection
print(reflection.content)

# Optionally save the reflection to a file
current_date = datetime.datetime.now().strftime("%Y-%m-%d")
reflection_path = Path(f"apps/agents/shared/memory/reflections/reflection_{current_date}.md")
reflection_path.parent.mkdir(parents=True, exist_ok=True)
reflection_path.write_text(reflection.content) 