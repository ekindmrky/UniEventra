'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type NavbarAuthControlsProps = {
  isLoggedIn: boolean;
  displayName: string;
};

export function NavbarAuthControls({
  isLoggedIn,
  displayName,
}: NavbarAuthControlsProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
    setIsSigningOut(false);
  }

  if (!isLoggedIn) {
    return (
      <Link
        href="/login"
        className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-bold transition hover:bg-indigo-500"
      >
        Giris Yap
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200">
        {displayName}
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="rounded-full border border-slate-600 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSigningOut ? 'Cikis...' : 'Cikis Yap'}
      </button>
    </div>
  );
}
