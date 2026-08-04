'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, MapPin, Search, Building2 } from 'lucide-react';
import type { EventItem } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import {
  dateParts,
  formatEventDate,
  isThisWeekDate,
  isTodayDate,
} from '@/lib/event-date';
import { clubPath } from '@/lib/club-slug';

type EventsClientProps = {
  initialEvents: EventItem[];
  isClubAdmin?: boolean;
};

type DateFilter = 'all' | 'today' | 'week';

const CATEGORY_STYLES: Record<string, { badge: string; cardHover: string; accent: string }> = {
  Sosyal: {
    badge: 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200',
    cardHover: 'hover:border-indigo-500/50',
    accent: 'bg-indigo-500/15 text-indigo-200',
  },
  Akademik: {
    badge: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
    cardHover: 'hover:border-amber-500/50',
    accent: 'bg-amber-500/15 text-amber-200',
  },
  Spor: {
    badge: 'border-green-400/30 bg-green-500/10 text-green-200',
    cardHover: 'hover:border-green-500/50',
    accent: 'bg-green-500/15 text-green-200',
  },
  Teknoloji: {
    badge: 'border-violet-400/30 bg-violet-500/10 text-violet-200',
    cardHover: 'hover:border-violet-500/50',
    accent: 'bg-violet-500/15 text-violet-200',
  },
};

const CATEGORY_ORDER = ['Sosyal', 'Akademik', 'Spor', 'Teknoloji'] as const;

function CardSkeleton() {
  return (
    <div className="flex h-full animate-pulse gap-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4 sm:p-5">
      <div className="h-[4.5rem] w-14 shrink-0 rounded-xl bg-slate-800/80" />
      <div className="flex flex-1 flex-col gap-2.5">
        <div className="h-4 w-16 rounded-full bg-slate-800/80" />
        <div className="h-5 w-3/4 rounded-lg bg-slate-800/80" />
        <div className="h-3.5 w-1/2 rounded bg-slate-800/60" />
      </div>
    </div>
  );
}

