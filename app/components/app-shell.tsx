'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  LayoutDashboard,
  LogIn,
  UserRound,
} from 'lucide-react';
import type { UserRole } from '@/lib/auth';
import { NavbarAuthControls } from '@/app/navbar-auth-controls';
import { NotificationsBell } from '@/app/components/notifications-bell';

type AppShellProps = {
  children: React.ReactNode;
  isLoggedIn: boolean;
  displayName: string;
  role?: UserRole;
  userId?: string | null;
  maxWidthClassName?: string;
  /** Sayfa içeriğinin üstüne ekstra boşluk (mobil tab için alt padding her zaman var) */
  contentClassName?: string;
};

function navActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  isLoggedIn,
  displayName,
  role = null,
  userId = null,
  maxWidthClassName = 'max-w-6xl',
  contentClassName = '',
}: AppShellProps) {
  const pathname = usePathname();
  const isAdmin = role === 'club_admin';

  const desktopLinks = [
    { href: '/', label: 'Etkinlikler', show: true },
    { href: '/profile', label: 'Profil', show: isLoggedIn },
    { href: '/dashboard', label: 'Yönetim', show: isAdmin },
  ].filter((l) => l.show);

  const tabs = isAdmin
    ? [
        { href: '/', label: 'Keşfet', icon: Home, emphasize: false },
        { href: '/dashboard', label: 'Yönetim', icon: LayoutDashboard, emphasize: true },
        { href: '/profile', label: 'Profil', icon: UserRound, emphasize: false },
      ]
    : isLoggedIn
      ? [
          { href: '/', label: 'Keşfet', icon: Home, emphasize: false },
          { href: '/profile', label: 'Profil', icon: UserRound, emphasize: false },
        ]
      : [
          { href: '/', label: 'Keşfet', icon: Home, emphasize: false },
          { href: '/login', label: 'Giriş', icon: LogIn, emphasize: true },
        ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/75 backdrop-blur-xl">
        <div
          className={`mx-auto flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5 ${maxWidthClassName}`}
        >
          <div className="flex items-center gap-5 sm:gap-8">
            <Link href="/" className="text-xl font-black tracking-tight text-indigo-400 sm:text-2xl">
              UniEventra
            </Link>
            <nav className="hidden items-center gap-1 md:flex" aria-label="Ana menü">
              {desktopLinks.map((link) => {
                const active = navActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                      active
                        ? 'bg-indigo-500/15 text-indigo-300'
                        : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {isLoggedIn && userId ? <NotificationsBell userId={userId} /> : null}
            <NavbarAuthControls
              isLoggedIn={isLoggedIn}
              displayName={displayName}
              role={role}
            />
          </div>
        </div>
      </header>

      <div
        className={`mx-auto w-full px-4 pb-24 pt-6 sm:px-6 sm:pb-12 sm:pt-8 md:pt-10 ${maxWidthClassName} ${contentClassName}`}
      >
        {children}
      </div>

      {/* Mobil alt sekme çubuğu */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-800/90 bg-slate-950/90 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Mobil menü"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-1.5">
          {tabs.map((tab) => {
            const active = navActive(pathname, tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={`${tab.href}-${tab.label}`}
                href={tab.href}
                className={`flex min-w-[4.5rem] flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-semibold transition ${
                  active
                    ? 'text-indigo-300'
                    : tab.emphasize
                      ? 'text-indigo-400/80'
                      : 'text-slate-500'
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                    active
                      ? 'bg-indigo-500/20'
                      : tab.emphasize
                        ? 'bg-indigo-600 text-white'
                        : 'bg-transparent'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${tab.emphasize && !active ? 'text-white' : ''}`} />
                </span>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
