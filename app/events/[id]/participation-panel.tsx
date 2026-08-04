'use client';

import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Flame, Clock3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { initialsForParticipant, mapParticipationRows } from '@/lib/participant-display';
import type { ParticipantItem, ParticipationRow, ParticipationStatus } from '@/lib/types';
import { AddToCalendarButton } from '@/app/components/add-to-calendar-button';
import { JoinButton } from './join-button';

type ParticipationPanelProps = {
  eventId: string;
  currentUserId: string | null;
  currentUserName: string | null;
  initialStatus: ParticipationStatus | null;
  participantsTableMissing: boolean;
  initialParticipants: ParticipantItem[];
  initialConfirmedCount: number;
  initialWaitlistCount: number;
  capacity: number | null;
  calendarEvent?: {
    title: string;
    date: string;
    time?: string | null;
    location: string;
    description?: string | null;
  };
};

async function fetchParticipants(
  eventId: string,
): Promise<{ rows: ParticipantItem[]; confirmed: number; waitlisted: number } | null> {
  const { data, error } = await supabase
    .from('participations')
    .select('user_id, status, profiles(*)')
    .eq('event_id', eventId);

  if (error) {
    if (error.message?.includes('avatar_url')) {
      const { data: fb, error: fe } = await supabase
        .from('participations')
        .select('user_id, status, profiles(full_name, email, role)')
        .eq('event_id', eventId);
      if (fe) return null;
      const rows = mapParticipationRows((fb ?? []) as ParticipationRow[]);
      return {
        rows,
        confirmed: rows.filter((r) => r.status !== 'waitlisted').length,
        waitlisted: rows.filter((r) => r.status === 'waitlisted').length,
      };
    }
    return null;
  }

  const rows = mapParticipationRows((data ?? []) as ParticipationRow[]);
  return {
    rows,
    confirmed: rows.filter((r) => r.status === 'confirmed' || !r.status).length,
    waitlisted: rows.filter((r) => r.status === 'waitlisted').length,
  };
}

export function ParticipationPanel({
  eventId,
  currentUserId,
  currentUserName,
  initialStatus,
  participantsTableMissing,
  initialParticipants,
  initialConfirmedCount,
  initialWaitlistCount,
  capacity,
  calendarEvent,
}: ParticipationPanelProps) {
  const [participants, setParticipants] = useState<ParticipantItem[]>(initialParticipants);
  const [confirmedCount, setConfirmedCount] = useState(initialConfirmedCount);
  const [waitlistCount, setWaitlistCount] = useState(initialWaitlistCount);
  const [myStatus, setMyStatus] = useState<ParticipationStatus | null>(initialStatus);

  const normalizedCurrentUserName = useMemo(
    () => currentUserName?.trim() ?? '',
    [currentUserName],
  );

  const isFull = capacity != null && confirmedCount >= capacity;

  const applyFetch = useCallback(async () => {
    const result = await fetchParticipants(eventId);
    if (!result) return;
    setParticipants(result.rows);
    setConfirmedCount(result.confirmed);
    setWaitlistCount(result.waitlisted);
    if (currentUserId) {
      const mine = result.rows.find((p) => p.userId === currentUserId);
      setMyStatus(mine?.status === 'waitlisted' ? 'waitlisted' : mine ? 'confirmed' : null);
    }
  }, [eventId, currentUserId]);

  useEffect(() => {
    startTransition(() => void applyFetch());
  }, [applyFetch]);

  useEffect(() => {
    const channel = supabase.channel(`participations-event-${eventId}`);
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'participations', filter: `event_id=eq.${eventId}` },
      () => startTransition(() => void applyFetch()),
    );
    channel.subscribe();
    return () => void supabase.removeChannel(channel);
  }, [eventId, applyFetch]);

  function handleJoined(status: ParticipationStatus) {
    setMyStatus(status);
    if (!currentUserId || !normalizedCurrentUserName) {
      void applyFetch();
      return;
    }
    setParticipants((prev) => {
      if (prev.some((p) => p.userId === currentUserId)) {
        return prev.map((p) => (p.userId === currentUserId ? { ...p, status } : p));
      }
      return [
        ...prev,
        { userId: currentUserId, name: normalizedCurrentUserName, avatarUrl: null, status },
      ];
    });
    if (status === 'confirmed') setConfirmedCount((c) => c + 1);
    else setWaitlistCount((c) => c + 1);
  }

  function handleLeft() {
    setMyStatus(null);
    void applyFetch();
  }

  const confirmed = participants.filter((p) => p.status !== 'waitlisted');
  const waitlisted = participants.filter((p) => p.status === 'waitlisted');

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 shrink-0 text-orange-400" />
            <span className="font-semibold tabular-nums text-slate-100">{confirmedCount}</span>
            <span className="text-slate-400">
              {capacity != null ? `/ ${capacity} kontenjan` : 'kişi katılıyor'}
            </span>
            {isFull ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                Dolu
              </span>
            ) : null}
          </div>
          {waitlistCount > 0 ? (
            <div className="flex items-center gap-1.5 text-amber-300/90">
              <Clock3 className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{waitlistCount} beklemede</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div className="flex-1">
            <JoinButton
              eventId={eventId}
              initialStatus={myStatus}
              participantsTableMissing={participantsTableMissing}
              isFull={isFull}
              onJoined={handleJoined}
              onLeft={handleLeft}
              size="lg"
            />
          </div>
          {calendarEvent ? <AddToCalendarButton {...calendarEvent} /> : null}
        </div>
      </div>

      <section className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          Katılanlar
        </p>
        <div className="flex flex-wrap gap-2">
          {confirmed.length === 0 ? (
            <p className="text-sm text-slate-500">Henüz katılımcı yok.</p>
          ) : (
            confirmed.map((participant) => (
              <ParticipantChip key={participant.userId} participant={participant} />
            ))
          )}
        </div>

        {waitlisted.length > 0 ? (
          <>
            <p className="mb-3 mt-5 text-[11px] font-semibold uppercase tracking-widest text-amber-500/80">
              Bekleme listesi
            </p>
            <div className="flex flex-wrap gap-2">
              {waitlisted.map((participant) => (
                <ParticipantChip key={participant.userId} participant={participant} waitlisted />
              ))}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

function ParticipantChip({
  participant,
  waitlisted = false,
}: {
  participant: ParticipantItem;
  waitlisted?: boolean;
}) {
  return (
    <div
      className={`inline-flex max-w-[180px] items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-medium sm:max-w-[220px] ${
        waitlisted
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
          : 'border-slate-700/60 bg-slate-800/70 text-slate-200'
      }`}
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
  );
}
