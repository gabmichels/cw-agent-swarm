import { ulid } from 'ulid';
import { KnowledgeExtractionWorkflow } from '../../agents/shared/knowledge/workflows/KnowledgeExtractionWorkflow';
import { MemoryRetriever } from '../thinking/memory/MemoryRetriever';
import { GoogleSheetsCapabilities } from '../workspace/capabilities/google/GoogleSheetsCapabilities';
import { KnowledgeNodeType, KnowledgeEdgeType } from '../../agents/shared/knowledge/interfaces/KnowledgeGraph.interface';

/**
 * Fitness data structure extracted from conversations
 */
export interface FitnessDataPoint {
  id: string;
  date: Date;
  exercise: string;
  weight?: number;
  weightUnit?: 'lbs' | 'kg';
  sets?: number;
  reps?: number;
  duration?: number; // minutes
  notes?: string;
  confidence: number;
  sourceMemoryId: string;
}

/**
 * Fitness extraction configuration
 */
export interface FitnessExtractionConfig {
  timeRangeDays?: number;
  minConfidence?: number;
  includeBodyweight?: boolean;
  exerciseTypes?: string[];
}

/**
 * Dashboard data for fitness visualizations
 */
export interface FitnessDashboardData {
  progressCharts: {
    weightProgression: Array<{ exercise: string; dates: Date[]; weights: number[] }>;
    volumeProgression: Array<{ exercise: string; dates: Date[]; volume: number[] }>;
    frequencyData: Array<{ exercise: string; count: number; lastPerformed: Date }>;
  };
  summaryStats: {
    totalWorkouts: number;
    averageWorkoutsPerWeek: number;
    favoriteExercises: string[];
    strengthGains: Array<{ exercise: string; startWeight: number; currentWeight: number; improvement: number }>;
  };
  rawData: FitnessDataPoint[];
}

/**
 * Service for extracting fitness data from agent conversations
 * and creating structured dashboards and exports
 */
export class FitnessDataExtractor {
  private memoryRetriever: MemoryRetriever;
  private knowledgeExtractor: KnowledgeExtractionWorkflow;
  private sheetsCapabilities: GoogleSheetsCapabilities;

  constructor(
    memoryRetriever: MemoryRetriever,
    knowledgeExtractor: KnowledgeExtractionWorkflow,
    sheetsCapabilities: GoogleSheetsCapabilities
  ) {
    this.memoryRetriever = memoryRetriever;
    this.knowledgeExtractor = knowledgeExtractor;
    this.sheetsCapabilities = sheetsCapabilities;
  }

