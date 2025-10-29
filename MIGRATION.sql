-- Migration: Add authentication and book cover support
-- Date: 2024

-- Add cover_image_url column to books table if it doesn't exist
-- This migration assumes the books table already exists

-- Add cover_image_url column
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Optional: Create a storage bucket for book covers in Supabase
-- This needs to be done in the Supabase Dashboard:
-- 1. Go to Storage in your Supabase Dashboard
-- 2. Create a new bucket named 'book-covers'
-- 3. Set it to public access
-- 4. Configure policies if needed

-- Update RLS policies to require authentication
-- First, enable RLS on books table if not already enabled
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- Drop existing public policies if they exist
DROP POLICY IF EXISTS "Allow public read access" ON books;
DROP POLICY IF EXISTS "Allow public insert access" ON books;
DROP POLICY IF EXISTS "Allow public update access" ON books;
DROP POLICY IF EXISTS "Allow public delete access" ON books;

-- Create new policies that require authentication
CREATE POLICY "Authenticated users can read books" ON books
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert books" ON books
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update books" ON books
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete books" ON books
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Note: User authentication is handled by Supabase Auth automatically
-- Make sure to enable Email authentication in Supabase Dashboard:
-- Authentication → Providers → Email
