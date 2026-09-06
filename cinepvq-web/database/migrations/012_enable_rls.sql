-- ==============================================================================
-- 012_enable_rls.sql
-- Enable Row Level Security (RLS) and Define Least-Privilege Access Policies
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. User Private Data Tables (Strict Ownership Isolation)
-- ------------------------------------------------------------------------------

-- 1.1 Favorites
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS favorites_select_own ON favorites;
CREATE POLICY favorites_select_own ON favorites
    FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS favorites_insert_own ON favorites;
CREATE POLICY favorites_insert_own ON favorites
    FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS favorites_delete_own ON favorites;
CREATE POLICY favorites_delete_own ON favorites
    FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);

-- 1.2 Watch History
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS watch_history_select_own ON watch_history;
CREATE POLICY watch_history_select_own ON watch_history
    FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS watch_history_insert_own ON watch_history;
CREATE POLICY watch_history_insert_own ON watch_history
    FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS watch_history_update_own ON watch_history;
CREATE POLICY watch_history_update_own ON watch_history
    FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS watch_history_delete_own ON watch_history;
CREATE POLICY watch_history_delete_own ON watch_history
    FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);

-- 1.3 User Settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settings_select_own ON user_settings;
CREATE POLICY settings_select_own ON user_settings
    FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS settings_insert_own ON user_settings;
CREATE POLICY settings_insert_own ON user_settings
    FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS settings_update_own ON user_settings;
CREATE POLICY settings_update_own ON user_settings
    FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS settings_delete_own ON user_settings;
CREATE POLICY settings_delete_own ON user_settings
    FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);

-- 1.4 Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow reading personal notifications and broadcast/system notifications (user_id IS NULL)
DROP POLICY IF EXISTS notifications_select_own ON notifications;
CREATE POLICY notifications_select_own ON notifications
    FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS notifications_update_own ON notifications;
CREATE POLICY notifications_update_own ON notifications
    FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- 1.5 Comments (Public Read, Owner Modify)
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comments_select_public ON comments;
CREATE POLICY comments_select_public ON comments
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS comments_insert_authenticated ON comments;
CREATE POLICY comments_insert_authenticated ON comments
    FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS comments_update_own ON comments;
CREATE POLICY comments_update_own ON comments
    FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS comments_delete_own ON comments;
CREATE POLICY comments_delete_own ON comments
    FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);

-- 1.6 Core Users Table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_own ON users;
CREATE POLICY users_select_own ON users
    FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users
    FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = id)
    WITH CHECK ((select auth.uid()) = id);

-- ------------------------------------------------------------------------------
-- 2. Public Catalog Content Tables (Public Read-Only)
-- ------------------------------------------------------------------------------

ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS movies_select_public ON movies;
CREATE POLICY movies_select_public ON movies FOR SELECT TO public USING (true);

ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS genres_select_public ON genres;
CREATE POLICY genres_select_public ON genres FOR SELECT TO public USING (true);

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS countries_select_public ON countries;
CREATE POLICY countries_select_public ON countries FOR SELECT TO public USING (true);

ALTER TABLE movie_genres ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS movie_genres_select_public ON movie_genres;
CREATE POLICY movie_genres_select_public ON movie_genres FOR SELECT TO public USING (true);

ALTER TABLE movie_countries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS movie_countries_select_public ON movie_countries;
CREATE POLICY movie_countries_select_public ON movie_countries FOR SELECT TO public USING (true);

ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servers_select_public ON servers;
CREATE POLICY servers_select_public ON servers FOR SELECT TO public USING (true);

ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS episodes_select_public ON episodes;
CREATE POLICY episodes_select_public ON episodes FOR SELECT TO public USING (true);
