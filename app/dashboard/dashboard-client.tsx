'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, X, Loader2, Trash2, Calendar, MapPin, Users, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import type { EventItem } from '@/lib/types';
import { formatEventDate, isUpcomingDate } from '@/lib/event-date';

type DashboardClientProps = {
  userId: string;
  clubName: string | null;
  initialEvents: EventItem[];
  participantCounts: Record<string, number>;
};

type NewEventForm = {
  title: string;
  date: string;
  location: string;
  category: string;
  description: string;
  capacity: string;
};

type StatusFilter = 'upcoming' | 'past' | 'all';

const EMPTY_FORM: NewEventForm = {
  title: '',
  date: '',
  location: '',
  category: 'Sosyal',
  description: '',
  capacity: '',
};

const CATEGORIES = ['Sosyal', 'Akademik', 'Spor', 'Teknoloji'] as const;

const CATEGORY_STYLES: Record<string, { badge: string }> = {
  Sosyal: { badge: 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200' },
  Akademik: { badge: 'border-amber-400/30 bg-amber-500/10 text-amber-200' },
  Spor: { badge: 'border-green-400/30 bg-green-500/10 text-green-200' },
  Teknoloji: { badge: 'border-violet-400/30 bg-violet-500/10 text-violet-200' },
};

function CreateEventModal({
  userId,
  clubName,
  onClose,
  onCreated,
}: {
  userId: string;
  clubName: string | null;
  onClose: () => void;
  onCreated: (event: EventItem) => void;
}) {
  const [form, setForm] = useState<NewEventForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function set(key: keyof NewEventForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date || !form.location.trim()) {
      toast.error('Lütfen zorunlu alanları doldurun.');
      return;
    }

    setSaving(true);
    try {
      const [datePart, timePart] = form.date.split('T');
      const timeStr = timePart ? `${timePart}:00` : '00:00:00';
      const capacityNum = form.capacity.trim() ? Number(form.capacity) : null;
      if (capacityNum != null && (!Number.isFinite(capacityNum) || capacityNum < 1)) {
        toast.error('Kontenjan 1 veya daha büyük bir sayı olmalı.');
        return;
      }

      const payload = {
        title: form.title.trim(),
        date: datePart,
        time: timeStr,
        location: form.location.trim(),
        category: form.category,
        description: form.description.trim() || null,
        created_by: userId,
        organizer_club: clubName ?? null,
        capacity: capacityNum,
      };

      let { data, error } = await supabase
        .from('events')
        .insert(payload)
        .select('id, title, date, time, location, category, organizer_club, capacity')
        .single();

      // capacity kolonu yoksa eski insert
      if (error?.message?.includes('capacity')) {
        const { capacity: _c, ...withoutCapacity } = payload;
        ({ data, error } = await supabase
          .from('events')
          .insert(withoutCapacity)
          .select('id, title, date, time, location, category, organizer_club')
          .single());
      }

      if (error) {
        if (error.code === '42501') {
          toast.error('Etkinlik oluşturma izniniz yok.');
        } else {
          toast.error('Etkinlik oluşturulamadı: ' + error.message);
        }
        return;
      }

      onCreated(data as EventItem);
      toast.success('Etkinlik oluşturuldu!');
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl sm:rounded-3xl sm:p-8">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Yeni etkinlik</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {clubName ? `${clubName} adına yayınlanacak` : 'Kulüp etkinliği oluştur'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
              Etkinlik adı <span className="text-red-400">*</span>
            </label>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Örn: Yapay Zeka Semineri"
              required
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
                Tarih & saat <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                required
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
                Kategori
              </label>
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
              Konum <span className="text-red-400">*</span>
            </label>
            <input
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Örn: Mühendislik Fakültesi A101"
              required
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
              Kontenjan
            </label>
            <input
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => set('capacity', e.target.value)}
              placeholder="Boş = sınırsız"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10"
            />
            <p className="mt-1 text-[11px] text-slate-600">
              Dolduğunda yeni kayıtlar bekleme listesine alınır.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
              Kısa açıklama
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="Öğrencilerin katılmadan önce bilmesi gerekenler…"
              className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Oluşturuluyor...
              </>
            ) : (
              'Etkinliği yayınla'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  event,
  onCancel,
  onConfirm,
  deleting,
}: {
  event: EventItem;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-700/60 bg-slate-900 p-7 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
          <Trash2 className="h-6 w-6 text-red-400" />
        </div>
        <h3 className="text-base font-bold text-white">Etkinliği sil</h3>
        <p className="mt-2 text-sm text-slate-400">
          <span className="font-semibold text-slate-200">{event.title}</span> kalıcı olarak
          silinecek.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-700"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sil
          </button>
        </div>
      </div>
    </div>
  );
}

