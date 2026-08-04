import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { resolveDisplayName, resolveUserRole } from '@/lib/auth';
import type { EventItem } from '@/lib/types';
import { AppShell } from '@/app/components/app-shell';
import { DashboardClient } from './dashboard-client';

export default async function DashboardPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const role = resolveUserRole(user);
  if (role !== 'club_admin') redirect('/');

  const { data: profile } = await supabase
    .from('profiles')
    .select('club_name')
    .eq('id', user.id)
    .single();

  const clubName = profile?.club_name ?? (user.user_metadata?.club_name as string | undefined) ?? null;

  const { data: events } = await supabase
    .from('events')
    .select('id, title, date, time, location, category, organizer_club')
    .eq('created_by', user.id)
    .order('date', { ascending: true });

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
    <AppShell
      isLoggedIn
      displayName={resolveDisplayName(user)}
      role={role}
      userId={user.id}
      maxWidthClassName="max-w-5xl"
    >
      <DashboardClient
        userId={user.id}
        clubName={clubName}
        initialEvents={eventList}
        participantCounts={participantCounts}
      />
    </AppShell>
  );
}
