/**
 * Proje genelinde paylaşılan domain tipleri.
 */

export type ParticipationStatus = 'confirmed' | 'waitlisted' | 'cancelled';

export type EventItem = {
  id: string | number;
  title: string;
  date: string;
  time?: string | null;
  location: string;
  category: string;
  organizer_club?: string | null;
  capacity?: number | null;
};

export type EventDetail = EventItem & {
  description: string | null;
};

export type ParticipantItem = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  status?: ParticipationStatus;
};

export type ParticipationRow = {
  user_id: string;
  status?: ParticipationStatus | null;
  profiles: ProfileEmbed | ProfileEmbed[] | null;
};

export type ProfileEmbed = {
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  role?: string | null;
};

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

export type AppNotification = {
  id: number | string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};
