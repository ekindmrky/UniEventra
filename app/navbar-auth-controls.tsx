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
      toast.error('Çıkış yapılırken bir hata oluştu.');
      setIsSigningOut(false);
      return;
    }
    toast.success('Çıkış yapıldı');
    router.push('/');
    router.refresh();
    setIsSigningOut(false);
  }

  if (!isLoggedIn) {
    return (
      <Link
        href="/login"
        className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-500 sm:px-5 sm:text-sm"
      >
        Giriş Yap
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-2.5">
      {role === 'club_admin' ? (
        <Link
          href="/dashboard"
          className="hidden items-center gap-1.5 rounded-xl border border-indigo-500/35 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-200 transition hover:border-indigo-500/55 hover:bg-indigo-500/20 sm:inline-flex sm:px-3.5 sm:py-2"
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          + Etkinlik
        </Link>
      ) : null}

      <Link
        href="/profile"
        className="max-w-[100px] truncate rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 sm:max-w-[160px] sm:px-3.5 sm:py-2 sm:text-sm"
        title="Profile git"
      >
        {displayName}
      </Link>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="rounded-xl border border-slate-700 bg-transparent px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-slate-600 hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3.5 sm:py-2"
      >
        {isSigningOut ? '...' : 'Çıkış'}
      </button>
    </div>
  );
}
