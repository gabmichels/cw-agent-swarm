from departments.marketing.cmo_executor import run_agent_loop

if __name__ == "__main__":
    print("🤖 Ask your CMO anything:")
    while True:
        prompt = input("🧠 You: ")
        if prompt.lower() in ["exit", "quit"]: break
        response = run_agent_loop(prompt)
        print("CMO:", response)
