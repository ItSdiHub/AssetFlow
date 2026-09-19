-- ==============================================================================
-- Migration: Add email column to public.users and reload PostgREST schema cache
-- ==============================================================================
-- If your Supabase database does not yet have the 'email' column in public.users,
-- run this script in the Supabase SQL Editor.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;

-- Reload PostgREST schema cache so the API immediately recognizes the new column
NOTIFY pgrst, 'reload schema';
