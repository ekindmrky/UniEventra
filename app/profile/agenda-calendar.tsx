'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { DayPicker, type DayButtonProps } from 'react-day-picker';
import { tr } from 'react-day-picker/locale';
import {
  format, parseISO, isSameDay,
  differenceInDays,
  startOfWeek, endOfWeek,
  isWithinInterval,
} from 'date-fns';
import { ChevronRight, Calendar, MapPin, Clock, Sparkles, ArrowRight } from 'lucide-react';
import type { EventItem } from '@/lib/types';

// ---------------------------------------------------------------------------
// Tipler & sabitler
// ---------------------------------------------------------------------------

export type AgendaCalendarProps = {
  joinedEvents: EventItem[];   // Kullanıcının katıldığı etkinlikler
  campusEvents: EventItem[];   // Tüm gelecek kampüs etkinlikleri
};

const CATEGORY_DOT: Record<string, string> = {
  Sosyal:    'bg-indigo-400',
  Akademik:  'bg-amber-400',
  Spor:      'bg-green-400',
  Teknoloji: 'bg-purple-400',
};

const CATEGORY_STYLES: Record<string, string> = {
  Sosyal:    'border-indigo-400/30 bg-indigo-500/10 text-indigo-200',
  Akademik:  'border-amber-400/30 bg-amber-500/10 text-amber-200',
  Spor:      'border-green-400/30 bg-green-500/10 text-green-200',
  Teknoloji: 'border-purple-400/30 bg-purple-500/10 text-purple-200',
};

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function parseEventDate(event: EventItem): Date | null {
  try {
    const d = parseISO(event.date.slice(0, 10));
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function formatEventTime(event: EventItem): string {
  return event.time ? event.time.slice(0, 5) : '';
}

function formatSelectedDay(date: Date): string {
  return new Intl.DateTimeFormat('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
}

/** "X gün kaldı" / "Bugün!" / "Dün" / "X gün önce" */
function countdown(eventDate: Date, today: Date): { label: string; urgent: boolean } {
  const diff = differenceInDays(eventDate, today);
  if (diff === 0)  return { label: 'Bugün!',     urgent: true };
  if (diff === 1)  return { label: 'Yarın',       urgent: true };
  if (diff > 1)    return { label: `${diff} gün kaldı`, urgent: diff <= 3 };
  if (diff === -1) return { label: 'Dün',         urgent: false };
  return { label: `${Math.abs(diff)} gün önce`,   urgent: false };
}

// ---------------------------------------------------------------------------
// Tek etkinlik satırı (seçili gün paneli)
// ---------------------------------------------------------------------------

function EventRow({
  event,
  today,
  isJoined,
}: {
  event: EventItem;
  today: Date;
  isJoined: boolean;
}) {
  const catStyle = CATEGORY_STYLES[event.category] ?? 'border-slate-700/60 bg-slate-800/60 text-slate-400';
  const timeStr  = formatEventTime(event);
  const eDate    = parseEventDate(event);
  const cd       = eDate ? countdown(eDate, today) : null;

  return (
    <li>
      <Link
        href={`/events/${event.id}`}
        className="group flex items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-900/80 p-3 transition-all hover:border-slate-700 hover:bg-slate-900 sm:p-3.5"
      >
        {/* Saat */}
        <div className="flex w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-slate-800/60 bg-slate-950/50 px-1 py-2 text-center">
          {timeStr ? (
            <>
              <Clock className="mb-0.5 h-2.5 w-2.5 text-slate-600" />
              <span className="text-[11px] font-bold leading-none text-slate-300">{timeStr}</span>
            </>
          ) : (
            <Calendar className="h-3 w-3 text-slate-600" />
          )}
        </div>

        {/* İçerik */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest ${catStyle}`}>
              {event.category}
            </span>
            {isJoined && (
              <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                ✓ Katıldın
              </span>
            )}
            {cd && (
              <span className={`text-[9px] font-semibold ${cd.urgent ? 'text-amber-400' : 'text-slate-600'}`}>
                {cd.label}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold leading-snug text-slate-100 transition-colors group-hover:text-indigo-300">
            {event.title}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            {event.location}
          </p>
        </div>

        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-indigo-400" />
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Ana bileşen
// ---------------------------------------------------------------------------

export function AgendaCalendar({ joinedEvents, campusEvents }: AgendaCalendarProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [month,       setMonth]       = useState<Date>(today);

  // Kullanıcının katıldığı etkinlikler: tarih → list
  const joinedByDate = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const ev of joinedEvents) {
      const d = parseEventDate(ev);
      if (!d) continue;
      const key = toDateKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [joinedEvents]);

  // Tüm kampüs etkinlikleri: tarih → list
  const campusByDate = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const ev of campusEvents) {
      const d = parseEventDate(ev);
      if (!d) continue;
      const key = toDateKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [campusEvents]);

  // Joined event id seti (hızlı arama için)
  const joinedIds = useMemo(() => new Set(joinedEvents.map((e) => String(e.id))), [joinedEvents]);

  // Seçili günün verisi
  const selectedKey           = toDateKey(selectedDay);
  const selectedJoined        = joinedByDate.get(selectedKey) ?? [];
  const selectedCampusAll     = campusByDate.get(selectedKey) ?? [];
  // Kampüs etkinlikleri - joined olmayanlar önce, joinedler sonra (zaten ayrı gösterilecek)
  const selectedCampusOnly    = selectedCampusAll.filter((e) => !joinedIds.has(String(e.id)));
  const isDayInFuture         = selectedDay >= today;

  // Bu haftada kullanıcının etkinliği var mı?
  const weekStart = useMemo(() => startOfWeek(today, { weekStartsOn: 1 }), [today]);
  const weekEnd   = useMemo(() => endOfWeek(today, { weekStartsOn: 1 }),   [today]);
  const hasEventThisWeek = useMemo(() => joinedEvents.some((ev) => {
    const d = parseEventDate(ev);
    return d && isWithinInterval(d, { start: weekStart, end: weekEnd });
  }), [joinedEvents, weekStart, weekEnd]);

  // Yaklaşan etkinliklerin ID seti (badge için)
  const upcomingIds = useMemo(
    () => new Set(joinedEvents.filter((ev) => { const d = parseEventDate(ev); return d && d >= today; }).map((e) => String(e.id))),
    [joinedEvents, today],
  );

  // Bu haftaki öneri etkinlikleri (katılmadığın, gelecekte olan)
  const weekSuggestions = useMemo(() => {
    if (hasEventThisWeek) return [];
    return campusEvents
      .filter((ev) => {
        const d = parseEventDate(ev);
        return d && isWithinInterval(d, { start: today, end: weekEnd }) && !joinedIds.has(String(ev.id));
      })
      .slice(0, 3);
  }, [hasEventThisWeek, campusEvents, today, weekEnd, joinedIds]);

  // ----- DayButton -----
  const DayButton = useCallback(
    ({ day, modifiers, ...buttonProps }: DayButtonProps) => {
      const key         = toDateKey(day.date);
      const dayJoined   = joinedByDate.get(key) ?? [];
      const dayCampus   = campusByDate.get(key) ?? [];
      const isSelected  = modifiers.selected;
      const isToday     = modifiers.today;
      const isOutside   = modifiers.outside;
      const isPast      = day.date < today && !isToday;
      const dow         = day.date.getDay();
      const isWeekend   = dow === 0 || dow === 6;
      const hasJoined   = dayJoined.length > 0;
      const hasCampus   = dayCampus.some((e) => !joinedIds.has(String(e.id)));

      // Sayı rengi
      let numColor = 'text-slate-200';
      if (isOutside)                  numColor = 'text-slate-700';
      else if (isPast && !isSelected) numColor = 'text-slate-600';
      else if (isWeekend && !isSelected) numColor = 'text-slate-400';

      // En yakın etkinliği tooltip için bul
      const tooltipEvents = [...dayJoined, ...dayCampus.filter((e) => !joinedIds.has(String(e.id)))];
      const firstEv       = tooltipEvents[0];
      const cdResult      = firstEv && !isOutside ? countdown(day.date, today) : null;

      return (
        <div className="group relative flex-1">
          <button
            {...buttonProps}
            className={[
              'flex w-full flex-col items-center justify-center gap-0.5 rounded-lg p-1 text-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50',
              isSelected
                ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30'
                : isToday
                ? 'bg-indigo-500/15 ring-1 ring-indigo-500/40'
                : 'hover:bg-slate-800/70',
            ].join(' ')}
          >
            <span className={[
              'flex h-7 w-7 items-center justify-center rounded-md text-[13px] font-medium leading-none',
              isSelected ? 'font-bold text-white' : isToday ? 'font-bold text-indigo-300' : numColor,
            ].join(' ')}>
              {day.date.getDate()}
            </span>

            {/* Etkinlik noktaları */}
            {!isOutside && (hasJoined || hasCampus) && (
              <div className="flex items-center gap-0.5">
                {/* Joined etkinlikler: parlak */}
                {dayJoined.slice(0, 2).map((ev, i) => (
                  <span
                    key={`j-${i}`}
                    className={[
                      'h-1.5 w-1.5 rounded-full transition-opacity',
                      isSelected ? 'bg-white' : (CATEGORY_DOT[ev.category] ?? 'bg-slate-400'),
                      isPast ? 'opacity-40' : 'opacity-100',
                    ].join(' ')}
                  />
                ))}
                {/* Sadece kampüs etkinliği olan günler: küçük nokta */}
                {!hasJoined && hasCampus && !isSelected && (
                  <span className="h-1 w-1 rounded-full bg-slate-600" />
                )}
              </div>
            )}
          </button>

          {/* Tooltip — yalnızca etkinliği olan günlerde göster */}
          {firstEv && !isOutside && (
            <div
              className={[
                'pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2',
                'rounded-xl border border-slate-700/80 bg-slate-900 p-3 shadow-xl shadow-black/50',
                'opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100',
              ].join(' ')}
            >
              {/* Gün ve etkinlik sayısı */}
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {tooltipEvents.length} etkinlik
              </p>

              {/* İlk etkinlik detayı */}
              <p className="truncate text-xs font-semibold text-slate-100">{firstEv.title}</p>
              {firstEv.time && (
                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                  <Clock className="h-2.5 w-2.5" /> {firstEv.time.slice(0, 5)}
                </p>
              )}

              {/* Geri sayım — sadece gelecek günler */}
              {cdResult && day.date >= today && (
                <span className={[
                  'mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold',
                  cdResult.urgent
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-indigo-500/15 text-indigo-400',
                ].join(' ')}>
                  {cdResult.label}
                </span>
              )}

              {/* "ve X daha" */}
              {tooltipEvents.length > 1 && (
                <p className="mt-1.5 text-[10px] text-slate-600">
                  +{tooltipEvents.length - 1} etkinlik daha
                </p>
              )}

              {/* Ok */}
              <div className="absolute left-1/2 top-full -mt-px -translate-x-1/2 border-4 border-transparent border-t-slate-700/80" />
            </div>
          )}
        </div>
      );
    },
    [joinedByDate, campusByDate, joinedIds, today],
  );

  const handleSelect = useCallback((day: Date | undefined) => {
    if (day) setSelectedDay(day);
  }, []);

  // ----- Render -----
  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------------ */}
      {/* Boş hafta öneri banner'ı                                            */}
      {/* ------------------------------------------------------------------ */}
      {!hasEventThisWeek && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
              <Sparkles className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-200">
                Bu hafta boş görünüyorsun!
              </p>
              <p className="mt-0.5 text-xs text-amber-400/70">
                Kampüste etkinlikler seni bekliyor, katılmak ister misin?
              </p>
              {weekSuggestions.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {weekSuggestions.map((ev) => (
                    <li key={ev.id}>
                      <Link
                        href={`/events/${ev.id}`}
                        className="group flex items-center gap-2 rounded-lg border border-amber-500/10 bg-amber-500/5 px-3 py-2 text-xs transition hover:border-amber-500/30 hover:bg-amber-500/10"
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_DOT[ev.category] ?? 'bg-slate-400'}`} />
                        <span className="flex-1 truncate font-medium text-amber-100">{ev.title}</span>
                        <span className="shrink-0 text-amber-500/60">{ev.date.slice(5, 10)}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-amber-500/40 transition group-hover:translate-x-0.5 group-hover:text-amber-400" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {weekSuggestions.length === 0 && (
                <Link
                  href="/"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300"
                >
                  Tüm etkinliklere bak <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Takvim + Gün Paneli — iki sütun (md+)                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto,1fr]">

        {/* Takvim */}
        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60">
          <DayPicker
            mode="single"
            locale={tr}
            selected={selectedDay}
            onSelect={handleSelect}
            month={month}
            onMonthChange={setMonth}
            components={{ DayButton }}
            classNames={{
              root:            'p-4 sm:p-5 select-none',
              months:          'flex flex-col',
              month:           'space-y-3',
              month_caption:   'flex items-center justify-between mb-1',
              caption_label:   'text-sm font-bold text-slate-100 capitalize',
              nav:             'flex items-center gap-1',
              button_previous: 'flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800/70 bg-slate-900/80 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 focus:outline-none',
              button_next:     'flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800/70 bg-slate-900/80 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 focus:outline-none',
              month_grid:      'w-full border-collapse',
              weekdays:        'flex mb-2',
              weekday:         'flex-1 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-600 pb-1',
              weeks:           'space-y-1',
              week:            'flex',
              day:             'flex-1 p-0.5',
              day_button:      '',
              selected:        '',
              today:           '',
              outside:         '',
              disabled:        'opacity-30 pointer-events-none',
              hidden:          'invisible',
              range_start:     '',
              range_end:       '',
              range_middle:    '',
              focused:         '',
            }}
          />

          {/* Renk açıklaması */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-800/60 px-4 py-2.5 sm:px-5">
            {Object.entries(CATEGORY_DOT).map(([cat, dot]) => (
              <span key={cat} className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                <span className="text-[10px] text-slate-700">{cat}</span>
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-slate-600" />
              <span className="text-[10px] text-slate-700">Kampüs</span>
            </span>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Seçili gün paneli                                                */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4 sm:p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
            {formatSelectedDay(selectedDay)}
          </h3>

          {/* Kullanıcının katıldığı etkinlikler */}
          {selectedJoined.length > 0 && (
            <section className="mb-4">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Katıldıklarım
              </p>
              <ul className="space-y-2">
                {selectedJoined.map((ev) => (
                  <EventRow key={ev.id} event={ev} today={today} isJoined />
                ))}
              </ul>
            </section>
          )}

          {/* Kampüs etkinlikleri (katılmadıkları) */}
          {selectedCampusOnly.length > 0 && (
            <section className="mb-4">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                {isDayInFuture ? 'Bu Gün Kampüste' : 'Gerçekleşti'}
              </p>
              <ul className="space-y-2">
                {selectedCampusOnly.map((ev) => (
                  <EventRow key={ev.id} event={ev} today={today} isJoined={false} />
                ))}
              </ul>
            </section>
          )}

          {/* Boş durum */}
          {selectedJoined.length === 0 && selectedCampusOnly.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
              <span className="mb-3 text-3xl">
                {isSameDay(selectedDay, today) ? '🌅' : isDayInFuture ? '📅' : '📭'}
              </span>
              <p className="text-sm font-medium text-slate-500">
                {isSameDay(selectedDay, today)
                  ? 'Bugün için hiçbir etkinlik yok'
                  : isDayInFuture
                  ? 'Bu gün kampüste etkinlik yok'
                  : 'Bu gün için kayıt yok'}
              </p>
              {isDayInFuture && (
                <Link
                  href="/"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
                >
                  Etkinlik Keşfet <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}

          {/* Yaklaşan etkinlikler kısa özeti — yalnızca bugün görünümünde */}
          {isSameDay(selectedDay, today) && (
            <div className="mt-auto border-t border-slate-800/60 pt-3">
              {(() => {
                const upcoming = joinedEvents
                  .filter((ev) => { const d = parseEventDate(ev); return d && d > today; })
                  .sort((a, b) => (parseEventDate(a)?.getTime() ?? 0) - (parseEventDate(b)?.getTime() ?? 0))
                  .slice(0, 2);
                if (!upcoming.length) return null;
                return (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                      Sonraki Etkinliklerim
                    </p>
                    {upcoming.map((ev) => {
                      const d = parseEventDate(ev);
                      const cd = d ? countdown(d, today) : null;
                      return (
                        <Link
                          key={ev.id}
                          href={`/events/${ev.id}`}
                          className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-xs transition hover:bg-slate-800/50"
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_DOT[ev.category] ?? 'bg-slate-400'} ${upcomingIds.has(String(ev.id)) ? 'opacity-100' : 'opacity-50'}`} />
                          <span className="flex-1 truncate text-slate-400 group-hover:text-slate-200">{ev.title}</span>
                          {cd && <span className={`shrink-0 text-[10px] ${cd.urgent ? 'text-amber-400' : 'text-slate-600'}`}>{cd.label}</span>}
                        </Link>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
