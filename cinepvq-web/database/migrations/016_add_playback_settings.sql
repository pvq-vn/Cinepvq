-- ==============================================================================
-- 016_add_playback_settings.sql
-- Add default playback speed and preferred source to user_settings table
-- ==============================================================================

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS playback_speed NUMERIC(3,2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS preferred_source VARCHAR(30) DEFAULT 'auto';
