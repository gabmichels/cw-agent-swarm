import { FitnessDataExtractor } from '../services/fitness/FitnessDataExtractor';
import { MemoryRetriever } from '../services/thinking/memory/MemoryRetriever';
import { KnowledgeExtractionWorkflow } from '../agents/shared/knowledge/workflows/KnowledgeExtractionWorkflow';
import { GoogleSheetsCapabilities } from '../services/workspace/capabilities/google/GoogleSheetsCapabilities';

/**
 * Example demonstrating how to extract fitness data from agent conversations
 * and create custom dashboards and Google Sheets exports
 */
export class FitnessDataExtractionExample {
  private fitnessExtractor: FitnessDataExtractor;

  constructor() {
    // Initialize the required services
    const memoryRetriever = new MemoryRetriever();
    const knowledgeExtractor = new KnowledgeExtractionWorkflow({
      openAIApiKey: process.env.OPENAI_API_KEY,
      extractionModel: 'gpt-4',
      maxEntities: 100,
      minConfidenceThreshold: 0.6
    });
    const sheetsCapabilities = new GoogleSheetsCapabilities();

    this.fitnessExtractor = new FitnessDataExtractor(
      memoryRetriever,
      knowledgeExtractor,
      sheetsCapabilities
    );
  }

  /**
   * Example: Extract fitness data and create comprehensive dashboard
   */
  async createFitnessDashboard(): Promise<void> {
    console.log('🏋️ Starting fitness data extraction...');

    try {
      // Step 1: Extract fitness data from agent conversations
      const fitnessData = await this.fitnessExtractor.extractFitnessData({
        timeRangeDays: 30, // Last 30 days
        minConfidence: 0.7, // High confidence threshold
        includeBodyweight: true,
        exerciseTypes: ['strength', 'cardio', 'flexibility']
      });

      console.log(`💪 Extracted ${fitnessData.length} fitness data points`);

      if (fitnessData.length === 0) {
        console.log('⚠️ No fitness data found. Make sure you have workout conversations with your agent!');
        return;
      }

      // Step 2: Generate dashboard visualization data
      const dashboardData = await this.fitnessExtractor.generateDashboardData(fitnessData);

      // Step 3: Display summary statistics
      this.displaySummaryStats(dashboardData.summaryStats);

      // Step 4: Show progress insights
      this.displayProgressInsights(dashboardData.progressCharts);

      // Step 5: Create Google Sheets export (if workspace connected)
      try {
        const spreadsheetId = await this.fitnessExtractor.createGoogleSheetsDashboard(
          fitnessData,
          'your-connection-id', // Replace with actual connection ID
          'your-agent-id',      // Replace with actual agent ID
          'My Fitness Tracker 2024'
        );
        console.log(`📊 Google Sheets dashboard created: ${spreadsheetId}`);
             } catch (error) {
         console.log('⚠️ Google Sheets export failed (workspace not connected?):', (error as Error).message);
       }

    } catch (error) {
      console.error('❌ Fitness data extraction failed:', error);
    }
  }

  /**
   * Display summary statistics in a readable format
   */
  private displaySummaryStats(stats: any): void {
    console.log('\n📊 FITNESS SUMMARY STATS');
    console.log('═══════════════════════');
    console.log(`Total Workouts: ${stats.totalWorkouts}`);
    console.log(`Average Workouts/Week: ${stats.averageWorkoutsPerWeek}`);
    
    console.log('\n🏆 Favorite Exercises:');
    stats.favoriteExercises.forEach((exercise: string, index: number) => {
      console.log(`${index + 1}. ${exercise}`);
    });

    console.log('\n💪 Strength Gains:');
    stats.strengthGains.forEach((gain: any) => {
      const improvement = gain.improvement > 0 ? '+' : '';
      console.log(`${gain.exercise}: ${gain.startWeight} → ${gain.currentWeight} (${improvement}${gain.improvement.toFixed(1)}%)`);
    });
  }

