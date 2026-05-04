-- =============================================================================
-- UniEventra — Row Level Security Policies
-- =============================================================================
-- Supabase SQL Editor'e bu dosyayi blok blok yapistirabilirsin.
-- Her blok bagimsizdir; sirayla calistir.
-- =============================================================================


-- =============================================================================
-- 0. REPLICA IDENTITY (Realtime DELETE olaylarinin event_id filtresini destekler)
-- =============================================================================

ALTER TABLE public.participations REPLICA IDENTITY FULL;


-- =============================================================================
-- 1. CHECK CONSTRAINTS (uygulama katmanini destekleyen veritabani kısıtları)
-- =============================================================================

-- participations.status yalnizca izin verilen degerler alabilir
ALTER TABLE public.participations
  DROP CONSTRAINT IF EXISTS participations_status_check;

ALTER TABLE public.participations
  ADD CONSTRAINT participations_status_check
  CHECK (status IN ('confirmed', 'waitlisted', 'cancelled'));

-- participations(event_id, user_id) icin benzersizlik: bir kullanici
-- ayni etkinlige birden fazla kayit yapamaz.
ALTER TABLE public.participations
  DROP CONSTRAINT IF EXISTS participations_event_user_unique;

ALTER TABLE public.participations
  ADD CONSTRAINT participations_event_user_unique
  UNIQUE (event_id, user_id);


