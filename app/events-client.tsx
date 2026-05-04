'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { EventItem } from '@/lib/types';
import { supabase } from '@/lib/supabase';

type EventsClientProps = {
  initialEvents: EventItem[];
};

// ---------------------------------------------------------------------------
// Sabit stiller
// ---------------------------------------------------------------------------

const CATEGORY_STYLES: Record<string, { badge: string; cardHover: string }> = {
  Sosyal:    { badge: 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200',  cardHover: 'hover:border-indigo-500/60' },
  Akademik:  { badge: 'border-amber-400/30 bg-amber-500/10 text-amber-200',    cardHover: 'hover:border-amber-500/60' },
  Spor:      { badge: 'border-green-400/30 bg-green-500/10 text-green-200',    cardHover: 'hover:border-green-500/60' },
  Teknoloji: { badge: 'border-purple-400/30 bg-purple-500/10 text-purple-200', cardHover: 'hover:border-purple-500/60' },
};

const CATEGORY_ORDER = ['Sosyal', 'Akademik', 'Spor', 'Teknoloji'] as const;

// ---------------------------------------------------------------------------
// Yardımcı fonksiyonlar
// ---------------------------------------------------------------------------

function formatEventDate(date: string, time?: string | null): string {
  // Tarih ve saati birlestirerek dogru parse edilmesini sagla
  const combined = time ? `${date}T${time.slice(0, 5)}` : date;
  const d = new Date(combined);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    ...(time ? { timeStyle: 'short' as const } : {}),
  }).format(d);
}

// ---------------------------------------------------------------------------
// Skeleton kart (yükleme animasyonu)
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <div className="flex h-full animate-pulse flex-col rounded-2xl border border-slate-800/70 bg-slate-900/60 p-5 sm:p-6">
      <div className="mb-4 h-5 w-20 rounded-full bg-slate-800/80" />
      <div className="mb-2 h-5 w-3/4 rounded-lg bg-slate-800/80" />
      <div className="h-4 w-1/2 rounded-lg bg-slate-800/60" />
      <div className="mt-5 space-y-2.5">
        <div className="h-3.5 w-44 rounded bg-slate-800/60" />
        <div className="h-3.5 w-36 rounded bg-slate-800/60" />
      </div>
      <div className="mt-auto pt-5">
        <div className="h-3 w-24 rounded bg-slate-800/40" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ana bileşen
// ---------------------------------------------------------------------------

