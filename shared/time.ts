import { DateTime } from 'luxon';
export const TIME_ZONE = 'Asia/Dushanbe';
export function nowISO() {
  return new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
}
export function today() {
  return DateTime.now().setZone(TIME_ZONE).toISODate()!;
}
export function defaultPeriod() {
  return {
    startDate: DateTime.now().setZone(TIME_ZONE).minus({ days: 6 }).toISODate()!,
    endDate: today(),
  };
}
export function dayBounds(date: string) {
  const d = DateTime.fromISO(date, { zone: TIME_ZONE });
  return { start: d.startOf('day').toMillis(), end: d.plus({ days: 1 }).startOf('day').toMillis() };
}
export function duration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}
export function dateTime(iso: string) {
  return DateTime.fromISO(iso).setZone(TIME_ZONE).toFormat('dd.MM.yyyy HH:mm');
}
export function inputTime(iso: string) {
  return DateTime.fromISO(iso).setZone(TIME_ZONE).toFormat("yyyy-MM-dd'T'HH:mm");
}
export function inputToISO(value: string) {
  return DateTime.fromISO(value, { zone: TIME_ZONE }).toUTC().toISO()!;
}
