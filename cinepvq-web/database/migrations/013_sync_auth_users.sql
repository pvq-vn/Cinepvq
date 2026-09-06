-- ==============================================================================
-- 013_sync_auth_users.sql
-- Synchronize Supabase GoTrue Auth (auth.users) with Application Users (public.users)
-- ==============================================================================

-- 1. Ensure foreign keys support ON UPDATE CASCADE so that transitioning
-- legacy local user IDs to Supabase Auth UUIDs preserves all user data.

ALTER TABLE favorites
  DROP CONSTRAINT IF EXISTS favorites_user_id_fkey,
  ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE watch_history
  DROP CONSTRAINT IF EXISTS watch_history_user_id_fkey,
  ADD CONSTRAINT watch_history_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE comments
  DROP CONSTRAINT IF EXISTS comments_user_id_fkey,
  ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey,
  ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE user_settings
  DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey,
  ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- 2. Trigger function to handle user creation & email linking from Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
DECLARE
  existing_user_id UUID;
BEGIN
  -- Check if a user with this email already exists in public.users
  SELECT id INTO existing_user_id
  FROM public.users
  WHERE LOWER(email) = LOWER(new.email);

  IF existing_user_id IS NOT NULL THEN
    -- Update existing user ID to match Supabase Auth UUID.
    -- Thanks to ON UPDATE CASCADE, all favorites, history, comments,
    -- notifications, and settings are smoothly migrated to new.id.
    UPDATE public.users
    SET
      id = new.id,
      username = COALESCE(new.raw_user_meta_data->>'username', public.users.username),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = existing_user_id;
  ELSE
    -- Insert a brand new record into public.users with deduplicated username
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
        'user'
      );
    END;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Register the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
