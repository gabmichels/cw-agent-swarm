"""
Run Chloe's autonomous behavior loop.

This script executes Chloe's daily autonomous behavior loop.
It can be run manually or scheduled to run automatically (e.g., via cron job).
"""

import sys
import logging
from pathlib import Path
import argparse
from apps.agents.shared.autonomy.behavior_loop import (
    run_behavior_loop, 
    LoopExecutionMode
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("autonomy_run.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def main():
    """Run the autonomy script with command line arguments."""
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Run Chloe's autonomous behavior loop")
    
    parser.add_argument(
        "--mode", 
        type=str, 
        choices=["auto", "simulation", "approval"],
        default="simulation",
        help="Execution mode: auto (automatic execution), simulation (default, just simulate), approval (ask for approval)"
    )
    
    args = parser.parse_args()
    
    # Map argument to execution mode
    mode_map = {
        "auto": LoopExecutionMode.AUTOMATIC,
        "simulation": LoopExecutionMode.SIMULATION,
        "approval": LoopExecutionMode.APPROVAL
    }
    
    execution_mode = mode_map.get(args.mode, LoopExecutionMode.SIMULATION)
    
    # Execute the behavior loop
    print(f"Running Chloe's behavior loop in {args.mode} mode...")
    result = run_behavior_loop(execution_mode)
    
    # Print result summary
    action_type = result["action"]
    
    print("\nExecution Summary:")
    print(f"- Action type: {action_type}")
    
    if action_type == "task":
        print(f"- Task: {result.get('task_title')}")
        print(f"- Priority score: {result.get('priority_score', 0):.2f}")
    elif action_type == "idle":
        print(f"- Idle activity: {result.get('activity')}")
    elif action_type == "escalation":
        print(f"- Escalation reason: {result.get('reason')}")
    else:
        print(f"- Reason: {result.get('reason')}")
    
    print(f"- Execution time: {result.get('execution_time', 0):.2f} seconds")
    
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nExecution cancelled by user.")
        sys.exit(1)
    except Exception as e:
        logger.exception("Error in autonomy script execution")
        print(f"\nError: {e}")
        sys.exit(1) 