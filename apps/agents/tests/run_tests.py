"""
Test Runner

This script provides a centralized way to run different test groups.
"""
import os
import sys
import argparse
import importlib
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("test_runner")

# Add the parent directory to the sys.path
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent.parent
sys.path.insert(0, str(parent_dir))

# Mock the episodic_memory module to avoid NumPy dependency issues on Windows
import sys
from unittest.mock import MagicMock
sys.modules['apps.agents.shared.memory.episodic_memory'] = MagicMock()
sys.modules['apps.agents.shared.memory.episodic_memory'].store_memory = lambda *args, **kwargs: True
sys.modules['apps.agents.shared.memory.episodic_memory'].get_relevant_memories = lambda *args, **kwargs: []

def run_perception_tests(args):
    """Run the perception subsystem tests."""
    logger.info("Running perception tests...")
    
    if args.simple:
        logger.info("Running simple perception tests...")
        from tests.perception.test_simple import main as run_simple
        run_simple()
    elif args.mock:
        logger.info("Running mock perception tests...")
        from tests.perception.test_mock import main as run_mock
        run_mock()
    elif args.all:
        logger.info("Running all perception tests...")
        # Run each test module in a controlled sequence
        from tests.perception.test_simple import main as run_simple
        from tests.perception.test_mock import main as run_mock
        from tests.perception.test_isolated import main as run_isolated
        from tests.perception.test_simple_collection import main as run_simple_collection
        run_simple()
        run_mock()
        run_isolated()
        run_simple_collection()
    else:
        logger.info("No specific perception test selected. Use --simple, --mock, or --all.")
        
    logger.info("Perception tests completed.")

def run_memory_tests(args):
    """Run the memory subsystem tests."""
    logger.info("Running memory tests...")
    
    if args.reflection:
        logger.info("Running reflection tests...")
        from tests.memory.test_reflection_simple import main as run_simple_reflection
        run_simple_reflection()
    elif args.all:
        logger.info("Running all memory tests...")
        from tests.memory.test_reflection_simple import main as run_simple_reflection
        run_simple_reflection()
    else:
        logger.info("No specific memory test selected. Use --reflection or --all.")
        
    logger.info("Memory tests completed.")

def run_notification_tests(args):
    """Run the notification subsystem tests."""
    logger.info("Running notification tests...")
    
    if args.simple:
        logger.info("Running simple notification tests...")
        from tests.notification.test_simple import test_notification_intent, test_interaction_logging
        test_notification_intent()
        test_interaction_logging()
    elif args.integration:
        logger.info("Running notification integration tests...")
        from tests.notification.integration_example import simulate_agent_conversation
        simulate_agent_conversation()
    elif args.all:
        logger.info("Running all notification tests...")
        from tests.notification.test_simple import test_notification_intent, test_interaction_logging
        from tests.notification.integration_example import simulate_agent_conversation
        test_notification_intent()
        test_interaction_logging()
        simulate_agent_conversation()
    else:
        logger.info("No specific notification test selected. Use --simple, --integration, or --all.")
        
    logger.info("Notification tests completed.")

def run_tools_tests(args):
    """Run the tools subsystem tests."""
    logger.info("Running tools tests...")
    
    if args.basic:
        logger.info("Running basic tools tests...")
        from tests.tools.test_basic import main as run_basic
        run_basic()
    elif args.minimal:
        logger.info("Running minimal tools tests...")
        from tests.tools.test_minimal import main as run_minimal
        run_minimal()
    elif args.all:
        logger.info("Running all tools tests...")
        from tests.tools.test_basic import main as run_basic
        from tests.tools.test_minimal import main as run_minimal
        run_basic()
        run_minimal()
    else:
        logger.info("No specific tools test selected. Use --basic, --minimal, or --all.")
        
    logger.info("Tools tests completed.")

def main():
    """Main entry point for the test runner."""
    parser = argparse.ArgumentParser(description="Run tests for different subsystems")
    subparsers = parser.add_subparsers(dest="command", help="Subsystem to test")
    
    # Perception tests
    perception_parser = subparsers.add_parser("perception", help="Run perception tests")
    perception_parser.add_argument("--simple", action="store_true", help="Run simple perception tests")
    perception_parser.add_argument("--mock", action="store_true", help="Run mock perception tests")
    perception_parser.add_argument("--all", action="store_true", help="Run all perception tests")
    
    # Memory tests
    memory_parser = subparsers.add_parser("memory", help="Run memory tests")
    memory_parser.add_argument("--reflection", action="store_true", help="Run reflection tests")
    memory_parser.add_argument("--all", action="store_true", help="Run all memory tests")
    
    # Notification tests
    notification_parser = subparsers.add_parser("notification", help="Run notification tests")
    notification_parser.add_argument("--simple", action="store_true", help="Run simple notification tests")
    notification_parser.add_argument("--integration", action="store_true", help="Run notification integration tests")
    notification_parser.add_argument("--all", action="store_true", help="Run all notification tests")
    
    # Tools tests
    tools_parser = subparsers.add_parser("tools", help="Run tools tests")
    tools_parser.add_argument("--basic", action="store_true", help="Run basic tools tests")
    tools_parser.add_argument("--minimal", action="store_true", help="Run minimal tools tests")
    tools_parser.add_argument("--all", action="store_true", help="Run all tools tests")
    
    # All tests
    parser.add_argument("--all", action="store_true", help="Run all tests")
    
    args = parser.parse_args()
    
    if args.all:
        logger.info("Running all tests...")
        
        # Create new args with all flags set to true
        class AllArgs:
            all = True
            simple = True
            mock = True
            reflection = True
            integration = True
            basic = True
            minimal = True
        
        all_args = AllArgs()
        
        run_perception_tests(all_args)
        run_memory_tests(all_args)
        run_notification_tests(all_args)
        run_tools_tests(all_args)
        
        logger.info("All tests completed successfully!")
        return
    
    if args.command == "perception":
        run_perception_tests(args)
    elif args.command == "memory":
        run_memory_tests(args)
    elif args.command == "notification":
        run_notification_tests(args)
    elif args.command == "tools":
        run_tools_tests(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main() 