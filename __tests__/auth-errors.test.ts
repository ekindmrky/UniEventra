import { localizeAuthError } from '../lib/auth-errors';

describe('localizeAuthError', () => {
  test('returns Turkish message for invalid login credentials', () => {
    expect(localizeAuthError('Invalid login credentials')).toBe('E-posta veya sifre hatali.');
  });

  test('returns Turkish message for unconfirmed email', () => {
    expect(localizeAuthError('Email not confirmed')).toBe(
      'Hesabini onaylamayi unutma. Mail kutunu kontrol et.'
    );
  });

  test('returns original message for unknown errors', () => {
    expect(localizeAuthError('Unknown error')).toBe('Unknown error');
  });
});
