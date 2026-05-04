import Link from 'next/link';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { resolveDisplayName, resolveUserRole } from '@/lib/auth';
import type { EventItem, UserProfile } from '@/lib/types';
import { NavbarAuthControls } from '@/app/navbar-auth-controls';
import { ProfileClient } from './profile-client';

export default async function ProfilePage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const userId = user.id;
  const role = resolveUserRole(user);

  const today = new Date().toISOString().slice(0, 10);

  // Katilimlar: once tam sorgu dene, hata alirsa minimal fallback
  async function fetchJoinedRows() {
    // Tam sorgu (organizer_club mevcut ise)
    const { data, error } = await supabase
      .from('participations')
      .select('events(id, title, date, time, location, category, organizer_club)')
      .eq('user_id', userId);
    if (!error && data) return data;

    // Fallback: organizer_club olmadan
    const { data: fallback } = await supabase
      .from('participations')
      .select('events(id, title, date, time, location, category)')
      .eq('user_id', userId);
    return fallback ?? [];
  }

  // Campus etkinlikleri: organizer_club varsa ekle, yoksa minimal
  async function fetchCampusEvents() {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, date, time, location, category, organizer_club')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(120);
    if (!error && data) return data as EventItem[];

    const { data: fallback } = await supabase
      .from('events')
      .select('id, title, date, time, location, category')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(120);
    return (fallback ?? []) as EventItem[];
  }

  // Tum sorgulari paralel calistir
  const [{ data: profile }, joinedRows, createdResult, campusEventsData] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, role, university, department, bio, interests')
      .eq('id', userId)
      .single<UserProfile>(),

    fetchJoinedRows(),

    role === 'club_admin'
      ? supabase
          .from('events')
          .select('id, title, date, time, location, category, organizer_club')
          .eq('created_by', userId)
          .order('date', { ascending: true })
      : Promise.resolve({ data: [] }),

    fetchCampusEvents(),
  ]);

  const joinedEvents: EventItem[] = (joinedRows ?? []).flatMap((row) => {
    const e = (row as unknown as { events: EventItem | EventItem[] | null }).events;
    if (!e) return [];
    return Array.isArray(e) ? e : [e];
  });

  const createdEvents: EventItem[] =
    'data' in createdResult ? ((createdResult.data ?? []) as EventItem[]) : [];

  const campusEvents: EventItem[] = campusEventsData;

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

      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <ProfileClient
          userId={user.id}
          role={role}
          initialProfile={profile}
          userEmail={user.email ?? null}
          userMeta={user.user_metadata as Record<string, string> | null}
          joinedEvents={joinedEvents}
          createdEvents={createdEvents}
          campusEvents={campusEvents}
        />
      </div>
    </main>
  );
}
