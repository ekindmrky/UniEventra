-- =============================================================================
-- UniEventra — Kapasite / Waitlist + Bildirimler
-- Çalıştır: Supabase SQL Editor → Run (bir kez)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. events.capacity (NULL = sınırsız)
-- -----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS capacity integer
    CHECK (capacity IS NULL OR capacity > 0);

-- -----------------------------------------------------------------------------
-- 2. notifications
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
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- INSERT yalnızca SECURITY DEFINER fonksiyonlar üzerinden

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Bildirim yardımcısı
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text DEFAULT NULL,
  p_link text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_user_id, p_type, p_title, p_body, p_link);
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. join_event — kapasiteye göre confirmed / waitlisted
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.join_event(p_event_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_capacity integer;
  v_confirmed integer;
  v_status text;
  v_title text;
  v_creator uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT capacity, title, created_by
    INTO v_capacity, v_title, v_creator
  FROM public.events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.participations
    WHERE event_id = p_event_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'already_joined' USING ERRCODE = '23505';
  END IF;

  SELECT count(*)::integer INTO v_confirmed
  FROM public.participations
  WHERE event_id = p_event_id AND status = 'confirmed';

  IF v_capacity IS NULL OR v_confirmed < v_capacity THEN
    v_status := 'confirmed';
  ELSE
    v_status := 'waitlisted';
  END IF;

  INSERT INTO public.participations (event_id, user_id, status)
  VALUES (p_event_id, v_uid, v_status);

  -- Öğrenciye bildirim
  PERFORM public.create_notification(
    v_uid,
    CASE WHEN v_status = 'confirmed' THEN 'join_confirmed' ELSE 'join_waitlisted' END,
    CASE WHEN v_status = 'confirmed'
      THEN 'Katılımın onaylandı'
      ELSE 'Bekleme listesine eklendin'
    END,
    v_title,
    '/events/' || p_event_id::text
  );

  -- Organizatöre bildirim
  IF v_creator IS NOT NULL AND v_creator <> v_uid THEN
    PERFORM public.create_notification(
      v_creator,
      'new_participant',
      CASE WHEN v_status = 'confirmed'
        THEN 'Yeni katılımcı'
        ELSE 'Bekleme listesine kayıt'
      END,
      v_title,
      '/events/' || p_event_id::text
    );
  END IF;

  RETURN jsonb_build_object('status', v_status);
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. leave_event — ayrıl + waitlist terfisi
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.leave_event(p_event_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old_status text;
  v_promoted uuid;
  v_title text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT title INTO v_title FROM public.events WHERE id = p_event_id;

  DELETE FROM public.participations
  WHERE event_id = p_event_id AND user_id = v_uid
  RETURNING status INTO v_old_status;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'not_joined' USING ERRCODE = 'P0002';
  END IF;

  IF v_old_status = 'confirmed' THEN
    UPDATE public.participations
    SET status = 'confirmed'
    WHERE id = (
      SELECT id FROM public.participations
      WHERE event_id = p_event_id AND status = 'waitlisted'
      ORDER BY created_at ASC
      LIMIT 1
    )
    RETURNING user_id INTO v_promoted;

    IF v_promoted IS NOT NULL THEN
      PERFORM public.create_notification(
        v_promoted,
        'waitlist_promoted',
        'Kontenjan açıldı — katılımın onaylandı',
        v_title,
        '/events/' || p_event_id::text
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'left_status', v_old_status,
    'promoted_user_id', v_promoted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.join_event(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_event(bigint) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Yeni etkinlik → aynı üniversitedeki öğrencilere bildirim (opsiyonel hafif)
--    Trigger: club_admin etkinlik oluşturunca university eşleşen student'lara
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_new_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uni text;
  r record;
BEGIN
  SELECT university INTO v_uni
  FROM public.profiles
  WHERE id = NEW.created_by;

  IF v_uni IS NULL THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT id FROM public.profiles
    WHERE role = 'student'
      AND university = v_uni
      AND id IS DISTINCT FROM NEW.created_by
    LIMIT 200
  LOOP
    PERFORM public.create_notification(
      r.id,
      'new_event',
      'Yeni kampüs etkinliği',
      NEW.title,
      '/events/' || NEW.id::text
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_event_created_notify ON public.events;
CREATE TRIGGER on_event_created_notify
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_event();
