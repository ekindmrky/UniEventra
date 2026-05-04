'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/lib/auth';

type NavbarAuthControlsProps = {
  isLoggedIn: boolean;
  displayName: string;
  role?: UserRole;
};

export function NavbarAuthControls({ isLoggedIn, displayName, role }: NavbarAuthControlsProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Cikis yapilirken bir hata olustu.');
      setIsSigningOut(false);
      return;
    }
    toast('Cikis yapildi. Gorusuruz!', { icon: '👋' });
    router.push('/');
    router.refresh();
    setIsSigningOut(false);
  }

  if (!isLoggedIn) {
    return (
      <Link
        href="/login"
        className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-bold transition hover:bg-indigo-500 sm:px-6 sm:text-sm"
      >
        Giris Yap
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {/* Club Admin: Etkinlik Yönetimi butonu */}
      {role === 'club_admin' && (
        <Link
          href="/dashboard"
          className="hidden items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-200 transition hover:border-amber-500/60 hover:bg-amber-500/20 sm:flex sm:px-4 sm:py-2"
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Etkinlik Olustur
        </Link>
      )}

      {/* Kullanıcı adı → Profil linki */}
      <Link
        href="/profile"
        className="max-w-[90px] truncate rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400/60 hover:bg-emerald-500/20 sm:max-w-[160px] sm:px-4 sm:py-2 sm:text-sm"
        title="Profile git"
      >
        {displayName}
      </Link>

      {/* Çıkış */}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:py-2"
      >
        {isSigningOut ? '...' : 'Cikis'}
      </button>
    </div>
  );
}
