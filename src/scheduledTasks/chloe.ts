/**
 * Scheduled tasks for Chloe's autonomous cycles
 * Handles daily planning and weekly reflection tasks
 */

// Import ChloeScheduler functions
import { runChloeDaily, runChloeWeekly } from "@/agents/chloe/scheduler/chloeScheduler";
import { ChloeMemory } from "@/agents/chloe/memory";
import { MemoryType, ImportanceLevel, MemorySource } from "@/constants/memory";

// Create memory instance
const memory = new ChloeMemory();

/**
 * Runs Chloe's scheduled tasks based on the current time
 * - Daily cycle runs every day
 * - Weekly cycle runs only on Mondays
 */
export async function runChloeScheduledTasks() {
  const now = new Date();
  const day = now.getDay(); // 1 = Monday

  await runChloeDaily();

  if (day === 1) {
    await runChloeWeekly();
  }

  await memory.addMemory(
    `Ran Chloe's scheduled tasks at ${now.toISOString()}`,
    MemoryType.MESSAGE,
    ImportanceLevel.LOW,
    MemorySource.SYSTEM,
    'scheduler',
    ['scheduler', 'daily', day === 1 ? 'weekly' : '']
  );
} 