'use client';

import { useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
import { JoinButton } from './join-button';

type ParticipationPanelProps = {
  eventId: string;
  currentUserId: string | null;
  currentUserName: string | null;
  initiallyJoined: boolean;
  participantsTableMissing: boolean;
  initialParticipantNames: string[];
};

function normalizeName(value: string) {
  return value.trim();
}

export function ParticipationPanel({
  eventId,
  currentUserId,
  currentUserName,
  initiallyJoined,
  participantsTableMissing,
  initialParticipantNames,
}: ParticipationPanelProps) {
  const [participantNames, setParticipantNames] = useState<string[]>(initialParticipantNames);

  const participantCount = participantNames.length;

  const fallbackCurrentUserName = useMemo(() => {
    if (currentUserName) return normalizeName(currentUserName);
    if (!currentUserId) return 'Anonim';
    return 'Anonim';
  }, [currentUserId, currentUserName]);

  function handleJoined() {
    if (!fallbackCurrentUserName) return;

    setParticipantNames((previous) => {
      if (previous.includes(fallbackCurrentUserName)) return previous;
      return [...previous, fallbackCurrentUserName];
    });
  }

  function handleLeft() {
    if (!fallbackCurrentUserName) return;

    setParticipantNames((previous) => {
      const index = previous.indexOf(fallbackCurrentUserName);
      if (index === -1) return previous;
      return [...previous.slice(0, index), ...previous.slice(index + 1)];
    });
  }

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/40 bg-orange-500/15 px-4 py-2 text-sm font-semibold text-orange-200">
          <Flame className="h-4 w-4" />
          🔥 {participantCount} Kisi Katiliyor
        </div>
        <JoinButton
          eventId={eventId}
          initiallyJoined={initiallyJoined}
          participantsTableMissing={participantsTableMissing}
          onJoined={handleJoined}
          onLeft={handleLeft}
        />
      </div>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Katilanlar
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {participantNames.length === 0 ? (
            <p className="text-sm text-slate-400">Henuz katilimci yok.</p>
          ) : (
            participantNames.map((name, index) => (
              <span
                key={`${name}-${index}`}
                className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200"
              >
                {name}
              </span>
            ))
          )}
        </div>
      </section>
    </>
  );
}
