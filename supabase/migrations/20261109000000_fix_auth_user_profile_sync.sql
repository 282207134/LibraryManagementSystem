-- Repair the deployed trigger: public.users has full_name, not name.
-- Keep existing profiles (including administrator roles) unchanged.
BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    left(coalesce(
      nullif(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
      nullif(btrim(NEW.raw_user_meta_data->>'name'), ''),
      NEW.email,
      'User'
    ), 255),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- The production trigger already exists. Rebind it for reproducible setup.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill accounts affected by the old trigger without changing email verification.
INSERT INTO public.users (id, email, full_name, role, member_since, created_at)
SELECT
  a.id,
  a.email,
  left(coalesce(
    nullif(btrim(a.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(a.raw_user_meta_data->>'name'), ''),
    a.email,
    'User'
  ), 255),
  'user',
  a.created_at,
  a.created_at
FROM auth.users AS a
LEFT JOIN public.users AS p ON p.id = a.id
WHERE p.id IS NULL AND a.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

COMMIT;
