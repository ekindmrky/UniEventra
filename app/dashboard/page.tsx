import Link from 'next/link';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { resolveDisplayName, resolveUserRole } from '@/lib/auth';
import type { EventItem } from '@/lib/types';
import { NavbarAuthControls } from '@/app/navbar-auth-controls';
import { DashboardClient } from './dashboard-client';

export default async function DashboardPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const role = resolveUserRole(user);

  // Sadece kulup yetkilileri erisebilir
  if (role !== 'club_admin') redirect('/');

  // Kullanicinin kulup adini cek
  const { data: profile } = await supabase
    .from('profiles')
    .select('club_name')
    .eq('id', user.id)
    .single();

  const clubName = profile?.club_name ?? (user.user_metadata?.club_name as string | undefined) ?? null;

  // Bu kullanicinin olusturduğu etkinlikleri cek
  const { data: events } = await supabase
    .from('events')
    .select('id, title, date, time, location, category, organizer_club')
    .eq('created_by', user.id)
    .order('date', { ascending: true });

  // Katilimci sayilarini paralel cek
  const eventList = (events ?? []) as EventItem[];

  const participantCounts: Record<string, number> = {};
  if (eventList.length > 0) {
    await Promise.all(
      eventList.map(async (ev) => {
        const { count } = await supabase
          .from('participations')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', String(ev.id));
        participantCounts[String(ev.id)] = count ?? 0;
      }),
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/60 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="text-xl font-black text-indigo-400 sm:text-2xl">
            UniEventra
          </Link>
          <NavbarAuthControls
            isLoggedIn
            displayName={resolveDisplayName(user)}
            role={role}
          />
        </div>
      </nav>

      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <DashboardClient
          userId={user.id}
          clubName={clubName}
          initialEvents={eventList}
          participantCounts={participantCounts}
        />
      </div>
    </main>
  );
}
