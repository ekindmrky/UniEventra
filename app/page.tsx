import Link from 'next/link';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { EventsClient } from './events-client';
import { NavbarAuthControls } from './navbar-auth-controls';

type EventItem = {
  id: string | number;
  title: string;
  date: string;
  location: string;
  category: string;
};

export default async function HomePage() {
  const cookieStore = await cookies();
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

  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, date, location, category')
    .order('date', { ascending: true });

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.first_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'Kullanici';

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

      <div className="mx-auto w-full max-w-6xl px-6 py-16">
        <header className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-white md:text-6xl">
            UniEventra - Kampus Etkinlikleri
          </h1>
          <p className="text-sm text-slate-400 md:text-base">
            Universite hayatini canlandir.
          </p>
        </header>

        {error ? (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            Etkinlikler yuklenirken hata olustu: {error.message}
          </p>
        ) : (
          <EventsClient events={(events ?? []) as EventItem[]} />
        )}
      </div>
    </main>
  );
}