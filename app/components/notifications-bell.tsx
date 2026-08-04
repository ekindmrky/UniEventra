'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AppNotification } from '@/lib/types';

type NotificationsBellProps = {
  userId: string;
};

export function NotificationsBell({ userId }: NotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read_at).length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, link, read_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        setItems(data as AppNotification[]);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => void load(),
      )
      .subscribe();

    return () => void supabase.removeChannel(channel);
  }, [userId, load]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  async function markAllRead() {
    const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .in('id', unreadIds);

    if (!error) {
      setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    }
  }

  async function openPanel() {
    const next = !open;
    setOpen(next);
    if (next) {
      await load();
      await markAllRead();
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => void openPanel()}
        className="relative rounded-xl border border-slate-700 bg-slate-800/70 p-2 text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
        aria-label="Bildirimler"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-[70] mt-2 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <p className="text-sm font-bold text-white">Bildirimler</p>
            <button
              type="button"
              onClick={() => void load()}
              className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
            >
              Yenile
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Yükleniyor…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                Henüz bildirimin yok.
              </p>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id} className="border-b border-slate-800/70 last:border-0">
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => setOpen(false)}
                        className="block px-4 py-3 transition hover:bg-slate-800/60"
                      >
                        <NotificationBody n={n} />
                      </Link>
                    ) : (
                      <div className="px-4 py-3">
                        <NotificationBody n={n} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NotificationBody({ n }: { n: AppNotification }) {
  const time = new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(n.created_at));

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-100">{n.title}</p>
        {!n.read_at ? (
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
        ) : null}
      </div>
      {n.body ? <p className="mt-0.5 text-xs text-slate-400">{n.body}</p> : null}
      <p className="mt-1 text-[10px] text-slate-600">{time}</p>
    </>
  );
}
