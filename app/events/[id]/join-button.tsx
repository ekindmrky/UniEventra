'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock3, Loader2, LogOut, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import type { ParticipationStatus } from '@/lib/types';

type JoinButtonProps = {
  eventId: string;
  initialStatus: ParticipationStatus | null;
  participantsTableMissing: boolean;
  isFull: boolean;
  onJoined?: (status: ParticipationStatus) => void;
  onLeft?: () => void;
  size?: 'md' | 'lg';
};

export function JoinButton({
  eventId,
  initialStatus,
  participantsTableMissing,
  isFull,
  onJoined,
  onLeft,
  size = 'md',
}: JoinButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ParticipationStatus | null>(initialStatus);
  const [isLoading, setIsLoading] = useState(false);

  async function handleToggle() {
    if (isLoading || participantsTableMissing) {
      if (participantsTableMissing) {
        toast.error('Katılım sistemi şu an aktif değil.');
      }
      return;
    }

    setIsLoading(true);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        toast.error('Katılmak için giriş yapman gerekiyor.');
        router.push('/login');
        return;
      }

      if (status) {
        const { error } = await supabase.rpc('leave_event', {
          p_event_id: Number(eventId),
        });

        if (error) {
          // RPC yoksa eski yönteme düş
          if (error.message?.includes('Could not find the function') || error.code === 'PGRST202') {
            const { error: delError } = await supabase
              .from('participations')
              .delete()
              .eq('event_id', eventId)
              .eq('user_id', session.user.id);
            if (delError) {
              toast.error(delError.message);
              return;
            }
          } else {
            toast.error(error.message);
            return;
          }
        }

        setStatus(null);
        onLeft?.();
        toast.success('Etkinlikten ayrıldın.');
        return;
      }

      const { data, error } = await supabase.rpc('join_event', {
        p_event_id: Number(eventId),
      });

      if (error) {
        if (error.message?.includes('Could not find the function') || error.code === 'PGRST202') {
          const fallbackStatus: ParticipationStatus = isFull ? 'waitlisted' : 'confirmed';
          const { error: insError } = await supabase.from('participations').insert({
            event_id: eventId,
            user_id: session.user.id,
            status: fallbackStatus,
          });
          if (insError) {
            toast.error(insError.message);
            return;
          }
          setStatus(fallbackStatus);
          onJoined?.(fallbackStatus);
          toast.success(
            fallbackStatus === 'confirmed'
              ? 'Etkinliğe başarıyla katıldın!'
              : 'Bekleme listesine eklendin.',
          );
          return;
        }

        if (error.message?.includes('already_joined') || error.code === '23505') {
          setStatus('confirmed');
          onJoined?.('confirmed');
          toast.success('Zaten bu etkinliğe kayıtlısın!');
          return;
        }

        toast.error(error.message);
        return;
      }

      const nextStatus = (data as { status?: ParticipationStatus } | null)?.status ?? 'confirmed';
      setStatus(nextStatus);
      onJoined?.(nextStatus);
      toast.success(
        nextStatus === 'confirmed'
          ? 'Etkinliğe başarıyla katıldın!'
          : 'Kontenjan doldu — bekleme listesine eklendin.',
      );
    } catch (err) {
      console.error(err);
      toast.error('Beklenmeyen bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  }

  const large = size === 'lg';
  const joined = status === 'confirmed';
  const waitlisted = status === 'waitlisted';

  const buttonClass = joined
    ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
    : waitlisted
      ? 'border-amber-400/40 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
      : isFull
        ? 'border-amber-500/40 bg-amber-500 text-slate-950 hover:bg-amber-400 border-transparent'
        : 'border-transparent bg-indigo-600 text-white hover:bg-indigo-500';

  return (
    <div className={`flex items-center gap-2 ${large ? 'w-full' : 'shrink-0'}`}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading || participantsTableMissing}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border font-bold transition disabled:cursor-not-allowed disabled:opacity-70 ${buttonClass} ${
          large ? 'w-full px-5 py-3 text-sm' : 'px-4 py-2 text-sm font-semibold'
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            İşleniyor...
          </>
        ) : joined ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Katıldın
          </>
        ) : waitlisted ? (
          <>
            <Clock3 className="h-4 w-4" />
            Bekleme listesinde
          </>
        ) : isFull ? (
          <>
            <Clock3 className="h-4 w-4" />
            Bekleme listesine gir
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4" />
            Katıl
          </>
        )}
      </button>

      {status ? (
        <button
          type="button"
          onClick={handleToggle}
          disabled={isLoading || participantsTableMissing}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700/60 bg-slate-800/60 font-semibold text-slate-400 transition hover:border-slate-600 hover:bg-slate-700 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-70 ${
            large ? 'px-4 py-3 text-sm' : 'px-3 py-2 text-xs'
          }`}
        >
          <LogOut className="h-3.5 w-3.5" />
          Ayrıl
        </button>
      ) : null}
    </div>
  );
}
