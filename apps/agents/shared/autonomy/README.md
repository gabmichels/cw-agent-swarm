# Chloe's Autonomous Behavior System

This package implements Chloe's autonomous executive behavior, allowing her to operate more independently with a daily rhythm, task prioritization, and meaningful idle-time behavior.

## Overview

The autonomous behavior system consists of four main components:

1. **Daily Rhythm Map**: A lightweight schedule of behaviors mapped to each day of the week
2. **Task Prioritization**: Ranking tasks based on urgency, importance, and daily rhythm
3. **Main Behavior Loop**: The central routine that decides what Chloe should do next
4. **Idle Behaviors**: Productive activities Chloe can perform when no urgent tasks exist

## How It Works

### Daily Rhythm

Each day of the week has an associated set of behaviors that guide Chloe's focus. For example:

- **Monday**: Analyze analytics, plan strategy, clean task queue
- **Wednesday**: Competitor analysis, midweek reflection, stakeholder updates
- **Friday**: Summarize results, weekly reflection, ask clarifying questions

These behaviors influence task prioritization but don't rigidly determine Chloe's activities.

### Task Prioritization

The prioritization system ranks tasks based on:

- **Deadline proximity**: Tasks with closer deadlines get higher priority
- **Explicit priority**: High, medium, or low priority settings
- **Daily rhythm alignment**: Tasks that align with today's focus get a boost
- **Recency**: Tasks that haven't been touched in a while get a small boost

This ensures Chloe focuses on what's most important right now.

### Behavior Loop

The main behavior loop follows these steps:

1. Check the current day of the week and load daily rhythm behaviors
2. Pull the task queue and prioritize based on urgency/importance
3. Determine if any decisions should be escalated to a human
4. If tasks exist, execute the highest-priority one
5. If no tasks, perform a meaningful idle activity

### Idle Behaviors

When no urgent tasks are available, Chloe will perform productive idle activities like:

- Researching market trends
- Analyzing competitor activities
- Generating content ideas
- Reviewing past campaign performance
- Drafting stakeholder updates
- Asking clarifying questions to Gab

## Usage

### Running the Behavior Loop

You can run Chloe's autonomous behavior loop in several ways:

1. **Via Agent Commands**:
   ```
   run_daily_routine
   ```
   or with a specific mode:
   ```
   run_daily_routine(mode="automatic")
   ```

2. **Using the Script**:
   ```
   python apps/agents/run_autonomy.py
   ```
   or with a specific mode:
   ```
   python apps/agents/run_autonomy.py --mode auto
   ```

### Execution Modes

- **Simulation** (default): Shows what Chloe would do without actually doing it
- **Automatic**: Executes actions fully autonomously
- **Approval**: Asks for human approval before executing actions

### Viewing Autonomy Information

Several tools are available to inspect Chloe's autonomous behavior:

- `get_daily_rhythm`: See Chloe's daily rhythm map
- `get_prioritized_tasks`: View tasks sorted by priority
- `get_autonomous_activity_history`: See recent autonomous actions
- `suggest_idle_activity`: Get a suggestion for an idle activity

## Customization

To customize Chloe's autonomous behavior:

1. **Modify Daily Rhythm**: Edit the `DEFAULT_RHYTHM_MAP` in `daily_rhythm.py`
2. **Adjust Priorities**: Change the `WEIGHTS` in `prioritizer.py`
3. **Add New Idle Activities**: Add to the `IDLE_ACTIVITIES` list in `idle_behavior.py`

## Future Improvements

Potential enhancements to the autonomy system:

1. **Schedule integration**: Connect with calendar APIs
2. **Learning & adaptation**: Adjust daily rhythms based on performance
3. **Advanced escalation**: More sophisticated human escalation patterns
4. **External triggers**: Respond to external events or notifications
5. **Autonomous reflection**: Regular self-improvement reflections 