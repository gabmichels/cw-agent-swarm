import { ChloeAgent } from '../agent';
import { runMemoryConsolidation } from './memoryConsolidation';
import {
  runNewsScanTask,
  runTrendingTopicResearchTask,
  runSocialMediaTrendsTask
} from './allTasks';

/**
 * Export all task functions
 */
export {
  runMemoryConsolidation,
  runNewsScanTask,
  runTrendingTopicResearchTask,
  runSocialMediaTrendsTask
}; 