export function EventsClient({ initialEvents, isClubAdmin = false }: EventsClientProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Tümü');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [events, setEvents] = useState<EventItem[]>(initialEvents);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categories = useMemo<string[]>(() => {
    const all = Array.from(new Set(initialEvents.map((e) => e.category).filter(Boolean)));
    const extras = all.filter((cat) => !CATEGORY_ORDER.includes(cat as never));
    return ['Tümü', ...CATEGORY_ORDER, ...extras];
  }, [initialEvents]);

  const fetchEvents = useCallback(async (searchQuery: string, category: string) => {
    setIsLoading(true);
    try {
      let q = supabase
        .from('events')
        .select('id, title, date, time, location, category, organizer_club')
        .order('date', { ascending: true });

      if (searchQuery.trim()) {
        q = q.or(
          `title.ilike.%${searchQuery.trim()}%,description.ilike.%${searchQuery.trim()}%`,
        );
      }

      if (category !== 'Tümü') {
        q = q.eq('category', category);
      }

      const { data, error } = await q;
      if (!error) setEvents((data ?? []) as EventItem[]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (query === '' && activeCategory === 'Tümü') return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = query.trim() !== '' ? 350 : 80;

    debounceRef.current = setTimeout(() => {
      void fetchEvents(query, activeCategory);
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeCategory, fetchEvents]);

  function clearFilters() {
    setQuery('');
    setActiveCategory('Tümü');
    setDateFilter('all');
  }

  const hasServerFilter = query.trim() !== '' || activeCategory !== 'Tümü';
  const baseEvents = hasServerFilter ? events : initialEvents;

  const displayEvents = useMemo(() => {
    if (dateFilter === 'all') return baseEvents;
    if (dateFilter === 'today') return baseEvents.filter((e) => isTodayDate(e.date));
    return baseEvents.filter((e) => isThisWeekDate(e.date));
  }, [baseEvents, dateFilter]);

  const hasActiveFilter = hasServerFilter || dateFilter !== 'all';
  const isGloballyEmpty = initialEvents.length === 0 && !hasActiveFilter;

  return (
    <div className="w-full">
      {/* Sticky filtre alanı */}
      <div className="sticky top-[57px] z-40 -mx-4 space-y-3 border-b border-slate-800/60 bg-slate-950/90 px-4 py-3 backdrop-blur-xl sm:top-[61px] sm:mx-0 sm:rounded-2xl sm:border sm:border-slate-800/70 sm:bg-slate-900/55 sm:px-5 sm:py-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Etkinlik, açıklama veya yer ara…"
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-3 pl-10 pr-10 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/15"
          />
          {isLoading && hasServerFilter ? (
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
              <span className="block h-4 w-4 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-400" />
            </span>
          ) : null}
        </div>

        {/* Tarih hızlı filtreleri */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'all', label: 'Tümü' },
              { id: 'today', label: 'Bugün' },
              { id: 'week', label: 'Bu hafta' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDateFilter(item.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                dateFilter === item.id
                  ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/25'
                  : 'bg-slate-800/70 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Kategori */}
        <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
          <div className="flex items-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeCategory === cat
                    ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-300'
                    : 'border-slate-700/60 bg-slate-800/40 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sonuç özeti */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500 sm:mt-5">
        <p>
          <span className="font-semibold text-slate-300">{displayEvents.length}</span> etkinlik
        </p>
        {hasActiveFilter ? (
          <button
            type="button"
            onClick={clearFilters}
            className="font-semibold text-indigo-400 hover:text-indigo-300"
          >
            Filtreleri temizle
          </button>
        ) : null}
      </div>

      {isLoading && hasServerFilter ? (
        <section className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {Array.from({ length: Math.max(displayEvents.length, 3) }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </section>
      ) : displayEvents.length > 0 ? (
        <section className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {displayEvents.map((event) => {
            const style = CATEGORY_STYLES[event.category] ?? {
              badge: 'border-slate-700/60 bg-slate-800/60 text-slate-400',
              cardHover: 'hover:border-slate-700',
              accent: 'bg-slate-800 text-slate-300',
            };
            const parts = dateParts(event.date);
            return (
              <article
                key={event.id}
                className={`group flex h-full gap-3.5 rounded-2xl border border-slate-800/70 bg-slate-900/55 p-4 transition-all duration-200 sm:gap-4 sm:p-5 sm:hover:-translate-y-0.5 sm:hover:shadow-lg sm:hover:shadow-black/30 ${style.cardHover}`}
              >
                <Link
                  href={`/events/${event.id}`}
                  className={`flex w-14 shrink-0 flex-col items-center justify-center rounded-xl px-1 py-2 text-center ${style.accent}`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                    {parts.month}
                  </span>
                  <span className="text-xl font-black leading-none">{parts.day}</span>
                  <span className="mt-0.5 text-[10px] capitalize opacity-70">{parts.weekday}</span>
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style.badge}`}
                    >
                      {event.category}
                    </span>
                    {isTodayDate(event.date) ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        Bugün
                      </span>
                    ) : null}
                  </div>

                  <Link href={`/events/${event.id}`}>
                    <h2 className="truncate text-[15px] font-bold leading-snug text-white transition-colors group-hover:text-indigo-300 sm:text-base">
                      {event.title}
                    </h2>
                  </Link>

                  <div className="mt-2.5 space-y-1.5 text-xs text-slate-500">
                    <p className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                      <span className="text-slate-400">
                        {formatEventDate(event.date, event.time)}
                      </span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                      <span className="truncate font-medium text-slate-300">{event.location}</span>
                    </p>
                    {event.organizer_club ? (
                      <p className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                        <Link
                          href={clubPath(event.organizer_club)}
                          className="truncate text-slate-400 underline-offset-2 hover:text-indigo-300 hover:underline"
                        >
                          {event.organizer_club}
                        </Link>
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : !isLoading ? (
        <div className="mt-8 flex flex-col items-center rounded-3xl border border-dashed border-slate-800 px-6 py-14 text-center sm:mt-10">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900">
            <CalendarDays className="h-7 w-7 text-slate-600" />
          </div>

          {isGloballyEmpty ? (
            <>
              <p className="text-base font-semibold text-slate-200">Henüz etkinlik yok</p>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Kampüste yeni etkinlikler eklendiğinde burada görünecek.
              </p>
              {isClubAdmin ? (
                <Link
                  href="/dashboard"
                  className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500"
                >
                  İlk etkinliği oluştur
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-slate-200">Etkinlik bulunamadı</p>
              <p className="mt-2 max-w-xs text-sm text-slate-500">
                {query.trim()
                  ? `"${query}" aramasına`
                  : activeCategory !== 'Tümü'
                    ? `"${activeCategory}" kategorisinde`
                    : dateFilter === 'today'
                      ? 'Bugün için'
                      : dateFilter === 'week'
                        ? 'Bu hafta için'
                        : 'Seçilen kriterlere'}{' '}
                uygun etkinlik yok.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
              >
                Filtreleri temizle
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