  /**
   * Extract fitness data from agent memory conversations
   */
  async extractFitnessData(config: FitnessExtractionConfig = {}): Promise<FitnessDataPoint[]> {
    const {
      timeRangeDays = 90,
      minConfidence = 0.6,
      includeBodyweight = true,
      exerciseTypes = ['strength', 'cardio', 'flexibility']
    } = config;

    // 1. Retrieve fitness-related memories
    const fitnessMemories = await this.memoryRetriever.retrieveMemories({
      query: `workout training exercise gym fitness strength cardio ${exerciseTypes.join(' ')}`,
      userId: 'default', // TODO: Pass actual userId from context
      tags: ['fitness', 'training', 'exercise', 'workout', 'gym'],
      limit: 1000,
      recencyWindow: {
        days: timeRangeDays
      }
    });

    console.log(`📋 Found ${fitnessMemories.memories.length} fitness-related memories`);

    // 2. Extract structured knowledge from conversations
    const combinedContent = fitnessMemories.memories
      .map(memory => memory.content)
      .join('\n\n---\n\n');

    const extractionResult = await this.knowledgeExtractor.extractKnowledge({
      content: combinedContent,
      nodeTypes: [KnowledgeNodeType.ENTITY, KnowledgeNodeType.METRIC, KnowledgeNodeType.EVENT],
      edgeTypes: [KnowledgeEdgeType.RELATED_TO, KnowledgeEdgeType.PART_OF, KnowledgeEdgeType.USED_BY],
      minConfidence: minConfidence,
      maxNodes: 500,
      context: {
        domain: 'fitness',
        extractionType: 'workout_data'
      }
    });

    // 3. Parse extracted nodes into structured fitness data
    const fitnessData: FitnessDataPoint[] = [];
    
    // Parse all nodes that could represent fitness activities
    for (const node of extractionResult.nodes) {
      if (node.type === KnowledgeNodeType.ENTITY || node.type === KnowledgeNodeType.EVENT) {
        // Check if this looks like an exercise or fitness activity
        const exerciseKeywords = ['bench', 'squat', 'deadlift', 'press', 'curl', 'row', 'pushup', 'pullup', 'run', 'bike', 'swim'];
        const isExerciseNode = exerciseKeywords.some(keyword => 
          node.label.toLowerCase().includes(keyword) || 
          (node.description && node.description.toLowerCase().includes(keyword))
        );
        
        if (isExerciseNode) {
          const dataPoint = await this.parseExerciseNode(
            node, 
            extractionResult.nodes, 
            extractionResult.edges,
            fitnessMemories.memories
          );
          
          if (dataPoint && dataPoint.confidence >= minConfidence) {
            fitnessData.push(dataPoint);
          }
        }
      }
    }

    console.log(`💪 Extracted ${fitnessData.length} fitness data points`);
    return fitnessData;
  }

  /**
   * Parse an exercise node and related data into structured format
   */
  private async parseExerciseNode(
    exerciseNode: any,
    allNodes: any[],
    allEdges: any[],
    sourceMemories: any[]
  ): Promise<FitnessDataPoint | null> {
    try {
      // Find related nodes through edges
      const relatedEdges = allEdges.filter(edge => 
        edge.from === exerciseNode.id || edge.to === exerciseNode.id
      );

      const relatedNodeIds = relatedEdges.map(edge => 
        edge.from === exerciseNode.id ? edge.to : edge.from
      );
      
      const relatedNodes = allNodes.filter(node => 
        relatedNodeIds.includes(node.id)
      );

      // Extract specific data points
      const weightNode = relatedNodes.find(n => n.type === 'weight');
      const repsNode = relatedNodes.find(n => n.type === 'repetition');
      const setsNode = relatedNodes.find(n => n.type === 'set');
      const durationNode = relatedNodes.find(n => n.type === 'duration');
      const dateNode = relatedNodes.find(n => n.type === 'date');

      // Parse weight with unit detection
      let weight: number | undefined;
      let weightUnit: 'lbs' | 'kg' | undefined;
      if (weightNode?.label) {
        const weightMatch = weightNode.label.match(/(\d+(?:\.\d+)?)\s*(lbs?|kg|pounds?|kilograms?)?/i);
        if (weightMatch) {
          weight = parseFloat(weightMatch[1]);
          const unit = weightMatch[2]?.toLowerCase();
          weightUnit = unit?.includes('kg') ? 'kg' : 'lbs';
        }
      }

      // Parse reps and sets
      const reps = repsNode?.label ? this.extractNumber(repsNode.label) : undefined;
      const sets = setsNode?.label ? this.extractNumber(setsNode.label) : undefined;
      
      // Parse duration (in minutes)
      const duration = durationNode?.label ? this.extractDuration(durationNode.label) : undefined;

      // Parse or estimate date
      let workoutDate = new Date();
      if (dateNode?.label) {
        workoutDate = this.parseWorkoutDate(dateNode.label);
      }

      // Find source memory for context
      const sourceMemory = sourceMemories.find(memory => 
        memory.content.includes(exerciseNode.label)
      );

      return {
        id: ulid(),
        date: workoutDate,
        exercise: exerciseNode.label,
        weight,
        weightUnit,
        sets,
        reps,
        duration,
        notes: exerciseNode.description,
        confidence: exerciseNode.confidence || 0.5,
        sourceMemoryId: sourceMemory?.id || 'unknown'
      };

    } catch (error) {
      console.warn('Failed to parse exercise node:', error);
      return null;
    }
  }

