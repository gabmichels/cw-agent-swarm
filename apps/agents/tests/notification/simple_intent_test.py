"""
Simple test for notification intent detection.
"""

import sys
from pathlib import Path

# Add the parent directory to sys.path
current_dir = Path(__file__).parent
parent_dir = current_dir.parent.parent.parent
sys.path.append(str(parent_dir))

# Try different import approaches
try:
    # First approach
    from apps.agents.shared.config import has_notification_intent, NOTIFICATION_PHRASES
    print("Import successful using apps.agents.shared.config")
except ImportError:
    try:
        # Second approach
        sys.path.append(str(Path(__file__).parent.parent.parent.parent))
        from apps.agents.shared.config import has_notification_intent, NOTIFICATION_PHRASES
        print("Import successful using expanded path")
    except ImportError:
        # Print the sys.path for debugging
        print("Import failed. Current sys.path:")
        for path in sys.path:
            print(f"  - {path}")
        sys.exit(1)

def test_notification_intent():
    """Test the notification intent detection functionality"""
    print("Testing notification intent detection...")
    
    # Test with positive examples
    positive_examples = [
        "I'll notify you when I'm done researching.",
        "I will let you know when I have completed the analysis.",
        "Once the data is collected, I'll message you on Discord.",
        "I'll send you a notification when the task is complete.",
        "I will dm you on discord when I have results."
    ]
    
    for i, message in enumerate(positive_examples):
        result = has_notification_intent(message)
        print(f"Example {i+1}: '{message}'")
        print(f"  Intent detected: {result}")
        if not result:
            print("  FAIL: Should have detected intent")
        else:
            print("  PASS")
    
    # Test with negative examples
    negative_examples = [
        "Here's the information you requested.",
        "The data collection is still in progress.",
        "I've completed the analysis of the data.",
        "Discord is a popular messaging platform.",
        "Let me search for that information."
    ]
    
    for i, message in enumerate(negative_examples):
        result = has_notification_intent(message)
        print(f"Example {i+1}: '{message}'")
        print(f"  Intent detected: {result}")
        if result:
            print("  FAIL: Should not have detected intent")
        else:
            print("  PASS")
    
    # Print all notification phrases
    print("\nAll notification phrases:")
    for phrase in NOTIFICATION_PHRASES:
        print(f"  - '{phrase}'")

if __name__ == "__main__":
    print("=" * 50)
    print("NOTIFICATION INTENT DETECTION TEST")
    print("=" * 50)
    
    # Test notification intent detection
    test_notification_intent() 