export function EventsClient({ initialEvents }: EventsClientProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Tum');
  const [events, setEvents] = useState<EventItem[]>(initialEvents);
  const [isLoading, setIsLoading] = useState(false);

  // Debounce timer referansı
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kategori listesi: sabit sıra + veritabanından gelen bilinmeyen kategoriler
  const categories = useMemo<string[]>(() => {
    const all = Array.from(new Set(initialEvents.map((e) => e.category).filter(Boolean)));
    const extras = all.filter((cat) => !CATEGORY_ORDER.includes(cat as never));
    return ['Tum', ...CATEGORY_ORDER, ...extras];
  }, [initialEvents]);

  // ---------------------------------------------------------------------------
  // Supabase fetch — ilike ile sunucu taraflı arama
  // ---------------------------------------------------------------------------
  const fetchEvents = useCallback(async (searchQuery: string, category: string) => {
    setIsLoading(true);
    try {
      let q = supabase
        .from('events')
        .select('id, title, date, time, location, category, organizer_club')
        .order('date', { ascending: true });

      if (searchQuery.trim()) {
        // title VEYA description içinde arama (case-insensitive)
        q = q.or(
          `title.ilike.%${searchQuery.trim()}%,description.ilike.%${searchQuery.trim()}%`,
        );
      }

      if (category !== 'Tum') {
        q = q.eq('category', category);
      }

      const { data, error } = await q;
      if (!error) {
        setEvents((data ?? []) as EventItem[]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Debounce efekti — hem sorgu hem kategori değişimini izler
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Varsayilan durum: sunucudan gelen initialEvents zaten dogru.
    // Gereksiz fetch yapma — bu yaklasim React StrictMode cift-effect
    // sorununu da otomatik olarak cözer.
    if (query === '' && activeCategory === 'Tum') {
      return;
    }

    // Önceki zamanlayıcıyı iptal et
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Metin araması: 350ms bekle. Kategori degisimi: 80ms (neredeyse ani).
    const delay = query.trim() !== '' ? 350 : 80;

    debounceRef.current = setTimeout(() => {
      void fetchEvents(query, activeCategory);
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeCategory, fetchEvents]);

  // ---------------------------------------------------------------------------
  // Filtreleri sıfırla
  // ---------------------------------------------------------------------------
  function clearFilters() {
    setQuery('');
    setActiveCategory('Tum');
  }

  const hasActiveFilter = query.trim() !== '' || activeCategory !== 'Tum';

  // Filtre yoksa sunucu verisini kullan (gereksiz fetch yok).
  // Filtre varsa Supabase'den gelen events state'ini kullan.
  const displayEvents = hasActiveFilter ? events : initialEvents;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="w-full">
      {/* ------------------------------------------------------------------ */}
      {/* Arama çubuğu + kategori filtreleri                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5">
        {/* Arama inputu + yükleme spinner'ı */}
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Etkinlik ara... (başlık veya açıklamada)"
            className="w-full rounded-xl border border-slate-800 bg-slate-950/70 py-3 pl-10 pr-10 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/15"
          />
          {/* Yükleme spinner — sadece aktif filtre varken gorunur */}
          <span
            className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity duration-200 ${isLoading && hasActiveFilter ? 'opacity-100' : 'opacity-0'}`}
          >
            <svg className="h-4 w-4 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </span>
        </div>

        {/* Kaydırılabilir kategori pilleri */}
        <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
          <div className="flex items-center gap-2 sm:flex-wrap">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              Filtrele:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition sm:px-4 ${
                  activeCategory === cat
                    ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-300'
                    : 'border-slate-700/60 bg-slate-800/50 text-slate-500 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Etkinlik listesi                                                    */}
      {/* ------------------------------------------------------------------ */}
      {isLoading && hasActiveFilter ? (
        /* Skeleton kartlar — grid yüksekliği korunuyor, zıplama yok */
        <section className="mt-6 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {Array.from({ length: Math.max(displayEvents.length, 3) }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </section>
      ) : displayEvents.length > 0 ? (
        <section className="mt-6 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {displayEvents.map((event) => {
            const style = CATEGORY_STYLES[event.category] ?? {
              badge: 'border-slate-700/60 bg-slate-800/60 text-slate-400',
              cardHover: 'hover:border-slate-700',
            };
            return (
              <Link href={`/events/${event.id}`} key={event.id} className="group block">
                <article
                  className={`relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/60 p-5 transition-all duration-300 active:scale-[0.98] sm:p-6 sm:group-hover:-translate-y-1 sm:group-hover:shadow-xl sm:group-hover:shadow-black/40 ${style.cardHover}`}
                >
                  {/* Kategori rozeti + Yayınlayan */}
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-widest ${style.badge}`}
                    >
                      {event.category}
                    </div>
                    {event.organizer_club && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/50 bg-slate-800/50 px-2.5 py-1 text-[10px] text-slate-400">
                        <span className="opacity-60">🏛</span>
                        {event.organizer_club}
                      </span>
                    )}
                  </div>

                  {/* Başlık */}
                  <h2 className="text-[15px] font-bold leading-snug text-white transition-colors group-hover:text-indigo-300 sm:text-lg">
                    {event.title}
                  </h2>

                  {/* Meta bilgiler */}
                  <div className="mt-4 space-y-2.5 text-xs text-slate-500 sm:mt-5">
                    <p className="flex items-center gap-2">
                      <span className="text-sm">📅</span>
                      <span className="text-slate-400">{formatEventDate(event.date, event.time)}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-sm">📍</span>
                      <span className="font-medium text-slate-300">{event.location}</span>
                    </p>
                  </div>

                  {/* Alt link — her zaman kartın altına yapışık */}
                  <div className="mt-auto pt-5">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 opacity-0 transition-all duration-200 group-hover:opacity-100">
                      Detaylari Gor
                      <svg
                        className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </article>
              </Link>
            );
          })}
        </section>
      ) : !isLoading ? (
        /* ---------------------------------------------------------------- */
        /* Boş durum                                                         */
        /* ---------------------------------------------------------------- */
        <div className="mt-10 flex flex-col items-center rounded-3xl border border-dashed border-slate-800 py-16 text-center sm:mt-14">
          {/* İllüstrasyon */}
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-slate-800 bg-slate-900">
            <svg className="h-9 w-9 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>

          <p className="text-base font-semibold text-slate-300">Etkinlik bulunamadi</p>
          <p className="mt-2 max-w-xs text-sm text-slate-500">
            {query.trim()
              ? `"${query}" aramasına`
              : activeCategory !== 'Tum'
                ? `"${activeCategory}" kategorisinde`
                : 'Seçilen kriterlere'}
            {' '}uygun etkinlik yok.
          </p>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
            >
              Filtreleri Temizle
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
