'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, LogOut, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type JoinButtonProps = {
  eventId: string;
  initiallyJoined: boolean;
  participantsTableMissing: boolean;
  onJoined?: () => void;
  onLeft?: () => void;
};

function isParticipationsTableMissingError(error: { code?: string; message?: string }) {
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.message?.includes("Could not find the table 'public.participations'") === true
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
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
  const [errorMessage, setErrorMessage] = useState<string | null>(
    participantsTableMissing
      ? 'participations tablosu bulunamadi. Katilim kaydi su an olusturulamiyor.'
      : null,
  );

  async function handleJoin() {
    if (isLoading || participantsTableMissing) return;

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error('Katilim auth kontrolu hatasi:', authError);
        setErrorMessage(authError.message);
        return;
      }

      // Oturum yoksa insert denemeden login'e yonlendir.
      if (!user) {
        router.push('/login');
        return;
      }

      // RLS kuralinin bekledigi user_id degeri: auth.user.id (salt UUID string).
      const currentUserId = user.id;
      if (!currentUserId || !isUuid(currentUserId)) {
        setErrorMessage('Gecerli bir kullanici kimligi bulunamadi. Lutfen tekrar giris yap.');
        console.error('Gecersiz user_id, insert iptal edildi:', currentUserId);
        return;
      }

      console.log("DB'ye giden ID:", currentUserId);

      if (joined) {
        const { error } = await supabase
          .from('participations')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', currentUserId);

        if (error) {
          console.error('Katilimdan ayrilma hatasi:', error);
          setErrorMessage(error.message);
          return;
        }

        setJoined(false);
        onLeft?.();
        return;
      }

      const { error } = await supabase
        .from('participations')
        .insert({ event_id: eventId, user_id: currentUserId, status: 'confirmed' });

      if (error) {
        console.error('Katilim kaydi hatasi:', error);

        if (error.code === '23505') {
          setJoined(true);
          onJoined?.();
          return;
        }

        if (isParticipationsTableMissingError(error)) {
          setErrorMessage('participations tablosu bulunamadi. Katilim kaydi olusturulamadi.');
          return;
        }

        setErrorMessage(error.message);
        return;
      }

      setJoined(true);
      onJoined?.();
    } catch (error) {
      console.error('Katil fonksiyonu beklenmeyen hata:', error);
      setErrorMessage('Beklenmeyen bir hata olustu. Lutfen tekrar dene.');
    } finally {
      setIsLoading(false);
    }
  }

  const buttonClass = joined
    ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
    : 'border-indigo-400/40 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30';

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleJoin}
        disabled={isLoading || participantsTableMissing}
        className={`inline-flex items-center gap-2 rounded-lg border px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${buttonClass}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {joined ? 'Ayriliniyor...' : 'Isleniyor...'}
          </>
        ) : joined ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Katildin
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4" />
            Katil
          </>
        )}
      </button>

      {joined ? (
        <button
          type="button"
          onClick={handleJoin}
          disabled={isLoading || participantsTableMissing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <LogOut className="h-3.5 w-3.5" />
          Ayril
        </button>
      ) : null}

      {errorMessage ? <p className="text-xs text-red-300">{errorMessage}</p> : null}
    </div>
  );
}
