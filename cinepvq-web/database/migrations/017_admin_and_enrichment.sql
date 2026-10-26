-- ==============================================================================
-- 017_admin_and_enrichment.sql
-- 1. Enforce sole admin role for vanquyetp823@gmail.com
-- 2. Clean up corrupt episode names (tap-01, Tập Tập 01, etc.)
-- 3. Add movie enrichment & admin management columns
-- 4. Create platform_rankings_cache table with RLS enabled
-- ==============================================================================

-- 1. Enforce sole admin role for vanquyetp823@gmail.com
UPDATE public.users
SET role = CASE
  WHEN LOWER(email) = 'vanquyetp823@gmail.com' THEN 'admin'
  ELSE 'user'
END,
updated_at = CURRENT_TIMESTAMP
WHERE (LOWER(email) = 'vanquyetp823@gmail.com' AND role <> 'admin')
   OR (LOWER(email) <> 'vanquyetp823@gmail.com' AND role = 'admin');

-- Also store role in auth.users raw_app_meta_data for vanquyetp823@gmail.com
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE LOWER(email) = 'vanquyetp823@gmail.com';

-- Update handle_new_auth_user trigger function so vanquyetp823@gmail.com always gets 'admin'
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_user_id UUID;
  assigned_role VARCHAR(20);
BEGIN
  IF LOWER(new.email) = 'vanquyetp823@gmail.com' THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'user';
  END IF;

  SELECT id INTO existing_user_id
  FROM public.users
  WHERE LOWER(email) = LOWER(new.email);

  IF existing_user_id IS NOT NULL THEN
    UPDATE public.users
    SET
      id = new.id,
      username = COALESCE(new.raw_user_meta_data->>'username', public.users.username),
      role = assigned_role,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = existing_user_id;
  ELSE
    DECLARE
      desired_username TEXT := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
      final_username TEXT := desired_username;
      suffix INT := 1;
    BEGIN
      WHILE EXISTS (SELECT 1 FROM public.users WHERE LOWER(username) = LOWER(final_username)) LOOP
        final_username := desired_username || '_' || suffix;
        suffix := suffix + 1;
      END LOOP;

      INSERT INTO public.users (id, email, username, password_hash, role)
      VALUES (
        new.id,
        new.email,
        final_username,
        'SUPABASE_AUTH',
        assigned_role
      );
    END;
  END IF;

  RETURN new;
END;
$$;

-- Revoke public execute on SECURITY DEFINER trigger function per Supabase security best practices
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

-- 2. Normalize corrupt episode names in public.episodes
-- e.g. 'tap-01' -> 'Tập 01', 'tap-1' -> 'Tập 01', 'Tập Tập 01' -> 'Tập 01', 'Tập tap-01' -> 'Tập 01'
UPDATE public.episodes
SET
  name = CASE
    WHEN LOWER(TRIM(name)) IN ('full', 'tap-full', 'tập full', 'tap full') THEN 'Tập Full'
    WHEN TRIM(name) ~* '^(?:(?:tập|tap|episode|ep)[\s\-_:.]*)+(\d+)$' THEN
      'Tập ' || LPAD((regexp_match(TRIM(name), '^(?:(?:tập|tap|episode|ep)[\s\-_:.]*)+(\d+)$', 'i'))[1], 2, '0')
    WHEN TRIM(name) ~ '^\d+$' THEN
      'Tập ' || LPAD(TRIM(name), 2, '0')
    ELSE TRIM(name)
  END,
  episode_number = COALESCE(
    episode_number,
    CASE
      WHEN TRIM(slug) ~ '(\d+)' THEN ((regexp_match(TRIM(slug), '(\d+)'))[1])::INT
      ELSE NULL
    END
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE name ~* '^(?:tap[\s\-_]|tập\s+(?:tập|tap)|episode[\s\-_]|\d+$)';

-- 3. Add movie enrichment and admin management columns to public.movies
ALTER TABLE public.movies
  ADD COLUMN IF NOT EXISTS tmdb_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS imdb_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS douban_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS cast_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pinned_rank INT,
  ADD COLUMN IF NOT EXISTS internal_views BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_movies_is_featured ON public.movies (is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_movies_internal_views ON public.movies (internal_views DESC);

-- 4. Create platform_rankings_cache table for Trending BXH Crawler
CREATE TABLE IF NOT EXISTS public.platform_rankings_cache (
  platform VARCHAR(50) PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  subtitle VARCHAR(255),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  crawled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.platform_rankings_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_rankings_cache_select_public" ON public.platform_rankings_cache;
CREATE POLICY "platform_rankings_cache_select_public"
  ON public.platform_rankings_cache
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.platform_rankings_cache TO anon, authenticated;
