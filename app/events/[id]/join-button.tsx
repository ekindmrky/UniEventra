'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, LogOut, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { isParticipationsTableMissingError } from '@/lib/participant-display';
import { humanizeDbError } from '@/lib/db-guards';

type JoinButtonProps = {
  eventId: string;
  initiallyJoined: boolean;
  participantsTableMissing: boolean;
  onJoined?: () => void;
  onLeft?: () => void;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function JoinButton({
  eventId,
  initiallyJoined,
  participantsTableMissing,
  onJoined,
  onLeft,
}: JoinButtonProps) {
  const router = useRouter();
  const [joined, setJoined] = useState(initiallyJoined);
  const [isLoading, setIsLoading] = useState(false);

  async function handleJoin() {
    if (isLoading || participantsTableMissing) {
      if (participantsTableMissing) {
        toast.error('Katilim sistemi su an aktif degil.');
      }
      return;
    }

    setIsLoading(true);

    try {
      // getSession() oturum yoksa hata FIRLATMAZ — sadece null doner.
      // getUser() ise oturum yoksa AuthSessionMissingError firlatir.
      // Client tarafinda her zaman getSession() ile basliyoruz.
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Oturum kontrolu hatasi:', sessionError.message);
        toast.error('Oturum dogrulanamadi. Lutfen tekrar giris yap.');
        return;
      }

      if (!session) {
        toast('Katilmak icin giris yapman gerekiyor.', { icon: '🔐' });
        router.push('/login');
        return;
      }

      // Oturum varsa user.id guvenli sekilde session'dan okunur.
      // getUser() network cagrisi yerine session'dan okuma: hizli ve hatasiz.
      const currentUserId = session.user.id;
      if (!isUuid(currentUserId)) {
        toast.error('Gecersiz kullanici kimligi. Lutfen tekrar giris yap.');
        console.error('Gecersiz user_id, insert iptal edildi:', currentUserId);
        return;
      }

      if (joined) {
        const { error } = await supabase
          .from('participations')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', currentUserId);

        if (error) {
          console.error('Katilimdan ayrilma hatasi:', error);
          toast.error(humanizeDbError(error));
          return;
        }

        setJoined(false);
        onLeft?.();
        toast('Etkinlikten ayrildin.', { icon: '👋' });
        return;
      }

      const { error } = await supabase
        .from('participations')
        .insert({ event_id: eventId, user_id: currentUserId, status: 'confirmed' });

      if (error) {
        console.error('Katilim kaydi hatasi:', error);

        if (error.code === '23505') {
          // Unique constraint: zaten katilmis (iki sekme acikken olabilir)
          setJoined(true);
          onJoined?.();
          toast.success('Zaten bu etkinlige katilmistin!');
          return;
        }

        if (isParticipationsTableMissingError(error)) {
          toast.error('Katilim sistemi henuz hazir degil.');
          return;
        }

        toast.error(humanizeDbError(error));
        return;
      }

      setJoined(true);
      onJoined?.();
      toast.success('Etkinlige basariyla katildin!');
    } catch (err) {
      console.error('Katil fonksiyonu beklenmeyen hata:', err);
      toast.error('Beklenmeyen bir hata olustu. Lutfen tekrar dene.');
    } finally {
      setIsLoading(false);
    }
  }

  const buttonClass = joined
    ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
    : 'border-indigo-400/40 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30';

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={handleJoin}
        disabled={isLoading || participantsTableMissing}
        className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${buttonClass}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {joined ? 'Ayriliniyor...' : 'Isleniyor...'}
          </>
        ) : joined ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Katildin
          </>
        ) : (
          <>
            <UserPlus className="h-3.5 w-3.5" />
            Katil
          </>
        )}
      </button>

      {joined ? (
        <button
          type="button"
          onClick={handleJoin}
          disabled={isLoading || participantsTableMissing}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/60 bg-slate-800/60 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-slate-600 hover:bg-slate-700 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <LogOut className="h-3 w-3" />
          Ayril
        </button>
      ) : null}
    </div>
  );
}
