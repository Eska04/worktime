import { DateTime } from 'luxon';
import type { Entry, Report } from '../../../shared/types.js';
import { dayBounds, TIME_ZONE } from '../../../shared/time.js';
export function aggregate(entries: Entry[], startDate: string, endDate: string): Report {
  const periodStart = dayBounds(startDate).start;
  const periodEnd = dayBounds(endDate).end;
  const daily: Report['daily'] = [];
  let day = DateTime.fromISO(startDate, { zone: TIME_ZONE });
  while (day.toISODate()! <= endDate) {
    daily.push({ date: day.toISODate()!, seconds: 0 });
    day = day.plus({ days: 1 });
  }
  const employees = new Map<string, Report['byEmployee'][number]>();
  const recordedDays = new Set<string>();
  let totalSeconds = 0,
    sessionCount = 0;
  for (const entry of entries) {
    if (!entry.endedAt) continue;
    const rawStart = Date.parse(entry.startedAt),
      rawEnd = Date.parse(entry.endedAt);
    const start = Math.max(rawStart, periodStart);
    const end = Math.min(rawEnd, periodEnd);
    const zeroSession = rawStart === rawEnd && rawStart >= periodStart && rawStart < periodEnd;
    if (end <= start && !zeroSession) continue;
    const seconds = (end - start) / 1000;
    totalSeconds += seconds;
    sessionCount++;
    const employee = employees.get(entry.employeeId) ?? {
      employeeId: entry.employeeId,
      fullName: entry.fullName ?? '',
      seconds: 0,
      sessionCount: 0,
    };
    employee.seconds += seconds;
    employee.sessionCount++;
    employees.set(entry.employeeId, employee);
    recordedDays.add(DateTime.fromMillis(start, { zone: TIME_ZONE }).toISODate()!);
    let cursor = start;
    while (cursor < end) {
      const date = DateTime.fromMillis(cursor, { zone: TIME_ZONE }).toISODate()!;
      recordedDays.add(date);
      const chunkEnd = Math.min(dayBounds(date).end, end);
      const bucket = daily.find((d) => d.date === date)!;
      bucket.seconds += (chunkEnd - cursor) / 1000;
      cursor = chunkEnd;
    }
  }
  const activeDays = recordedDays.size;
  return {
    startDate,
    endDate,
    totalSeconds,
    sessionCount,
    employeeCount: employees.size,
    activeDays,
    averagePerActiveDay: activeDays ? Math.floor(totalSeconds / activeDays) : 0,
    daily,
    byEmployee: [...employees.values()].sort((a, b) => b.seconds - a.seconds),
  };
}