  /**
   * Create a Google Sheets dashboard with fitness data
   */
  async createGoogleSheetsDashboard(
    fitnessData: FitnessDataPoint[],
    connectionId: string,
    agentId: string,
    title?: string
  ): Promise<string> {
    const spreadsheetTitle = title || `Fitness Tracker - ${new Date().toISOString().split('T')[0]}`;
    
    // Create the spreadsheet
    const spreadsheet = await this.sheetsCapabilities.createSpreadsheet({
      title: spreadsheetTitle,
      sheets: [{
        title: 'Fitness Data',
        headers: ['Date', 'Exercise', 'Weight', 'Unit', 'Sets', 'Reps', 'Duration (min)', 'Notes', 'Confidence']
      }]
    }, connectionId, agentId);

    // Prepare data for Google Sheets
    const sheetData = fitnessData.map(dataPoint => [
      dataPoint.date.toISOString().split('T')[0], // Date as YYYY-MM-DD
      dataPoint.exercise,
      dataPoint.weight || '',
      dataPoint.weightUnit || '',
      dataPoint.sets || '',
      dataPoint.reps || '',
      dataPoint.duration || '',
      dataPoint.notes || '',
      Math.round(dataPoint.confidence * 100) + '%'
    ]);

    // Update the sheet with data
    await this.sheetsCapabilities.updateCells({
      spreadsheetId: spreadsheet.id,
      range: 'A2:I' + (sheetData.length + 1),
      values: sheetData
    }, connectionId, agentId);

    console.log(`📊 Created Google Sheet: ${spreadsheet.title}`);
    console.log(`🔗 Spreadsheet ID: ${spreadsheet.id}`);
    
    return spreadsheet.id;
  }

  /**
   * Generate dashboard visualization data
   */
  async generateDashboardData(fitnessData: FitnessDataPoint[]): Promise<FitnessDashboardData> {
    // Group data by exercise for progression tracking
    const exerciseGroups = this.groupByExercise(fitnessData);
    
    // Calculate progress charts
    const weightProgression = this.calculateWeightProgression(exerciseGroups);
    const volumeProgression = this.calculateVolumeProgression(exerciseGroups);
    const frequencyData = this.calculateExerciseFrequency(exerciseGroups);

    // Calculate summary statistics
    const summaryStats = this.calculateSummaryStats(fitnessData, exerciseGroups);

    return {
      progressCharts: {
        weightProgression,
        volumeProgression,
        frequencyData
      },
      summaryStats,
      rawData: fitnessData
    };
  }

  // Helper methods for data processing
  private extractNumber(text: string): number | undefined {
    const match = text.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : undefined;
  }

  private extractDuration(text: string): number | undefined {
    // Parse "45 minutes", "1 hour", "90 min", etc.
    const minuteMatch = text.match(/(\d+)\s*(?:minutes?|mins?)/i);
    if (minuteMatch) return parseInt(minuteMatch[1]);

    const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);
    if (hourMatch) return Math.round(parseFloat(hourMatch[1]) * 60);

