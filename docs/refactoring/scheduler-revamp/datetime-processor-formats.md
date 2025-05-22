# DateTimeProcessor: Supported Date/Time Formats & Expressions

This document details the date/time formats and expressions supported by the `BasicDateTimeProcessor` implementation.

## Natural Language Date Expressions

The `parseNaturalLanguage` method supports the following natural language expressions:

### Simple Date References

| Expression | Description | Example Result |
|------------|-------------|----------------|
| `now` | Current date and time | 2023-06-01T14:30:25Z |
| `today` | Current date at midnight | 2023-06-01T00:00:00Z |
| `tomorrow` | Next day at midnight | 2023-06-02T00:00:00Z |
| `yesterday` | Previous day at midnight | 2023-05-31T00:00:00Z |

### "Next" Expressions

| Expression | Description | Example Result |
|------------|-------------|----------------|
| `next monday` | Next Monday at midnight | 2023-06-05T00:00:00Z |
| `next tuesday` | Next Tuesday at midnight | 2023-06-06T00:00:00Z |
| `next wednesday` | Next Wednesday at midnight | 2023-06-07T00:00:00Z |
| `next thursday` | Next Thursday at midnight | 2023-06-08T00:00:00Z |
| `next friday` | Next Friday at midnight | 2023-06-09T00:00:00Z |
| `next saturday` | Next Saturday at midnight | 2023-06-10T00:00:00Z |
| `next sunday` | Next Sunday at midnight | 2023-06-11T00:00:00Z |
| `next week` | Date 7 days from now | 2023-06-08T14:30:25Z |
| `next month` | Date 1 month from now | 2023-07-01T14:30:25Z |
| `next year` | Date 1 year from now | 2024-06-01T14:30:25Z |

### "In" Expressions

| Expression | Description | Example Result |
|------------|-------------|----------------|
| `in 5 minutes` | 5 minutes from now | 2023-06-01T14:35:25Z |
| `in 2 hours` | 2 hours from now | 2023-06-01T16:30:25Z |
| `in 1 day` | 1 day from now | 2023-06-02T14:30:25Z |
| `in 3 weeks` | 3 weeks from now | 2023-06-22T14:30:25Z |
| `in 6 months` | 6 months from now | 2023-12-01T14:30:25Z |
| `in 1 year` | 1 year from now | 2024-06-01T14:30:25Z |

### Standard Date Formats

In addition to natural language expressions, the following standard date formats are supported:

| Format | Example |
|--------|---------|
| ISO 8601 | `2023-06-01T14:30:25Z` |
| ISO Date | `2023-06-01` |
| Short Date | `06/01/2023` |
| Date with Time | `2023-06-01 14:30:25` |

## Interval Expressions

The `calculateInterval` method supports the following interval formats:

| Format | Description | Example |
|--------|-------------|---------|
| `Ns` | N seconds | `30s` |
| `Nm` | N minutes | `15m` |
| `Nh` | N hours | `2h` |
| `Nd` | N days | `7d` |
| `Nw` | N weeks | `2w` |
| `Nmo` | N months | `3mo` |
| `Ny` | N years | `1y` |

### Full-Word Intervals

The method also supports full-word intervals:

| Format | Example |
|--------|---------|
| `N second(s)` | `1 second`, `30 seconds` |
| `N minute(s)` | `1 minute`, `15 minutes` |
| `N hour(s)` | `1 hour`, `2 hours` |
| `N day(s)` | `1 day`, `7 days` |
| `N week(s)` | `1 week`, `2 weeks` |
| `N month(s)` | `1 month`, `6 months` |
| `N year(s)` | `1 year`, `5 years` |

## Cron Expressions

The `generateCronExpression` method supports the following natural language expressions:

| Expression | Cron Expression | Description |
|------------|----------------|-------------|
| `every minute` | `* * * * *` | Run every minute |
| `every hour` | `0 * * * *` | Run at the start of every hour |
| `every day` or `daily` | `0 0 * * *` | Run at midnight every day |
| `every week` or `weekly` | `0 0 * * 0` | Run at midnight on Sunday |
| `every month` or `monthly` | `0 0 1 * *` | Run at midnight on the 1st of each month |
| `every year` or `yearly` or `annually` | `0 0 1 1 *` | Run at midnight on January 1st |

## Date Formatting

The `formatDate` method supports the following format specifiers:

| Format | Description | Example |
|--------|-------------|---------|
| `iso` | ISO 8601 format | `2023-06-01T14:30:25Z` |
| `short` | MM/DD/YYYY format | `6/1/2023` |
| `long` | Full text format | `Thursday, June 1, 2023` |
| `time` | Time only | `2:30:25 PM` |
| `datetime` | Date and time | `6/1/2023, 2:30:25 PM` |

## Human-Readable Intervals

The `getHumanReadableInterval` method generates human-readable descriptions of time differences:

| Time Difference | Output |
|-----------------|--------|
| < 60 seconds | `X seconds` |
| < 60 minutes | `X minutes` |
| < 24 hours | `X hours and Y minutes` |
| >= 24 hours | `X days` |

## Date Comparison

The following date comparison methods are available:

1. `hasPassed(date, referenceDate)` - Checks if a date has passed relative to the reference date
2. `isSameDay(date1, date2)` - Checks if two dates fall on the same calendar day

## Limitations

The current implementation of the `BasicDateTimeProcessor` has the following limitations:

1. Limited natural language parsing (no support for complex expressions like "the day after tomorrow")
2. No time zone handling beyond what's built into JavaScript's Date object
3. Limited cron expression parsing
4. No support for recurring dates with exceptions (e.g., "every Monday except holidays")

For more advanced use cases, consider integrating a specialized date/time library. 