/**
 * Sunucu tarafı güvenlik guard'ları.
 *
 * RLS veritabanı katmanında zaten zorlandığı için bu fonksiyonlar
 * "defence in depth" — kötü istek veritabanına hiç ulaşmadan erken reddedilir.
 *
 * Server Actions veya Route Handler'larda kullan:
 *
 *   const user = await requireAuth(supabase);
 *   await requireEventExists(supabase, eventId);
 *   await requireNotAlreadyJoined(supabase, eventId, user.id);
 */

import type { SupabaseClient, User } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Hata tipi
// ---------------------------------------------------------------------------

export type GuardErrorCode =
  | 'UNAUTHENTICATED'   // Oturum yok
  | 'FORBIDDEN'         // Yetki yok (baska kullanicinin kaynagi vs.)
  | 'NOT_FOUND'         // Kaynak bulunamadi
  | 'CONFLICT'          // Zaten var (duplicate)
  | 'INVALID_INPUT';    // Yanlis format / eksik alan

export class GuardError extends Error {
  readonly code: GuardErrorCode;

  constructor(message: string, code: GuardErrorCode) {
    super(message);
    this.name = 'GuardError';
    this.code = code;
  }

  /** HTTP status code'a donustur (API route'larda kullanmak icin) */
  toHttpStatus(): number {
    const map: Record<GuardErrorCode, number> = {
      UNAUTHENTICATED: 401,
      FORBIDDEN:       403,
      NOT_FOUND:       404,
      CONFLICT:        409,
      INVALID_INPUT:   422,
    };
    return map[this.code];
  }
}

// ---------------------------------------------------------------------------
// Kimlik dogrulama
// ---------------------------------------------------------------------------

/**
 * Gecerli bir oturum var mi? Yoksa GuardError firlatir.
 * Boyle bir kullanici nesnesi dondurur ki sonraki guard'lara gecilebilsin.
 */
export async function requireAuth(supabase: SupabaseClient): Promise<User> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new GuardError(
      'Bu islemi gerceklestirmek icin giris yapman gerekiyor.',
      'UNAUTHENTICATED',
    );
  }

  return user;
}

// ---------------------------------------------------------------------------
// events tablosu
// ---------------------------------------------------------------------------

/**
 * Verilen ID'ye sahip etkinlik var mi? Yoksa GuardError firlatir.
 */
export async function requireEventExists(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{ id: string | number }> {
  const { data, error } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .single();

  if (error || !data) {
    throw new GuardError('Etkinlik bulunamadi.', 'NOT_FOUND');
  }

  return data as { id: string | number };
}

// ---------------------------------------------------------------------------
// participations tablosu
// ---------------------------------------------------------------------------

/**
 * Kullanici bu etkinlige zaten katilmis mi?
 * Katilmamissa GuardError firlatir (join-once enforcement).
 */
export async function requireNotAlreadyJoined(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<void> {
  const { data } = await supabase
    .from('participations')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  if (data) {
    throw new GuardError(
      'Bu etkinlige zaten katilmissin.',
      'CONFLICT',
    );
  }
}

/**
 * Kullanici bu katilim kaydinin sahibi mi?
 * Degilse GuardError firlatir (baska kullanicinin kaydini silmeyi engeller).
 */
export async function requireParticipationOwner(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<void> {
  const { data } = await supabase
    .from('participations')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) {
    throw new GuardError(
      'Bu etkinlikten ayrilmak icin once katilmis olmalisin.',
      'FORBIDDEN',
    );
  }
}

// ---------------------------------------------------------------------------
// Supabase hata kodlarini insan diline cevir
// ---------------------------------------------------------------------------

/**
 * PostgREST / PostgreSQL hata kodlarini kullaniciya gosterilecek
 * Turkce mesajlara donusturur.
 *
 * RLS ihlalleri (42501), unique constraint (23505), FK hatasi (23503) vb.
 */
export function humanizeDbError(error: {
  code?: string;
  message?: string;
}): string {
  const { code, message } = error;

  // RLS ihlali — kullanicinin yetkisi yok
  if (code === '42501' || message?.includes('row-level security')) {
    return 'Bu islemi gerceklestirme iznin yok.';
  }

  // Unique constraint — zaten var
  if (code === '23505') {
    return 'Bu kayit zaten mevcut.';
  }

  // Foreign key constraint — baglantili kayit yok
  if (code === '23503') {
    return 'Gecersiz etkinlik veya kullanici referansi.';
  }

  // Check constraint ihlali
  if (code === '23514') {
    return 'Gecersiz deger gonderildi.';
  }

  // Tablo bulunamadi (migration eksik)
  if (
    code === '42P01' ||
    code === 'PGRST205' ||
    message?.includes("Could not find the table")
  ) {
    return 'Sistem yapilandirmasi eksik. Lutfen yoneticiye bildirin.';
  }

  // JWT suresi dolmus / gecersiz token
  if (code === 'PGRST301' || message?.includes('JWT')) {
    return 'Oturumun suresi dolmus. Lutfen tekrar giris yap.';
  }

  return message ?? 'Beklenmeyen bir hata olustu.';
}