export function DashboardClient({
  userId,
  clubName,
  initialEvents,
  participantCounts: initialCounts,
}: DashboardClientProps) {
  const [events, setEvents] = useState<EventItem[]>(initialEvents);
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<EventItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('upcoming');

  const totalParticipants = Object.values(counts).reduce((sum, n) => sum + n, 0);

  const filteredEvents = useMemo(() => {
    if (statusFilter === 'all') return events;
    if (statusFilter === 'upcoming') return events.filter((e) => isUpcomingDate(e.date));
    return events.filter((e) => !isUpcomingDate(e.date));
  }, [events, statusFilter]);

  const upcomingCount = events.filter((e) => isUpcomingDate(e.date)).length;

  function handleCreated(event: EventItem) {
    setEvents((prev) => [event, ...prev]);
    setCounts((prev) => ({ ...prev, [String(event.id)]: 0 }));
    setStatusFilter('upcoming');
  }

  async function handleDelete() {
    if (!deletingEvent) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', String(deletingEvent.id))
        .eq('created_by', userId);

      if (error) {
        toast.error('Etkinlik silinemedi: ' + error.message);
        return;
      }

      setEvents((prev) => prev.filter((e) => String(e.id) !== String(deletingEvent.id)));
      const newCounts = { ...counts };
      delete newCounts[String(deletingEvent.id)];
      setCounts(newCounts);
      toast.success('Etkinlik silindi.');
      setDeletingEvent(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="mb-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-400/80">
              {clubName ?? 'Kulüp paneli'}
            </p>
            <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">Etkinlik yönetimi</h1>
            <p className="mt-1 text-sm text-slate-500">
              Etkinlik oluştur, katılımcıları takip et, geçmişi gözden geçir.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-500 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Yeni etkinlik
          </button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/55 px-4 py-3.5">
            <p className="text-2xl font-black text-indigo-300">{events.length}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Toplam</p>
          </div>
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/55 px-4 py-3.5">
            <p className="text-2xl font-black text-emerald-300">{upcomingCount}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Yaklaşan</p>
          </div>
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/55 px-4 py-3.5">
            <p className="text-2xl font-black text-amber-300">{totalParticipants}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Katılımcı</p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            { id: 'upcoming', label: 'Yaklaşan' },
            { id: 'past', label: 'Geçmiş' },
            { id: 'all', label: 'Tümü' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              statusFilter === tab.id
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-800/70 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-slate-800 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900">
            <Calendar className="h-7 w-7 text-slate-600" />
          </div>
          <p className="font-semibold text-slate-300">Henüz etkinlik oluşturmadınız</p>
          <p className="mt-1.5 text-sm text-slate-500">İlk etkinliğinizi yayınlayarak başlayın.</p>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            İlk etkinliği oluştur
          </button>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 px-6 py-12 text-center text-sm text-slate-500">
          Bu filtrede etkinlik yok.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => {
            const style = CATEGORY_STYLES[event.category] ?? {
              badge: 'border-slate-700/60 bg-slate-800/60 text-slate-400',
            };
            const count = counts[String(event.id)] ?? 0;
            const upcoming = isUpcomingDate(event.date);

            return (
              <div
                key={event.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/55 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${style.badge}`}
                    >
                      {event.category}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        upcoming
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-slate-700/60 text-slate-400'
                      }`}
                    >
                      {upcoming ? 'Yaklaşan' : 'Geçmiş'}
                    </span>
                  </div>

                  <h3 className="truncate text-sm font-bold text-white sm:text-base">{event.title}</h3>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
                    <p className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="text-slate-400">{formatEventDate(event.date, event.time)}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="text-slate-300">{event.location}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      <span className="font-semibold text-slate-300">{count}</span> katılımcı
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/events/${event.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Görüntüle
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDeletingEvent(event)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
                    title="Sil"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Sil
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isCreating ? (
        <CreateEventModal
          userId={userId}
          clubName={clubName}
          onClose={() => setIsCreating(false)}
          onCreated={handleCreated}
        />
      ) : null}

      {deletingEvent ? (
        <DeleteConfirmModal
          event={deletingEvent}
          onCancel={() => setDeletingEvent(null)}
          onConfirm={() => void handleDelete()}
          deleting={deleting}
        />
      ) : null}
    </>
  );
}
