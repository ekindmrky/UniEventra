'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GraduationCap, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { getSiteUrl } from '@/lib/auth';

type Role = 'student' | 'club_admin';

const UNIVERSITIES = ['Yaşar Üniversitesi'] as const;

function localizeAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'E-posta veya sifre hatali.';
  if (message.includes('Email not confirmed'))       return 'Hesabini onaylamayi unutma. Mail kutunu kontrol et.';
  if (message.includes('User already registered'))   return 'Bu e-posta adresi zaten kayitli.';
  if (message.includes('Password should be at least')) return 'Sifre en az 6 karakter olmali.';
  if (message.includes('Unable to validate email address')) return 'Gecersiz e-posta adresi.';
  if (message.includes('rate limit'))                return 'Cok fazla deneme yapildi. Biraz bekle.';
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [university, setUniversity] = useState<string>(UNIVERSITIES[0]);
  const [clubName, setClubName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorStatus(null);

    try {
      if (isSignUp) {
        if (role === 'club_admin' && !clubName.trim()) {
          toast.error('Kulüp adını girmek zorunludur.');
          return;
        }
        const siteUrl = getSiteUrl();
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name:  firstName,
              last_name:   lastName,
              full_name:   `${firstName} ${lastName}`.trim(),
              role,
              university,
              club_name:   role === 'club_admin' ? clubName.trim() : null,
            },
            emailRedirectTo: siteUrl ? `${siteUrl}/login` : undefined,
          },
        });
        if (error) throw error;
        toast.success('Kayit basarili! Onay mailini kontrol et.');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (data.user) {
          toast.success('Hos geldin!');
          // Rol bazli yonlendirme
          const userRole = data.user.user_metadata?.role as string | undefined;
          if (userRole === 'club_admin') {
            router.push('/dashboard');
          } else {
            router.push('/');
          }
          router.refresh();
        }
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Beklenmeyen bir hata olustu.';
      const message = localizeAuthError(raw);
      setErrorStatus(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 sm:p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:max-w-[420px] sm:rounded-[2rem] sm:p-10">
        {/* Logo + başlık */}
        <div className="mb-7 text-center sm:mb-8">
          <Link href="/" className="text-xl font-black text-indigo-400 sm:text-2xl">
            UniEventra
          </Link>
          <h1 className="mt-3 text-xl font-bold text-white sm:mt-4 sm:text-2xl">
            {isSignUp ? 'Kayit Ol' : 'Giris Yap'}
          </h1>
        </div>

        <form onSubmit={handleAuth} className="space-y-3 sm:space-y-4">
          {/* Kayıt formu ek alanları */}
          {isSignUp && (
            <>
              {/* Ad Soyad */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <input
                  placeholder="Isim"
                  className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-indigo-500 sm:px-4"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
                <input
                  placeholder="Soyisim"
                  className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-indigo-500 sm:px-4"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>

              {/* Üniversite Seçimi */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Universite
                </label>
                <select
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-indigo-500 sm:px-4"
                >
                  {UNIVERSITIES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              {/* Rol Seçimi */}
              <div>
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Rolunu Sec
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Öğrenci kartı */}
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition ${
                      role === 'student'
                        ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-200'
                        : 'border-slate-700/60 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:bg-slate-800/70'
                    }`}
                  >
                    <GraduationCap className={`h-6 w-6 ${role === 'student' ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold leading-tight">Ogrenci</span>
                    <span className="text-[10px] leading-tight opacity-70">
                      Etkinlikleri kesfet ve katil
                    </span>
                    {/* Seçili işareti */}
                    {role === 'student' && (
                      <span className="mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-black text-white">✓</span>
                    )}
                  </button>

                  {/* Kulüp Yetkilisi kartı */}
                  <button
                    type="button"
                    onClick={() => setRole('club_admin')}
                    className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition ${
                      role === 'club_admin'
                        ? 'border-amber-500/60 bg-amber-500/10 text-amber-200'
                        : 'border-slate-700/60 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:bg-slate-800/70'
                    }`}
                  >
                    <Star className={`h-6 w-6 ${role === 'club_admin' ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold leading-tight">Kulup Yetkilisi</span>
                    <span className="text-[10px] leading-tight opacity-70">
                      Etkinlik olustur ve yonet
                    </span>
                    {role === 'club_admin' && (
                      <span className="mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-white">✓</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Kulüp Adı — sadece club_admin için */}
              {role === 'club_admin' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Kulup Adi <span className="text-red-400">*</span>
                  </label>
                  <input
                    placeholder="Örn: IEEE, Gastronomi Toplulugu"
                    className="w-full rounded-xl border border-amber-500/30 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-amber-500 sm:px-4"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    required={role === 'club_admin'}
                  />
                </div>
              )}
            </>
          )}

          {/* E-posta */}
          <input
            type="email"
            placeholder="e-posta"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-indigo-500 sm:px-4"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {/* Şifre */}
          <input
            type="password"
            placeholder="Sifre"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-indigo-500 sm:px-4"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {errorStatus ? (
            <p className="text-center text-xs text-red-400">{errorStatus}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50 sm:py-3.5"
          >
            {loading ? 'Baglaniliyor...' : isSignUp ? 'Kayit Ol' : 'Giris Yap'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setIsSignUp(!isSignUp); setErrorStatus(null); }}
          className="mt-5 w-full text-xs text-slate-500 hover:text-slate-400 sm:mt-6"
        >
          {isSignUp ? 'Zaten hesabın var mı? Giris Yap' : 'Hesabın yok mu? Kayit Ol'}
        </button>
      </div>
    </main>
  );
}
