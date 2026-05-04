import type { User } from '@supabase/supabase-js';

export type UserRole = 'student' | 'club_admin' | null;

/**
 * Kullanicinin rolunu user_metadata'dan okur.
 * Metadata yoksa ya da tanimsizsa null dondurur.
 * Sunucu tarafinda ekstra DB sorgusu gerekmez.
 */
export function resolveUserRole(user: User | null | undefined): UserRole {
  const r = user?.user_metadata?.role as string | undefined;
  if (r === 'club_admin') return 'club_admin';
  if (r === 'student') return 'student';
  return null;
}

/**
 * Supabase User nesnesinden gorunen ad turetir.
 * Oncelik: full_name -> first_name -> email @ oncesi -> 'Kullanici'
 */
export function resolveDisplayName(user: User | null | undefined): string {
  return (
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    (user?.user_metadata?.first_name as string | undefined)?.trim() ||
    user?.email?.split('@')[0] ||
    'Kullanici'
  );
}

/**
 * Production/preview/local ortaminda dogru site URL'ini dondurur.
 * oncelik: NEXT_PUBLIC_SITE_URL env -> window.location.origin -> bos string
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}
