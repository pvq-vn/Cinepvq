-- ==============================================================================
-- 003_movies.sql
-- Movies central table compatible with NguonC schema and AI enrichment
-- ==============================================================================

CREATE TABLE IF NOT EXISTS movies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    description TEXT,
    thumb_url TEXT,
    poster_url TEXT,
    year INTEGER,
    total_episodes INTEGER NOT NULL DEFAULT 0,
    current_episode VARCHAR(100),
    duration VARCHAR(100),
    quality VARCHAR(50),
    language VARCHAR(100),
    director VARCHAR(255),
    casts TEXT,
    source VARCHAR(50) NOT NULL DEFAULT 'nguonc',
    metadata_status VARCHAR(20) NOT NULL DEFAULT 'ready' CHECK (metadata_status IN ('pending', 'ready', 'enriching', 'failed')),
    ai_enriched BOOLEAN NOT NULL DEFAULT FALSE,
    ai_enriched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
