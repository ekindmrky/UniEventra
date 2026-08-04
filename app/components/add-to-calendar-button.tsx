'use client';

import { CalendarPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { buildIcsContent } from '@/lib/event-date';

type AddToCalendarButtonProps = {
  title: string;
  date: string;
  time?: string | null;
  location: string;
  description?: string | null;
};

export function AddToCalendarButton({
  title,
  date,
  time,
  location,
  description,
}: AddToCalendarButtonProps) {
  function handleClick() {
    try {
      const ics = buildIcsContent({ title, date, time, location, description });
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^\wğüşıöçĞÜŞİÖÇ\s-]/gi, '').trim() || 'etkinlik'}.ics`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Takvim dosyası indirildi');
    } catch {
      toast.error('Takvim dosyası oluşturulamadı');
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
    >
      <CalendarPlus className="h-4 w-4 text-indigo-300" />
      Takvime ekle
    </button>
  );
}
