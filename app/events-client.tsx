'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

type EventItem = {
  id: string | number;
  title: string;
  date: string;
  location: string;
  category: string;
};

type EventsClientProps = {
  events: EventItem[];
};

const CATEGORY_STYLES: Record<string, { pill: string; badge: string; cardHover: string }> = {
  Sosyal: {
    pill: 'border-indigo-400/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20',
    badge: 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200',
    cardHover: 'hover:border-indigo-500/60',
  },
  Akademik: {
    pill: 'border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20',
    badge: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
    cardHover: 'hover:border-amber-500/60',
  },
  Spor: {
    pill: 'border-green-400/40 bg-green-500/10 text-green-200 hover:bg-green-500/20',
    badge: 'border-green-400/30 bg-green-500/10 text-green-200',
    cardHover: 'hover:border-green-500/60',
  },
  Teknoloji: {
    pill: 'border-purple-400/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20',
    badge: 'border-purple-400/30 bg-purple-500/10 text-purple-200',
    cardHover: 'hover:border-purple-500/60',
  },
};

const CATEGORY_ORDER = ['Sosyal', 'Akademik', 'Spor', 'Teknoloji'] as const;

function formatEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function EventsClient({ events }: EventsClientProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Tum');

  const categories = useMemo(() => {
    const fromData = Array.from(new Set(events.map((e) => e.category).filter(Boolean)));
    const extras = fromData.filter((category) => !CATEGORY_ORDER.includes(category as never));
    return ['Tum', ...CATEGORY_ORDER, ...extras];
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesCategory = activeCategory === 'Tum' || event.category === activeCategory;
      const searchable = `${event.title} ${event.location} ${event.category}`.toLowerCase();
      const matchesQuery = !query || searchable.includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, events, query]);

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* ARAMA VE FİLTRELEME ALANI */}
      <div className="mt-8 flex flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-md">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Etkinlik ara..."
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-5 py-4 text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
        />

        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-xs font-bold uppercase text-slate-500 mr-2">Filtrele:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full border px-5 py-2 text-xs font-bold transition ${
                activeCategory === cat 
                ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' 
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ETKİNLİK KARTLARI */}
      <section className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {filteredEvents.map((event) => {
          const style = CATEGORY_STYLES[event.category] || { badge: 'bg-slate-800 text-slate-300', cardHover: 'hover:border-slate-700' };
          return (
            <Link href={`/events/${event.id}`} key={event.id} className="block group">
              <article className={`h-full rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl transition-all duration-300 group-hover:-translate-y-2 ${style.cardHover}`}>
                <div className={`mb-4 inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}>
                  {event.category}
                </div>
                <h2 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">
                  {event.title}
                </h2>
                <div className="mt-6 space-y-3 text-sm text-slate-400">
                  <p className="flex items-center gap-2">📅 {formatEventDate(event.date)}</p>
                  <p className="flex items-center gap-2 text-slate-300 font-medium">📍 {event.location}</p>
                </div>
                <div className="mt-6 text-xs font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Detayları Gör →
                </div>
              </article>
            </Link>
          );
        })}
      </section>

      {filteredEvents.length === 0 && (
        <div className="mt-20 text-center py-12 rounded-3xl border border-dashed border-slate-800">
          <p className="text-slate-500">Aradığın kriterlerde bir etkinlik bulamadık.</p>
        </div>
      )}
    </div>
  );
}