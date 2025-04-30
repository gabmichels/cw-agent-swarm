// Function to convert cron expressions to human-readable format
export const formatCronExpression = (cronExp: string): string => {
  try {
    const parts = cronExp.split(' ');
    if (parts.length !== 5) return cronExp; // Invalid format
    
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    
    // Helper to format time in 12-hour format
    const formatTime = (h: number, m: number): string => {
      const period = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      const minuteStr = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
      return `${hour12}${minuteStr} ${period}`;
    };
    
    // Special case for market-scanner: "0 7,15 * * *" (twice daily at 7am and 3pm)
    if (minute === '0' && hour === '7,15' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return 'Twice daily at 7 AM and 3 PM';
    }
    
    // For simple expressions
    if (dayOfMonth === '*' && month === '*') {
      if (dayOfWeek === '*') {
        // Every day at specific time
        if (minute === '0' && hour.match(/^\d+$/)) {
          return `Daily at ${formatTime(parseInt(hour), 0)}`;
        }
        // Every day at multiple times
        if (minute === '0' && hour.includes(',')) {
          const times = hour.split(',').map(h => formatTime(parseInt(h), 0)).join(' and ');
          return `Daily at ${times}`;
        }
      } else if (dayOfWeek.match(/^\d+$/)) {
        // Specific day of week
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        if (minute === '0' && hour.match(/^\d+$/)) {
          return `Every ${days[parseInt(dayOfWeek)]} at ${formatTime(parseInt(hour), 0)}`;
        }
      } else if (dayOfWeek.includes(',')) {
        // Multiple days
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayNames = dayOfWeek.split(',').map(d => days[parseInt(d)]).join(' & ');
        if (minute === '0' && hour.match(/^\d+$/)) {
          return `Every ${dayNames} at ${formatTime(parseInt(hour), 0)}`;
        }
      }
    }
    
    // Fallback for complex expressions - more readable than raw cron
    let readable = 'At ';
    
    // Minute
    if (minute === '0') {
      // Don't display minutes for on-the-hour times
    } else if (minute === '*') {
      readable += 'every minute ';
    } else {
      readable += `minute ${minute} `;
    }
    
    // Hour
    if (hour === '*') {
      readable += 'of every hour ';
    } else if (hour.includes(',')) {
      const hours = hour.split(',').map(h => formatTime(parseInt(h), 0)).join(' and ');
      readable += `${hours} `;
    } else {
      readable += `${formatTime(parseInt(hour), parseInt(minute))} `;
    }
    
    // Day of week
    if (dayOfWeek !== '*') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      if (dayOfWeek.includes(',')) {
        const dayNames = dayOfWeek.split(',').map(d => days[parseInt(d)]).join(' and ');
        readable += `on ${dayNames} `;
      } else if (dayOfWeek.includes('-')) {
        const [start, end] = dayOfWeek.split('-').map(d => parseInt(d));
        readable += `from ${days[start]} to ${days[end]} `;
      } else {
        readable += `on ${days[parseInt(dayOfWeek)]} `;
      }
    } else if (dayOfMonth !== '*') {
      // Day of month
      if (dayOfMonth.includes(',')) {
        const dates = dayOfMonth.split(',').join(', ');
        readable += `on the ${dates} of the month `;
      } else {
        readable += `on the ${dayOfMonth} of the month `;
      }
    } else {
      readable += 'every day ';
    }
    
    return readable.trim();
  } catch (error) {
    console.error('Error formatting cron expression:', error);
    return cronExp;
  }
}; 