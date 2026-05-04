-- =============================================================================
-- UniEventra — Kulüp & Üniversite Migration
-- Çalıştır: Supabase Dashboard > SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. profiles tablosuna club_name ve university kolonları ekle
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS club_name  text,
  ADD COLUMN IF NOT EXISTS university text;

-- -----------------------------------------------------------------------------
-- 2. events tablosuna organizer_club kolonu ekle
-- -----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS organizer_club text;

-- -----------------------------------------------------------------------------
-- 3. Trigger güncelleme — club_name ve university artık user_metadata'dan okunuyor
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  IF v_role NOT IN ('student', 'club_admin') THEN
    v_role := 'student';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role, university, club_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      TRIM(
        COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' ||
        COALESCE(NEW.raw_user_meta_data->>'last_name',  '')
      )
    ),
    NEW.email,
    v_role,
    NEW.raw_user_meta_data->>'university',
    NEW.raw_user_meta_data->>'club_name'
  )
  ON CONFLICT (id) DO UPDATE
    SET
      full_name   = EXCLUDED.full_name,
      email       = EXCLUDED.email,
      role        = EXCLUDED.role,
      university  = EXCLUDED.university,
      club_name   = EXCLUDED.club_name;

  RETURN NEW;
END;
$$;

-- Trigger'ı yeniden bağla
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
