from departments.marketing.cmo_agent import plan_weekly_strategy

if __name__ == "__main__":
    try:
        strategy = plan_weekly_strategy()
        print("\nWEEKLY STRATEGY FROM YOUR CMO AGENT:\n")
        print(strategy)
    except Exception as e:
        print(f"An error occurred: {e}")
