import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { resolveDisplayName, resolveUserRole } from '@/lib/auth';
import {
  isParticipationsTableMissingError,
  mapParticipationRows,
} from '@/lib/participant-display';
import type { EventDetail, ParticipantItem, ParticipationRow } from '@/lib/types';
import { NavbarAuthControls } from '@/app/navbar-auth-controls';
import { ParticipationPanel } from './participation-panel';

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatEventDate(date: string, time?: string | null): string {
  const combined = time ? `${date}T${time.slice(0, 5)}` : date;
  const d = new Date(combined);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'full',
    ...(time ? { timeStyle: 'short' as const } : {}),
  }).format(d);
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  noStore();

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // 3 bagimsiz sorguyu tek bir Promise.all ile paralel olarak calistir:
  //   - getUser   : auth cookie dogrulamasi
  //   - getEvent  : etkinlik detaylari
  //   - getParticipations : katilimci listesi + profiller + count
  // Bunlar birbirini beklemiyor; toplam sure = en yavash sorgunun suresi.
  const [
    { data: { user } },
    { data: event, error: eventError },
    { data: rawParticipations, count: rawCount, error: participationsError },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('events')
      .select('id, title, date, time, location, category, description, organizer_club')
      .eq('id', id)
      .single<EventDetail>(),
    // count: 'exact' ile hem satir sayisi hem de veri tek sorguda gelir.
    // Ayri bir "head: true" count sorgusu artik gerekmiyor.
    supabase
      .from('participations')
      .select('*, profiles(*)', { count: 'exact' })
      .eq('event_id', id),
  ]);

  if (eventError || !event) {
    notFound();
  }

  let participationsTableMissing = false;
  let participants: ParticipantItem[] = [];
  let participantCount = 0;

  if (participationsError) {
    console.error(
      'Katilim listesi hatasi:',
      participationsError.message,
      'details:',
      participationsError.details,
    );

    if (participationsError.message?.includes('avatar_url')) {
      // avatar_url kolonu henuz eklenmemisse profiles sutun listesi olmadan tekrar dene.
      // Bu dal sadece schema migration tamamlanmamissa tetiklenir.
      const { data: fallback, count: fallbackCount, error: fallbackError } = await supabase
        .from('participations')
        .select('*, profiles(full_name, email, role)', { count: 'exact' })
        .eq('event_id', id);

      if (fallbackError) {
        console.error('Fallback hatasi:', fallbackError.message);
        participationsTableMissing = isParticipationsTableMissingError(fallbackError);
      } else {
        participants = mapParticipationRows((fallback ?? []) as ParticipationRow[]);
        participantCount = Math.max(fallbackCount ?? 0, participants.length);
      }
    } else {
      participationsTableMissing = isParticipationsTableMissingError(participationsError);
    }
  } else {
    const rows = (rawParticipations ?? []) as ParticipationRow[];
    participants = mapParticipationRows(rows);
    participantCount = Math.max(rawCount ?? 0, participants.length);
  }

  // initiallyJoined: ayri bir DB sorgusu yerine zaten getirilen listeden O(n) ile hesapla.
  // user.id'nin katilimci listesinde olup olmadigini kontrol etmek yeterli.
  const userId = user?.id ?? null;
  const initiallyJoined = userId !== null
    ? (rawParticipations ?? []).some(
        (row) => (row as { user_id: string }).user_id === userId,
      )
    : false;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/60 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="text-xl font-black text-indigo-400 sm:text-2xl">
            UniEventra
          </Link>
          <NavbarAuthControls
            isLoggedIn={Boolean(user)}
            displayName={resolveDisplayName(user)}
            role={resolveUserRole(user)}
          />
        </div>
      </nav>

      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10 md:py-12">
        <div className="mb-5 flex items-center sm:mb-8">
          <Link
            href="/"
            className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 sm:px-4 sm:text-sm"
          >
            ← Geri Don
          </Link>
        </div>

        <article className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-5 sm:rounded-3xl sm:p-7 md:p-9">
          {/* Kategori rozeti + Yayınlayan */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-indigo-300 sm:px-4 sm:text-[11px]">
              {event.category}
            </div>
            {event.organizer_club && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/50 bg-slate-800/50 px-3 py-1 text-[11px] text-slate-300">
                <span className="text-sm leading-none">🏛</span>
                <span className="font-medium">{event.organizer_club}</span>
              </span>
            )}
          </div>

          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:mt-5 sm:text-3xl md:text-4xl">
            {event.title}
          </h1>

          {/* Tarih + Konum */}
          <div className="mt-5 grid gap-2.5 sm:mt-7 sm:grid-cols-2 sm:gap-3">
            <div className="flex items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-950/40 p-3.5 sm:p-4">
              <span className="mt-0.5 text-base leading-none">📅</span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Tarih</p>
                <p className="mt-1 text-sm font-medium text-slate-100">
                  {formatEventDate(event.date, event.time)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-950/40 p-3.5 sm:p-4">
              <span className="mt-0.5 text-base leading-none">📍</span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Konum</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{event.location}</p>
              </div>
            </div>
          </div>

          {/* Aciklama */}
          <div className="mt-5 sm:mt-6">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Aciklama
            </p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {event.description?.trim() || 'Bu etkinlik icin henuz aciklama eklenmemis.'}
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
          initiallyJoined={initiallyJoined}
          participantsTableMissing={participationsTableMissing}
          initialParticipants={participants}
          initialParticipantCount={participantCount}
        />
      </div>
    </main>
  );
}
