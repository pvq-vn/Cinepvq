-- ==============================================================================
-- 011_indexes.sql
-- Performance indexes for lookup, relational joins, and chronological sorting
-- ==============================================================================

-- Movies indexes
CREATE INDEX IF NOT EXISTS idx_movies_name ON movies (name);
CREATE INDEX IF NOT EXISTS idx_movies_year ON movies (year);
CREATE INDEX IF NOT EXISTS idx_movies_source ON movies (source);
CREATE INDEX IF NOT EXISTS idx_movies_metadata_status ON movies (metadata_status);

-- Relational taxonomy indexes
CREATE INDEX IF NOT EXISTS idx_movie_genres_genre_id ON movie_genres (genre_id);
CREATE INDEX IF NOT EXISTS idx_movie_countries_country_id ON movie_countries (country_id);

-- Server and episode lookup indexes
CREATE INDEX IF NOT EXISTS idx_servers_movie_id ON servers (movie_id);
CREATE INDEX IF NOT EXISTS idx_episodes_movie_id ON episodes (movie_id);
CREATE INDEX IF NOT EXISTS idx_episodes_server_id ON episodes (server_id);

-- User favorites & history indexes
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_movie_id ON favorites (movie_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_user_id ON watch_history (user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_movie_id ON watch_history (movie_id);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_movie_id ON comments (movie_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments (user_id);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id, created_at DESC);