    return undefined;
  }

  private parseWorkoutDate(dateText: string): Date {
    // Handle relative dates like "yesterday", "today", "last Monday"
    const today = new Date();
    
    if (dateText.toLowerCase().includes('today')) {
      return today;
    }
    
    if (dateText.toLowerCase().includes('yesterday')) {
      return new Date(today.getTime() - 24 * 60 * 60 * 1000);
    }
    
    // Try to parse absolute dates
    const parsed = new Date(dateText);
    return isNaN(parsed.getTime()) ? today : parsed;
  }

  private groupByExercise(data: FitnessDataPoint[]): Map<string, FitnessDataPoint[]> {
    const groups = new Map<string, FitnessDataPoint[]>();
    
    for (const point of data) {
      const existing = groups.get(point.exercise) || [];
      existing.push(point);
      groups.set(point.exercise, existing);
    }
    
    return groups;
  }

  private calculateWeightProgression(exerciseGroups: Map<string, FitnessDataPoint[]>) {
    const progression: Array<{ exercise: string; dates: Date[]; weights: number[] }> = [];
    
    for (const [exercise, dataPoints] of exerciseGroups) {
      const withWeight = dataPoints
        .filter(p => p.weight !== undefined)
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      
      if (withWeight.length > 1) {
        progression.push({
          exercise,
          dates: withWeight.map(p => p.date),
          weights: withWeight.map(p => p.weight!)
        });
      }
    }
    
    return progression;
  }

  private calculateVolumeProgression(exerciseGroups: Map<string, FitnessDataPoint[]>) {
    const progression: Array<{ exercise: string; dates: Date[]; volume: number[] }> = [];
    
    for (const [exercise, dataPoints] of exerciseGroups) {
      const withVolume = dataPoints
        .filter(p => p.weight && p.sets && p.reps)
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      
      if (withVolume.length > 1) {
        progression.push({
          exercise,
          dates: withVolume.map(p => p.date),
          volume: withVolume.map(p => (p.weight! * p.sets! * p.reps!))
        });
      }
    }
    
    return progression;
  }

  private calculateExerciseFrequency(exerciseGroups: Map<string, FitnessDataPoint[]>) {
    const frequency: Array<{ exercise: string; count: number; lastPerformed: Date }> = [];
    
    for (const [exercise, dataPoints] of exerciseGroups) {
      const sortedByDate = dataPoints.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      frequency.push({
        exercise,
        count: dataPoints.length,
        lastPerformed: sortedByDate[0].date
      });
    }
    
    return frequency.sort((a, b) => b.count - a.count);
  }

  private calculateSummaryStats(fitnessData: FitnessDataPoint[], exerciseGroups: Map<string, FitnessDataPoint[]>) {
    const totalWorkouts = new Set(fitnessData.map(p => p.date.toDateString())).size;
    
    // Calculate weekly average
    const firstWorkout = new Date(Math.min(...fitnessData.map(p => p.date.getTime())));
    const lastWorkout = new Date(Math.max(...fitnessData.map(p => p.date.getTime())));
    const weeksBetween = Math.max(1, (lastWorkout.getTime() - firstWorkout.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const averageWorkoutsPerWeek = Math.round((totalWorkouts / weeksBetween) * 10) / 10;

    // Top exercises by frequency
    const exerciseFrequency = Array.from(exerciseGroups.entries())
      .map(([exercise, points]) => ({ exercise, count: points.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const favoriteExercises = exerciseFrequency.map(e => e.exercise);

    // Calculate strength gains (comparing first vs latest weights)
    const strengthGains = Array.from(exerciseGroups.entries())
      .map(([exercise, points]) => {
        const withWeight = points
          .filter(p => p.weight !== undefined)
          .sort((a, b) => a.date.getTime() - b.date.getTime());
        
        if (withWeight.length >= 2) {
          const startWeight = withWeight[0].weight!;
          const currentWeight = withWeight[withWeight.length - 1].weight!;
          const improvement = ((currentWeight - startWeight) / startWeight) * 100;
          
          return { exercise, startWeight, currentWeight, improvement };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => b!.improvement - a!.improvement)
      .slice(0, 10) as Array<{ exercise: string; startWeight: number; currentWeight: number; improvement: number }>;

    return {
      totalWorkouts,
      averageWorkoutsPerWeek,
      favoriteExercises,
      strengthGains
    };
  }
} 