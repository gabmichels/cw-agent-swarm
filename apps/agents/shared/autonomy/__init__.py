"""
Autonomy package for Chloe's autonomous executive behavior.

This package provides functions for Chloe to operate with more autonomy,
including a daily rhythm, task prioritization, and idle behaviors.
"""

from apps.agents.shared.autonomy.behavior_loop import (
    run_behavior_loop, 
    LoopExecutionMode,
    get_recent_behavior_logs
)

from apps.agents.shared.autonomy.daily_rhythm import (
    get_todays_behaviors,
    get_full_rhythm_map
)

from apps.agents.shared.autonomy.prioritizer import (
    prioritize_tasks,
    get_highest_priority_task
)

from apps.agents.shared.autonomy.idle_behavior import (
    choose_idle_activity,
    get_idle_activity_history
) 