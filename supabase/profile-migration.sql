-- =============================================================================
-- UniEventra — Öğrenci Profili Migrasyonu
-- =============================================================================
-- Bu dosyayı Supabase SQL Editor'de sırayla çalıştır.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. profiles tablosuna yeni sütunlar
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS university  text,
  ADD COLUMN IF NOT EXISTS department  text,
  ADD COLUMN IF NOT EXISTS bio         text,
  ADD COLUMN IF NOT EXISTS interests   text[] DEFAULT '{}';

-- bio için makul uzunluk sınırı
ALTER TABLE public.profiles
  ADD CONSTRAINT IF NOT EXISTS profiles_bio_length CHECK (char_length(bio) <= 500);


-- -----------------------------------------------------------------------------
-- 2. events tablosuna created_by sütunu (organizatör desteği)
-- -----------------------------------------------------------------------------
-- Bu sütun olmadan "Oluşturduğum Etkinlikler" sekmesi boş kalır.
-- Mevcut etkinlikler sahipsiz görünür; yeni etkinlikler için kullanılır.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS created_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS events_created_by_idx ON public.events (created_by);


-- -----------------------------------------------------------------------------
-- 3. RLS politikaları (profiles tablosu için güncelleme)
-- -----------------------------------------------------------------------------
-- Önceki rls-policies.sql dosyasında profiles için temel politikalar zaten
-- tanımlandı. Burada yeni sütunların da o politikalar kapsamında olduğunu
-- doğruluyoruz (sütun ekleme mevcut politikaları otomatik kapsar).

-- Mevcut politikaları listele (doğrulama için):
SELECT policyname, cmd, qual, with_check
FROM   pg_policies
WHERE  schemaname = 'public' AND tablename = 'profiles';


-- -----------------------------------------------------------------------------
-- 4. events tablosu için organizatör politikaları
-- -----------------------------------------------------------------------------
-- Artık created_by sütunu olduğu için INSERT/UPDATE/DELETE'e izin verebiliriz.

-- Giriş yapmış kullanıcılar etkinlik oluşturabilir (created_by kendi id'si olmalı)
DROP POLICY IF EXISTS "events_insert_organizer" ON public.events;
CREATE POLICY "events_insert_organizer"
  ON public.events
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = created_by
  );

-- Sadece etkinliği oluşturan kişi güncelleyebilir
DROP POLICY IF EXISTS "events_update_owner" ON public.events;
CREATE POLICY "events_update_owner"
  ON public.events
  FOR UPDATE
  USING  (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Sadece etkinliği oluşturan kişi silebilir
DROP POLICY IF EXISTS "events_delete_owner" ON public.events;
CREATE POLICY "events_delete_owner"
  ON public.events
  FOR DELETE
  USING (auth.uid() = created_by);


-- -----------------------------------------------------------------------------
-- 5. Doğrulama — yeni sütunların eklendiğini kontrol et
-- -----------------------------------------------------------------------------

SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   IN ('profiles', 'events')
  AND  column_name  IN ('university', 'department', 'bio', 'interests', 'created_by')
ORDER BY table_name, column_name;
