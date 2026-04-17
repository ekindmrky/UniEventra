'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

function getSiteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
}

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorStatus(null);

    try {
      if (isSignUp) {
        const siteUrl = getSiteUrl();
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}` },
            emailRedirectTo: siteUrl ? `${siteUrl}/login` : undefined,
          },
        });
        if (error) throw error;
        alert('Kayıt başarılı! Mailini onaylamayı unutma.');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        
        if (data.user) {
          router.push('/');
          router.refresh();
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Beklenmeyen bir hata olustu.';
      setErrorStatus(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-[400px] bg-slate-900 border border-slate-800 p-10 rounded-[2rem] shadow-2xl">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-black text-indigo-400">UniEventra</Link>
          <h1 className="text-2xl font-bold text-white mt-4">{isSignUp ? 'Kayıt Ol' : 'Giriş Yap'}</h1>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="İsim" className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none" value={firstName} onChange={e => setFirstName(e.target.value)} required />
              <input placeholder="Soyisim" className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none" value={lastName} onChange={e => setLastName(e.target.value)} required />
            </div>
          )}
          <input type="email" placeholder="e-posta" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Şifre" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none" value={password} onChange={e => setPassword(e.target.value)} required />
          
          {errorStatus && <p className="text-red-400 text-[10px] text-center">{errorStatus}</p>}
          
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 py-3.5 rounded-xl text-white font-bold disabled:opacity-50">
            {loading ? 'Bağlanıyor...' : (isSignUp ? 'Kayıt Ol' : 'Giriş Yap')}
          </button>
        </form>

        <button onClick={() => setIsSignUp(!isSignUp)} className="w-full mt-6 text-xs text-slate-500">
          {isSignUp ? 'Giriş Yap' : 'Kayıt Ol'}
        </button>
      </div>
    </main>
  );
}