'use client';

import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Flame } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { initialsForParticipant, mapParticipationRows } from '@/lib/participant-display';
import type { ParticipantItem, ParticipationRow } from '@/lib/types';
import { JoinButton } from './join-button';

type ParticipationPanelProps = {
  eventId: string;
  currentUserId: string | null;
  currentUserName: string | null;
  initiallyJoined: boolean;
  participantsTableMissing: boolean;
  initialParticipants: ParticipantItem[];
  initialParticipantCount: number;
};


async function fetchParticipants(
  eventId: string,
): Promise<{ rows: ParticipantItem[]; count: number } | null> {
  const { data, count, error } = await supabase
    .from('participations')
    .select('*, profiles(*)', { count: 'exact' })
    .eq('event_id', eventId);

  if (error) {
    // avatar_url kolonu henuz yoksa fallback sorgusunu dene
    if (error.message?.includes('avatar_url')) {
      const { data: fb, count: fc, error: fe } = await supabase
        .from('participations')
        .select('*, profiles(full_name, email, role)', { count: 'exact' })
        .eq('event_id', eventId);

      if (fe) {
        console.error('[ParticipationPanel] fallback fetch error:', fe.message);
        return null;
      }

      const rows = mapParticipationRows((fb ?? []) as ParticipationRow[]);
      return { rows, count: Math.max(fc ?? 0, rows.length) };
    }

    console.error('[ParticipationPanel] fetch error:', error.message, error.details);
    return null;
  }

  const rows = mapParticipationRows((data ?? []) as ParticipationRow[]);
  return { rows, count: Math.max(count ?? 0, rows.length) };
}

export function ParticipationPanel({
  eventId,
  currentUserId,
  currentUserName,
  initiallyJoined,
  participantsTableMissing,
  initialParticipants,
  initialParticipantCount,
}: ParticipationPanelProps) {
  const [participants, setParticipants] = useState<ParticipantItem[]>(initialParticipants);
  const [participantCount, setParticipantCount] = useState(initialParticipantCount);
  const normalizedCurrentUserName = useMemo(
    () => currentUserName?.trim() ?? '',
    [currentUserName],
  );

  const applyFetch = useCallback(async () => {
    const result = await fetchParticipants(eventId);
    if (!result) return;
    setParticipants(result.rows);
    setParticipantCount(result.count);
  }, [eventId]);

  // Mount: sunucu tarafinda render edilen initial data tazele
  useEffect(() => {
    startTransition(() => void applyFetch());
  }, [applyFetch]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel(`participations-event-${eventId}`);

    // INSERT: sunucu filtresi guvenilir cunku yeni satir event_id icerir
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'participations',
        filter: `event_id=eq.${eventId}`,
      },
      () => startTransition(() => void applyFetch()),
    );

    // DELETE: varsayilan REPLICA IDENTITY'de old.event_id gelmez, sunucu filtresi calismiyor.
    // Tum silme olaylarini dinle, istemci tarafinda ek bir sorgu atarak guncelle.
    // (Baska etkinliklerin silme olaylari fazladan 1 sorgu tetikler; kucuk olcekte kabul edilebilir.)
    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'participations' },
      () => startTransition(() => void applyFetch()),
    );

    channel.subscribe((status, err) => {
      if (err) console.error('[Realtime] Subscription error:', err);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[Realtime] Channel status:', status);
      }
    });

    return () => void supabase.removeChannel(channel);
  }, [eventId, applyFetch]);

  // Optimistik: kendi eylemi aninda yansit; Realtime async olarak teyit eder
  function handleJoined() {
    if (!currentUserId || !normalizedCurrentUserName) return;
    setParticipants((prev) => {
      if (prev.some((p) => p.userId === currentUserId)) return prev;
      return [...prev, { userId: currentUserId, name: normalizedCurrentUserName, avatarUrl: null }];
    });
    setParticipantCount((prev) => prev + 1);
  }

  function handleLeft() {
    if (!currentUserId) return;
    setParticipants((prev) => prev.filter((p) => p.userId !== currentUserId));
    setParticipantCount((prev) => Math.max(prev - 1, 0));
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Sayac + Katil butonu — her zaman yatay, hafif arka plan */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-800/70 bg-slate-900/50 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2 text-sm">
          <Flame className="h-4 w-4 shrink-0 text-orange-400" />
          <span className="font-semibold tabular-nums text-slate-100">{participantCount}</span>
          <span className="text-slate-400">kisi katiliyor</span>
        </div>

        <JoinButton
          eventId={eventId}
          initiallyJoined={initiallyJoined}
          participantsTableMissing={participantsTableMissing}
          onJoined={handleJoined}
          onLeft={handleLeft}
        />
      </div>

      {/* Katilimci listesi */}
      <section className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          Katilanlar
        </p>
        <div className="flex flex-wrap gap-2">
          {participants.length === 0 ? (
            <p className="text-sm text-slate-500">Henuz katilimci yok.</p>
          ) : (
            participants.map((participant) => (
              <div
                key={participant.userId}
                className="inline-flex max-w-[180px] items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/70 py-1 pl-1 pr-3 text-xs font-medium text-slate-200 sm:max-w-[220px]"
              >
                {participant.avatarUrl ? (
                  <Image
                    src={participant.avatarUrl}
                    alt={participant.name}
                    width={22}
                    height={22}
                    className="h-[22px] w-[22px] shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[9px] font-bold text-white">
                    {initialsForParticipant(participant.name, participant.userId)}
                  </div>
                )}
                <span className="truncate">{participant.name}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