  /**
   * Display progress insights
   */
  private displayProgressInsights(progressCharts: any): void {
    console.log('\n📈 PROGRESS INSIGHTS');
    console.log('═══════════════════');

    // Weight progression
    if (progressCharts.weightProgression.length > 0) {
      console.log('\n🏋️ Weight Progression:');
      progressCharts.weightProgression.forEach((progression: any) => {
        const latest = progression.weights[progression.weights.length - 1];
        const first = progression.weights[0];
        const change = latest - first;
        const changePercent = ((change / first) * 100).toFixed(1);
        console.log(`${progression.exercise}: ${first} → ${latest} lbs (${change > 0 ? '+' : ''}${change} lbs, ${changePercent}%)`);
      });
    }

    // Exercise frequency
    if (progressCharts.frequencyData.length > 0) {
      console.log('\n📅 Exercise Frequency:');
      progressCharts.frequencyData.slice(0, 5).forEach((freq: any) => {
        const daysSince = Math.floor((Date.now() - freq.lastPerformed.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`${freq.exercise}: ${freq.count} times (last: ${daysSince} days ago)`);
      });
    }
  }

  /**
   * Example: Extract specific exercise data
   */
  async extractSpecificExercise(exerciseName: string): Promise<void> {
    console.log(`🔍 Extracting data for: ${exerciseName}`);

    const allData = await this.fitnessExtractor.extractFitnessData({
      timeRangeDays: 90, // Last 90 days
      minConfidence: 0.6
    });

    // Filter for specific exercise
    const exerciseData = allData.filter(data => 
      data.exercise.toLowerCase().includes(exerciseName.toLowerCase())
    );

    if (exerciseData.length === 0) {
      console.log(`❌ No data found for exercise: ${exerciseName}`);
      return;
    }

    console.log(`\n📋 Found ${exerciseData.length} entries for ${exerciseName}:`);
    
    exerciseData
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .forEach(data => {
        console.log(`${data.date.toDateString()}: ${data.weight}${data.weightUnit} × ${data.sets}×${data.reps}`);
      });

    // Calculate progression
    const weightsWithDates = exerciseData
      .filter(d => d.weight)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (weightsWithDates.length >= 2) {
      const first = weightsWithDates[0];
      const latest = weightsWithDates[weightsWithDates.length - 1];
      const improvement = ((latest.weight! - first.weight!) / first.weight!) * 100;
      
      console.log(`\n💪 Progress: ${first.weight}${first.weightUnit} → ${latest.weight}${latest.weightUnit} (+${improvement.toFixed(1)}%)`);
    }
  }

  /**
   * Example: Generate fitness insights and recommendations
   */
  async generateFitnessInsights(): Promise<void> {
    console.log('🧠 Generating fitness insights...');

    const fitnessData = await this.fitnessExtractor.extractFitnessData({
      timeRangeDays: 60,
      minConfidence: 0.6
    });

    const dashboardData = await this.fitnessExtractor.generateDashboardData(fitnessData);

    console.log('\n🎯 FITNESS INSIGHTS & RECOMMENDATIONS');
    console.log('══════════════════════════════════');

    // Workout frequency analysis
    const workoutsPerWeek = dashboardData.summaryStats.averageWorkoutsPerWeek;
    if (workoutsPerWeek < 3) {
      console.log('⚠️ LOW FREQUENCY: Consider increasing workout frequency to 3-4 times per week');
    } else if (workoutsPerWeek > 6) {
      console.log('⚠️ HIGH FREQUENCY: Consider adding rest days to prevent overtraining');
    } else {
      console.log('✅ GOOD FREQUENCY: Your workout frequency is well-balanced');
    }

    // Exercise variety analysis
    const uniqueExercises = new Set(fitnessData.map(d => d.exercise)).size;
    if (uniqueExercises < 5) {
      console.log('💡 VARIETY: Consider adding more exercise variety to your routine');
    } else {
      console.log('✅ GOOD VARIETY: You have good exercise diversity');
    }

    // Progress analysis
    const progressingExercises = dashboardData.summaryStats.strengthGains.filter(g => g.improvement > 0);
    const plateauExercises = dashboardData.summaryStats.strengthGains.filter(g => Math.abs(g.improvement) < 2);

    console.log(`\n📈 ${progressingExercises.length} exercises showing progress`);
    console.log(`📊 ${plateauExercises.length} exercises may have plateaued`);

    if (plateauExercises.length > 0) {
      console.log('\n💡 PLATEAU RECOMMENDATIONS:');
      plateauExercises.forEach(exercise => {
        console.log(`- ${exercise.exercise}: Try increasing volume, changing rep ranges, or adding variations`);
      });
    }
  }
}

// Example usage
if (require.main === module) {
  const example = new FitnessDataExtractionExample();
  
  // Run examples
  example.createFitnessDashboard()
    .then(() => example.extractSpecificExercise('bench press'))
    .then(() => example.generateFitnessInsights())
    .then(() => {
      console.log('\n✅ Fitness data extraction examples completed!');
      console.log('\n🔗 INTEGRATION SUGGESTIONS:');
      console.log('- Connect to Google Sheets for automatic tracking');
      console.log('- Set up weekly fitness reports via email');
      console.log('- Create visual charts with Chart.js or D3');
      console.log('- Build custom fitness dashboard UI components');
      console.log('- Add notifications for workout reminders');
      console.log('- Export data to fitness apps like MyFitnessPal');
    })
    .catch(console.error);
} 