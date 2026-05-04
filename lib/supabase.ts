import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY',
  );
}

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        // autoRefreshToken=true (varsayilan) oturum yokken de token yenilemesi
        // deneyebilir; bu deneme AuthSessionMissingError'a yol acar.
        // persistSession=true ile sadece gercek oturum varsa yenileme yapilir.
        persistSession: true,
        // detectSessionInUrl=true: OAuth callback URL'lerini yakalar
        detectSessionInUrl: true,
        // flowType: 'pkce' — server-side rendering ile uyumlu guveli akis
        flowType: 'pkce',
      },
    });

    // Oturum yokken otomatik token yenileme girisimleri AuthSessionMissingError
    // firlatir ve console'u kirletir. onAuthStateChange ile bu olaylari
    // sessizce yakaliyoruz; fonksiyonun govdesi kasitli olarak bos.
    browserClient.auth.onAuthStateChange(() => {
      // no-op: sadece unhandled rejection'lari engellemek icin abone olundu
    });
  }

  return browserClient;
}

export const supabase = getSupabaseBrowserClient();
