  } catch (error) {
    // Calculate duration for error case
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    taskLogger.logAction("Error in execution", { error: errorMessage });
    
    const errorTraceEntry: ExecutionTraceEntry = {
      step: `Error in execution: ${errorMessage}`,
      startTime,
      endTime,
      duration,
      status: 'error',
      details: { error: errorMessage }
    };
    
    return {
      ...state,
      error: `Error in execution: ${errorMessage}`,
      executionTrace: [...state.executionTrace, errorTraceEntry],
    };
  } 