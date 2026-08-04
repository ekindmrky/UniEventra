-- =============================================================================
-- UniEventra — Yeni Supabase projesi için tam şema
-- Çalıştır: Supabase Dashboard > SQL Editor > New query > Run
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tablolar
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  email       text,
  avatar_url  text,
  role        text NOT NULL DEFAULT 'student'
                CHECK (role IN ('student', 'club_admin')),
  university  text,
  department  text,
  bio         text CHECK (char_length(bio) <= 500),
  interests   text[] DEFAULT '{}',
  club_name   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.events (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title           text NOT NULL,
  date            date NOT NULL,
  time            time NOT NULL DEFAULT '00:00:00',
  location        text NOT NULL,
  category        text NOT NULL,
  description     text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organizer_club  text,
  capacity        integer CHECK (capacity IS NULL OR capacity > 0),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_created_by_idx ON public.events (created_by);
CREATE INDEX IF NOT EXISTS events_date_idx ON public.events (date);

CREATE TABLE IF NOT EXISTS public.participations (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id    bigint NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'confirmed'
                CHECK (status IN ('confirmed', 'waitlisted', 'cancelled')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.participations REPLICA IDENTITY FULL;

-- -----------------------------------------------------------------------------
-- 2. RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE USING (auth.uid() = id);

DROP POLICY IF EXISTS "events_select_public" ON public.events;
CREATE POLICY "events_select_public"
  ON public.events FOR SELECT USING (true);

DROP POLICY IF EXISTS "events_insert_club_admin" ON public.events;
CREATE POLICY "events_insert_club_admin"
  ON public.events FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'club_admin'
    )
  );

DROP POLICY IF EXISTS "events_update_club_admin" ON public.events;
CREATE POLICY "events_update_club_admin"
  ON public.events FOR UPDATE
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

DROP POLICY IF EXISTS "events_delete_club_admin" ON public.events;
CREATE POLICY "events_delete_club_admin"
  ON public.events FOR DELETE
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'club_admin'
    )
  );

DROP POLICY IF EXISTS "participations_select_public" ON public.participations;
CREATE POLICY "participations_select_public"
  ON public.participations FOR SELECT USING (true);

DROP POLICY IF EXISTS "participations_insert_own" ON public.participations;
CREATE POLICY "participations_insert_own"
  ON public.participations FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.events WHERE id = event_id)
  );

DROP POLICY IF EXISTS "participations_delete_own" ON public.participations;
CREATE POLICY "participations_delete_own"
  ON public.participations FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. Realtime
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.participations;

-- -----------------------------------------------------------------------------
-- 4. Kayıt sonrası otomatik profil
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
      full_name  = EXCLUDED.full_name,
      email      = EXCLUDED.email,
      role       = EXCLUDED.role,
      university = EXCLUDED.university,
      club_name  = EXCLUDED.club_name;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 5. Bildirimler + kapasite RPC (features-migration.sql ile aynı)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  title       text NOT NULL,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_created_idx
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid, p_type text, p_title text,
  p_body text DEFAULT NULL, p_link text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_user_id, p_type, p_title, p_body, p_link);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_event(p_event_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_capacity integer; v_confirmed integer; v_status text;
  v_title text; v_creator uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  SELECT capacity, title, created_by INTO v_capacity, v_title, v_creator
  FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002'; END IF;
  IF EXISTS (SELECT 1 FROM public.participations WHERE event_id = p_event_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'already_joined' USING ERRCODE = '23505';
  END IF;
  SELECT count(*)::integer INTO v_confirmed
  FROM public.participations WHERE event_id = p_event_id AND status = 'confirmed';
  IF v_capacity IS NULL OR v_confirmed < v_capacity THEN v_status := 'confirmed';
  ELSE v_status := 'waitlisted'; END IF;
  INSERT INTO public.participations (event_id, user_id, status) VALUES (p_event_id, v_uid, v_status);
  PERFORM public.create_notification(
    v_uid,
    CASE WHEN v_status = 'confirmed' THEN 'join_confirmed' ELSE 'join_waitlisted' END,
    CASE WHEN v_status = 'confirmed' THEN 'Katılımın onaylandı' ELSE 'Bekleme listesine eklendin' END,
    v_title, '/events/' || p_event_id::text);
  IF v_creator IS NOT NULL AND v_creator <> v_uid THEN
    PERFORM public.create_notification(
      v_creator, 'new_participant',
      CASE WHEN v_status = 'confirmed' THEN 'Yeni katılımcı' ELSE 'Bekleme listesine kayıt' END,
      v_title, '/events/' || p_event_id::text);
  END IF;
  RETURN jsonb_build_object('status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_event(p_event_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_old_status text; v_promoted uuid; v_title text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  SELECT title INTO v_title FROM public.events WHERE id = p_event_id;
  DELETE FROM public.participations WHERE event_id = p_event_id AND user_id = v_uid
  RETURNING status INTO v_old_status;
  IF v_old_status IS NULL THEN RAISE EXCEPTION 'not_joined' USING ERRCODE = 'P0002'; END IF;
  IF v_old_status = 'confirmed' THEN
    UPDATE public.participations SET status = 'confirmed'
    WHERE id = (
      SELECT id FROM public.participations
      WHERE event_id = p_event_id AND status = 'waitlisted'
      ORDER BY created_at ASC LIMIT 1
    ) RETURNING user_id INTO v_promoted;
    IF v_promoted IS NOT NULL THEN
      PERFORM public.create_notification(
        v_promoted, 'waitlist_promoted',
        'Kontenjan açıldı — katılımın onaylandı',
        v_title, '/events/' || p_event_id::text);
    END IF;
  END IF;
  RETURN jsonb_build_object('left_status', v_old_status, 'promoted_user_id', v_promoted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_event(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_event(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_new_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uni text; r record;
BEGIN
  SELECT university INTO v_uni FROM public.profiles WHERE id = NEW.created_by;
  IF v_uni IS NULL THEN RETURN NEW; END IF;
  FOR r IN
    SELECT id FROM public.profiles
    WHERE role = 'student' AND university = v_uni AND id IS DISTINCT FROM NEW.created_by
    LIMIT 200
  LOOP
    PERFORM public.create_notification(r.id, 'new_event', 'Yeni kampüs etkinliği', NEW.title, '/events/' || NEW.id::text);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_event_created_notify ON public.events;
CREATE TRIGGER on_event_created_notify
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_event();