-- =============================================================================
-- 2. PROFILES tablosu
-- =============================================================================
-- Sema varsayimi:
--   profiles(id uuid PRIMARY KEY REFERENCES auth.users(id), full_name, email,
--            avatar_url, role, created_at)
-- id kolonu auth.uid() ile eslesir.
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Herkese (anonim dahil) okuma izni: katilimci listesinde isim/avatar gostermek icin gerekli.
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Sadece kendi profilini olusturabilirsin (genellikle trigger halleder, ama guvenlik icin ekliyoruz).
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Sadece kendi profilini guncelleyebilirsin.
-- id degistirilemez — WITH CHECK auth.uid() = id bunu garantiler.
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING  (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Sadece kendi profilini silebilirsin.
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own"
  ON public.profiles
  FOR DELETE
  USING (auth.uid() = id);


-- =============================================================================
-- 3. EVENTS tablosu
-- =============================================================================
-- Mevcut sema: events(id, title, date, location, category, description)
-- NOT: Etkinlik olusturma/duzenleme su an sadece Supabase paneli / service_role ile
-- yapiliyor. Eger gelecekte kullanicilar etkinlik olusturabilecekse
-- "3b. Organizator destegi" blogunu calistir.
-- =============================================================================

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Herkes (anonim dahil) tum etkinlikleri gorebilir.
DROP POLICY IF EXISTS "events_select_public" ON public.events;
CREATE POLICY "events_select_public"
  ON public.events
  FOR SELECT
  USING (true);

-- INSERT / UPDATE / DELETE: tanimsiz birakmak = yalnizca service_role erisebilir.
-- (service_role RLS'i atlar; anon/authenticated rollerine bu izinler verilmemistir.)


-- -----------------------------------------------------------------------------
-- 3b. OPSIYONEL — Organizator destegi (su an aktif degil)
-- -----------------------------------------------------------------------------
-- Etkinliklerin kimin tarafindan olusturuldugunu takip etmek icin once su
-- migration'i calistir:
--
--   ALTER TABLE public.events
--     ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
--
-- Ardindan asagidaki politikalari aktif et:

-- DROP POLICY IF EXISTS "events_insert_organizer" ON public.events;
-- CREATE POLICY "events_insert_organizer"
--   ON public.events
--   FOR INSERT
--   WITH CHECK (
--     auth.uid() IS NOT NULL
--     AND auth.uid() = created_by
--   );
--
-- DROP POLICY IF EXISTS "events_update_owner" ON public.events;
-- CREATE POLICY "events_update_owner"
--   ON public.events
--   FOR UPDATE
--   USING  (auth.uid() = created_by)
--   WITH CHECK (auth.uid() = created_by);
--
-- DROP POLICY IF EXISTS "events_delete_owner" ON public.events;
-- CREATE POLICY "events_delete_owner"
--   ON public.events
--   FOR DELETE
--   USING (auth.uid() = created_by);


-- =============================================================================
-- 4. PARTICIPATIONS tablosu
-- =============================================================================
-- Sema: participations(id, event_id, user_id, status, created_at)
-- Kritik kural: user_id her zaman auth.uid() olmalidır.
-- =============================================================================

ALTER TABLE public.participations ENABLE ROW LEVEL SECURITY;

-- Herkes katilimci listesini gorebilir (etkinlik sayfasindaki sayac ve liste icin).
DROP POLICY IF EXISTS "participations_select_public" ON public.participations;
CREATE POLICY "participations_select_public"
  ON public.participations
  FOR SELECT
  USING (true);

-- Sadece giris yapmis kullanicılar katilabilir.
-- WITH CHECK garantiler: istemci hicbir sekilde baska birinin adina kayit atamaz.
DROP POLICY IF EXISTS "participations_insert_own" ON public.participations;
CREATE POLICY "participations_insert_own"
  ON public.participations
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL          -- Giris yapmis olmali
    AND auth.uid() = user_id        -- Sadece kendi user_id'si ile kayit yapabilir
    AND EXISTS (                    -- Etkinlik gercekten var olmali
      SELECT 1 FROM public.events WHERE id = event_id
    )
  );

-- Sadece kendi katilimını silebilirsin (etkinlikten ayrilma).
-- Etkinlik sahibi / admin baglantili satirlari silemez — kasitli olarak.
DROP POLICY IF EXISTS "participations_delete_own" ON public.participations;
CREATE POLICY "participations_delete_own"
  ON public.participations
  FOR DELETE
  USING (auth.uid() = user_id);

-- UPDATE kasitli olarak tanimlanmamistir.
-- Status degisikligi (confirmed -> cancelled vb.) sunucu tarafi bir
-- Server Action veya Edge Function uzerinden yapilmalidir.


-- =============================================================================
-- 5. REALTIME icin yayın izni (postgres_changes dinlemek icin gerekli)
-- =============================================================================

-- participations tablosunu Realtime yayin listesine ekle.
-- (Supabase Dashboard > Database > Replication > Source Tables ile de yapilabilir.)
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;
  CREATE PUBLICATION supabase_realtime FOR TABLE
    public.events,
    public.participations;
COMMIT;


-- =============================================================================
-- 6. Kayit sonrasi otomatik profil olusturma trigger'i
-- =============================================================================
-- Yeni bir kullanici kayit olundugunda auth.users'a bir satir eklenir.
-- Bu trigger, public.profiles'a eslesik bir satir olusturur.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER          -- auth.users'a okuma izni olmayan rollerin de calistirabilmesi icin
SET search_path = public
AS $$
BEGIN
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
    'student'             -- varsayilan rol
  )
  ON CONFLICT (id) DO NOTHING;  -- ikinci kez tetiklenirse sessizce atla

  RETURN NEW;
END;
$$;

-- Eski trigger varsa temizle
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- 7. Dogrulama sorguları — her politikanin calistigini test et
-- =============================================================================
-- Bu sorgulari calistirdiktan sonra beklenen sonuclari goreceksin.

-- Tum aktif politikalari listele:
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'events', 'participations')
ORDER BY tablename, cmd;

-- RLS'in etkin oldugunu dogrula:
SELECT
  relname        AS "tablo",
  relrowsecurity AS "rls_etkin",
  relforcerowsecurity AS "force_rls"
FROM pg_class
WHERE relname IN ('profiles', 'events', 'participations')
  AND relnamespace = 'public'::regnamespace;
