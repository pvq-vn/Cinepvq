-- ==============================================================================
-- 010_user_settings.sql
-- User preference settings
-- ==============================================================================

CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) NOT NULL DEFAULT 'system' CHECK (theme IN ('dark', 'light', 'system')),
    autoplay BOOLEAN NOT NULL DEFAULT TRUE,
    sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    preferred_quality VARCHAR(20) NOT NULL DEFAULT 'auto' CHECK (preferred_quality IN ('auto', 'HD', 'FHD')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
