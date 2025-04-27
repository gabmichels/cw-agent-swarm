import { ChloeAgent } from '../agent';
import { runMemoryConsolidation } from './memoryConsolidation';
import { 
  runMarketScanTask,
  runNewsScanTask,
  runTrendingTopicResearchTask,
  runSocialMediaTrendsTask
} from './marketScanTask';

/**
 * Export all task functions
 */
export {
  runMemoryConsolidation,
  runMarketScanTask,
  runNewsScanTask,
  runTrendingTopicResearchTask,
  runSocialMediaTrendsTask
}; 