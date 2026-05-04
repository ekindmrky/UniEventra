import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server Component ve Route Handler icin Supabase istemcisi olusturur.
 * Her cagri icin yeni bir ornek dondurmez; ayni istek boyunca cookie store
 * sabit oldugu icin guvenlidir.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
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
}
