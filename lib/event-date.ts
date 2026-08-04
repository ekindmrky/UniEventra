import { endOfWeek, format, isWithinInterval, parseISO, startOfWeek } from 'date-fns';
import { tr } from 'date-fns/locale';

/** YYYY-MM-DD (+ optional HH:MM[:SS]) → Date */
export function eventDateTime(date: string, time?: string | null): Date {
  const combined = time ? `${date}T${time.slice(0, 5)}` : `${date}T00:00`;
  return parseISO(combined);
}

export function formatEventDate(
  date: string,
  time?: string | null,
  style: 'medium' | 'full' = 'medium',
): string {
  const d = eventDateTime(date, time);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: style,
    ...(time ? { timeStyle: 'short' as const } : {}),
  }).format(d);
}

export function dateParts(date: string): { day: string; month: string; weekday: string } {
  const d = eventDateTime(date);
  if (Number.isNaN(d.getTime())) {
    return { day: '--', month: '---', weekday: '' };
  }
  return {
    day: format(d, 'd'),
    month: format(d, 'MMM', { locale: tr }),
    weekday: format(d, 'EEE', { locale: tr }),
  };
}

export function isTodayDate(date: string): boolean {
  return date === format(new Date(), 'yyyy-MM-dd');
}

export function isThisWeekDate(date: string): boolean {
  const d = eventDateTime(date);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return isWithinInterval(d, {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 }),
  });
}

export function isUpcomingDate(date: string): boolean {
  return date >= format(new Date(), 'yyyy-MM-dd');
}

/** Google/Apple takvim uyumlu ICS içeriği */
export function buildIcsContent(event: {
  title: string;
  date: string;
  time?: string | null;
  location: string;
  description?: string | null;
}): string {
  const start = eventDateTime(event.date, event.time);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  const stamp = (d: Date) =>
    format(d, "yyyyMMdd'T'HHmmss");

  const escape = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UniEventra//TR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(event.title)}`,
    `LOCATION:${escape(event.location)}`,
    `DESCRIPTION:${escape(event.description?.trim() || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
