import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { resolveDisplayName, resolveUserRole } from '@/lib/auth';
import type { EventItem } from '@/lib/types';
import { NavbarAuthControls } from './navbar-auth-controls';
import { EventsClient } from './events-client';
import { IncompleteProfileBanner } from './incomplete-profile-banner';

export default async function HomePage() {
  noStore();

  const supabase = await createSupabaseServerClient();

  // Kullanici ve etkinlikleri paralel cek
  const [{ data: { user } }, { data: events, error }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('events')
      .select('id, title, date, time, location, category, organizer_club')
      .order('date', { ascending: true }),
  ]);

  // Profil eksiklik kontrolu: sadece giris yapmis kullanicilar icin
  let profileIncomplete = false;
  if (user) {
    const { data: p } = await supabase
      .from('profiles')
      .select('university, department')
      .eq('id', user.id)
      .single();
    profileIncomplete = !p?.university || !p?.department;
  }

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

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
        <header className="mb-8 text-center sm:mb-12">
          <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
            UniEventra
          </h1>
          <p className="text-sm text-slate-400 sm:text-base">
            Kampus etkinliklerini kesfet, katil, baglan.
          </p>
        </header>

        {/* Eksik profil uyarisi — giris yapmis ve profili eksik kullanicilar icin */}
        <IncompleteProfileBanner show={Boolean(user) && profileIncomplete} />

        {error ? (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            Etkinlikler yuklenirken hata olustu: {error.message}
          </p>
        ) : (
          <EventsClient initialEvents={(events ?? []) as EventItem[]} />
        )}
      </div>
    </main>
  );
}
