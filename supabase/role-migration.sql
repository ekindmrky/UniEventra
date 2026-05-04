-- =============================================================================
-- UniEventra — Rol Yönetimi Migrasyonu
-- =============================================================================
-- Bu dosyayı Supabase SQL Editor'de sırayla çalıştır.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. profiles.role — mevcut satırlar için varsayılanı temizle
-- -----------------------------------------------------------------------------
-- role sütunu rls-policies.sql'daki trigger'da zaten 'student' olarak eklendi.
-- Artık kullanıcının kayıt sırasında seçtiği değer metadatadan gelecek.
-- Mevcut tabloyu dokunmadan bırakıyoruz; trigger güncelleniyor.

-- Izin verilen rol değerleri
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'club_admin'));


-- -----------------------------------------------------------------------------
-- 2. Trigger güncelleme — rol artık user_metadata'dan okunuyor
-- -----------------------------------------------------------------------------
-- Kayıt sırasında options.data.role olarak gönderilen değer
-- raw_user_meta_data->>'role' ile alınır.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  -- Kullanıcının seçtiği rolü oku; geçersizse 'student' kullan
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  IF v_role NOT IN ('student', 'club_admin') THEN
    v_role := 'student';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role)
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
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger'ı yeniden bağla (fonksiyon güncellendi, trigger zaten var)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 3. events tablosu — yalnızca club_admin etkinlik oluşturabilir
-- -----------------------------------------------------------------------------

-- Önceki geniş INSERT politikasını kaldır
DROP POLICY IF EXISTS "events_insert_organizer" ON public.events;

-- Yalnızca club_admin ve created_by kendi id'si ise izin ver
CREATE POLICY "events_insert_club_admin"
  ON public.events
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'club_admin'
    )
  );

-- UPDATE: sahip + club_admin olmalı
DROP POLICY IF EXISTS "events_update_owner" ON public.events;
CREATE POLICY "events_update_club_admin"
  ON public.events
  FOR UPDATE
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'club_admin'
    )
  )
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'club_admin'
    )
  );

-- DELETE: sahip + club_admin olmalı
DROP POLICY IF EXISTS "events_delete_owner" ON public.events;
CREATE POLICY "events_delete_club_admin"
  ON public.events
  FOR DELETE
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'club_admin'
    )
  );


-- -----------------------------------------------------------------------------
-- 4. Mevcut kullanıcılar için rol güncelleme (isteğe bağlı)
-- -----------------------------------------------------------------------------
-- Mevcut kullanıcılar 'student' rolüyle kayıtlıysa ve bunu değiştirmek
-- istersen aşağıdaki UPDATE'i kullan:
--
-- UPDATE public.profiles
--   SET role = 'club_admin'
--   WHERE email = 'ornek@uni.edu.tr';


-- -----------------------------------------------------------------------------
-- 5. Doğrulama
-- -----------------------------------------------------------------------------

SELECT policyname, cmd, qual
FROM   pg_policies
WHERE  schemaname = 'public' AND tablename = 'events'
ORDER BY cmd;
