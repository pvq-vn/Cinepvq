-- ==============================================================================
-- 015_watch_progress.sql
-- Add duration_seconds to watch_history table for enhanced progress tracking
-- ==============================================================================

ALTER TABLE watch_history
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;
