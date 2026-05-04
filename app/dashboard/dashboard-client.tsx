'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, X, Loader2, Trash2, Calendar, MapPin, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import type { EventItem } from '@/lib/types';

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

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
};

const EMPTY_FORM: NewEventForm = {
  title: '',
  date: '',
  location: '',
  category: 'Sosyal',
  description: '',
};

const CATEGORIES = ['Sosyal', 'Akademik', 'Spor', 'Teknoloji'] as const;

const CATEGORY_STYLES: Record<string, { badge: string }> = {
  Sosyal:    { badge: 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200' },
  Akademik:  { badge: 'border-amber-400/30 bg-amber-500/10 text-amber-200' },
  Spor:      { badge: 'border-green-400/30 bg-green-500/10 text-green-200' },
  Teknoloji: { badge: 'border-purple-400/30 bg-purple-500/10 text-purple-200' },
};

// ---------------------------------------------------------------------------
// Yardımcı
// ---------------------------------------------------------------------------

function formatEventDate(date: string, time?: string | null): string {
  const combined = time ? `${date}T${time.slice(0, 5)}` : date;
  const d = new Date(combined);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    ...(time ? { timeStyle: 'short' as const } : {}),
  }).format(d);
}

// ---------------------------------------------------------------------------
// Etkinlik Oluşturma Modalı
// ---------------------------------------------------------------------------

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
      toast.error('Lutfen zorunlu alanlari doldurun.');
      return;
    }

    setSaving(true);
    try {
      // datetime-local degeri "YYYY-MM-DDTHH:MM" formatinda gelir.
      // Veritabaninda date ve time ayri kolonlar oldugu icin parcaliyoruz.
      // time kolonu NOT NULL oldugu icin varsayilan olarak "00:00:00" kullanilir.
      const [datePart, timePart] = form.date.split('T');
      const timeStr = timePart ? `${timePart}:00` : '00:00:00';

      const { data, error } = await supabase
        .from('events')
        .insert({
          title:          form.title.trim(),
          date:           datePart,
          time:           timeStr,
          location:       form.location.trim(),
          category:       form.category,
          description:    form.description.trim() || null,
          created_by:     userId,
          organizer_club: clubName ?? null,
        })
        .select('id, title, date, time, location, category, organizer_club')
        .single();

      if (error) {
        if (error.code === '42501') {
          toast.error('Etkinlik olusturma izniniz yok. Rol kontrolu yapiliyor...');
        } else {
          toast.error('Etkinlik olusturulamadi: ' + error.message);
        }
        return;
      }

      onCreated(data as EventItem);
      toast.success('Etkinlik olusturuldu!');
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-t-3xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl sm:rounded-3xl sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Yeni Etkinlik Olustur</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Başlık */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
              Etkinlik Adi <span className="text-red-400">*</span>
            </label>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Örn: Yapay Zeka Semineri"
              required
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10"
            />
          </div>

          {/* Tarih + Kategori */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
                Tarih <span className="text-red-400">*</span>
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

          {/* Konum */}
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

          {/* Açıklama */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
              Aciklama
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="Etkinlik hakkında kısa bilgi..."
              className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Olusturuluyor...</> : 'Etkinligi Olustur'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Silme onay modalı
// ---------------------------------------------------------------------------

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-700/60 bg-slate-900 p-7 shadow-2xl text-center">
        <div className="mb-4 flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-red-500/10 border border-red-500/30">
          <Trash2 className="h-6 w-6 text-red-400" />
        </div>
        <h3 className="text-base font-bold text-white">Etkinligi Sil</h3>
        <p className="mt-2 text-sm text-slate-400">
          <span className="font-semibold text-slate-200">{event.title}</span> etkinligini silmek istediginize emin misiniz? Bu islem geri alinabilir.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-700"
          >
            Iptal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sil
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ana Dashboard bileşeni
// ---------------------------------------------------------------------------

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

  const totalParticipants = Object.values(counts).reduce((sum, n) => sum + n, 0);

  function handleCreated(event: EventItem) {
    setEvents((prev) => [event, ...prev]);
    setCounts((prev) => ({ ...prev, [String(event.id)]: 0 }));
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
      {/* ------------------------------------------------------------------ */}
      {/* Başlık + İstatistikler                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-white sm:text-3xl">Etkinlik Yonetimi</h1>
            <p className="mt-1 text-sm text-slate-500">Kulubunuzun etkinliklerini buradan olusturun ve yonetin.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-500 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Yeni Etkinlik
          </button>
        </div>

        {/* İstatistik kartları */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 px-5 py-4">
            <p className="text-2xl font-black text-indigo-300">{events.length}</p>
            <p className="mt-0.5 text-xs text-slate-500">Toplam Etkinlik</p>
          </div>
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 px-5 py-4">
            <p className="text-2xl font-black text-emerald-300">{totalParticipants}</p>
            <p className="mt-0.5 text-xs text-slate-500">Toplam Katilimci</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-slate-800/70 bg-slate-900/60 px-5 py-4 sm:col-span-1">
            <p className="text-2xl font-black text-amber-300">
              {events.length > 0 ? Math.round(totalParticipants / events.length) : 0}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Ort. Katilimci / Etkinlik</p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Etkinlik listesi                                                    */}
      {/* ------------------------------------------------------------------ */}
      {events.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-slate-800 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-800 bg-slate-900">
            <Calendar className="h-7 w-7 text-slate-600" />
          </div>
          <p className="font-semibold text-slate-400">Henuz etkinlik olusturmadiniz</p>
          <p className="mt-1.5 text-sm text-slate-600">Yeni bir etkinlik olusturarak baslayin.</p>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
          >
            <Plus className="h-4 w-4" />
            Etkinlik Olustur
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => {
            const style = CATEGORY_STYLES[event.category] ?? { badge: 'border-slate-700/60 bg-slate-800/60 text-slate-400' };
            const count = counts[String(event.id)] ?? 0;
            return (
              <div
                key={event.id}
                className="group relative flex flex-col rounded-2xl border border-slate-800/70 bg-slate-900/60 p-5 transition-all"
              >
                {/* Sil butonu */}
                <button
                  type="button"
                  onClick={() => setDeletingEvent(event)}
                  className="absolute right-4 top-4 rounded-lg border border-slate-700/60 bg-slate-800/60 p-1.5 text-slate-600 opacity-0 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                  title="Sil"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                <div className={`mb-3 inline-flex w-fit rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${style.badge}`}>
                  {event.category}
                </div>

                <Link href={`/events/${event.id}`} className="hover:underline">
                  <h3 className="pr-8 text-sm font-bold leading-snug text-white sm:text-base">
                    {event.title}
                  </h3>
                </Link>

                <div className="mt-3 flex flex-col gap-1.5 text-xs text-slate-500">
                  <p className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span className="text-slate-400">{formatEventDate(event.date, event.time)}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="text-slate-300">{event.location}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Users className="h-3 w-3 shrink-0" />
                    <span className="font-semibold text-slate-300">{count}</span>
                    <span>katilimci</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modaller */}
      {isCreating && (
        <CreateEventModal
          userId={userId}
          clubName={clubName}
          onClose={() => setIsCreating(false)}
          onCreated={handleCreated}
        />
      )}

      {deletingEvent && (
        <DeleteConfirmModal
          event={deletingEvent}
          onCancel={() => setDeletingEvent(null)}
          onConfirm={() => void handleDelete()}
          deleting={deleting}
        />
      )}
    </>
  );
}
