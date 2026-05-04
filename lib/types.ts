/**
 * Proje genelinde paylasilan domain tipleri.
 * Bu dosya dis bagimliligi olmayan, salt veri sekli tanimlarindan olusur.
 */

export type EventItem = {
  id: string | number;
  title: string;
  date: string;
  time?: string | null;            // HH:MM:SS — date kolonu sadece tarih icerebilir
  location: string;
  category: string;
  organizer_club?: string | null;  // Etkinligi olusturan kulubun adi
};

export type EventDetail = EventItem & {
  description: string | null;
  // time EventItem'dan inherited
};

export type ParticipantItem = {
  userId: string;
  name: string;
  avatarUrl: string | null;
};

export type ParticipationRow = {
  user_id: string;
  profiles: ProfileEmbed | ProfileEmbed[] | null;
};

export type ProfileEmbed = {
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  role?: string | null;
};

/** Kullanicinin tam profil satiri (profiles tablosu). */
export type UserProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
  university: string | null;
  department: string | null;
  bio: string | null;
  interests: string[] | null;
  club_name: string | null;
};
