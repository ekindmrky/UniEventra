import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NavbarAuthControls } from '@/app/navbar-auth-controls';
import { ParticipationPanel } from './participation-panel';

type EventDetail = {
  id: string | number;
  title: string;
  date: string;
  location: string;
  category: string;
  description: string | null;
};

type ParticipationRow = {
  user_id: string;
  profiles: {
    full_name?: string;
    email?: string;
  } | null;
};

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date);
}

function isParticipationsTableMissingError(error: { code?: string; message?: string }) {
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.message?.includes("Could not find the table 'public.participations'") === true
  );
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const cookieStore = await cookies();
  const { id } = await params;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server Component tarafinda cookie yazimi desteklenmedigi icin no-op.
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: event, error } = await supabase
    .from('events')
    .select('id, title, date, location, category, description')
    .eq('id', id)
    .single<EventDetail>();

  if (error || !event) {
    notFound();
  }

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.first_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'Kullanici';
  let initiallyJoined = false;
  let participationsTableMissing = false;
  let participantNames: string[] = [];

  const { data: participations, error: participationsError } = await supabase
    .from('participations')
    .select('user_id, profiles(full_name, email)')
    .eq('event_id', event.id);

  if (participationsError) {
    console.error('Katilim listeleme hatasi:', participationsError);
    participationsTableMissing = isParticipationsTableMissingError(participationsError);
  } else {
    const rows = (participations ?? []) as ParticipationRow[];
    participantNames = rows.map((row) => {
      const profile = row.profiles;
      return profile?.full_name?.trim() || profile?.email?.trim() || 'Anonim';
    });
  }

  if (user) {
    const { data: participation, error: participationError } = await supabase
      .from('participations')
      .select('id')
      .eq('event_id', event.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (participationError) {
      console.error('Katilim durum kontrolu hatasi:', participationError);
      participationsTableMissing = isParticipationsTableMissingError(participationError);
    } else {
      initiallyJoined = Boolean(participation);
    }

    const currentUserDisplayName =
      (user.user_metadata?.full_name as string | undefined) || user.email || 'Anonim';

    if (initiallyJoined && currentUserDisplayName) {
      const normalized = currentUserDisplayName.trim();
      if (normalized && !participantNames.includes(normalized)) {
        participantNames = [...participantNames, normalized];
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/60 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-black text-indigo-400">
            UniEventra
          </Link>
          <NavbarAuthControls isLoggedIn={Boolean(user)} displayName={displayName} />
        </div>
      </nav>

      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="mb-8 flex items-center">
          <Link
            href="/"
            className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Geri Don
          </Link>
        </div>

        <article className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-7 shadow-2xl shadow-black/30 md:p-9">
          <div className="inline-flex rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-200">
            {event.category}
          </div>

          <h1 className="mt-5 text-3xl font-bold tracking-tight text-white md:text-4xl">
            {event.title}
          </h1>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Tarih</p>
              <p className="mt-2 text-sm font-medium text-slate-100">
                {formatEventDate(event.date)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Konum</p>
              <p className="mt-2 text-sm font-medium text-slate-100">{event.location}</p>
            </div>
          </div>

          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Etkinlik Aciklamasi
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-200">
              {event.description?.trim() || 'Bu etkinlik icin henuz aciklama eklenmemis.'}
            </p>
          </section>
        </article>

        <ParticipationPanel
          eventId={String(event.id)}
          currentUserId={user?.id ?? null}
          currentUserName={
            (user?.user_metadata?.full_name as string | undefined) ||
            user?.email ||
            'Anonim'
          }
          initiallyJoined={initiallyJoined}
          participantsTableMissing={participationsTableMissing}
          initialParticipantNames={participantNames}
        />
      </div>
    </main>
  );
}