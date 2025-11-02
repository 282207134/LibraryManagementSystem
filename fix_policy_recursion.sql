-- =====================================================
-- Fix infinite recursion in RLS policies
-- =====================================================
-- This script fixes the circular dependency where policies 
-- query the users table while the users table is being queried.
--
-- Solution: Use a security definer function to check admin role
-- =====================================================

-- Step 1: Create a security definer function to check if user is admin
-- This function bypasses RLS policies
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- Step 2: Drop and recreate the problematic policies for users table
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;

-- Admins can read all users (using security definer function)
CREATE POLICY "Admins can read all users" ON users
  FOR SELECT
  USING (is_admin());

-- Admins can update all users
CREATE POLICY "Admins can update all users" ON users
  FOR UPDATE
  USING (is_admin());

-- Admins can insert users
CREATE POLICY "Admins can insert users" ON users
  FOR INSERT
  WITH CHECK (is_admin());

-- Step 3: Fix borrowing_records policies
DROP POLICY IF EXISTS "Admins can view all borrowing records" ON borrowing_records;
DROP POLICY IF EXISTS "Admins can update all borrowing records" ON borrowing_records;
DROP POLICY IF EXISTS "Admins can delete borrowing records" ON borrowing_records;

-- Admins can view all borrowing records
CREATE POLICY "Admins can view all borrowing records" ON borrowing_records
  FOR SELECT
  USING (is_admin());

-- Admins can update all borrowing records
CREATE POLICY "Admins can update all borrowing records" ON borrowing_records
  FOR UPDATE
  USING (is_admin());

-- Admins can delete borrowing records
CREATE POLICY "Admins can delete borrowing records" ON borrowing_records
  FOR DELETE
  USING (is_admin());

-- Step 4: Add admin policies for book_favorites
DROP POLICY IF EXISTS "Admins can view all favorites" ON book_favorites;
DROP POLICY IF EXISTS "Admins can delete any favorites" ON book_favorites;

CREATE POLICY "Admins can view all favorites" ON book_favorites
  FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can delete any favorites" ON book_favorites
  FOR DELETE
  USING (is_admin());

-- Step 5: Add admin policies for reviews
DROP POLICY IF EXISTS "Admins can update all reviews" ON reviews;
DROP POLICY IF EXISTS "Admins can delete all reviews" ON reviews;

CREATE POLICY "Admins can update all reviews" ON reviews
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete all reviews" ON reviews
  FOR DELETE
  USING (is_admin());

-- Step 6: Add admin policies for books table
DROP POLICY IF EXISTS "Admins can manage books" ON books;

CREATE POLICY "Admins can manage books" ON books
  FOR ALL
  USING (is_admin());

-- Step 7: Create a function to automatically add authenticated users to users table
-- This ensures every authenticated user has a corresponding entry in users table
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.email
    ),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users to automatically create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- Verification queries (run after applying this script)
-- =====================================================
-- SELECT * FROM users WHERE email = 'liu282207134@yahoo.co.jp';
-- SELECT is_admin(); -- Should return true if current user is admin
-- =====================================================
