import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { Building2, CalendarDays, MapPin } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { resolveDisplayName, resolveUserRole } from '@/lib/auth';
import { fromClubSlug } from '@/lib/club-slug';
import { dateParts, formatEventDate, isUpcomingDate } from '@/lib/event-date';
import type { EventItem, UserProfile } from '@/lib/types';
import { AppShell } from '@/app/components/app-shell';

type ClubPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ClubPage({ params }: ClubPageProps) {
  noStore();

  const { slug } = await params;
  const clubName = fromClubSlug(slug);
  if (!clubName) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: admins }, eventsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, role, university, department, bio, interests, club_name')
      .eq('club_name', clubName)
      .eq('role', 'club_admin')
      .limit(5),
    supabase
      .from('events')
      .select('id, title, date, time, location, category, organizer_club, capacity')
      .eq('organizer_club', clubName)
      .order('date', { ascending: true }),
  ]);

  let eventList = (eventsResult.data ?? []) as EventItem[];
  if (eventsResult.error?.message?.includes('capacity')) {
    const { data: fallback } = await supabase
      .from('events')
      .select('id, title, date, time, location, category, organizer_club')
      .eq('organizer_club', clubName)
      .order('date', { ascending: true });
    eventList = (fallback ?? []) as EventItem[];
  }

  if ((!admins || admins.length === 0) && eventList.length === 0) {
    notFound();
  }

  const admin = (admins?.[0] ?? null) as UserProfile | null;
  const upcoming = eventList.filter((e) => isUpcomingDate(e.date));
  const past = eventList.filter((e) => !isUpcomingDate(e.date));

  return (
    <AppShell
      isLoggedIn={Boolean(user)}
      displayName={resolveDisplayName(user)}
      role={resolveUserRole(user)}
      userId={user?.id ?? null}
      maxWidthClassName="max-w-4xl"
    >
      <div className="mb-5">
        <Link
          href="/"
          className="inline-flex rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 sm:text-sm"
        >
          ← Etkinliklere dön
        </Link>
      </div>

      <header className="rounded-3xl border border-slate-800/70 bg-slate-900/55 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/15">
            <Building2 className="h-7 w-7 text-indigo-300" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-400/80">
              Kulüp
            </p>
            <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">{clubName}</h1>
            {admin?.university ? (
              <p className="mt-1 text-sm text-slate-400">{admin.university}</p>
            ) : null}
            {admin?.bio ? (
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{admin.bio}</p>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Bu kulübün etkinliklerini keşfet ve katıl.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
              <span>
                <span className="font-semibold text-slate-300">{upcoming.length}</span> yaklaşan
              </span>
              <span>
                <span className="font-semibold text-slate-300">{eventList.length}</span> toplam etkinlik
              </span>
              {admin?.full_name ? (
                <span>
                  Temsilci: <span className="text-slate-300">{admin.full_name}</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-white">Yaklaşan etkinlikler</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
            Yaklaşan etkinlik yok.
          </p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((event) => (
              <ClubEventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold text-slate-400">Geçmiş etkinlikler</h2>
          <div className="space-y-3 opacity-80">
            {past.map((event) => (
              <ClubEventRow key={event.id} event={event} />
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}

function ClubEventRow({ event }: { event: EventItem }) {
  const parts = dateParts(event.date);
  return (
    <Link
      href={`/events/${event.id}`}
      className="flex gap-3.5 rounded-2xl border border-slate-800/70 bg-slate-900/50 p-4 transition hover:border-indigo-500/40"
    >
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-500/15 px-1 py-2 text-center text-indigo-200">
        <span className="text-[10px] font-semibold uppercase opacity-80">{parts.month}</span>
        <span className="text-xl font-black leading-none">{parts.day}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{event.title}</p>
        <div className="mt-1.5 space-y-1 text-xs text-slate-500">
          <p className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="text-slate-400">{formatEventDate(event.date, event.time)}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate text-slate-300">{event.location}</span>
          </p>
        </div>
      </div>
      <span className="self-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {event.category}
      </span>
    </Link>
  );
}
