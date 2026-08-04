import { unstable_noStore as noStore } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { resolveDisplayName, resolveUserRole } from '@/lib/auth';
import type { EventItem } from '@/lib/types';
import { AppShell } from './components/app-shell';
import { EventsClient } from './events-client';
import { IncompleteProfileBanner } from './incomplete-profile-banner';

export default async function HomePage() {
  noStore();

  const supabase = await createSupabaseServerClient();

  const [{ data: { user } }, { data: events, error }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('events')
      .select('id, title, date, time, location, category, organizer_club')
      .order('date', { ascending: true }),
  ]);

  let profileIncomplete = false;
  if (user) {
    const { data: p } = await supabase
      .from('profiles')
      .select('university, department')
      .eq('id', user.id)
      .single();
    profileIncomplete = !p?.university || !p?.department;
  }

  const role = resolveUserRole(user);

  return (
    <AppShell
      isLoggedIn={Boolean(user)}
      displayName={resolveDisplayName(user)}
      role={role}
      userId={user?.id ?? null}
    >
      <header className="mb-5 sm:mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-400/80">
          Kampüs etkinlikleri
        </p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl md:text-4xl">
          Ne oluyor, keşfet
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-400 sm:text-base">
          Kulüp etkinliklerini filtrele, katıl ve ajandana ekle.
        </p>
      </header>

      <IncompleteProfileBanner show={Boolean(user) && profileIncomplete} />

      {error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          Etkinlikler yüklenirken hata oluştu: {error.message}
        </p>
      ) : (
        <EventsClient
          initialEvents={(events ?? []) as EventItem[]}
          isClubAdmin={role === 'club_admin'}
        />
      )}
    </AppShell>
  );
}
