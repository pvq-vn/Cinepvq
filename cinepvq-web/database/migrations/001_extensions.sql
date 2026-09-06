-- ==============================================================================
-- 001_extensions.sql
-- Enables UUID and cryptographic generation functions
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
