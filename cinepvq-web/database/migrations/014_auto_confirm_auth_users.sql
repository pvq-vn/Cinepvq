-- ==============================================================================
-- 014_auto_confirm_auth_users.sql
-- Automatically confirm user emails in Supabase GoTrue (auth.users)
-- Ensures seamless authentication without requiring external SMTP configuration
-- ==============================================================================

-- 1. Create or replace trigger function to auto-set email_confirmed_at on user creation
CREATE OR REPLACE FUNCTION public.auto_confirm_auth_user()
RETURNS trigger AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach BEFORE INSERT trigger on auth.users
DROP TRIGGER IF EXISTS trg_auto_confirm_auth_user ON auth.users;
CREATE TRIGGER trg_auto_confirm_auth_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_auth_user();

-- 3. Update any existing users with null confirmation to prevent login block
UPDATE auth.users
SET email_confirmed_at = CURRENT_TIMESTAMP
WHERE email_confirmed_at IS NULL;
