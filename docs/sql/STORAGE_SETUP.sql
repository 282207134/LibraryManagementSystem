-- ====================================
-- Supabase Storage Bucket Setup
-- ====================================
-- This script creates a storage bucket for book cover images
-- and sets up the necessary storage policies.

-- Create the book-covers storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-covers', 'book-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Allow authenticated users to upload images
CREATE POLICY "Allow authenticated users to upload book covers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'book-covers');

-- Storage Policy: Allow authenticated users to update their uploaded images
CREATE POLICY "Allow authenticated users to update book covers"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'book-covers');

-- Storage Policy: Allow authenticated users to delete images
CREATE POLICY "Allow authenticated users to delete book covers"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'book-covers');

-- Storage Policy: Allow public access to read images (since bucket is public)
CREATE POLICY "Allow public to read book covers"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'book-covers');
