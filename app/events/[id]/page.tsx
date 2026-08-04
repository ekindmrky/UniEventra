import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { Building2, MapPin, Users } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { resolveDisplayName, resolveUserRole } from '@/lib/auth';
import { formatEventDate } from '@/lib/event-date';
import { clubPath } from '@/lib/club-slug';
import {
  isParticipationsTableMissingError,
  mapParticipationRows,
} from '@/lib/participant-display';
import type {
  EventDetail,
  ParticipantItem,
  ParticipationRow,
  ParticipationStatus,
} from '@/lib/types';
import { AppShell } from '@/app/components/app-shell';
import { ParticipationPanel } from './participation-panel';

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  noStore();

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: { user } }, eventResult, participationsResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('events')
      .select('id, title, date, time, location, category, description, organizer_club, capacity')
      .eq('id', id)
      .single<EventDetail>(),
    supabase
      .from('participations')
      .select('user_id, status, profiles(*)')
      .eq('event_id', id),
  ]);

  let event = eventResult.data;
  let eventError = eventResult.error;

  // capacity kolonu henüz yoksa (migration öncesi) tekrar dene
  if (eventError?.message?.includes('capacity')) {
    const fallback = await supabase
      .from('events')
      .select('id, title, date, time, location, category, description, organizer_club')
      .eq('id', id)
      .single<EventDetail>();
    event = fallback.data;
    eventError = fallback.error;
  }

  const { data: rawParticipations, error: participationsError } = participationsResult;

  if (eventError || !event) {
    notFound();
  }

  let participationsTableMissing = false;
  let participants: ParticipantItem[] = [];

  if (participationsError) {
    if (participationsError.message?.includes('capacity') || participationsError.message?.includes('avatar_url')) {
      // capacity kolonu yoksa veya avatar yoksa yeniden dene
    }
    if (participationsError.message?.includes('avatar_url')) {
      const { data: fallback, error: fallbackError } = await supabase
        .from('participations')
        .select('user_id, status, profiles(full_name, email, role)')
        .eq('event_id', id);

      if (fallbackError) {
        participationsTableMissing = isParticipationsTableMissingError(fallbackError);
      } else {
        participants = mapParticipationRows((fallback ?? []) as ParticipationRow[]);
      }
    } else if (isParticipationsTableMissingError(participationsError)) {
      participationsTableMissing = true;
    }
  } else {
    participants = mapParticipationRows((rawParticipations ?? []) as ParticipationRow[]);
  }

  // capacity kolonu migration öncesi yoksa event select fail etmiş olabilir - handled by notFound above
  // If capacity missing from select, retry without it was better - let me add fallback for event fetch

  const confirmedCount = participants.filter((p) => p.status !== 'waitlisted').length;
  const waitlistCount = participants.filter((p) => p.status === 'waitlisted').length;
  const capacity = event.capacity ?? null;

  const userId = user?.id ?? null;
  let initialStatus: ParticipationStatus | null = null;
  if (userId) {
    const mine = participants.find((p) => p.userId === userId);
    if (mine) {
      initialStatus = mine.status === 'waitlisted' ? 'waitlisted' : 'confirmed';
    }
  }

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

      <article className="rounded-2xl border border-slate-800/70 bg-slate-900/55 p-5 sm:rounded-3xl sm:p-7 md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-indigo-300">
            {event.category}
          </div>
          {event.organizer_club ? (
            <Link
              href={clubPath(event.organizer_club)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/50 bg-slate-800/50 px-3 py-1 text-[11px] font-medium text-slate-300 transition hover:border-indigo-500/40 hover:text-indigo-200"
            >
              <Building2 className="h-3.5 w-3.5 text-slate-500" />
              {event.organizer_club}
            </Link>
          ) : null}
        </div>

        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:mt-5 sm:text-3xl md:text-4xl">
          {event.title}
        </h1>

        <div className="mt-5 grid gap-2 sm:mt-6 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Tarih</p>
            <p className="mt-1 text-sm font-medium text-slate-100">
              {formatEventDate(event.date, event.time, 'full')}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Konum</p>
            <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-slate-100">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
              {event.location}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Katılım</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-100">
              <Users className="h-3.5 w-3.5 text-slate-500" />
              {capacity != null ? `${confirmedCount} / ${capacity}` : `${confirmedCount} kişi`}
              {initialStatus === 'confirmed' ? (
                <span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  Katıldın
                </span>
              ) : initialStatus === 'waitlisted' ? (
                <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  Beklemede
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="mt-5 sm:mt-6">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Açıklama
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
            {event.description?.trim() || 'Bu etkinlik için henüz açıklama eklenmemiş.'}
          </p>
        </div>
      </article>

      <ParticipationPanel
        eventId={String(event.id)}
        currentUserId={user?.id ?? null}
        currentUserName={
          (user?.user_metadata?.full_name as string | undefined) ||
          user?.email ||
          null
        }
        initialStatus={initialStatus}
        participantsTableMissing={participationsTableMissing}
        initialParticipants={participants}
        initialConfirmedCount={confirmedCount}
        initialWaitlistCount={waitlistCount}
        capacity={capacity}
        calendarEvent={{
          title: event.title,
          date: event.date,
          time: event.time,
          location: event.location,
          description: event.description,
        }}
      />
    </AppShell>
  );
}
