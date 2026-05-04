import type { ParticipantItem, ParticipationRow, ProfileEmbed } from './types';

// ProfileShape tip alias'i (geri uyumluluk)
export type ProfileShape = ProfileEmbed | null;

export function normalizeProfileEmbed(
  profiles: ProfileEmbed | ProfileEmbed[] | null | undefined,
): ProfileShape {
  if (profiles == null) return null;
  if (Array.isArray(profiles)) return profiles[0] ?? null;
  return profiles;
}

/** DB'den: full_name -> email @ oncesi -> user_id kisa referans */
export function displayNameFromProfile(
  profile: ProfileShape,
  participationUserId: string,
): string {
  const full = profile?.full_name?.trim();
  if (full) return full;

  const email = profile?.email?.trim();
  if (email && email.includes('@')) {
    return email.split('@')[0] ?? email;
  }

  const compact = participationUserId.replace(/-/g, '');
  return compact.slice(0, 8);
}

/** Avatar dairesi icin bas harfler: "Ekin Demirkaya" -> "ED" */
export function initialsForParticipant(
  displayName: string,
  participationUserId: string,
): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const compact = participationUserId.replace(/-/g, '');
  return compact.slice(0, 2).toUpperCase();
}

/** participations tablosunun mevcut olmadigini gosteren PostgREST/PG hata kodlari */
export function isParticipationsTableMissingError(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.message?.includes("Could not find the table 'public.participations'") === true
  );
}

/** ParticipationRow dizisini ParticipantItem dizisine donusturur */
export function mapParticipationRows(rows: ParticipationRow[]): ParticipantItem[] {
  return rows.map((row) => {
    const profile = normalizeProfileEmbed(row.profiles);
    const name = displayNameFromProfile(profile, String(row.user_id));
    const avatarRaw = profile?.avatar_url;
    const avatarUrl =
      typeof avatarRaw === 'string' && avatarRaw.trim() ? avatarRaw.trim() : null;
    return { userId: String(row.user_id), name, avatarUrl };
  });
}
