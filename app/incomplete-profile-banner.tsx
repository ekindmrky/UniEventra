'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

type IncompleteProfileBannerProps = {
  show: boolean;
};

export function IncompleteProfileBanner({ show }: IncompleteProfileBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) return null;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 sm:mb-8 sm:px-5 sm:py-4">
      {/* İkon */}
      <span className="shrink-0 text-xl">👤</span>

      {/* Mesaj */}
      <p className="flex-1 text-xs text-amber-200 sm:text-sm">
        <span className="font-semibold">Profilin eksik görünüyor.</span>{' '}
        Üniversite ve bölüm bilgilerini ekleyerek diğer öğrencilerle bağlantı kur.{' '}
        <Link href="/profile" className="font-bold underline underline-offset-2 hover:text-amber-100">
          Profili tamamla →
        </Link>
      </p>

      {/* Kapat */}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-full p-1 text-amber-400/60 transition hover:bg-amber-500/20 hover:text-amber-200"
        aria-label="Kapat"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
