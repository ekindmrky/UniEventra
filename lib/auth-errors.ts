export function localizeAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'E-posta veya sifre hatali.';
  if (message.includes('Email not confirmed')) return 'Hesabini onaylamayi unutma. Mail kutunu kontrol et.';
  if (message.includes('User already registered')) return 'Bu e-posta adresi zaten kayitli.';
  if (message.includes('Password should be at least')) return 'Sifre en az 6 karakter olmali.';
  if (message.includes('Unable to validate email address')) return 'Gecersiz e-posta adresi.';
  if (message.includes('rate limit')) return 'Cok fazla deneme yapildi. Biraz bekle.';
  return message;
}
