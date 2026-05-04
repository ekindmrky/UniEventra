'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Pencil, X, Loader2,
  GraduationCap, BookOpen, MapPin, Calendar,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import type { EventItem, UserProfile } from '@/lib/types';
import type { UserRole } from '@/lib/auth';
import { AgendaCalendar } from './agenda-calendar';

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

type ProfileClientProps = {
  userId: string;
  role: UserRole;
  initialProfile: UserProfile | null;
  userEmail: string | null;
  userMeta: Record<string, string> | null;
  joinedEvents: EventItem[];
  createdEvents: EventItem[];
  campusEvents: EventItem[];
};

type EditForm = {
  full_name:  string;
  university: string;
  department: string;
  bio:        string;
  interests:  string;
};

// ---------------------------------------------------------------------------
// Yardımcı fonksiyonlar
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

function getInitials(name: string | null, email: string | null): string {
  if (name?.trim()) {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
}

function isUpcoming(dateStr: string): boolean {
  return new Date(dateStr) >= new Date();
}

const CATEGORY_STYLES: Record<string, { badge: string; cardHover: string }> = {
  Sosyal:    { badge: 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200',  cardHover: 'hover:border-indigo-500/60' },
  Akademik:  { badge: 'border-amber-400/30 bg-amber-500/10 text-amber-200',    cardHover: 'hover:border-amber-500/60' },
  Spor:      { badge: 'border-green-400/30 bg-green-500/10 text-green-200',    cardHover: 'hover:border-green-500/60' },
  Teknoloji: { badge: 'border-purple-400/30 bg-purple-500/10 text-purple-200', cardHover: 'hover:border-purple-500/60' },
};

// ---------------------------------------------------------------------------
// Paylaşılan küçük bileşenler
// ---------------------------------------------------------------------------

function EventCard({ event, dimmed = false }: { event: EventItem; dimmed?: boolean }) {
  const style = CATEGORY_STYLES[event.category] ?? {
    badge: 'border-slate-700/60 bg-slate-800/60 text-slate-400',
    cardHover: 'hover:border-slate-700',
  };
  return (
    <Link href={`/events/${event.id}`} className="group block">
      <article
        className={`flex h-full flex-col rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4 transition-all duration-200 active:scale-[0.98] sm:p-5 sm:group-hover:-translate-y-0.5 sm:group-hover:shadow-lg sm:group-hover:shadow-black/30 ${style.cardHover} ${dimmed ? 'opacity-50' : ''}`}
      >
        <div className={`mb-3 inline-flex w-fit rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${style.badge}`}>
          {event.category}
        </div>
        <h3 className="text-sm font-bold leading-snug text-white transition-colors group-hover:text-indigo-300 sm:text-[15px]">
          {event.title}
        </h3>
        <div className="mt-3 space-y-1.5 text-xs text-slate-500">
          <p className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 shrink-0" />
            <span className="text-slate-400">{formatEventDate(event.date, event.time)}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="text-slate-300">{event.location}</span>
          </p>
        </div>
      </article>
    </Link>
  );
}

function SectionEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-800/70 py-8 text-center">
      <p className="text-sm text-slate-600">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Modal
// ---------------------------------------------------------------------------

function EditModal({
  initial,
  onClose,
  onSaved,
  userId,
}: {
  initial: EditForm;
  onClose: () => void;
  onSaved: (updated: Partial<UserProfile>) => void;
  userId: string;
}) {
  const [form, setForm] = useState<EditForm>(initial);
  const [saving, setSaving] = useState(false);

  function set(key: keyof EditForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const interestsArray = form.interests.split(',').map((s) => s.trim()).filter(Boolean);

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name:  form.full_name.trim() || null,
          university: form.university.trim() || null,
          department: form.department.trim() || null,
          bio:        form.bio.trim() || null,
          interests:  interestsArray.length > 0 ? interestsArray : null,
        })
        .eq('id', userId);

      if (error) { toast.error('Profil kaydedilemedi: ' + error.message); return; }

      onSaved({
        full_name:  form.full_name.trim() || null,
        university: form.university.trim() || null,
        department: form.department.trim() || null,
        bio:        form.bio.trim() || null,
        interests:  interestsArray.length > 0 ? interestsArray : null,
      });
      toast.success('Profil guncellendi!');
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-t-3xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl sm:rounded-3xl sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Profili Duzenle</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">Ad Soyad</label>
            <input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="Adın ve soyadın"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">Universite</label>
              <input value={form.university} onChange={(e) => set('university', e.target.value)} placeholder="Örn: ODTÜ"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">Bolum</label>
              <input value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="Örn: Bilgisayar Müh."
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
              Hakkinda <span className="normal-case text-slate-600">(maks. 500 karakter)</span>
            </label>
            <textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} maxLength={500} rows={3}
              placeholder="Kendini kısaca tanıt..."
              className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10" />
            <p className="mt-1 text-right text-xs text-slate-600">{form.bio.length}/500</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
              Ilgi Alanlari <span className="normal-case text-slate-600">(virgülle ayır)</span>
            </label>
            <input value={form.interests} onChange={(e) => set('interests', e.target.value)} placeholder="Örn: Yapay Zeka, Müzik, Robotik"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10" />
          </div>

          <button type="submit" disabled={saving}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-60">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Kaydediliyor...</> : 'Kaydet'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Öğrenci: Gelecek / Geçmiş bölümlü görünüm
// ---------------------------------------------------------------------------

function StudentEventView({ joinedEvents, campusEvents }: { joinedEvents: EventItem[]; campusEvents: EventItem[] }) {
  const past = joinedEvents.filter((e) => !isUpcoming(e.date));
  const [showPast, setShowPast] = useState(false);

  return (
    <div className="mt-8 space-y-8">
      {/* Kişisel Ajanda Takvimi */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-indigo-300">
            Kisisel Ajanda
          </h2>
          {joinedEvents.length > 0 && (
            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
              {joinedEvents.length} etkinlik
            </span>
          )}
        </div>

        {joinedEvents.length === 0 ? (
          <SectionEmpty message="Henuz hicbir etkinlige katilmadiniz. Takvim doldurmaya basla!" />
        ) : (
          <AgendaCalendar joinedEvents={joinedEvents} campusEvents={campusEvents} />
        )}
      </section>

      {/* Geçmiş Etkinlikler — daraltılabilir bölüm */}
      {past.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            className="mb-4 flex w-full items-center gap-2 rounded-2xl border border-slate-800/60 bg-slate-900/40 px-4 py-3 text-left transition hover:bg-slate-900/70"
          >
            <CheckCircle2 className="h-4 w-4 text-slate-600" />
            <span className="flex-1 text-sm font-bold uppercase tracking-widest text-slate-600">
              Gecmis Etkinliklerim
            </span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-500">
              {past.length}
            </span>
            <span className={`text-slate-600 transition ${showPast ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {showPast && (
            <div className="grid gap-4 sm:grid-cols-2">
              {past.map((event) => <EventCard key={event.id} event={event} dimmed />)}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kulüp Yetkilisi: Katıldığım / Oluşturduklarım sekme görünümü
// ---------------------------------------------------------------------------

function AdminEventView({
  joinedEvents,
  createdEvents,
}: {
  joinedEvents: EventItem[];
  createdEvents: EventItem[];
}) {
  const [activeTab, setActiveTab] = useState<'joined' | 'created'>('joined');

  return (
    <div className="mt-8">
      <div className="mb-6 flex gap-1 rounded-2xl border border-slate-800/70 bg-slate-900/40 p-1">
        {(
          [
            { id: 'joined',  label: 'Katildigim',     count: joinedEvents.length },
            { id: 'created', label: 'Olusturduklarim', count: createdEvents.length },
          ] as const
        ).map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
              activeTab === id
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === id ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'joined' ? (
        joinedEvents.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {joinedEvents.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-slate-800 py-12 text-center">
            <Calendar className="mb-3 h-8 w-8 text-slate-700" />
            <p className="text-sm font-semibold text-slate-400">Henuz hicbir etkinlige katilmadiniz.</p>
          </div>
        )
      ) : (
        createdEvents.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {createdEvents.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-slate-800 py-12 text-center">
            <Calendar className="mb-3 h-8 w-8 text-slate-700" />
            <p className="text-sm font-semibold text-slate-400">Henuz bir etkinlik olusturmadiniz.</p>
            <Link
              href="/dashboard"
              className="mt-4 rounded-xl border border-slate-700 bg-slate-900 px-5 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
            >
              Dashboard&apos;a Git
            </Link>
          </div>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ana ProfileClient bileşeni
// ---------------------------------------------------------------------------

export function ProfileClient({
  userId,
  role,
  initialProfile,
  userEmail,
  userMeta,
  joinedEvents,
  createdEvents,
  campusEvents,
}: ProfileClientProps) {
  const [profile, setProfile] = useState<Partial<UserProfile>>(initialProfile ?? {});
  const [isEditing, setIsEditing] = useState(false);

  const isStudent    = role !== 'club_admin';
  const displayName  = profile.full_name?.trim() || userMeta?.full_name?.trim() || userEmail?.split('@')[0] || 'Kullanici';
  const initials     = getInitials(profile.full_name ?? userMeta?.full_name ?? null, userEmail);

  const editInitial: EditForm = {
    full_name:  profile.full_name ?? userMeta?.full_name ?? '',
    university: profile.university ?? '',
    department: profile.department ?? '',
    bio:        profile.bio ?? '',
    interests:  (profile.interests ?? []).join(', '),
  };

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Profil kartı                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6 sm:p-8">
        {/* Düzenle butonu */}
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="absolute right-5 top-5 flex items-center gap-1.5 rounded-xl border border-slate-700/60 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white sm:right-7 sm:top-7"
        >
          <Pencil className="h-3 w-3" />
          Duzenle
        </button>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          {/* Avatar */}
          <div className="shrink-0">
            <div className={`flex h-20 w-20 items-center justify-center rounded-full text-2xl font-black text-white shadow-lg sm:h-24 sm:w-24 sm:text-3xl ${
              isStudent
                ? 'bg-gradient-to-br from-indigo-500 to-blue-600'
                : 'bg-gradient-to-br from-amber-500 to-orange-600'
            }`}>
              {initials}
            </div>
            {/* Rol rozeti */}
            <div className={`mt-2 rounded-full px-2.5 py-1 text-center text-[10px] font-bold uppercase tracking-widest ${
              isStudent
                ? 'border border-indigo-400/25 bg-indigo-500/10 text-indigo-300'
                : 'border border-amber-400/25 bg-amber-500/10 text-amber-300'
            }`}>
              {isStudent ? 'Ogrenci' : 'Kulup Yetkilisi'}
            </div>
          </div>

          {/* Bilgiler */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
              {displayName}
            </h1>

            {(profile.university || profile.department) ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
                {profile.university && (
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                    {profile.university}
                  </span>
                )}
                {profile.university && profile.department && <span className="text-slate-700">•</span>}
                {profile.department && (
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                    {profile.department}
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm italic text-slate-600">
                Universite ve bolum bilgisi eklenmemis.
              </p>
            )}

            {userEmail && <p className="mt-1.5 text-xs text-slate-600">{userEmail}</p>}

            {profile.bio && (
              <p className="mt-4 max-w-prose text-sm leading-relaxed text-slate-300">
                {profile.bio}
              </p>
            )}

            {(profile.interests ?? []).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {(profile.interests ?? []).map((interest) => (
                  <span key={interest}
                    className="rounded-full border border-slate-700/60 bg-slate-800/60 px-3 py-1 text-xs font-medium text-slate-300">
                    {interest}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* İstatistik çubuğu */}
        <div className={`mt-6 grid gap-3 border-t border-slate-800/70 pt-5 ${isStudent ? 'grid-cols-2' : 'grid-cols-2'}`}>
          <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-3 text-center">
            <p className="text-xl font-black text-indigo-300">{joinedEvents.length}</p>
            <p className="mt-0.5 text-xs text-slate-500">Katilim</p>
          </div>
          {isStudent ? (
            // Ogrenci: gelecek etkinlik sayisi
            <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-3 text-center">
              <p className="text-xl font-black text-emerald-300">
                {joinedEvents.filter((e) => isUpcoming(e.date)).length}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Yaklasan</p>
            </div>
          ) : (
            // Kulup yetkilisi: olusturdugu etkinlikler
            <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-3 text-center">
              <p className="text-xl font-black text-amber-300">{createdEvents.length}</p>
              <p className="mt-0.5 text-xs text-slate-500">Olusturulan</p>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Etkinlik bölümü — role göre farklı görünüm                         */}
      {/* ------------------------------------------------------------------ */}
      {isStudent ? (
        <StudentEventView joinedEvents={joinedEvents} campusEvents={campusEvents} />
      ) : (
        <AdminEventView joinedEvents={joinedEvents} createdEvents={createdEvents} />
      )}

      {/* Edit Modal */}
      {isEditing && (
        <EditModal
          initial={editInitial}
          userId={userId}
          onClose={() => setIsEditing(false)}
          onSaved={(updated) => setProfile((prev) => ({ ...prev, ...updated }))}
        />
      )}
    </>
  );
}
