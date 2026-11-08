-- Run in the Supabase SQL Editor. All test records are rolled back.
BEGIN;

DO $$
DECLARE
  test_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (test_id, test_id::text || '@example.invalid',
    '{"name":"Profile sync regression","role":"admin"}'::jsonb);

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = test_id AND full_name = 'Profile sync regression' AND role = 'user'
  ) THEN
    RAISE EXCEPTION 'Profile was not synchronized, or trusted untrusted role metadata';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = test_id AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Profile creation must not confirm the email';
  END IF;
END;
$$;

SELECT 'Profile sync and unconfirmed-email checks passed' AS result;
ROLLBACK;
